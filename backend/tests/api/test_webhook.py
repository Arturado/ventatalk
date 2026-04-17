"""
Tests del webhook de Meta WhatsApp.
"""
import hashlib
import hmac
import json

import pytest
from httpx import AsyncClient

from app.core.config import get_settings

settings = get_settings()


def _make_signature(body: bytes) -> str:
    """Genera firma HMAC-SHA256 válida como la de Meta."""
    sig = hmac.new(
        settings.META_APP_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={sig}"


def _wa_payload(phone_number_id: str, from_phone: str, text: str, msg_id: str = "wamid.test123") -> dict:
    """Construye payload realista de Meta."""
    return {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "entry_id",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"phone_number_id": phone_number_id},
                    "contacts": [{"wa_id": from_phone, "profile": {"name": "Juan Test"}}],
                    "messages": [{
                        "id": msg_id,
                        "from": from_phone,
                        "type": "text",
                        "text": {"body": text},
                        "timestamp": "1700000000",
                    }],
                },
                "field": "messages",
            }],
        }],
    }


# ── GET /webhook — verificación Meta ─────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_verification_ok(client: AsyncClient):
    res = await client.get("/webhook", params={
        "hub.mode": "subscribe",
        "hub.verify_token": settings.META_VERIFY_TOKEN,
        "hub.challenge": "challenge_abc123",
    })
    assert res.status_code == 200
    assert res.text == "challenge_abc123"


@pytest.mark.asyncio
async def test_webhook_verification_wrong_token(client: AsyncClient):
    res = await client.get("/webhook", params={
        "hub.mode": "subscribe",
        "hub.verify_token": "token_equivocado",
        "hub.challenge": "challenge_abc",
    })
    assert res.status_code == 403


# ── POST /webhook — recepción de mensajes ────────────────────────────

@pytest.mark.asyncio
async def test_webhook_ignores_non_whatsapp(client: AsyncClient):
    body = json.dumps({"object": "instagram"}).encode()
    res = await client.post(
        "/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "x-hub-signature-256": _make_signature(body),
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"


@pytest.mark.asyncio
async def test_webhook_invalid_signature(client: AsyncClient):
    body = json.dumps({"object": "whatsapp_business_account"}).encode()
    res = await client.post(
        "/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "x-hub-signature-256": "sha256=firma_falsa",
        },
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_webhook_message_enqueued(client: AsyncClient, phone_number, mock_openai, mock_whatsapp):
    """
    Mensaje válido → responde 200 inmediatamente.
    El procesamiento es async (background task) así que no esperamos la respuesta de IA,
    solo que el endpoint responda rápido y no explote.
    """
    payload = _wa_payload(
        phone_number_id=phone_number.phone_number_id,
        from_phone="56987654321",
        text="Hola, ¿cuánto cuesta un tratamiento facial?",
        msg_id="wamid.unique_test_001",
    )
    body = json.dumps(payload).encode()
    res = await client.post(
        "/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "x-hub-signature-256": _make_signature(body),
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_webhook_status_update(client: AsyncClient):
    """Actualizaciones de estado (delivered, read) también deben responder 200."""
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "changes": [{
                "value": {
                    "metadata": {"phone_number_id": "any"},
                    "statuses": [{
                        "id": "wamid.some_id",
                        "status": "delivered",
                        "timestamp": "1700000001",
                    }],
                },
                "field": "messages",
            }],
        }],
    }
    body = json.dumps(payload).encode()
    res = await client.post(
        "/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "x-hub-signature-256": _make_signature(body),
        },
    )
    assert res.status_code == 200
