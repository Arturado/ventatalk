"""
Follow-up tasks: programan y envían mensajes automáticos post-cotización.

Flujo:
  1. schedule_followup_sequence: crea los FollowUpLog con scheduled_at
  2. send_pending_followups: beat task que corre cada minuto y envía los pendientes
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select

from app.core.database import AsyncSessionLocal
from app.models.models import (
    Contact, FollowUpLog, FollowUpSequence, FollowUpStatus,
    PhoneNumber, Business,
)
from app.services.whatsapp_service import WhatsAppService
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


async def schedule_followup_sequence(
    business_id: str,
    contact_id: str,
    trigger_intent: str,
) -> None:
    """
    Crea los FollowUpLog programados para una secuencia activa.
    Llamado desde message_processor cuando se detecta quote_request.
    """
    async with AsyncSessionLocal() as db:
        # Buscar secuencia activa para este trigger
        result = await db.execute(
            select(FollowUpSequence)
            .where(
                FollowUpSequence.business_id == business_id,
                FollowUpSequence.is_active == True,
                FollowUpSequence.trigger_intent == trigger_intent,
            )
        )
        sequence = result.scalar_one_or_none()
        if not sequence or not sequence.steps:
            return

        # Verificar que no haya follow-ups ya programados para este contacto
        existing = await db.execute(
            select(FollowUpLog).where(
                FollowUpLog.sequence_id == sequence.id,
                FollowUpLog.contact_id == contact_id,
                FollowUpLog.status == FollowUpStatus.PENDING,
            )
        )
        if existing.scalar_one_or_none():
            logger.debug(f"Follow-up ya programado para contacto {contact_id}")
            return

        now = datetime.now(timezone.utc)
        for step in sequence.steps:
            log = FollowUpLog(
                sequence_id=sequence.id,
                contact_id=contact_id,
                step_number=step.step_number,
                status=FollowUpStatus.PENDING,
                scheduled_at=now + timedelta(hours=step.delay_hours),
            )
            db.add(log)

        await db.commit()
        logger.info(f"Follow-up sequence {sequence.id} programada para contacto {contact_id}")


@celery_app.task(name="app.workers.followup_tasks.send_pending_followups")
def send_pending_followups():
    """Beat task: busca y envía follow-ups cuyo scheduled_at ya pasó."""
    asyncio.run(_send_pending_followups_async())


async def _send_pending_followups_async():
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        # Buscar logs pendientes cuyo tiempo ya llegó
        result = await db.execute(
            select(FollowUpLog)
            .where(
                and_(
                    FollowUpLog.status == FollowUpStatus.PENDING,
                    FollowUpLog.scheduled_at <= now,
                )
            )
            .limit(50)  # Procesar en lotes para no bloquear
        )
        pending_logs = result.scalars().all()

        for log in pending_logs:
            try:
                await _send_followup(db, log, now)
            except Exception as e:
                logger.error(f"Error enviando follow-up {log.id}: {e}")
                log.status = FollowUpStatus.FAILED
                log.error = str(e)

        await db.commit()


async def _send_followup(db, log: FollowUpLog, now: datetime) -> None:
    """Envía un follow-up individual."""
    # Cargar datos necesarios
    contact_result = await db.execute(
        select(Contact).where(Contact.id == log.contact_id)
    )
    contact: Contact = contact_result.scalar_one_or_none()
    if not contact:
        log.status = FollowUpStatus.CANCELLED
        return

    # Verificar si el cliente respondió (ventana activa → cancelar follow-up)
    from app.models.models import Conversation, ConversationStatus
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.contact_id == contact.id,
            Conversation.wa_window_expires_at > now,
        )
    )
    if conv_result.scalar_one_or_none():
        # El cliente respondió recientemente → no spamear
        log.status = FollowUpStatus.CANCELLED
        logger.info(f"Follow-up cancelado: cliente {contact.id} respondió recientemente")
        return

    # Obtener step con template
    step_result = await db.execute(
        select(__import__('app.models.models', fromlist=['FollowUpStep']).FollowUpStep)
        .where(
            __import__('app.models.models', fromlist=['FollowUpStep']).FollowUpStep.sequence_id == log.sequence_id,
            __import__('app.models.models', fromlist=['FollowUpStep']).FollowUpStep.step_number == log.step_number,
        )
    )
    step = step_result.scalar_one_or_none()
    if not step:
        log.status = FollowUpStatus.CANCELLED
        return

    # Obtener número de teléfono del negocio
    from app.models.models import FollowUpSequence
    seq_result = await db.execute(
        select(FollowUpSequence).where(FollowUpSequence.id == log.sequence_id)
    )
    sequence = seq_result.scalar_one_or_none()

    phone_result = await db.execute(
        select(PhoneNumber).where(
            PhoneNumber.business_id == sequence.business_id,
            PhoneNumber.is_active == True,
        )
    )
    phone_record = phone_result.scalar_one_or_none()
    if not phone_record:
        log.status = FollowUpStatus.FAILED
        log.error = "No hay número activo para este negocio"
        return

    wa_service = WhatsAppService(
        phone_number_id=phone_record.phone_number_id,
        access_token=phone_record.access_token,
    )

    # Usar template si está fuera de ventana 24h (lo estará en follow-ups)
    if step.template_name:
        business_result = await db.execute(
            select(Business).where(Business.id == sequence.business_id)
        )
        business = business_result.scalar_one()
        wa_msg_id = await wa_service.send_template(
            to=contact.wa_phone,
            template_name=step.template_name,
            template_vars=[contact.name or "cliente", business.name],
        )
    else:
        # Solo si hay ventana activa (raro en follow-ups, pero por si acaso)
        wa_msg_id = await wa_service.send_text(
            to=contact.wa_phone,
            text=step.message_text,
        )

    log.status = FollowUpStatus.SENT
    log.sent_at = now
    log.wa_message_id = wa_msg_id
    logger.info(f"Follow-up enviado a {contact.wa_phone}, step {log.step_number}")
