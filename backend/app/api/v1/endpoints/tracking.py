"""
Tracking de conversiones vt_conv.

Flujo:
  1. El agente genera un link: POST /api/v1/conversations/{id}/tracking-link
  2. El link tiene la forma: {API_URL}/track/{token}
  3. El cliente hace clic → GET /track/{token} registra conversión y redirige a destination_url
  4. El negocio ve las conversiones en /api/v1/analytics/conversions
"""
import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_business
from app.models.models import Business, Conversation, ConversionToken

router = APIRouter(tags=["tracking"])
public_router = APIRouter(tags=["tracking-public"])


# ── Schemas ────────────────────────────────────────────────────────────

class TrackingLinkRequest(BaseModel):
    destination_url: str
    label: Optional[str] = None


class TrackingLinkOut(BaseModel):
    token: str
    tracking_url: str
    destination_url: str
    label: Optional[str]
    converted: bool
    converted_at: Optional[str]
    created_at: str


# ── Endpoints autenticados ─────────────────────────────────────────────

@router.post("/conversations/{conversation_id}/tracking-link", response_model=TrackingLinkOut)
async def create_tracking_link(
    conversation_id: UUID,
    body: TrackingLinkRequest,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Genera un link de seguimiento para una conversación."""
    # Verificar que la conversación pertenece al negocio
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.business_id == business.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")

    token = secrets.token_urlsafe(32)

    ct = ConversionToken(
        token=token,
        business_id=business.id,
        conversation_id=conv.id,
        label=body.label,
        destination_url=body.destination_url,
    )
    db.add(ct)
    await db.commit()
    await db.refresh(ct)

    from app.core.config import get_settings
    settings = get_settings()
    tracking_url = f"{settings.API_URL}/track/{token}"

    return TrackingLinkOut(
        token=token,
        tracking_url=tracking_url,
        destination_url=body.destination_url,
        label=body.label,
        converted=False,
        converted_at=None,
        created_at=ct.created_at.isoformat(),
    )


@router.get("/conversations/{conversation_id}/tracking-links", response_model=list[TrackingLinkOut])
async def list_tracking_links(
    conversation_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Lista los links de seguimiento de una conversación."""
    result = await db.execute(
        select(ConversionToken).where(
            ConversionToken.conversation_id == conversation_id,
            ConversionToken.business_id == business.id,
        ).order_by(ConversionToken.created_at.desc())
    )
    tokens = result.scalars().all()

    from app.core.config import get_settings
    settings = get_settings()

    return [
        TrackingLinkOut(
            token=ct.token,
            tracking_url=f"{settings.API_URL}/track/{ct.token}",
            destination_url=ct.destination_url,
            label=ct.label,
            converted=ct.converted_at is not None,
            converted_at=ct.converted_at.isoformat() if ct.converted_at else None,
            created_at=ct.created_at.isoformat(),
        )
        for ct in tokens
    ]


# ── Endpoint público de redirección ───────────────────────────────────

@public_router.get("/track/{token}")
async def track_redirect(token: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint público. El cliente hace clic aquí desde WhatsApp.
    Registra la conversión y redirige a destination_url.
    """
    result = await db.execute(
        select(ConversionToken).where(ConversionToken.token == token)
    )
    ct = result.scalar_one_or_none()

    if not ct:
        raise HTTPException(404, "Link no válido")

    # Registrar conversión solo la primera vez
    if ct.converted_at is None:
        ct.converted_at = datetime.now(timezone.utc)
        await db.commit()

    return RedirectResponse(url=ct.destination_url, status_code=307)
