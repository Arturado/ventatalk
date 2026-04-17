"""
Webhook de Meta WhatsApp Cloud API.

Dos endpoints:
  GET  /webhook  → verificación de Meta (challenge handshake)
  POST /webhook  → recepción de mensajes

CRÍTICO:
  - El POST debe responder 200 en < 1 segundo o Meta reintenta (3 veces).
  - Todo el procesamiento va en background task.
  - Validar X-Hub-Signature-256 para seguridad.
"""

import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.core.config import get_settings
from app.services.message_processor import process_incoming_message

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["webhook"])


# ────────────────────────────────────────────────────────────────────
# GET /webhook — Meta challenge handshake
# ────────────────────────────────────────────────────────────────────

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
) -> PlainTextResponse:
    """
    Meta llama a este endpoint cuando configuras el webhook.
    Debes devolver hub.challenge como texto plano para confirmar ownership.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        logger.info("Webhook verificado correctamente por Meta")
        return PlainTextResponse(hub_challenge)

    logger.warning("Intento de verificación con token inválido")
    raise HTTPException(status_code=403, detail="Forbidden")


# ────────────────────────────────────────────────────────────────────
# POST /webhook — Mensajes entrantes
# ────────────────────────────────────────────────────────────────────

@router.post("/webhook", status_code=200)
async def receive_message(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str = Header(default=None, alias="x-hub-signature-256"),
) -> dict:
    """
    Recibe mensajes de WhatsApp.
    1. Valida firma (seguridad).
    2. Responde 200 de inmediato.
    3. Procesa en background.
    """
    body_bytes = await request.body()

    # ── Validar firma HMAC-SHA256 ────────────────────────────────────
    if not _validate_signature(body_bytes, x_hub_signature_256):
        logger.warning("Firma inválida en webhook - posible request falso")
        raise HTTPException(status_code=403, detail="Invalid signature")

    # ── Parsear payload ──────────────────────────────────────────────
    try:
        payload: dict[str, Any] = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # ── Ignorar si no es WhatsApp ────────────────────────────────────
    if payload.get("object") != "whatsapp_business_account":
        return {"status": "ignored"}

    # ── Extraer y encolar mensajes ───────────────────────────────────
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")

            # Procesar mensajes entrantes
            for message in value.get("messages", []):
                background_tasks.add_task(
                    process_incoming_message,
                    message=message,
                    phone_number_id=phone_number_id,
                    contacts_info=value.get("contacts", []),
                )

            # Procesar actualizaciones de estado (delivered, read, failed)
            for status_update in value.get("statuses", []):
                background_tasks.add_task(
                    _handle_status_update,
                    status_update=status_update,
                )

    return {"status": "ok"}


# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────

def _validate_signature(body: bytes, signature_header: str | None) -> bool:
    """
    Meta firma el body con HMAC-SHA256 usando el App Secret.
    Header formato: sha256=<hex_digest>
    En desarrollo puedes desactivar esto, pero NUNCA en prod.
    """
    if settings.APP_ENV == "development":
        return True  # Permite testing local sin firma

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = hmac.new(
        settings.META_APP_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    received = signature_header[len("sha256="):]
    return hmac.compare_digest(expected, received)


async def _handle_status_update(status_update: dict) -> None:
    """
    Actualiza el estado de entrega de mensajes enviados.
    wa_message_id + status: sent | delivered | read | failed
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import Message
    from sqlalchemy import update

    wa_id = status_update.get("id")
    new_status = status_update.get("status")  # sent | delivered | read | failed

    if not wa_id or not new_status:
        return

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Message)
            .where(Message.wa_message_id == wa_id)
            .values(wa_status=new_status)
        )
        await db.commit()

    logger.debug(f"Estado actualizado: {wa_id} → {new_status}")
