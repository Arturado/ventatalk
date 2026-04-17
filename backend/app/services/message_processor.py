"""
process_incoming_message: orquesta todo el flujo de un mensaje entrante.

Flujo:
  1. Idempotencia (evitar procesar duplicados)
  2. Resolver business por phone_number_id
  3. Upsert contact
  4. Upsert/obtener conversation
  5. Guardar mensaje del usuario
  6. Clasificar intención
  7. RAG: recuperar contexto del catálogo
  8. Generar respuesta con IA
  9. Enviar respuesta por WhatsApp
  10. Actualizar CRM (lead stage, tags)
  11. Programar follow-ups si aplica
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.models import (
    Business, CatalogItem, Contact, Conversation,
    ConversationStatus, Lead, LeadStage, Message,
    MessageIntent, MessageRole, MessageType, PhoneNumber,
)
from app.services.ai_service import AIService
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


async def process_incoming_message(
    message: dict,
    phone_number_id: str,
    contacts_info: list,
) -> None:
    """Entry point del background task."""
    try:
        await _process(message, phone_number_id, contacts_info)
    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}", exc_info=True)


async def _process(message: dict, phone_number_id: str, contacts_info: list) -> None:
    msg_id = message.get("id")
    msg_type = message.get("type", "text")
    from_phone = message.get("from")  # ej: "56912345678"

    if not msg_id or not from_phone:
        return

    async with AsyncSessionLocal() as db:

        # ── 1. Idempotencia ──────────────────────────────────────────
        existing = await db.execute(
            select(Message).where(Message.wa_message_id == msg_id)
        )
        if existing.scalar_one_or_none():
            logger.debug(f"Mensaje duplicado ignorado: {msg_id}")
            return

        # ── 2. Resolver PhoneNumber → Business ───────────────────────
        result = await db.execute(
            select(PhoneNumber)
            .where(PhoneNumber.phone_number_id == phone_number_id)
            .options(selectinload(PhoneNumber.business))
        )
        phone_record = result.scalar_one_or_none()
        if not phone_record or not phone_record.is_active:
            logger.warning(f"phone_number_id no registrado: {phone_number_id}")
            return

        business: Business = phone_record.business
        if not business.is_active or not business.ai_enabled:
            return

        # ── 3. Upsert Contact ────────────────────────────────────────
        contact = await _upsert_contact(db, business.id, from_phone, contacts_info)

        # ── 4. Upsert Conversation ───────────────────────────────────
        conversation = await _get_or_create_conversation(db, business.id, contact, phone_record)

        # ── 5. Extraer texto del mensaje ─────────────────────────────
        user_text = _extract_text(message)
        if not user_text:
            logger.info(f"Mensaje tipo {msg_type} sin texto extraíble, ignorado")
            return

        # Actualizar ventana de 24h (el cliente escribió ahora)
        conversation.wa_window_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        contact.last_seen_at = datetime.now(timezone.utc)

        # ── 6. Guardar mensaje del usuario ───────────────────────────
        user_message = Message(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            message_type=MessageType.TEXT,
            content=user_text,
            wa_message_id=msg_id,
            wa_status="received",
        )
        db.add(user_message)
        await db.flush()

        # ── 7. IA: clasificar, RAG, responder ────────────────────────
        ai_service = AIService(db, business)
        ai_result = await ai_service.process(
            user_text=user_text,
            conversation=conversation,
        )

        # ── 8. Guardar respuesta IA ──────────────────────────────────
        ai_message = Message(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            message_type=MessageType.TEXT,
            content=ai_result.response_text,
            intent=ai_result.intent,
            ai_tokens_used=ai_result.tokens_used,
            ai_cost_usd=ai_result.cost_usd,
            escalate_to_human=ai_result.should_escalate,
        )
        db.add(ai_message)

        # ── 9. Actualizar estado conversation ────────────────────────
        conversation.detected_intent = ai_result.intent
        conversation.last_message_at = datetime.now(timezone.utc)

        if ai_result.should_escalate:
            conversation.status = ConversationStatus.HUMAN_ASSIGNED
            logger.info(f"Conversación {conversation.id} escalada a humano")
        else:
            conversation.status = ConversationStatus.AI_HANDLING

        # ── 10. Upsert Lead ──────────────────────────────────────────
        await _update_lead(db, contact, business.id, ai_result.intent)

        await db.commit()

        # ── 11. Enviar respuesta por WhatsApp ────────────────────────
        wa_service = WhatsAppService(
            phone_number_id=phone_number_id,
            access_token=phone_record.access_token,
        )
        wa_msg_id = await wa_service.send_text(
            to=from_phone,
            text=ai_result.response_text,
        )

        if wa_msg_id:
            ai_message.wa_message_id = wa_msg_id
            ai_message.wa_status = "sent"
            await db.commit()

        # ── 12. Programar follow-up ──────────────────────────────────
        if ai_result.intent == MessageIntent.QUOTE_REQUEST and not ai_result.should_escalate:
            from app.workers.followup_tasks import schedule_followup_sequence
            await schedule_followup_sequence(
                business_id=str(business.id),
                contact_id=str(contact.id),
                trigger_intent=ai_result.intent.value,
            )


# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────

def _extract_text(message: dict) -> Optional[str]:
    """Extrae texto de cualquier tipo de mensaje de Meta."""
    msg_type = message.get("type")
    if msg_type == "text":
        return message.get("text", {}).get("body", "").strip()
    if msg_type == "interactive":
        interactive = message.get("interactive", {})
        if interactive.get("type") == "button_reply":
            return interactive["button_reply"].get("title", "")
        if interactive.get("type") == "list_reply":
            return interactive["list_reply"].get("title", "")
    # audio, image, video: de momento ignoramos (v1.2 agrega STT)
    return None


async def _upsert_contact(db, business_id, wa_phone: str, contacts_info: list) -> Contact:
    result = await db.execute(
        select(Contact).where(
            Contact.business_id == business_id,
            Contact.wa_phone == wa_phone,
        )
    )
    contact = result.scalar_one_or_none()

    if not contact:
        # Obtener nombre desde contacts_info de Meta
        name = None
        for c in contacts_info:
            if c.get("wa_id") == wa_phone:
                name = c.get("profile", {}).get("name")
                break
        contact = Contact(
            business_id=business_id,
            wa_phone=wa_phone,
            name=name,
            tags=[],
        )
        db.add(contact)
        await db.flush()

    return contact


async def _get_or_create_conversation(
    db, business_id, contact: Contact, phone_record: PhoneNumber
) -> Conversation:
    # Buscar conversación abierta
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.business_id == business_id,
            Conversation.contact_id == contact.id,
            Conversation.status.in_([
                ConversationStatus.OPEN,
                ConversationStatus.AI_HANDLING,
            ]),
        )
        .order_by(Conversation.created_at.desc())
    )
    conv = result.scalar_one_or_none()

    if not conv:
        conv = Conversation(
            business_id=business_id,
            contact_id=contact.id,
            phone_number_id=phone_record.id,
            status=ConversationStatus.AI_HANDLING,
        )
        db.add(conv)
        await db.flush()

    return conv


async def _update_lead(db, contact: Contact, business_id, intent: MessageIntent) -> None:
    result = await db.execute(
        select(Lead).where(Lead.contact_id == contact.id)
    )
    lead = result.scalar_one_or_none()

    if not lead:
        lead = Lead(contact_id=contact.id, business_id=business_id, stage=LeadStage.NEW)
        db.add(lead)
        await db.flush()

    # Avanzar etapa según intención
    intent_to_stage = {
        MessageIntent.QUOTE_REQUEST: LeadStage.QUOTED,
        MessageIntent.PURCHASE: LeadStage.CLOSED_WON,
        MessageIntent.GENERAL_INFO: LeadStage.INTERESTED,
    }
    new_stage = intent_to_stage.get(intent)
    if new_stage and _stage_advances(lead.stage, new_stage):
        lead.stage = new_stage


def _stage_advances(current: LeadStage, new: LeadStage) -> bool:
    order = [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.QUOTED,
             LeadStage.CLOSED_WON, LeadStage.CLOSED_LOST]
    return order.index(new) > order.index(current)
