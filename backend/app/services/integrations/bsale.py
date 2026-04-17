"""
BsaleService: sincroniza catálogo de Bsale con VentaTalk.

Diferencias clave vs Jumpseller:
  - Autenticación: header "access_token" (no Basic Auth)
  - Precios: NO vienen en el producto, están en /price_lists separados
  - Estructura: Producto → tiene variantes → cada variante tiene precio en lista
  - Paginación: usa offset/limit (máx 50), campo "next" indica si hay más páginas
  - Estado activo: state=0 (activo), state=1 (inactivo) — al revés de lo normal

Flujo de sync:
  1. Obtener lista de precios del negocio (elegir la principal)
  2. Paginar productos activos (state=0)
  3. Por cada producto → traer variantes con expand
  4. Por cada variante → obtener precio desde la lista de precios
  5. Upsert en catalog_items con source="bsale"
"""

import logging
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import CatalogItem
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

BSALE_API = "https://api.bsale.io/v1"
PAGE_LIMIT = 50


class BsaleService:
    def __init__(self, access_token: str):
        """
        access_token: token único por usuario/empresa obtenido desde
        Bsale Admin → Mi perfil → API Token
        O solicitado a ayuda@bsale.app para producción.
        """
        self.headers = {
            "access_token": access_token,
            "Content-Type": "application/json",
        }

    async def test_connection(self) -> dict:
        """Verifica el token obteniendo info básica de productos."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{BSALE_API}/products/count.json",
                headers=self.headers,
            )
            if resp.status_code == 200:
                count = resp.json().get("count", 0)
                return {"status": "ok", "total_products": count}
            raise ValueError(f"Token inválido: {resp.status_code} {resp.text}")

    async def get_price_lists(self) -> list[dict]:
        """Obtiene las listas de precio disponibles."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{BSALE_API}/price_lists.json",
                headers=self.headers,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            return data.get("items", [])

    async def get_all_prices(self, price_list_id: int) -> dict[str, float]:
        """
        Trae TODOS los precios de una lista de una vez (bulk).
        Mucho más eficiente que hacer una llamada por variante.
        Retorna dict: {variant_id_str: precio}
        """
        prices = {}
        offset = 0

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                resp = await client.get(
                    f"{BSALE_API}/price_lists/{price_list_id}/variant_prices.json",
                    headers=self.headers,
                    params={"limit": 50, "offset": offset},
                )
                if resp.status_code != 200:
                    logger.warning(f"Error obteniendo precios: {resp.status_code}")
                    break

                data = resp.json()
                items = data.get("items", [])
                if not items:
                    break

                for item in items:
                    variant = item.get("variant", {})
                    variant_id = str(variant.get("id", ""))
                    value = item.get("variantValue", 0)
                    if variant_id and value:
                        try:
                            prices[variant_id] = float(value)
                        except (ValueError, TypeError):
                            pass

                if not data.get("next") or len(items) < 50:
                    break
                offset += 50

        logger.info(f"Bsale: {len(prices)} precios cargados de lista {price_list_id}")
        return prices

    async def fetch_products(self, max_products: int = 500) -> list[dict]:
        """
        Trae productos activos con sus variantes.
        max_products: límite total de productos a traer (default 500).
        """
        products = []
        offset = 0

        async with httpx.AsyncClient(timeout=30) as client:
            while len(products) < max_products:
                batch_limit = min(PAGE_LIMIT, max_products - len(products))
                resp = await client.get(
                    f"{BSALE_API}/products.json",
                    headers=self.headers,
                    params={
                        "limit": batch_limit,
                        "offset": offset,
                        "state": 0,
                        "expand": "[variants]",
                    },
                )

                if resp.status_code != 200:
                    logger.error(f"Error Bsale API: {resp.status_code} {resp.text}")
                    break

                data = resp.json()
                items = data.get("items", [])

                if not items:
                    break

                products.extend(items)
                logger.info(f"Bsale: offset {offset} → {len(items)} productos (total: {len(products)})")

                if not data.get("next") or len(items) < batch_limit:
                    break

                offset += batch_limit

        logger.info(f"Bsale: {len(products)} productos obtenidos (límite: {max_products})")
        return products

    async def sync_catalog(
        self, db: AsyncSession, business_id: str,
        price_list_id: Optional[int] = None,
        max_products: int = 500,
    ) -> dict:
        """
        Sincroniza catálogo de Bsale a VentaTalk.
        max_products: cuántos productos importar (default 500).
        """
        stats = {"created": 0, "updated": 0, "deactivated": 0, "errors": 0}

        # 1. Lista de precios
        if not price_list_id:
            price_lists = await self.get_price_lists()
            if price_lists:
                price_list_id = price_lists[0].get("id")
                logger.info(f"Bsale: usando lista '{price_lists[0].get('name')}' (id: {price_list_id})")

        # 2. Traer productos con límite
        raw_products = await self.fetch_products(max_products=max_products)
        if not raw_products:
            return stats

        # 3. Cargar TODOS los precios de una vez (bulk)
        prices_map = {}
        if price_list_id:
            prices_map = await self.get_all_prices(price_list_id)
            logger.info(f"Bsale: {len(prices_map)} precios cargados")

        # 4. Procesar productos con el mapa de precios ya en memoria
        async with httpx.AsyncClient(timeout=30) as client:
            bsale_ids = set()

            for raw in raw_products:
                try:
                    normalized_list = await self._normalize_product(
                        client, raw, prices_map
                    )
                    for product_data in normalized_list:
                        bsale_ids.add(product_data["external_id"])
                        await self._upsert_product(db, business_id, product_data, stats)
                except Exception as e:
                    name = raw.get("name", "?")
                    logger.error(f"Error sincronizando '{name}': {e}")
                    stats["errors"] += 1

        # 4. Desactivar productos que ya no están en Bsale
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.source == "bsale",
                CatalogItem.is_available == True,
            )
        )
        for item in result.scalars().all():
            if item.external_id not in bsale_ids:
                item.is_available = False
                stats["deactivated"] += 1

        await db.commit()

        logger.info(
            f"Bsale sync completo: "
            f"+{stats['created']} nuevos, "
            f"~{stats['updated']} actualizados, "
            f"-{stats['deactivated']} desactivados, "
            f"!{stats['errors']} errores"
        )
        return stats

    async def _normalize_product(
        self,
        client: httpx.AsyncClient,
        raw: dict,
        prices_map: dict[str, float],
    ) -> list[dict]:
        """
        Convierte un producto Bsale en uno o más CatalogItems.

        En Bsale, cada variante puede ser un ítem del catálogo independiente
        (ej: Polera Blanca Talla S, Polera Blanca Talla M).
        Si el producto tiene una sola variante, lo tratamos como producto simple.
        """
        product_name = (raw.get("name") or "").strip()
        if not product_name:
            return []

        description = (raw.get("description") or "").strip()
        product_id = raw.get("id")

        # Obtener variantes (vienen en expand o hay que pedirlas)
        variants_node = raw.get("variants", {})
        if isinstance(variants_node, dict):
            variants = variants_node.get("items", [])
        else:
            variants = []

        # Si no hay variantes en el expand, traerlas aparte
        if not variants:
            try:
                resp = await client.get(
                    f"{BSALE_API}/products/{product_id}/variants.json",
                    headers=self.headers,
                    params={"state": 0, "limit": 50},
                )
                if resp.status_code == 200:
                    variants = resp.json().get("items", [])
            except Exception:
                pass

        # Si no hay variantes, crear un item simple con el nombre del producto
        if not variants:
            return [{
                "external_id": f"p_{product_id}",
                "name": product_name,
                "description": description or None,
                "price": None,
                "category": None,
                "embed_text": f"{product_name}. {description}".strip(),
                "sku": None,
            }]

        results = []
        single_variant = len(variants) == 1

        for variant in variants:
            variant_id = variant.get("id")
            variant_desc = (variant.get("description") or "").strip()
            sku = variant.get("code") or variant.get("barCode")

            # Nombre final del item
            if single_variant or not variant_desc or variant_desc.lower() == product_name.lower():
                name = product_name
            else:
                name = f"{product_name} — {variant_desc}"

            # Obtener precio desde el mapa (sin llamada extra)
            price = prices_map.get(str(variant_id))

            # Texto para embedding
            embed_text = f"{name}. {description} {variant_desc}".strip()

            results.append({
                "external_id": f"v_{variant_id}",
                "name": name,
                "description": description or None,
                "price": price,
                "category": None,  # Bsale tiene tipos de producto, no categorías directas
                "embed_text": embed_text,
                "sku": str(sku) if sku else None,
                "variant_description": variant_desc,
            })

        return results

    async def _upsert_product(
        self, db: AsyncSession, business_id: str, data: dict, stats: dict
    ):
        """Crea o actualiza un CatalogItem en la DB."""
        result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business_id,
                CatalogItem.external_id == data["external_id"],
                CatalogItem.source == "bsale",
            )
        )
        existing = result.scalar_one_or_none()

        # Embedding
        try:
            embedding = await AIService.generate_embedding(data["embed_text"])
        except Exception as e:
            logger.warning(f"Error embedding '{data['name']}': {e}")
            embedding = None

        metadata = {
            "sku": data.get("sku"),
            "variant_description": data.get("variant_description"),
        }

        if existing:
            existing.name = data["name"]
            existing.description = data["description"]
            existing.price = data["price"]
            existing.is_available = True
            existing.embedding = embedding
            existing.metadata_ = metadata
            stats["updated"] += 1
        else:
            item = CatalogItem(
                business_id=business_id,
                name=data["name"],
                description=data["description"],
                price=data["price"],
                category=data["category"],
                is_available=True,
                embedding=embedding,
                source="bsale",
                external_id=data["external_id"],
                metadata_=metadata,
            )
            db.add(item)
            stats["created"] += 1

        await db.flush()