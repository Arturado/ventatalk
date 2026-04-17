"""
MercadoLibreService: sincroniza el catálogo de un vendedor ML con VentaTalk.

Autenticación: OAuth2 client_credentials con App ID + Secret Key.
El token de app se genera en cada sync — nunca expira el problema del usuario.

Flujo:
  1. POST /oauth/token (client_credentials) → access_token
  2. GET /users/{seller_id} → verificar que el vendedor existe
  3. GET /sites/{site_id}/search?seller_id=X&limit=50&offset=N → IDs + data
  4. Normalizar resultados a CatalogItem
  5. Generar embeddings
  6. Upsert en DB

Sites disponibles:
  MLC = Chile | MLA = Argentina | MLB = Brasil
  MLM = México | MLU = Uruguay | MLP = Perú | MCO = Colombia
"""

import logging
import re
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import CatalogItem
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

ML_API = "https://api.mercadolibre.com"

SITES = {
    "MLC": "Chile",
    "MLA": "Argentina",
    "MLB": "Brasil",
    "MLM": "México",
    "MLU": "Uruguay",
    "MLP": "Perú",
    "MCO": "Colombia",
}

PAGE_LIMIT = 50   # máximo que permite ML en search


class MercadoLibreService:
    def __init__(self, app_id: str, secret_key: str, seller_id: str, site_id: str = "MLC"):
        self.app_id    = app_id
        self.secret_key = secret_key
        self.seller_id  = str(seller_id).strip()
        self.site_id    = site_id.upper().strip()

    # ── Auth ─────────────────────────────────────────────────────────

    async def _get_token(self) -> str:
        """Obtiene un app-level access token via client_credentials."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{ML_API}/oauth/token",
                data={
                    "grant_type":    "client_credentials",
                    "client_id":     self.app_id,
                    "client_secret": self.secret_key,
                },
            )
        if resp.status_code == 200:
            return resp.json()["access_token"]
        if resp.status_code == 400:
            raise ValueError("App ID o Secret Key inválidos.")
        raise ValueError(f"Error autenticando con ML: {resp.status_code}")

    # ── Test connection ───────────────────────────────────────────────

    async def test_connection(self) -> dict:
        """
        Verifica credenciales y que el seller_id existe.
        Retorna info del vendedor (nickname, country, etc.).
        """
        token = await self._get_token()

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{ML_API}/users/{self.seller_id}",
                headers={"Authorization": f"Bearer {token}"},
            )

        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 404:
            raise ValueError(f"Vendedor con ID {self.seller_id} no encontrado en MercadoLibre.")
        raise ValueError(f"Error verificando vendedor: {resp.status_code}")

    # ── Fetch products ────────────────────────────────────────────────

    async def fetch_products(self, token: str) -> list[dict]:
        """
        Trae todos los ítems activos del vendedor usando paginación por offset.
        Usa la Search API que devuelve datos completos en una sola llamada por página.
        """
        products = []
        offset   = 0

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                resp = await client.get(
                    f"{ML_API}/sites/{self.site_id}/search",
                    params={
                        "seller_id": self.seller_id,
                        "limit":     PAGE_LIMIT,
                        "offset":    offset,
                    },
                    headers={"Authorization": f"Bearer {token}"},
                )

                if resp.status_code == 429:
                    import asyncio
                    logger.warning("ML rate limit — esperando 2s")
                    await asyncio.sleep(2)
                    continue

                if resp.status_code != 200:
                    logger.error(f"ML search error: {resp.status_code} {resp.text[:200]}")
                    break

                data    = resp.json()
                results = data.get("results", [])

                if not results:
                    break

                products.extend(results)
                logger.info(f"ML: página offset={offset} → {len(results)} ítems (total: {len(products)})")

                paging = data.get("paging", {})
                total  = paging.get("total", 0)
                offset += PAGE_LIMIT

                if offset >= total:
                    break

        logger.info(f"ML: {len(products)} productos obtenidos en total para seller {self.seller_id}")
        return products

    # ── Sync ─────────────────────────────────────────────────────────

    async def sync_catalog(self, db: AsyncSession, business_id: str) -> dict:
        """Sincroniza el catálogo completo del vendedor a VentaTalk."""
        stats = {"created": 0, "updated": 0, "deactivated": 0, "errors": 0}

        token        = await self._get_token()
        raw_products = await self.fetch_products(token)

        if not raw_products:
            return stats

        normalized = [self._normalize_product(p) for p in raw_products]
        normalized = [p for p in normalized if p]
        ml_ids     = {p["external_id"] for p in normalized}

        for product_data in normalized:
            try:
                await self._upsert_product(db, business_id, product_data, stats)
            except Exception as e:
                logger.error(f"Error sincronizando ML item '{product_data.get('name')}': {e}")
                stats["errors"] += 1

        # Desactivar ítems que ya no están activos en ML
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.source      == "mercadolibre",
                CatalogItem.is_available == True,
            )
        )
        for item in result.scalars().all():
            if item.external_id not in ml_ids:
                item.is_available = False
                stats["deactivated"] += 1

        await db.commit()

        logger.info(
            f"ML sync completo [{business_id}]: "
            f"+{stats['created']} nuevos, ~{stats['updated']} actualizados, "
            f"-{stats['deactivated']} desactivados, !{stats['errors']} errores"
        )
        return stats

    # ── Helpers privados ─────────────────────────────────────────────

    def _normalize_product(self, raw: dict) -> Optional[dict]:
        """Convierte el resultado de Search API al formato interno de VentaTalk."""
        try:
            name = raw.get("title", "").strip()
            if not name:
                return None

            price = self._extract_price(raw)

            # Categoría
            category = raw.get("category_id")  # ej: MLC1051
            # Usar el nombre de la categoria si viene en el resultado
            if raw.get("category", {}) and isinstance(raw.get("category"), dict):
                category = raw["category"].get("name", category)

            # Condición y atributos para descripción enriquecida
            condition   = raw.get("condition", "")          # new / used
            attributes  = self._extract_attributes(raw)

            description = self._build_description(raw, condition, attributes)

            # Imagen principal
            thumbnail = raw.get("thumbnail", "")
            image_url = thumbnail.replace("I.jpg", "O.jpg") if thumbnail else None  # versión más grande

            # URL del anuncio
            permalink = raw.get("permalink")

            embed_text = f"{name}. {description} {category or ''}".strip()

            return {
                "external_id": str(raw["id"]),
                "name":        name,
                "description": description[:500] if description else None,
                "price":       price,
                "category":    category,
                "embed_text":  embed_text,
                "image_url":   image_url,
                "url":         permalink,
                "condition":   condition,
                "currency":    raw.get("currency_id", "CLP"),
            }
        except Exception as e:
            logger.warning(f"Error normalizando ML item: {e} — id={raw.get('id')}")
            return None

    def _extract_price(self, raw: dict) -> Optional[float]:
        """Precio del ítem — usa precio de oferta si existe."""
        # sale_price tiene prioridad si está activa
        sale = raw.get("sale_price") or {}
        if isinstance(sale, dict) and sale.get("amount"):
            try:
                return float(sale["amount"])
            except (ValueError, TypeError):
                pass

        price = raw.get("price")
        if price is not None:
            try:
                return float(price)
            except (ValueError, TypeError):
                pass
        return None

    def _extract_attributes(self, raw: dict) -> str:
        """Extrae atributos relevantes (talla, color, marca, etc.) como texto."""
        attributes = raw.get("attributes", [])
        relevant   = {"BRAND", "SIZE", "COLOR", "MODEL", "MATERIAL", "GENDER"}
        parts      = []

        for attr in attributes[:8]:
            attr_id   = attr.get("id", "")
            attr_name = attr.get("name", "")
            attr_val  = attr.get("value_name", "")
            if attr_id in relevant and attr_val:
                parts.append(f"{attr_name}: {attr_val}")

        return " | ".join(parts) if parts else ""

    def _build_description(self, raw: dict, condition: str, attributes: str) -> str:
        """Construye descripción enriquecida para el embedding."""
        parts = []

        if condition == "new":
            parts.append("Nuevo")
        elif condition == "used":
            parts.append("Usado")

        if attributes:
            parts.append(attributes)

        # Envío gratis
        shipping = raw.get("shipping", {})
        if shipping.get("free_shipping"):
            parts.append("Envío gratis")

        return ". ".join(parts) if parts else ""

    async def _upsert_product(
        self, db: AsyncSession, business_id: str, data: dict, stats: dict
    ):
        """Crea o actualiza un CatalogItem en la DB."""
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.external_id == data["external_id"],
                CatalogItem.source      == "mercadolibre",
            )
        )
        existing = result.scalar_one_or_none()

        try:
            embedding = await AIService.generate_embedding(data["embed_text"])
        except Exception as e:
            logger.warning(f"Error generando embedding '{data['name']}': {e}")
            embedding = None

        metadata = {
            "url":       data.get("url"),
            "image_url": data.get("image_url"),
            "condition": data.get("condition"),
            "currency":  data.get("currency"),
        }

        if existing:
            existing.name         = data["name"]
            existing.description  = data["description"]
            existing.price        = data["price"]
            existing.category     = data["category"]
            existing.is_available = True
            existing.embedding    = embedding
            existing.metadata_    = metadata
            stats["updated"] += 1
        else:
            db.add(CatalogItem(
                business_id  = business_id,
                name         = data["name"],
                description  = data["description"],
                price        = data["price"],
                category     = data["category"],
                is_available = True,
                embedding    = embedding,
                source       = "mercadolibre",
                external_id  = data["external_id"],
                metadata_    = metadata,
            ))
            stats["created"] += 1

        await db.flush()
