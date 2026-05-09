"""
Endpoint para gestionar integraciones de catálogo externas.
Jumpseller, Bsale, WooCommerce (inbound). Próximamente: Shopify.

Seguridad:
  - Tokens de salida (Jumpseller/Bsale) encriptados con Fernet antes de guardar en DB
  - Token de entrada WooCommerce guardado como SHA-256 hash — nunca en texto plano
  - Frontend nunca recibe tokens completos — solo últimos 8 chars enmascarados
  - Desencriptación solo en background tasks para llamadas a APIs externas
"""
import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.encryption import decrypt_token, encrypt_token, mask_token
from app.core.security import get_current_business
from app.models.models import Business, CatalogItem
from app.services.integrations.jumpseller import JumpsellerService
from app.services.integrations.bsale import BsaleService
from app.services.integrations.shopify import ShopifyService
from app.services.integrations.mercadolibre import MercadoLibreService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["integrations"])


# ── Schemas ───────────────────────────────────────────────────────────

class JumpsellerConnectRequest(BaseModel):
    login: str
    auth_token: str


class BsaleConnectRequest(BaseModel):
    access_token: str
    price_list_id: Optional[int] = None


class IntegrationStatus(BaseModel):
    provider: str
    connected: bool
    last_sync_at: Optional[str]
    products_synced: int
    store_name: Optional[str]
    token_hint: Optional[str] = None  # últimos 4 chars enmascarados


class SyncResult(BaseModel):
    created: int
    updated: int
    deactivated: int
    errors: int
    message: str


class BsaleSyncRequest(BaseModel):
    max_products: int = 500


class ShopifyConnectRequest(BaseModel):
    shop: str
    access_token: str


class MLConnectRequest(BaseModel):
    app_id:     str
    secret_key: str
    seller_id:  str
    site_id:    str = "MLC"   # MLC=Chile, MLA=Argentina, MLB=Brasil, MLM=México


# ── WooCommerce ───────────────────────────────────────────────────────

class WooCommerceTokenResponse(BaseModel):
    token: str          # Token completo — solo en la respuesta de generación
    hint: str           # Últimos 8 chars para mostrar después


class WooCommerceStatus(BaseModel):
    connected: bool
    hint: Optional[str]
    products_synced: int
    last_sync_at: Optional[str]
    store_url: Optional[str]


class WooCommerceProduct(BaseModel):
    external_id: str
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    is_available: bool = True
    stock_quantity: Optional[int] = None
    sku: Optional[str] = None


class WooCommerceIngestRequest(BaseModel):
    products: List[WooCommerceProduct]
    store_url: Optional[str] = None


# ── JUMPSELLER ────────────────────────────────────────────────────────

