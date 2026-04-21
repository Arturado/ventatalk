from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_business
from app.models.models import (
    Business, Contact, Conversation, ConversationStatus,
    Message, MessageRole, PhoneNumber,
)
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/conversations", tags=["conversations"])


class MessageOut(BaseModel):
    id: str
    role: str
    content: Optional[str]
    wa_status: Optional[str]
    intent: Optional[str]
    created_at: str


class ConversationOut(BaseModel):
    id: str
    contact_id: str
    contact_name: Optional[str]
    contact_phone: str
    status: str
    detected_intent: Optional[str]
    last_message_at: Optional[str]
    wa_window_expires_at: Optional[str]
    message_count: int


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class ReplyRequest(BaseModel):
    text: str


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Conversation)
        .where(Conversation.business_id == business.id)
        .options(selectinload(Conversation.contact))
        .order_by(Conversation.last_message_at.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if status:
        q = q.where(Conversation.status == status)

    result = await db.execute(q)
    convs = result.scalars().all()

    out = []
    for c in convs:
        # Contar mensajes
        count_result = await db.execute(
            select(func.count()).where(Message.conversation_id == c.id)
        )
        msg_count = count_result.scalar() or 0
        out.append(ConversationOut(
            id=str(c.id),
            contact_id=str(c.contact_id),
            contact_name=c.contact.name if c.contact else None,
            contact_phone=c.contact.wa_phone if c.contact else "",
            status=c.status.value,
            detected_intent=c.detected_intent.value if c.detected_intent else None,
            last_message_at=c.last_message_at.isoformat() if c.last_message_at else None,
            wa_window_expires_at=c.wa_window_expires_at.isoformat() if c.wa_window_expires_at else None,
            message_count=msg_count,
        ))
    return out


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.business_id == business.id)
        .options(selectinload(Conversation.contact), selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")

    return ConversationDetail(
        id=str(conv.id),
        contact_id=str(conv.contact_id),
        contact_name=conv.contact.name if conv.contact else None,
        contact_phone=conv.contact.wa_phone if conv.contact else "",
        status=conv.status.value,
        detected_intent=conv.detected_intent.value if conv.detected_intent else None,
        last_message_at=conv.last_message_at.isoformat() if conv.last_message_at else None,
        wa_window_expires_at=conv.wa_window_expires_at.isoformat() if conv.wa_window_expires_at else None,
        message_count=len(conv.messages),
        messages=[
            MessageOut(
                id=str(m.id),
                role=m.role.value,
                content=m.content,
                wa_status=m.wa_status,
                intent=m.intent.value if m.intent else None,
                created_at=m.created_at.isoformat(),
            )
            for m in conv.messages
        ],
    )


@router.post("/{conversation_id}/reply", status_code=200)
async def manual_reply(
    conversation_id: UUID,
    body: ReplyRequest,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Respuesta manual de agente humano desde el dashboard."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.business_id == business.id)
        .options(selectinload(Conversation.contact), selectinload(Conversation.phone_number))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")

    if not conv.phone_number:
        # Conversación de widget web: solo guardar en DB sin enviar por WhatsApp
        msg = Message(
            conversation_id=conv.id,
            role=MessageRole.ASSISTANT,
            content=body.text,
        )
        db.add(msg)
        await db.commit()
        return {"wa_message_id": None}

    wa_service = WhatsAppService(
        phone_number_id=conv.phone_number.phone_number_id,
        access_token=conv.phone_number.access_token,
    )
    wa_msg_id = await wa_service.send_text(
        to=conv.contact.wa_phone,
        text=body.text,
    )

    msg = Message(
        conversation_id=conv.id,
        role=MessageRole.AGENT,
        content=body.text,
        wa_message_id=wa_msg_id,
        wa_status="sent",
    )
    db.add(msg)
    await db.commit()
    return {"wa_message_id": wa_msg_id}


@router.put("/{conversation_id}/assign")
async def assign_conversation(
    conversation_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.business_id == business.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404)
    conv.status = ConversationStatus.HUMAN_ASSIGNED
    return {"status": conv.status.value}


@router.put("/{conversation_id}/close")
async def close_conversation(
    conversation_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.business_id == business.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404)
    conv.status = ConversationStatus.CLOSED
    return {"status": conv.status.value}
