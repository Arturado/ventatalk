"""
Endpoints exclusivos para superadmin. Acceso restringido a SUPERADMIN_EMAIL.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.plan_limits import get_plan_features, get_plan_limits
from app.core.security import get_current_business
from app.models.models import Business, Conversation, PlanType

settings = get_settings()
router = APIRouter(prefix="/admin", tags=["admin"])


# ── Dependency ────────────────────────────────────────────────────────

async def get_superadmin(business: Business = Depends(get_current_business)) -> Business:
    if not settings.SUPERADMIN_EMAIL or business.email != settings.SUPERADMIN_EMAIL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    return business


# ── Helpers ───────────────────────────────────────────────────────────

def _integration_keys(integrations: Optional[dict]) -> list[str]:
    """Devuelve solo las claves de integraciones activas, sin tokens."""
    if not integrations:
        return []
    return [k for k, v in integrations.items() if v]


def _business_summary(b: Business) -> dict:
    return {
        "id": str(b.id),
        "name": b.name,
        "email": b.email,
        "plan": b.plan,
        "billing_cycle": b.billing_cycle,
        "is_active": b.is_active,
        "conversations_this_month": b.conversations_this_month,
        "max_conversations_per_month": b.max_conversations_per_month,
        "created_at": b.created_at,
        "features": b.features,
        "integrations": _integration_keys(b.integrations),
    }


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/stats/overview")
async def stats_overview(
    _: Business = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_businesses = (await db.execute(select(func.count()).select_from(Business))).scalar() or 0
    active_businesses = (
        await db.execute(select(func.count()).select_from(Business).where(Business.is_active.is_(True)))
    ).scalar() or 0
    total_conversations_today = (
        await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(Conversation.created_at >= today_start)
        )
    ).scalar() or 0

    plans_breakdown: dict[str, int] = {}
    for plan in PlanType:
        count = (
            await db.execute(
                select(func.count()).select_from(Business).where(Business.plan == plan)
            )
        ).scalar() or 0
        plans_breakdown[plan.value] = count

    return {
        "total_businesses": total_businesses,
        "active_businesses": active_businesses,
        "total_conversations_today": total_conversations_today,
        "total_revenue_mtd": 0,
        "plans_breakdown": plans_breakdown,
    }


@router.get("/businesses")
async def list_businesses(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    _: Business = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Business)
    if search:
        term = f"%{search}%"
        query = query.where(Business.name.ilike(term) | Business.email.ilike(term))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    query = query.order_by(Business.created_at.desc()).offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(query)).scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [_business_summary(b) for b in rows],
    }


@router.get("/businesses/{business_id}")
async def get_business(
    business_id: uuid.UUID,
    _: Business = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    b = await db.get(Business, business_id)
    if not b:
        raise HTTPException(status_code=404, detail="Business no encontrado")
    return _business_summary(b)


class UpdateFeaturesRequest(BaseModel):
    features: dict


@router.patch("/businesses/{business_id}/features")
async def update_features(
    business_id: uuid.UUID,
    body: UpdateFeaturesRequest,
    _: Business = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    b = await db.get(Business, business_id)
    if not b:
        raise HTTPException(status_code=404, detail="Business no encontrado")

    b.features = body.features
    await db.commit()
    await db.refresh(b)
    return _business_summary(b)


class UpdatePlanRequest(BaseModel):
    plan: str
    billing_cycle: str = "monthly"


@router.patch("/businesses/{business_id}/plan")
async def update_plan(
    business_id: uuid.UUID,
    body: UpdatePlanRequest,
    _: Business = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    b = await db.get(Business, business_id)
    if not b:
        raise HTTPException(status_code=404, detail="Business no encontrado")

    plan_name = body.plan.lower()
    try:
        b.plan = PlanType(plan_name)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Plan inválido: {body.plan}")

    limits = get_plan_limits(plan_name)
    features = get_plan_features(plan_name)

    # Preservar add-ons activos que el cliente ya tenía
    if b.features:
        for addon in ["instagram", "mercadolibre", "extra_stores", "extra_whatsapp_numbers"]:
            if b.features.get(addon):
                features[addon] = b.features[addon]

    b.billing_cycle = body.billing_cycle
    b.max_phone_numbers = limits["max_phone_numbers"]
    b.max_conversations_per_month = limits["max_conversations_per_month"]
    b.features = features

    await db.commit()
    await db.refresh(b)
    return _business_summary(b)