@router.post("/jumpseller/connect", response_model=IntegrationStatus)
async def connect_jumpseller(
    body: JumpsellerConnectRequest,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Conecta o actualiza credenciales de Jumpseller. Encripta el token antes de guardar."""
    js = JumpsellerService(login=body.login, auth_token=body.auth_token)

    try:
        store_info = await js.test_connection()
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error conectando con Jumpseller: {e}")

    store_name = store_info.get("store", {}).get("name") or "Tienda Jumpseller"

    if not business.integrations:
        business.integrations = {}

    # Preservar last_sync_at y products_synced si ya existía
    existing = business.integrations.get("jumpseller", {})

    business.integrations["jumpseller"] = {
        "login": body.login,                        # login no es tan sensible
        "auth_token": encrypt_token(body.auth_token),  # ← encriptado
        "store_name": store_name,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "last_sync_at": existing.get("last_sync_at"),
        "products_synced": existing.get("products_synced", 0),
    }

    flag_modified(business, "integrations")
    await db.commit()

    return IntegrationStatus(
        provider="jumpseller",
        connected=True,
        last_sync_at=existing.get("last_sync_at"),
        products_synced=existing.get("products_synced", 0),
        store_name=store_name,
        token_hint=mask_token(encrypt_token(body.auth_token)),
    )


@router.post("/jumpseller/sync", response_model=SyncResult)
async def sync_jumpseller(
    background_tasks: BackgroundTasks,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    config = (business.integrations or {}).get("jumpseller")
    if not config:
        raise HTTPException(400, "Jumpseller no está conectado.")

    background_tasks.add_task(
        _run_jumpseller_sync,
        business_id=str(business.id),
        login=config["login"],
        auth_token_encrypted=config["auth_token"],
    )

    return SyncResult(
        created=0, updated=0, deactivated=0, errors=0,
        message="Sincronización iniciada. Puede tardar 1-2 minutos."
    )


@router.get("/jumpseller/status", response_model=IntegrationStatus)
async def jumpseller_status(business: Business = Depends(get_current_business)):
    config = (business.integrations or {}).get("jumpseller")
    if not config:
        return IntegrationStatus(provider="jumpseller", connected=False,
            last_sync_at=None, products_synced=0, store_name=None)

    return IntegrationStatus(
        provider="jumpseller",
        connected=True,
        last_sync_at=config.get("last_sync_at"),
        products_synced=config.get("products_synced", 0),
        store_name=config.get("store_name"),
        token_hint=mask_token(config.get("auth_token", "")),
    )


@router.delete("/jumpseller/disconnect", status_code=204)
async def disconnect_jumpseller(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    if business.integrations:
        business.integrations.pop("jumpseller", None)
        flag_modified(business, "integrations")
    await db.commit()


# ── BSALE ─────────────────────────────────────────────────────────────

@router.post("/bsale/connect", response_model=IntegrationStatus)
async def connect_bsale(
    body: BsaleConnectRequest,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Conecta o actualiza credenciales de Bsale. Encripta el token antes de guardar."""
    bs = BsaleService(access_token=body.access_token)

    try:
        info = await bs.test_connection()
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error conectando con Bsale: {e}")

    price_lists = await bs.get_price_lists()
    selected_price_list_id = body.price_list_id
    selected_price_list_name = None

    if price_lists:
        if not selected_price_list_id:
            selected_price_list_id = price_lists[0].get("id")
            selected_price_list_name = price_lists[0].get("name")
        else:
            match = next((p for p in price_lists if str(p.get("id")) == str(selected_price_list_id)), None)
            selected_price_list_name = match.get("name") if match else None

    if not business.integrations:
        business.integrations = {}

    existing = business.integrations.get("bsale", {})

    business.integrations["bsale"] = {
        "access_token": encrypt_token(body.access_token),  # ← encriptado
        "price_list_id": selected_price_list_id,
        "price_list_name": selected_price_list_name,
        "price_lists_available": [{"id": p.get("id"), "name": p.get("name")} for p in price_lists],
        "total_products": info.get("total_products", 0),
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "last_sync_at": existing.get("last_sync_at"),
        "products_synced": existing.get("products_synced", 0),
    }

    flag_modified(business, "integrations")
    await db.commit()

    return IntegrationStatus(
        provider="bsale",
        connected=True,
        last_sync_at=existing.get("last_sync_at"),
        products_synced=existing.get("products_synced", 0),
        store_name=f"Bsale — {info.get('total_products', 0)} productos disponibles",
        token_hint=mask_token(encrypt_token(body.access_token)),
    )


@router.post("/bsale/sync", response_model=SyncResult)
async def sync_bsale(
    background_tasks: BackgroundTasks,
    body: BsaleSyncRequest = BsaleSyncRequest(),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    config = (business.integrations or {}).get("bsale")
    if not config:
        raise HTTPException(400, "Bsale no está conectado.")

    background_tasks.add_task(
        _run_bsale_sync,
        business_id=str(business.id),
        access_token_encrypted=config["access_token"],
        price_list_id=config.get("price_list_id"),
        max_products=body.max_products,
    )

    return SyncResult(
        created=0, updated=0, deactivated=0, errors=0,
        message=f"Sincronización Bsale iniciada (límite: {body.max_products} productos)."
    )


@router.get("/bsale/status", response_model=IntegrationStatus)
async def bsale_status(business: Business = Depends(get_current_business)):
    config = (business.integrations or {}).get("bsale")
    if not config:
        return IntegrationStatus(provider="bsale", connected=False,
            last_sync_at=None, products_synced=0, store_name=None)

    return IntegrationStatus(
        provider="bsale",
        connected=True,
        last_sync_at=config.get("last_sync_at"),
        products_synced=config.get("products_synced", 0),
        store_name=f"Bsale ({config.get('price_list_name', 'lista default')})",
        token_hint=mask_token(config.get("access_token", "")),
    )


@router.get("/bsale/price-lists")
async def bsale_price_lists(business: Business = Depends(get_current_business)):
    config = (business.integrations or {}).get("bsale")
    if not config:
        raise HTTPException(400, "Bsale no está conectado.")
    return config.get("price_lists_available", [])


@router.delete("/bsale/disconnect", status_code=204)
async def disconnect_bsale(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    if business.integrations:
        business.integrations.pop("bsale", None)
        flag_modified(business, "integrations")
    await db.commit()


# ── SHOPIFY ───────────────────────────────────────────────────────────

@router.post("/shopify/connect", response_model=IntegrationStatus)
async def connect_shopify(
    body: ShopifyConnectRequest,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Conecta o actualiza credenciales de Shopify. Verifica la tienda antes de guardar."""
    svc = ShopifyService(shop=body.shop, access_token=body.access_token)

    try:
        shop_info = await svc.test_connection()
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error conectando con Shopify: {e}")

    store_name = shop_info.get("name") or svc.shop

    if not business.integrations:
        business.integrations = {}

    existing = business.integrations.get("shopify", {})

    business.integrations["shopify"] = {
        "shop":            svc.shop,
        "access_token":    encrypt_token(body.access_token),
        "store_name":      store_name,
        "currency":        shop_info.get("currency"),
        "connected_at":    datetime.now(timezone.utc).isoformat(),
        "last_sync_at":    existing.get("last_sync_at"),
        "products_synced": existing.get("products_synced", 0),
    }

    flag_modified(business, "integrations")
    await db.commit()

    return IntegrationStatus(
        provider="shopify",
        connected=True,
        last_sync_at=existing.get("last_sync_at"),
        products_synced=existing.get("products_synced", 0),
        store_name=store_name,
        token_hint=mask_token(encrypt_token(body.access_token)),
    )


@router.get("/shopify/status", response_model=IntegrationStatus)
async def shopify_status(business: Business = Depends(get_current_business)):
    config = (business.integrations or {}).get("shopify")
    if not config:
        return IntegrationStatus(
            provider="shopify", connected=False,
            last_sync_at=None, products_synced=0, store_name=None,
        )
    return IntegrationStatus(
        provider="shopify",
        connected=True,
        last_sync_at=config.get("last_sync_at"),
        products_synced=config.get("products_synced", 0),
        store_name=config.get("store_name"),
        token_hint=mask_token(config.get("access_token", "")),
    )


@router.post("/shopify/sync", response_model=SyncResult)
async def sync_shopify(
    background_tasks: BackgroundTasks,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    config = (business.integrations or {}).get("shopify")
    if not config:
        raise HTTPException(400, "Shopify no está conectado.")

    background_tasks.add_task(
        _run_shopify_sync,
        business_id=str(business.id),
        shop=config["shop"],
        access_token_encrypted=config["access_token"],
    )

    return SyncResult(
        created=0, updated=0, deactivated=0, errors=0,
        message="Sincronización Shopify iniciada. Puede tardar 1-3 minutos según el tamaño del catálogo.",
    )


@router.delete("/shopify/disconnect", status_code=204)
async def disconnect_shopify(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    if business.integrations:
        business.integrations.pop("shopify", None)
        flag_modified(business, "integrations")
    await db.commit()


# ── MERCADOLIBRE ──────────────────────────────────────────────────────

@router.post("/mercadolibre/connect", response_model=IntegrationStatus)
async def connect_mercadolibre(
    body: MLConnectRequest,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Conecta MercadoLibre verificando App ID + Secret Key + Seller ID."""
    svc = MercadoLibreService(
        app_id=body.app_id,
        secret_key=body.secret_key,
        seller_id=body.seller_id,
        site_id=body.site_id,
    )

    try:
        seller_info = await svc.test_connection()
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error conectando con MercadoLibre: {e}")

    store_name = seller_info.get("nickname") or f"Vendedor {body.seller_id}"

    if not business.integrations:
        business.integrations = {}

    existing = business.integrations.get("mercadolibre", {})

    business.integrations["mercadolibre"] = {
        "app_id":          body.app_id,
        "secret_key":      encrypt_token(body.secret_key),
        "seller_id":       body.seller_id,
        "site_id":         body.site_id.upper(),
        "store_name":      store_name,
        "connected_at":    datetime.now(timezone.utc).isoformat(),
        "last_sync_at":    existing.get("last_sync_at"),
        "products_synced": existing.get("products_synced", 0),
    }

    flag_modified(business, "integrations")
    await db.commit()

    return IntegrationStatus(
        provider="mercadolibre",
        connected=True,
        last_sync_at=existing.get("last_sync_at"),
        products_synced=existing.get("products_synced", 0),
        store_name=f"{store_name} ({body.site_id.upper()})",
        token_hint=mask_token(encrypt_token(body.secret_key)),
    )


@router.get("/mercadolibre/status", response_model=IntegrationStatus)
async def mercadolibre_status(business: Business = Depends(get_current_business)):
    config = (business.integrations or {}).get("mercadolibre")
    if not config:
        return IntegrationStatus(
            provider="mercadolibre", connected=False,
            last_sync_at=None, products_synced=0, store_name=None,
        )
    return IntegrationStatus(
        provider="mercadolibre",
        connected=True,
        last_sync_at=config.get("last_sync_at"),
        products_synced=config.get("products_synced", 0),
        store_name=f"{config.get('store_name')} ({config.get('site_id', 'MLC')})",
        token_hint=mask_token(config.get("secret_key", "")),
    )


@router.post("/mercadolibre/sync", response_model=SyncResult)
async def sync_mercadolibre(
    background_tasks: BackgroundTasks,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    config = (business.integrations or {}).get("mercadolibre")
    if not config:
        raise HTTPException(400, "MercadoLibre no está conectado.")

    background_tasks.add_task(
        _run_ml_sync,
        business_id=str(business.id),
        app_id=config["app_id"],
        secret_key_encrypted=config["secret_key"],
        seller_id=config["seller_id"],
        site_id=config.get("site_id", "MLC"),
    )

    return SyncResult(
        created=0, updated=0, deactivated=0, errors=0,
        message="Sincronización MercadoLibre iniciada. Puede tardar 1-3 minutos.",
    )


@router.delete("/mercadolibre/disconnect", status_code=204)
async def disconnect_mercadolibre(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    if business.integrations:
        business.integrations.pop("mercadolibre", None)
        flag_modified(business, "integrations")
    await db.commit()


# ── WOOCOMMERCE (inbound — el plugin WP empuja al servidor) ───────────

def _hash_token(plain: str) -> str:
    """SHA-256 hex del token para lookup seguro sin guardar texto plano."""
    return hashlib.sha256(plain.encode()).hexdigest()


@router.post("/woocommerce/token", response_model=WooCommerceTokenResponse)
async def generate_woocommerce_token(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera (o regenera) el token de API para el plugin de WordPress/WooCommerce.
    El token completo se devuelve UNA SOLA VEZ — después solo se muestra el hint.
    """
    plain_token = "vt_wc_" + secrets.token_hex(24)   # 48 hex chars → 54 total
    token_hash  = _hash_token(plain_token)
    hint        = f"...{plain_token[-8:]}"

    if not business.integrations:
        business.integrations = {}

    existing = business.integrations.get("woocommerce", {})

    business.integrations["woocommerce"] = {
        "token_hash":      token_hash,
        "hint":            hint,
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "last_sync_at":    existing.get("last_sync_at"),
        "products_synced": existing.get("products_synced", 0),
        "store_url":       existing.get("store_url"),
    }

    flag_modified(business, "integrations")
    await db.commit()

    return WooCommerceTokenResponse(token=plain_token, hint=hint)


@router.get("/woocommerce/status", response_model=WooCommerceStatus)
async def woocommerce_status(business: Business = Depends(get_current_business)):
    config = (business.integrations or {}).get("woocommerce")
    if not config:
        return WooCommerceStatus(
            connected=False, hint=None, products_synced=0,
            last_sync_at=None, store_url=None,
        )
    return WooCommerceStatus(
        connected=True,
        hint=config.get("hint"),
        products_synced=config.get("products_synced", 0),
        last_sync_at=config.get("last_sync_at"),
        store_url=config.get("store_url"),
    )


@router.post("/woocommerce/ingest", status_code=200)
async def woocommerce_ingest(
    body: WooCommerceIngestRequest,
    background_tasks: BackgroundTasks,
    x_ventatalk_token: str = Header(..., alias="X-VentaTalk-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint público — autenticado solo con X-VentaTalk-Token.
    El plugin de WP/WooCommerce llama aquí para sincronizar el catálogo.
    Hace upsert de productos: crea nuevos, actualiza existentes.
    """
    # 1. Buscar el negocio por token_hash
    token_hash = _hash_token(x_ventatalk_token)
    result = await db.execute(
        select(Business).where(
            text("integrations->'woocommerce'->>'token_hash' = :hash")
        ).params(hash=token_hash)
    )
    business = result.scalar_one_or_none()

    if not business:
        raise HTTPException(status_code=401, detail="Token inválido o no reconocido.")

    business_id = str(business.id)
    now = datetime.now(timezone.utc)

    # 2. Upsert productos
    created = updated = 0

    for prod in body.products:
        # Buscar si ya existe por external_id + source
        existing_result = await db.execute(
            select(CatalogItem).where(
                CatalogItem.business_id == business.id,
                CatalogItem.source == "woocommerce",
                CatalogItem.external_id == prod.external_id,
            )
        )
        item = existing_result.scalar_one_or_none()

        if item:
            item.name         = prod.name
            item.description  = prod.description
            item.price        = prod.price
            item.category     = prod.category
            item.is_available = prod.is_available
            item.metadata_ = {**(item.metadata_ or {}), "image_url": prod.image_url, "stock_quantity": prod.stock_quantity, "sku": prod.sku}
            updated += 1
        else:
            db.add(CatalogItem(
                business_id  = business.id,
                name         = prod.name,
                description  = prod.description,
                price        = prod.price,
                category     = prod.category,
                is_available = prod.is_available,
                source       = "woocommerce",
                external_id  = prod.external_id,
                metadata_    = {"image_url": prod.image_url, "stock_quantity": prod.stock_quantity, "sku": prod.sku} if (prod.image_url or prod.stock_quantity is not None or prod.sku) else {},
            ))
            created += 1

    # 3. Actualizar estadísticas del negocio
    if not business.integrations:
        business.integrations = {}
    if "woocommerce" not in business.integrations:
        business.integrations["woocommerce"] = {}

    wc = business.integrations["woocommerce"]
    wc["last_sync_at"]    = now.isoformat()
    wc["products_synced"] = wc.get("products_synced", 0) + created
    if body.store_url:
        wc["store_url"] = body.store_url

    business.integrations["active_catalog_source"] = "woocommerce"
    flag_modified(business, "integrations")

    await db.commit()

    # Generar embeddings en background para productos nuevos/actualizados (sin bloquear al plugin)
    if created > 0 or updated > 0:
        background_tasks.add_task(_generate_woocommerce_embeddings, business_id)

    logger.info(f"WooCommerce ingest OK {business_id}: +{created} nuevos, {updated} actualizados")
    return {"created": created, "updated": updated, "total": len(body.products)}


@router.delete("/woocommerce/token", status_code=204)
async def revoke_woocommerce_token(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Revoca el token actual. El plugin WP deja de poder sincronizar hasta que se genere uno nuevo."""
    if business.integrations:
        business.integrations.pop("woocommerce", None)
        flag_modified(business, "integrations")
    await db.commit()


# ── Background tasks ──────────────────────────────────────────────────

async def _run_jumpseller_sync(business_id: str, login: str, auth_token_encrypted: str):
    from app.core.database import AsyncSessionLocal
    from app.models.models import CatalogItem
    from sqlalchemy import delete as sql_delete

    async with AsyncSessionLocal() as db:
        try:
            # Desencriptar token solo aquí, en el backend
            auth_token = decrypt_token(auth_token_encrypted)
            if not auth_token:
                logger.error(f"No se pudo desencriptar token Jumpseller para {business_id}")
                return

            await db.execute(
                sql_delete(CatalogItem).where(
                    CatalogItem.business_id == business_id,
                    CatalogItem.source != "jumpseller",
                )
            )
            await db.commit()

            js = JumpsellerService(login=login, auth_token=auth_token)
            stats = await js.sync_catalog(db, business_id)

            result = await db.execute(select(Business).where(Business.id == business_id))
            business = result.scalar_one_or_none()
            if business and business.integrations:
                business.integrations["jumpseller"]["last_sync_at"] = datetime.now(timezone.utc).isoformat()
                business.integrations["jumpseller"]["products_synced"] = stats["created"] + stats["updated"]
                business.integrations["active_catalog_source"] = "jumpseller"
                flag_modified(business, "integrations")
                await db.commit()

            logger.info(f"Jumpseller sync OK {business_id}: {stats}")
        except Exception as e:
            logger.error(f"Error Jumpseller sync {business_id}: {e}", exc_info=True)


async def _run_ml_sync(
    business_id: str, app_id: str, secret_key_encrypted: str,
    seller_id: str, site_id: str
):
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import delete as sql_delete

    async with AsyncSessionLocal() as db:
        try:
            secret_key = decrypt_token(secret_key_encrypted)
            if not secret_key:
                logger.error(f"No se pudo desencriptar secret_key ML para {business_id}")
                return

            await db.execute(
                sql_delete(CatalogItem).where(
                    CatalogItem.business_id == business_id,
                    CatalogItem.source      == "mercadolibre",
                )
            )
            await db.commit()

            svc   = MercadoLibreService(app_id=app_id, secret_key=secret_key,
                                        seller_id=seller_id, site_id=site_id)
            stats = await svc.sync_catalog(db, business_id)

            result   = await db.execute(select(Business).where(Business.id == business_id))
            business = result.scalar_one_or_none()
            if business and business.integrations and "mercadolibre" in business.integrations:
                business.integrations["mercadolibre"]["last_sync_at"]    = datetime.now(timezone.utc).isoformat()
                business.integrations["mercadolibre"]["products_synced"] = stats["created"] + stats["updated"]
                business.integrations["active_catalog_source"]           = "mercadolibre"
                flag_modified(business, "integrations")
                await db.commit()

            logger.info(f"ML sync OK {business_id}: {stats}")
        except Exception as e:
            logger.error(f"Error ML sync {business_id}: {e}", exc_info=True)


async def _run_shopify_sync(business_id: str, shop: str, access_token_encrypted: str):
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import delete as sql_delete

    async with AsyncSessionLocal() as db:
        try:
            access_token = decrypt_token(access_token_encrypted)
            if not access_token:
                logger.error(f"No se pudo desencriptar token Shopify para {business_id}")
                return

            await db.execute(
                sql_delete(CatalogItem).where(
                    CatalogItem.business_id == business_id,
                    CatalogItem.source == "shopify",
                )
            )
            await db.commit()

            svc   = ShopifyService(shop=shop, access_token=access_token)
            stats = await svc.sync_catalog(db, business_id)

            result   = await db.execute(select(Business).where(Business.id == business_id))
            business = result.scalar_one_or_none()
            if business and business.integrations and "shopify" in business.integrations:
                business.integrations["shopify"]["last_sync_at"]    = datetime.now(timezone.utc).isoformat()
                business.integrations["shopify"]["products_synced"] = stats["created"] + stats["updated"]
                business.integrations["active_catalog_source"]      = "shopify"
                flag_modified(business, "integrations")
                await db.commit()

            logger.info(f"Shopify sync OK {business_id}: {stats}")
        except Exception as e:
            logger.error(f"Error Shopify sync {business_id}: {e}", exc_info=True)


async def _run_bsale_sync(
    business_id: str, access_token_encrypted: str,
    price_list_id: Optional[int], max_products: int = 500
):
    from app.core.database import AsyncSessionLocal
    from app.models.models import CatalogItem
    from sqlalchemy import delete as sql_delete

    async with AsyncSessionLocal() as db:
        try:
            # Desencriptar token solo aquí, en el backend
            access_token = decrypt_token(access_token_encrypted)
            if not access_token:
                logger.error(f"No se pudo desencriptar token Bsale para {business_id}")
                return

            await db.execute(
                sql_delete(CatalogItem).where(
                    CatalogItem.business_id == business_id,
                    CatalogItem.source != "bsale",
                )
            )
            await db.commit()

            bs = BsaleService(access_token=access_token)
            stats = await bs.sync_catalog(db, business_id, price_list_id, max_products=max_products)

            result = await db.execute(select(Business).where(Business.id == business_id))
            business = result.scalar_one_or_none()
            if business and business.integrations and "bsale" in business.integrations:
                business.integrations["bsale"]["last_sync_at"] = datetime.now(timezone.utc).isoformat()
                business.integrations["bsale"]["products_synced"] = stats["created"] + stats["updated"]
                business.integrations["active_catalog_source"] = "bsale"
                flag_modified(business, "integrations")
                await db.commit()

            logger.info(f"Bsale sync OK {business_id}: {stats}")
        except Exception as e:
            logger.error(f"Error Bsale sync {business_id}: {e}", exc_info=True)


async def _generate_woocommerce_embeddings(business_id: str):
    """
    Genera embeddings para todos los productos WooCommerce que no los tienen.
    Se ejecuta en background después del ingest para no bloquear el plugin.
    """
    from app.core.database import AsyncSessionLocal
    from app.services.ai_service import AIService

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(CatalogItem).where(
                    CatalogItem.business_id == business_id,
                    CatalogItem.source == "woocommerce",
                    CatalogItem.embedding.is_(None),
                )
            )
            items = result.scalars().all()

            if not items:
                return

            logger.info(f"Generando embeddings WooCommerce para {len(items)} productos ({business_id})")

            for item in items:
                embed_text = f"{item.name}. {item.description or ''} {item.category or ''}".strip()
                try:
                    item.embedding = await AIService.generate_embedding(embed_text)
                except Exception as e:
                    logger.warning(f"Error embedding WooCommerce '{item.name}': {e}")

            await db.commit()
            logger.info(f"Embeddings WooCommerce OK ({business_id}): {len(items)} productos")

        except Exception as e:
            logger.error(f"Error generando embeddings WooCommerce {business_id}: {e}", exc_info=True)
