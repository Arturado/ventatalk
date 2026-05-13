"""
JumpsellerService: sincroniza el catálogo de una tienda Jumpseller con VentaTalk.

Autenticación: X-LOGIN-KEY + X-AUTH-TOKEN (Basic Auth en realidad)
Base URL: https://api.jumpseller.com/v1/

Flujo:
  1. Fetch de todos los productos con paginación
  2. Normalizar a formato CatalogItem
  3. Generar embeddings para búsqueda semántica
  4. Upsert en DB (actualiza si existe, crea si no)
  5. Marcar como no disponible los que ya no están en Jumpseller
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import CatalogItem
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

JUMPSELLER_API = "https://api.jumpseller.com/v1"
PAGE_LIMIT = 50  # máx por request


class JumpsellerService:
    def __init__(self, login: str, auth_token: str):
        """
        login: el LOGIN KEY de la tienda (de la sección API del admin)
        auth_token: el AUTH TOKEN de la tienda
        """
        self.login = login
        self.auth_token = auth_token
        # Jumpseller usa Basic Auth con login:token
        self.auth = (login, auth_token)

    async def test_connection(self) -> dict:
        """Verifica credenciales y retorna info de la tienda."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{JUMPSELLER_API}/store/info.json",
                auth=self.auth,
            )
            if resp.status_code == 200:
                return resp.json()
            raise ValueError(f"Credenciales inválidas: {resp.status_code} {resp.text}")

    async def fetch_store_info(self) -> dict | None:
        """Trae info de la tienda (incluye URL del dominio). None si falla."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{JUMPSELLER_API}/store/info.json",
                    auth=self.auth,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("store", data)
        except Exception as e:
            logger.warning(f"Jumpseller: error obteniendo store info: {e}")
        return None

    async def fetch_products(self) -> list[dict]:
        """Trae todos los productos de la tienda con paginación automática."""
        products = []
        page = 1

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                resp = await client.get(
                    f"{JUMPSELLER_API}/products.json",
                    auth=self.auth,
                    params={
                        "limit": PAGE_LIMIT,
                        "page": page,
                        "status": "available",  # solo productos activos
                    },
                )

                if resp.status_code != 200:
                    logger.error(f"Error Jumpseller API: {resp.status_code} {resp.text}")
                    break

                data = resp.json()

                # Jumpseller retorna lista directa o dentro de "products"
                if isinstance(data, list):
                    batch = data
                else:
                    batch = data.get("products", [])

                if not batch:
                    break

                products.extend(batch)
                logger.info(f"Jumpseller: página {page} → {len(batch)} productos")

                # Si vino menos del límite, no hay más páginas
                if len(batch) < PAGE_LIMIT:
                    break

                page += 1

        logger.info(f"Jumpseller: total {len(products)} productos obtenidos")
        return products

    async def fetch_product_detail(self, product_id: int | str) -> dict | None:
        """Trae el detalle individual de un producto (incluye permalink). None si falla."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{JUMPSELLER_API}/products/{product_id}.json",
                    auth=self.auth,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("product", data)
        except Exception as e:
            logger.warning(f"Jumpseller: error obteniendo detalle producto {product_id}: {e}")
        return None

    async def detect_url_prefix(self, shop_url: str, sample_permalink: str) -> str:
        """
        Detecta el prefix de URL que usa esta tienda Jumpseller probando con HEAD requests.
        Retorna '/products/' o '/' según cuál responda 200. Fallback: '/products/'.

        Solo se llama si no hay prefix cacheado. Una vez detectado, debe guardarse
        en integrations.jumpseller.url_prefix para futuros syncs.
        """
        if not shop_url or not sample_permalink:
            return "/products/"

        shop_url = shop_url.rstrip("/")
        candidates = ["/products/", "/"]

        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            for prefix in candidates:
                url = f"{shop_url}{prefix}{sample_permalink}"
                try:
                    resp = await client.head(url)
                    if resp.status_code == 200:
                        logger.info(f"Jumpseller: prefix detectado = '{prefix}' (URL: {url})")
                        return prefix
                except Exception as e:
                    logger.debug(f"Jumpseller: error probando '{url}': {e}")
                    continue

        logger.warning(f"Jumpseller: no se detectó prefix para {shop_url}, usando default '/products/'")
        return "/products/"

    async def sync_catalog(
        self,
        db: AsyncSession,
        business_id: str,
        cached_url_prefix: str | None = None,
    ) -> dict:
        """
        Sincroniza el catálogo completo de Jumpseller a la DB de VentaTalk.
        Retorna estadísticas del sync.
        """
        stats = {"created": 0, "updated": 0, "deactivated": 0, "errors": 0}

        # 1. Traer productos de Jumpseller
        raw_products = await self.fetch_products()
        if not raw_products:
            return stats

        # 2. Resolver shop_url una vez para todo el sync
        store_info = await self.fetch_store_info()
        shop_url = (store_info or {}).get("url", "").rstrip("/") if store_info else None
        if not shop_url:
            logger.warning("Jumpseller: shop_url no disponible, product_url quedará null")

        # Pre-fetch detalles de todos los productos para tener permalinks
        product_details: dict[int | str, str] = {}
        for p in raw_products:
            raw = p.get("product", p)
            product_id = raw.get("id")
            if shop_url and product_id:
                detail = await self.fetch_product_detail(product_id)
                if detail and detail.get("permalink"):
                    product_details[product_id] = detail["permalink"]

        # Resolver prefix (cacheado o detectado)
        url_prefix = cached_url_prefix
        if url_prefix is None and shop_url and product_details:
            first_permalink = next(iter(product_details.values()))
            url_prefix = await self.detect_url_prefix(shop_url, first_permalink)
        elif url_prefix is None:
            url_prefix = "/products/"

        # Normalizar con product_url completo
        normalized = []
        for p in raw_products:
            raw = p.get("product", p)
            product_id = raw.get("id")
            permalink = product_details.get(product_id)
            product_url = f"{shop_url}{url_prefix}{permalink}" if shop_url and permalink else None
            n = self._normalize_product(p, product_url=product_url)
            if n:
                normalized.append(n)

        # Exponer el prefix detectado para que el caller lo guarde
        stats["_url_prefix"] = url_prefix

        # 3. IDs actuales en Jumpseller
        jumpseller_ids = {p["external_id"] for p in normalized}

        # 4. Upsert cada producto
        for product_data in normalized:
            try:
                await self._upsert_product(db, business_id, product_data, stats)
            except Exception as e:
                logger.error(f"Error sincronizando producto {product_data.get('name')}: {e}")
                stats["errors"] += 1

        # 5. Desactivar productos que ya no existen en Jumpseller
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.source == "jumpseller",
                CatalogItem.is_available == True,
            )
        )
        existing = result.scalars().all()

        for item in existing:
            if item.external_id not in jumpseller_ids:
                item.is_available = False
                stats["deactivated"] += 1

        await db.commit()

        logger.info(
            f"Jumpseller sync completo: "
            f"+{stats['created']} nuevos, "
            f"~{stats['updated']} actualizados, "
            f"-{stats['deactivated']} desactivados, "
            f"!{stats['errors']} errores"
        )
        return stats

    def _normalize_product(self, raw: dict, product_url: str | None = None) -> Optional[dict]:
        """Convierte el formato Jumpseller al formato interno de VentaTalk."""
        try:
            product = raw.get("product", raw)  # a veces viene anidado

            name = product.get("name", "").strip()
            if not name:
                return None

            # Precio: tomar el más bajo entre variantes
            price = self._extract_price(product)

            # Descripción: limpiar HTML básico
            description = self._clean_html(product.get("description", "") or "")

            # Categorías
            categories = product.get("categories", [])
            category = categories[0].get("name") if categories else None

            # Variantes para descripción enriquecida
            variants_info = self._extract_variants_info(product)

            # Texto completo para embedding
            embed_text = f"{name}. {description} {variants_info} {category or ''}".strip()

            return {
                "external_id": str(product.get("id")),
                "name": name,
                "description": description[:500] if description else None,
                "price": price,
                "category": category,
                "variants_info": variants_info,
                "embed_text": embed_text,
                "stock": product.get("stock", 0),
                "sku": product.get("sku"),
                "url": product.get("url"),
                "product_url": product_url,
            }
        except Exception as e:
            logger.warning(f"Error normalizando producto: {e} — {raw}")
            return None

    def _extract_price(self, product: dict) -> Optional[float]:
        """Extrae el precio más bajo del producto o sus variantes."""
        # Precio directo del producto
        if product.get("price"):
            try:
                return float(product["price"])
            except (ValueError, TypeError):
                pass

        # Precio desde variantes
        variants = product.get("variants", [])
        prices = []
        for v in variants:
            variant = v.get("variant", v)
            price = variant.get("price")
            if price:
                try:
                    prices.append(float(price))
                except (ValueError, TypeError):
                    pass

        return min(prices) if prices else None

    def _extract_variants_info(self, product: dict) -> str:
        """Genera texto legible de variantes para incluir en el embedding."""
        variants = product.get("variants", [])
        if not variants:
            return ""

        info_parts = []
        for v in variants[:5]:  # máx 5 variantes en el texto
            variant = v.get("variant", v)
            parts = []
            if variant.get("option1"):
                parts.append(variant["option1"])
            if variant.get("option2"):
                parts.append(variant["option2"])
            if variant.get("price"):
                parts.append(f"${float(variant['price']):,.0f}")
            if parts:
                info_parts.append(" - ".join(parts))

        return "Variantes: " + ", ".join(info_parts) if info_parts else ""

    def _clean_html(self, text: str) -> str:
        """Limpia HTML básico de la descripción."""
        import re
        # Remover tags HTML
        clean = re.sub(r"<[^>]+>", " ", text)
        # Normalizar espacios
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean[:1000]  # máx 1000 chars

    async def _upsert_product(
        self, db: AsyncSession, business_id: str, data: dict, stats: dict
    ):
        """Crea o actualiza un producto en la DB."""
        # Buscar si ya existe
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.external_id == data["external_id"],
                CatalogItem.source == "jumpseller",
            )
        )
        existing = result.scalar_one_or_none()

        # Generar embedding
        try:
            embedding = await AIService.generate_embedding(data["embed_text"])
        except Exception as e:
            logger.warning(f"Error generando embedding para '{data['name']}': {e}")
            embedding = None

        if existing:
            # Actualizar
            existing.name = data["name"]
            existing.description = data["description"]
            existing.price = data["price"]
            existing.category = data["category"]
            existing.is_available = True
            existing.embedding = embedding
            existing.product_url = data.get("product_url")
            existing.metadata_ = {
                "sku": data.get("sku"),
                "url": data.get("url"),
                "stock": data.get("stock"),
                "variants_info": data.get("variants_info"),
            }
            stats["updated"] += 1
        else:
            # Crear nuevo
            item = CatalogItem(
                business_id=business_id,
                name=data["name"],
                description=data["description"],
                price=data["price"],
                category=data["category"],
                is_available=True,
                embedding=embedding,
                source="jumpseller",
                external_id=data["external_id"],
                product_url=data.get("product_url"),
                metadata_={
                    "sku": data.get("sku"),
                    "url": data.get("url"),
                    "stock": data.get("stock"),
                    "variants_info": data.get("variants_info"),
                },
            )
            db.add(item)
            stats["created"] += 1

        await db.flush()