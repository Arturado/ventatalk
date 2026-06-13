"""
Endpoint para gestionar integraciones de catálogo externas.
Jumpseller, Bsale, WooCommerce (inbound). Shopify, MercadoLibre.
WhatsApp Embedded Signup: conecta números de WhatsApp Business a la cuenta del tenant.

Seguridad:
  - Tokens de salida (Jumpseller/Bsale) encriptados con Fernet antes de guardar en DB
  - Token de entrada WooCommerce guardado como SHA-256 hash — nunca en texto plano
  - Frontend nunca recibe tokens completos — solo últimos 8 chars enmascarados
  - Desencriptación solo en background tasks para llamadas a APIs externas
  - WhatsApp access_token guardado en texto plano (igual que el sandbox de VentaTalk)
"""
import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import get_settings
from app.core.database import get_db
from app.core.encryption import decrypt_token, encrypt_token, mask_token
from app.core.security import get_current_business
from app.models.models import Business, CatalogItem, Coupon, Order, PhoneNumber
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


class WooCommerceOrderItem(BaseModel):
    external_id: str
    order_number: str
    status: str
    total: float
    currency: str = "CLP"
    payment_method: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    items: list = []
    notes: Optional[str] = None
    ordered_at: Optional[datetime] = None


class WooCommerceOrderIngestRequest(BaseModel):
    orders: List[WooCommerceOrderItem]
    store_url: Optional[str] = None


class WooCommerceCouponItem(BaseModel):
    external_id: str
    code: str
    discount_type: str
    discount_value: float
    description: Optional[str] = None
    min_order_amount: Optional[float] = None
    usage_count: int = 0
    usage_limit: Optional[int] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True


class WooCommerceCouponIngestRequest(BaseModel):
    coupons: List[WooCommerceCouponItem]
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


