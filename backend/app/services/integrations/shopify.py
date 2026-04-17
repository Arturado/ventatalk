"""
ShopifyService: sincroniza el catálogo de una tienda Shopify con VentaTalk.

Autenticación: Admin API Access Token (X-Shopify-Access-Token header)
Base URL: https://{shop}.myshopify.com/admin/api/2024-01/

Flujo:
  1. Fetch de todos los productos con paginación cursor-based (Link header)
  2. Por cada producto, expandir variantes para precio mínimo
  3. Normalizar a formato CatalogItem
  4. Generar embeddings para búsqueda semántica
  5. Upsert en DB (actualiza si existe, crea si no)
  6. Marcar como no disponible los que ya no están en Shopify

Compatible con todos los planes (Basic, Shopify, Advanced, Plus).
Rate limits: Basic=2req/s, Plus=4req/s — manejado con reintentos automáticos.
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

SHOPIFY_API_VERSION = "2024-01"
PAGE_LIMIT = 250  # máximo permitido por Shopify


class ShopifyService:
    def __init__(self, shop: str, access_token: str):
        """
        shop: dominio de la tienda, ej: 'mitienda.myshopify.com' o 'mitienda'
        access_token: Admin API Access Token generado en Shopify Admin → Apps
        """
        # Normalizar el dominio — aceptar con o sin .myshopify.com
        shop = shop.strip().lower()
        shop = re.sub(r"^https?://", "", shop).rstrip("/")
        if not shop.endswith(".myshopify.com"):
            shop = f"{shop}.myshopify.com"

        self.shop         = shop
        self.access_token = access_token
        self.base_url     = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}"
        self.headers      = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        }

    async def test_connection(self) -> dict:
        """Verifica credenciales y retorna info de la tienda."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base_url}/shop.json",
                headers=self.headers,
            )
            if resp.status_code == 200:
                return resp.json().get("shop", {})
            if resp.status_code == 401:
                raise ValueError("Access token inválido o sin permisos.")
            if resp.status_code == 404:
                raise ValueError(f"Tienda no encontrada: {self.shop}")
            raise ValueError(f"Error conectando con Shopify: {resp.status_code}")

    async def fetch_products(self) -> list[dict]:
        """
        Trae todos los productos usando paginación cursor-based de Shopify.
        Shopify usa el header Link con rel='next' para paginar.
        """
        products = []
        url      = f"{self.base_url}/products.json"
        params   = {"limit": PAGE_LIMIT, "status": "active"}

        async with httpx.AsyncClient(timeout=30) as client:
            while url:
                resp = await client.get(url, headers=self.headers, params=params)

                if resp.status_code == 429:
                    # Rate limit — Shopify pide esperar
                    import asyncio
                    retry_after = float(resp.headers.get("Retry-After", "2"))
                    logger.warning(f"Shopify rate limit — esperando {retry_after}s")
                    await asyncio.sleep(retry_after)
                    continue

                if resp.status_code != 200:
                    logger.error(f"Shopify API error: {resp.status_code} {resp.text[:200]}")
                    break

                batch = resp.json().get("products", [])
                products.extend(batch)
                logger.info(f"Shopify: {len(batch)} productos en esta página (total: {len(products)})")

                # Cursor-based pagination via Link header
                url    = self._parse_next_link(resp.headers.get("Link", ""))
                params = {}  # el cursor ya va en la URL del Link

        logger.info(f"Shopify: {len(products)} productos obtenidos en total")
        return products

    async def sync_catalog(self, db: AsyncSession, business_id: str) -> dict:
        """
        Sincroniza el catálogo completo de Shopify a la DB de VentaTalk.
        Retorna estadísticas del sync.
        """
        stats = {"created": 0, "updated": 0, "deactivated": 0, "errors": 0}

        raw_products = await self.fetch_products()
        if not raw_products:
            return stats

        normalized   = [self._normalize_product(p) for p in raw_products]
        normalized   = [p for p in normalized if p]
        shopify_ids  = {p["external_id"] for p in normalized}

        for product_data in normalized:
            try:
                await self._upsert_product(db, business_id, product_data, stats)
            except Exception as e:
                logger.error(f"Error sincronizando producto Shopify '{product_data.get('name')}': {e}")
                stats["errors"] += 1

        # Desactivar productos que ya no existen en Shopify
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.source == "shopify",
                CatalogItem.is_available == True,
            )
        )
        for item in result.scalars().all():
            if item.external_id not in shopify_ids:
                item.is_available = False
                stats["deactivated"] += 1

        await db.commit()

        logger.info(
            f"Shopify sync completo [{business_id}]: "
            f"+{stats['created']} nuevos, ~{stats['updated']} actualizados, "
            f"-{stats['deactivated']} desactivados, !{stats['errors']} errores"
        )
        return stats

    # ── Helpers privados ─────────────────────────────────────────────

    def _normalize_product(self, raw: dict) -> Optional[dict]:
        """Convierte el formato Shopify al formato interno de VentaTalk."""
        try:
            name = raw.get("title", "").strip()
            if not name:
                return None

            # Precio mínimo entre variantes
            price = self._extract_price(raw)

            # Descripción: limpiar HTML
            description = self._clean_html(raw.get("body_html", "") or "")

            # Categoría: product_type es el campo más limpio de Shopify
            category = raw.get("product_type") or raw.get("vendor") or None

            # Imagen principal
            image_url = None
            images = raw.get("images", [])
            if images:
                image_url = images[0].get("src")

            # Handle/URL de la tienda
            handle  = raw.get("handle", "")
            shop_url = f"https://{self.shop}/products/{handle}" if handle else None

            # Info de variantes para el embedding
            variants_info = self._extract_variants_info(raw)

            embed_text = f"{name}. {description} {variants_info} {category or ''}".strip()

            return {
                "external_id":   str(raw["id"]),
                "name":          name,
                "description":   description[:500] if description else None,
                "price":         price,
                "category":      category,
                "variants_info": variants_info,
                "embed_text":    embed_text,
                "image_url":     image_url,
                "url":           shop_url,
                "vendor":        raw.get("vendor"),
                "tags":          raw.get("tags", ""),
            }
        except Exception as e:
            logger.warning(f"Error normalizando producto Shopify: {e} — id={raw.get('id')}")
            return None

    def _extract_price(self, product: dict) -> Optional[float]:
        """Precio mínimo entre todas las variantes del producto."""
        variants = product.get("variants", [])
        prices   = []
        for v in variants:
            p = v.get("price")
            if p:
                try:
                    prices.append(float(p))
                except (ValueError, TypeError):
                    pass
        return min(prices) if prices else None

    def _extract_variants_info(self, product: dict) -> str:
        """Genera texto legible con variantes (talla, color, precio)."""
        variants = product.get("variants", [])
        if not variants or (len(variants) == 1 and not variants[0].get("title", "").strip("Default Title")):
            return ""

        parts = []
        for v in variants[:6]:
            title = v.get("title", "")
            if title and title != "Default Title":
                price = v.get("price")
                entry = title
                if price:
                    entry += f" (${float(price):,.0f})"
                parts.append(entry)

        return "Variantes: " + ", ".join(parts) if parts else ""

    def _clean_html(self, text: str) -> str:
        """Elimina tags HTML y normaliza espacios."""
        clean = re.sub(r"<[^>]+>", " ", text)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean[:1000]

    def _parse_next_link(self, link_header: str) -> Optional[str]:
        """
        Parsea el header Link de Shopify para obtener la URL de la próxima página.
        Formato: <https://...?page_info=xxx>; rel="next"
        """
        if not link_header:
            return None
        for part in link_header.split(","):
            part = part.strip()
            if 'rel="next"' in part:
                match = re.search(r"<([^>]+)>", part)
                if match:
                    return match.group(1)
        return None

    async def _upsert_product(
        self, db: AsyncSession, business_id: str, data: dict, stats: dict
    ):
        """Crea o actualiza un CatalogItem en la DB."""
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.external_id == data["external_id"],
                CatalogItem.source == "shopify",
            )
        )
        existing = result.scalar_one_or_none()

        try:
            embedding = await AIService.generate_embedding(data["embed_text"])
        except Exception as e:
            logger.warning(f"Error generando embedding '{data['name']}': {e}")
            embedding = None

        metadata = {
            "url":           data.get("url"),
            "image_url":     data.get("image_url"),
            "vendor":        data.get("vendor"),
            "tags":          data.get("tags"),
            "variants_info": data.get("variants_info"),
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
                source       = "shopify",
                external_id  = data["external_id"],
                metadata_    = metadata,
            ))
            stats["created"] += 1

        await db.flush()
