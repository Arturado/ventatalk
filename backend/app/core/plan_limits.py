"""
Constantes y helpers para verificar límites de plan.
-1 en cualquier campo significa ilimitado.
"""
import calendar
from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Business, CatalogItem, Conversation

# ── Límites por plan ─────────────────────────────────────────────────
PLAN_LIMITS = {
    "starter": {
        "max_phone_numbers": 1,
        "max_conversations_per_month": 200,
        "max_catalog_items": -1,  # sin límite de catálogo
        "overage_price_usd": 0.40,
    },
    "pro": {
        "max_phone_numbers": 3,
        "max_conversations_per_month": 1000,
        "max_catalog_items": -1,
        "overage_price_usd": 0.40,
    },
    "max": {
        "max_phone_numbers": 4,
        "max_conversations_per_month": 3000,
        "max_catalog_items": -1,
        "overage_price_usd": 0.30,
    },
}

# ── Features por plan ────────────────────────────────────────────────
# Estos features se asignan automáticamente al crear/cambiar de plan.
# Add-ons (instagram, mercadolibre, etc.) se activan por separado vía Stripe.
PLAN_FEATURES = {
    "starter": {
        "abandoned_carts": True,
        "outbound_campaigns": False,
        "reviews_module": False,
        "b2b_quotes": False,
        "instagram": False,
        "mercadolibre": False,
        "extra_stores": 0,
        "extra_whatsapp_numbers": 0,
    },
    "pro": {
        "abandoned_carts": True,
        "outbound_campaigns": True,
        "reviews_module": True,
        "b2b_quotes": False,
        "instagram": False,
        "mercadolibre": False,
        "extra_stores": 0,
        "extra_whatsapp_numbers": 0,
    },
    "max": {
        "abandoned_carts": True,
        "outbound_campaigns": True,
        "reviews_module": True,
        "b2b_quotes": True,
        "instagram": False,
        "mercadolibre": False,
        "extra_stores": 0,
        "extra_whatsapp_numbers": 0,
    },
}


def get_plan_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan.lower(), PLAN_LIMITS["starter"])


def get_plan_features(plan: str) -> dict:
    """Retorna los features base del plan. Los add-ons se mergean encima."""
    return PLAN_FEATURES.get(plan.lower(), PLAN_FEATURES["starter"]).copy()


def days_until_reset() -> int:
    now = datetime.now(timezone.utc)
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    return days_in_month - now.day + 1


async def conversations_this_month(db: AsyncSession, business_id) -> int:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count())
        .select_from(Conversation)
        .where(
            Conversation.business_id == business_id,
            Conversation.created_at >= month_start,
        )
    )
    return result.scalar() or 0


async def catalog_items_count(db: AsyncSession, business_id) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(CatalogItem)
        .where(CatalogItem.business_id == business_id)
    )
    return result.scalar() or 0


async def is_conversation_limit_exceeded(db: AsyncSession, business: Business) -> bool:
    limit = business.max_conversations_per_month
    if limit == -1:
        return False
    count = await conversations_this_month(db, business.id)
    return count >= limit


async def is_catalog_limit_exceeded(db: AsyncSession, business: Business) -> bool:
    limit = business.max_catalog_items
    if limit == -1:
        return False
    count = await catalog_items_count(db, business.id)
    return count >= limit