@router.post("/woocommerce/orders/ingest", status_code=200)
async def woocommerce_orders_ingest(
    body: WooCommerceOrderIngestRequest,
    x_ventatalk_token: str = Header(..., alias="X-VentaTalk-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint público — autenticado solo con X-VentaTalk-Token.
    El plugin de WP/WooCommerce llama aquí para sincronizar órdenes.
    Hace upsert por (business_id, source="woocommerce", external_id).
    """
    token_hash = _hash_token(x_ventatalk_token)
    result = await db.execute(
        select(Business).where(
            text("integrations->'woocommerce'->>'token_hash' = :hash")
        ).params(hash=token_hash)
    )
    business = result.scalar_one_or_none()

    if not business:
        raise HTTPException(status_code=401, detail="Token inválido o no reconocido.")

    now = datetime.now(timezone.utc)
    created = updated = 0

    for order_data in body.orders:
        existing_result = await db.execute(
            select(Order).where(
                Order.business_id == business.id,
                Order.source == "woocommerce",
                Order.external_id == order_data.external_id,
            )
        )
        order = existing_result.scalar_one_or_none()

        if order:
            order.order_number   = order_data.order_number
            order.status         = order_data.status
            order.total          = order_data.total
            order.currency       = order_data.currency
            order.payment_method = order_data.payment_method
            order.customer_name  = order_data.customer_name
            order.customer_email = order_data.customer_email
            order.customer_phone = order_data.customer_phone
            order.items          = order_data.items
            order.notes          = order_data.notes
            order.ordered_at     = order_data.ordered_at
            order.synced_at      = now
            updated += 1
        else:
            db.add(Order(
                business_id    = business.id,
                source         = "woocommerce",
                external_id    = order_data.external_id,
                order_number   = order_data.order_number,
                status         = order_data.status,
                total          = order_data.total,
                currency       = order_data.currency,
                payment_method = order_data.payment_method,
                customer_name  = order_data.customer_name,
                customer_email = order_data.customer_email,
                customer_phone = order_data.customer_phone,
                items          = order_data.items,
                notes          = order_data.notes,
                ordered_at     = order_data.ordered_at,
                synced_at      = now,
            ))
            created += 1

    await db.commit()

    logger.info(f"WooCommerce orders ingest OK {business.id}: +{created} nuevas, {updated} actualizadas")
    return {"created": created, "updated": updated, "total": len(body.orders)}


@router.post("/woocommerce/coupons/ingest", status_code=200)
async def woocommerce_coupons_ingest(
    body: WooCommerceCouponIngestRequest,
    x_ventatalk_token: str = Header(..., alias="X-VentaTalk-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint público — autenticado solo con X-VentaTalk-Token.
    El plugin de WP/WooCommerce llama aquí para sincronizar cupones.
    Hace upsert por (business_id, source="woocommerce", code).
    """
    token_hash = _hash_token(x_ventatalk_token)
    result = await db.execute(
        select(Business).where(
            text("integrations->'woocommerce'->>'token_hash' = :hash")
        ).params(hash=token_hash)
    )
    business = result.scalar_one_or_none()

    if not business:
        raise HTTPException(status_code=401, detail="Token inválido o no reconocido.")

    created = updated = 0

    for coupon_data in body.coupons:
        existing_result = await db.execute(
            select(Coupon).where(
                Coupon.business_id == business.id,
                Coupon.source == "woocommerce",
                Coupon.code == coupon_data.code,
            )
        )
        coupon = existing_result.scalar_one_or_none()

        if coupon:
            coupon.external_id      = coupon_data.external_id
            coupon.discount_type    = coupon_data.discount_type
            coupon.discount_value   = coupon_data.discount_value
            coupon.description      = coupon_data.description
            coupon.min_order_amount = coupon_data.min_order_amount
            coupon.usage_count      = coupon_data.usage_count
            coupon.usage_limit      = coupon_data.usage_limit
            coupon.expires_at       = coupon_data.expires_at
            coupon.is_active        = coupon_data.is_active
            updated += 1
        else:
            db.add(Coupon(
                business_id     = business.id,
                source          = "woocommerce",
                external_id     = coupon_data.external_id,
                code            = coupon_data.code,
                discount_type   = coupon_data.discount_type,
                discount_value  = coupon_data.discount_value,
                description     = coupon_data.description,
                min_order_amount = coupon_data.min_order_amount,
                usage_count     = coupon_data.usage_count,
                usage_limit     = coupon_data.usage_limit,
                expires_at      = coupon_data.expires_at,
                is_active       = coupon_data.is_active,
            ))
            created += 1

    await db.commit()

    logger.info(f"WooCommerce coupons ingest OK {business.id}: +{created} nuevos, {updated} actualizados")
    return {"created": created, "updated": updated, "total": len(body.coupons)}


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


# ── WHATSAPP EMBEDDED SIGNUP ──────────────────────────────────────────
#
# Nota técnica — mecanismo de intercambio de code → token (v25.0):
#
# El JS SDK de Facebook con response_type='code' devuelve un código de
# autorización (OAuth 2.0 Authorization Code flow). Este se intercambia con:
#   GET /oauth/access_token?client_id=APP_ID&client_secret=APP_SECRET&code=CODE
# (sin redirect_uri para el flow de popup/JS SDK — Meta lo permite).
# El token resultante es un User Access Token de corta duración (~60 días).
# Para flujos de producción con Embedded Signup y featureType=
# 'whatsapp_business_app_onboarding', Meta puede emitir un System User Token
# de larga duración (nunca expira). Por ahora almacenamos lo que devuelve sin
# exchange adicional; si en producción se confirma que expira, agregar:
#   GET /oauth/access_token?grant_type=fb_exchange_token&fb_exchange_token=SHORT_TOKEN
# para obtener un long-lived token antes de guardar.


class WhatsAppConnectRequest(BaseModel):
    code: str
    waba_id: Optional[str] = None  # capturado del evento postMessage WA_EMBEDDED_SIGNUP


class WhatsAppConnectResponse(BaseModel):
    connected: bool
    phone_number: str
    display_name: str
    phone_number_id: str


class WhatsAppPhoneOut(BaseModel):
    phone_number_id: str
    phone_number: str
    display_name: str
    waba_id: str
    is_active: bool


async def _resolve_waba_id(access_token: str, graph_base: str) -> str:
    """Fallback: busca el WABA ID del usuario via GET /me/businesses."""
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"{graph_base}/me/businesses",
            params={
                "access_token": access_token,
                "fields": "owned_whatsapp_business_accounts{id}",
            },
        )
    if res.status_code != 200:
        raise HTTPException(
            502,
            f"No se pudo obtener el WABA ID desde Meta ({res.status_code}). "
            "Intenta de nuevo y asegúrate de completar el flujo de Embedded Signup.",
        )
    data = res.json()
    for biz in data.get("data", []):
        wabas = biz.get("owned_whatsapp_business_accounts", {}).get("data", [])
        if wabas:
            return wabas[0]["id"]
    raise HTTPException(
        400,
        "No se encontró ninguna cuenta de WhatsApp Business asociada. "
        "Asegúrate de completar el flujo de conexión en el popup.",
    )


@router.post("/whatsapp/connect", response_model=WhatsAppConnectResponse)
async def connect_whatsapp(
    body: WhatsAppConnectRequest,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Conecta un número de WhatsApp Business al tenant via Embedded Signup.
    Recibe el code del FB.login, intercambia por token, obtiene WABA + número,
    suscribe webhooks, y hace upsert en phone_numbers.
    """
    settings = get_settings()
    graph_base = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}"

    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise HTTPException(500, "META_APP_ID o META_APP_SECRET no configurados.")

    # 1. Intercambiar code por access_token
    async with httpx.AsyncClient(timeout=30) as client:
        token_res = await client.get(
            f"{graph_base}/oauth/access_token",
            params={
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "code": body.code,
            },
        )
    if token_res.status_code != 200:
        logger.error(f"Meta token exchange failed: {token_res.text}")
        raise HTTPException(
            400,
            f"Error al verificar la autorización con Meta ({token_res.status_code}). "
            "El código puede haber expirado — intenta reconectar.",
        )
    token_data = token_res.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(400, f"Meta no devolvió access_token: {token_data}")

    # 2. Obtener WABA ID (del postMessage del frontend o vía Graph API fallback)
    waba_id = body.waba_id
    if not waba_id:
        logger.info("waba_id no recibido del frontend — buscando vía Graph API")
        waba_id = await _resolve_waba_id(access_token, graph_base)

    # 3. Obtener phone_numbers del WABA
    async with httpx.AsyncClient(timeout=30) as client:
        phones_res = await client.get(
            f"{graph_base}/{waba_id}/phone_numbers",
            params={"access_token": access_token},
        )
    if phones_res.status_code != 200:
        logger.error(f"phone_numbers lookup failed for WABA {waba_id}: {phones_res.text}")
        raise HTTPException(
            502,
            "No se pudieron obtener los números de teléfono del WABA. "
            "Verifica que la app tenga permisos whatsapp_business_management.",
        )
    phones_data = phones_res.json()
    phone_list = phones_data.get("data", [])
    if not phone_list:
        raise HTTPException(400, "No hay números de teléfono en esta cuenta de WhatsApp Business.")

    # MVP: tomar el primer número disponible
    phone_info = phone_list[0]
    phone_number_id = phone_info["id"]
    phone_number = phone_info.get("display_phone_number", "")
    display_name = phone_info.get("verified_name", phone_info.get("display_phone_number", ""))

    # 4. Verificar límite del plan (solo si es número nuevo)
    existing_result = await db.execute(
        select(PhoneNumber).where(PhoneNumber.phone_number_id == phone_number_id)
    )
    existing_phone = existing_result.scalar_one_or_none()
    if not existing_phone:
        count_result = await db.execute(
            select(PhoneNumber).where(
                PhoneNumber.business_id == business.id,
                PhoneNumber.is_active == True,
            )
        )
        if len(count_result.scalars().all()) >= business.max_phone_numbers:
            raise HTTPException(
                403,
                f"Tu plan permite máximo {business.max_phone_numbers} número(s) activo(s). "
                "Desconecta uno existente o actualiza tu plan.",
            )
    elif str(existing_phone.business_id) != str(business.id):
        # El número ya está registrado en otro tenant
        raise HTTPException(409, "Este número ya está conectado a otra cuenta de VentaTalk.")

    # 5. Suscribir la app a los webhooks del WABA
    async with httpx.AsyncClient(timeout=30) as client:
        sub_res = await client.post(
            f"{graph_base}/{waba_id}/subscribed_apps",
            params={"access_token": access_token},
        )
    if sub_res.status_code != 200:
        logger.warning(
            f"Webhook subscription failed para WABA {waba_id} "
            f"(status {sub_res.status_code}): {sub_res.text}"
        )

    # 6. Upsert en phone_numbers
    if existing_phone:
        existing_phone.business_id = business.id
        existing_phone.phone_number = phone_number
        existing_phone.display_name = display_name
        existing_phone.access_token = access_token
        existing_phone.waba_id = waba_id
        existing_phone.is_active = True
    else:
        db.add(PhoneNumber(
            business_id=business.id,
            phone_number_id=phone_number_id,
            phone_number=phone_number,
            display_name=display_name,
            access_token=access_token,
            waba_id=waba_id,
            is_active=True,
        ))
    await db.commit()

    logger.info(
        f"WhatsApp conectado: business={business.id}, "
        f"phone={phone_number}, waba={waba_id}"
    )
    return WhatsAppConnectResponse(
        connected=True,
        phone_number=phone_number,
        display_name=display_name,
        phone_number_id=phone_number_id,
    )


@router.get("/whatsapp/status", response_model=list[WhatsAppPhoneOut])
async def whatsapp_status(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Devuelve los números de WhatsApp activos del business (sin exponer access_token)."""
    result = await db.execute(
        select(PhoneNumber).where(
            PhoneNumber.business_id == business.id,
            PhoneNumber.is_active == True,
        )
    )
    return [
        WhatsAppPhoneOut(
            phone_number_id=p.phone_number_id,
            phone_number=p.phone_number,
            display_name=p.display_name,
            waba_id=p.waba_id,
            is_active=p.is_active,
        )
        for p in result.scalars().all()
    ]


@router.delete("/whatsapp/{phone_number_id}", status_code=204)
async def disconnect_whatsapp(
    phone_number_id: str,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete del número (is_active=false). Preserva historial de conversaciones."""
    result = await db.execute(
        select(PhoneNumber).where(
            PhoneNumber.phone_number_id == phone_number_id,
            PhoneNumber.business_id == business.id,
        )
    )
    phone = result.scalar_one_or_none()
    if not phone:
        raise HTTPException(404, "Número no encontrado o no pertenece a este negocio.")
    phone.is_active = False
    await db.commit()
    logger.info(f"WhatsApp desconectado: phone_number_id={phone_number_id}, business={business.id}")


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

            pre_result = await db.execute(select(Business).where(Business.id == business_id))
            pre_business = pre_result.scalar_one_or_none()
            cached_prefix = (
                (pre_business.integrations or {}).get("jumpseller", {}).get("url_prefix")
                if pre_business else None
            )

            stats = await js.sync_catalog(db, business_id, cached_url_prefix=cached_prefix)
            detected_prefix = stats.pop("_url_prefix", None)

            store_info = await js.fetch_store_info()

            result = await db.execute(select(Business).where(Business.id == business_id))
            business = result.scalar_one_or_none()
            if business and business.integrations:
                business.integrations["jumpseller"]["last_sync_at"] = datetime.now(timezone.utc).isoformat()
                business.integrations["jumpseller"]["products_synced"] = stats["created"] + stats["updated"]
                if store_info and store_info.get("url"):
                    business.integrations["jumpseller"]["shop_url"] = store_info["url"].rstrip("/")
                if detected_prefix and cached_prefix != detected_prefix:
                    business.integrations["jumpseller"]["url_prefix"] = detected_prefix
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
