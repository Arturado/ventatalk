"""
Chat widget público — POST /api/v1/chat/widget

Sin autenticación. Vincula conversaciones al negocio WIDGET_BUSINESS_ID.
Rate limit: 20 mensajes/hora por session_id (Redis ZSET sliding window).
"""
import hashlib
import logging
import time
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import (
    Contact, Conversation, ConversationStatus,
    Message, MessageRole, MessageType,
)

settings = get_settings()
logger = logging.getLogger(__name__)
_openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

router = APIRouter(prefix="/chat", tags=["widget"])

WIDGET_SYSTEM_PROMPT = (
    "Eres el asistente virtual de VentaTalk, un SaaS de agente IA de ventas para PYMEs "
    "latinoamericanas. Ayudas a los visitantes a entender el producto, sus planes "
    "(Starter $29.900/mes, Pro $59.900/mes, Business $99.900/mes) y los derivas al "
    "formulario de contacto cuando muestran intención de compra. Responde siempre en "
    "español, de forma amigable y concisa. Máximo 3 oraciones por respuesta."
)

_RATE_LIMIT = 20    # mensajes por ventana
_RATE_WINDOW = 3600  # 1 hora en segundos

# Costo GPT-4o-mini por 1M tokens
_COST_IN = 0.15
_COST_OUT = 0.60


# ─────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────

class WidgetRequest(BaseModel):
    message: str
    session_id: str

    @field_validator("message")
    @classmethod
    def _validate_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message no puede estar vacío")
        if len(v) > 1000:
            raise ValueError("message demasiado largo (máx 1000 caracteres)")
        return v

    @field_validator("session_id")
    @classmethod
    def _validate_session(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("session_id no puede estar vacío")
        if len(v) > 128:
            raise ValueError("session_id demasiado largo (máx 128 caracteres)")
        return v


class WidgetResponse(BaseModel):
    response: str
    session_id: str


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def _session_to_wa_phone(session_id: str) -> str:
    """Deriva un wa_phone de max 20 chars a partir del session_id."""
    return "w" + hashlib.sha256(session_id.encode()).hexdigest()[:18]


async def _is_within_rate_limit(session_id: str) -> bool:
    """Sliding-window rate limit por session_id. True = dentro del límite."""
    try:
        redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        key = f"widget_rl:{session_id}"
        now = time.time()
        async with redis.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(key, 0, now - _RATE_WINDOW)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, _RATE_WINDOW * 2)
            results = await pipe.execute()
        await redis.aclose()
        return results[1] < _RATE_LIMIT
    except Exception as exc:
        logger.warning("Redis no disponible para rate limit widget: %s", exc)
        return True  # fail open


# ─────────────────────────────────────────────────────────────────────
# Endpoint
# ─────────────────────────────────────────────────────────────────────

@router.post("/widget", response_model=WidgetResponse)
async def chat_widget(
    payload: WidgetRequest,
    db: AsyncSession = Depends(get_db),
):
    if not settings.WIDGET_BUSINESS_ID:
        raise HTTPException(status_code=503, detail="Widget no configurado.")

    if not await _is_within_rate_limit(payload.session_id):
        raise HTTPException(
            status_code=429,
            detail="Límite de mensajes alcanzado. Intenta nuevamente en una hora.",
        )

    business_id = uuid.UUID(settings.WIDGET_BUSINESS_ID)
    now = datetime.now(timezone.utc)

    # ── Contact: crear o recuperar por wa_phone ──────────────────────
    wa_phone = _session_to_wa_phone(payload.session_id)
    result = await db.execute(
        select(Contact).where(
            Contact.business_id == business_id,
            Contact.wa_phone == wa_phone,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        contact = Contact(
            business_id=business_id,
            wa_phone=wa_phone,
            name="Visitante web",
            last_seen_at=now,
            tags=[],
        )
        db.add(contact)
        await db.flush()
    else:
        contact.last_seen_at = now

    # ── Conversation: usar la abierta más reciente o crear nueva ─────
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.contact_id == contact.id,
            Conversation.status != ConversationStatus.CLOSED,
        )
        .order_by(Conversation.created_at.desc())
        .limit(1)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        conversation = Conversation(
            business_id=business_id,
            contact_id=contact.id,
            phone_number_id=None,
            status=ConversationStatus.AI_HANDLING,
            last_message_at=now,
        )
        db.add(conversation)
        await db.flush()

    # ── Guardar mensaje del usuario ──────────────────────────────────
    db.add(Message(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        message_type=MessageType.TEXT,
        content=payload.message,
    ))
    await db.flush()

    # ── Historial para contexto (últimos 10 turnos) ──────────────────
    hist_result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.role.in_([MessageRole.USER, MessageRole.ASSISTANT]),
        )
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history = [
        {"role": m.role.value, "content": m.content}
        for m in reversed(hist_result.scalars().all())
        if m.content
    ]

    # ── Llamada a OpenAI ─────────────────────────────────────────────
    ai_text = ""
    tokens_used = 0
    cost = 0.0
    try:
        completion = await _openai.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,
            max_tokens=200,
            messages=[{"role": "system", "content": WIDGET_SYSTEM_PROMPT}, *history],
        )
        ai_text = completion.choices[0].message.content.strip()
        t_in = completion.usage.prompt_tokens
        t_out = completion.usage.completion_tokens
        tokens_used = t_in + t_out
        cost = (t_in * _COST_IN + t_out * _COST_OUT) / 1_000_000
    except Exception as exc:
        logger.error("Error OpenAI widget: %s", exc)
        ai_text = (
            "En este momento tengo dificultades técnicas. "
            "Por favor contáctanos directamente a través del formulario."
        )

    # ── Guardar respuesta de la IA ───────────────────────────────────
    db.add(Message(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        message_type=MessageType.TEXT,
        content=ai_text,
        ai_tokens_used=tokens_used,
        ai_cost_usd=cost,
    ))
    conversation.last_message_at = now

    return WidgetResponse(response=ai_text, session_id=payload.session_id)
