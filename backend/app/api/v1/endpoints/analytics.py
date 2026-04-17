from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_business
from app.models.models import (
    Business, Contact, Conversation, ConversationStatus,
    FollowUpLog, FollowUpStatus, Lead, LeadStage, Message,
    MessageRole,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """KPIs principales del dashboard."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total contactos
    total_contacts = await _count(db, Contact, Contact.business_id == business.id)

    # Conversaciones activas (AI + humano)
    active_convs = await _count(db, Conversation,
        Conversation.business_id == business.id,
        Conversation.status.in_([ConversationStatus.AI_HANDLING, ConversationStatus.HUMAN_ASSIGNED]),
    )

    # Conversaciones este mes
    convs_this_month = await _count(db, Conversation,
        Conversation.business_id == business.id,
        Conversation.created_at >= month_start,
    )

    # Mensajes respondidos por IA este mes
    ai_messages = await _count(db, Message,
        Message.role == MessageRole.ASSISTANT,
        Message.created_at >= month_start,
    )

    # Leads por etapa
    stages = ["new", "interested", "quoted", "closed_won", "closed_lost"]
    lead_funnel = {}
    for stage in stages:
        count = await _count(db, Lead,
            Lead.business_id == business.id,
            Lead.stage == stage,
        )
        lead_funnel[stage] = count

    # Costo IA este mes
    cost_result = await db.execute(
        select(func.sum(Message.ai_cost_usd))
        .where(Message.created_at >= month_start)
    )
    ai_cost_month = round(cost_result.scalar() or 0.0, 4)

    # Follow-ups enviados este mes
    followups_sent = await _count(db, FollowUpLog,
        FollowUpLog.status == FollowUpStatus.SENT,
        FollowUpLog.sent_at >= month_start,
    )

    # Tasa de escalada a humano (% de conversaciones)
    escalated = await _count(db, Conversation,
        Conversation.business_id == business.id,
        Conversation.status == ConversationStatus.HUMAN_ASSIGNED,
        Conversation.created_at >= month_start,
    )
    escalation_rate = round(escalated / convs_this_month * 100, 1) if convs_this_month else 0

    return {
        "period": "current_month",
        "contacts": {"total": total_contacts},
        "conversations": {
            "active": active_convs,
            "this_month": convs_this_month,
            "escalation_rate_pct": escalation_rate,
        },
        "ai": {
            "messages_sent": ai_messages,
            "cost_usd": ai_cost_month,
        },
        "leads": lead_funnel,
        "followups": {"sent_this_month": followups_sent},
    }


@router.get("/conversations")
async def conversations_over_time(
    days: int = 30,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Volumen de conversaciones por día para el gráfico de línea."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date_trunc("day", Conversation.created_at).label("day"),
            func.count().label("count"),
        )
        .where(
            Conversation.business_id == business.id,
            Conversation.created_at >= since,
        )
        .group_by("day")
        .order_by("day")
    )
    rows = result.fetchall()
    return [{"date": row.day.date().isoformat(), "conversations": row.count} for row in rows]


@router.get("/followup-performance")
async def followup_performance(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Tasa de éxito de follow-ups por step."""
    result = await db.execute(
        select(
            FollowUpLog.step_number,
            FollowUpLog.status,
            func.count().label("count"),
        )
        .group_by(FollowUpLog.step_number, FollowUpLog.status)
        .order_by(FollowUpLog.step_number)
    )
    rows = result.fetchall()

    summary = {}
    for row in rows:
        step = row.step_number
        if step not in summary:
            summary[step] = {"step": step, "sent": 0, "cancelled": 0, "failed": 0}
        summary[step][row.status] = row.count

    return list(summary.values())


async def _count(db, model, *conditions) -> int:
    q = select(func.count()).select_from(model)
    for cond in conditions:
        q = q.where(cond)
    result = await db.execute(q)
    return result.scalar() or 0
