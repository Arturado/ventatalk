"""
Constantes y helpers para verificar límites de plan.
-1 en cualquier campo significa ilimitado.
"""
import calendar
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Business, CatalogItem, Conversation

PLAN_LIMITS = {
    "starter": {
        "max_phone_numbers": 1,
        "max_conversations_per_month": 500,
        "max_catalog_items": 50,
    },
    "pro": {
        "max_phone_numbers": 2,
        "max_conversations_per_month": -1,
        "max_catalog_items": -1,
    },
    "business": {
        "max_phone_numbers": -1,
        "max_conversations_per_month": -1,
        "max_catalog_items": -1,
    },
}


def get_plan_defaults(plan: str) -> dict:
    return PLAN_LIMITS.get(plan.lower(), PLAN_LIMITS["starter"])


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
