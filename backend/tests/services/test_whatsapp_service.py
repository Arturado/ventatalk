"""Tests del WhatsAppService."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.whatsapp_service import WhatsAppService


@pytest.fixture
def wa():
    return WhatsAppService(
        phone_number_id="test_phone_id",
        access_token="test_access_token",
    )


def _mock_response(status_code: int, json_data: dict):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    return resp


@pytest.mark.asyncio
async def test_send_text_success(wa: WhatsAppService):
    mock_resp = _mock_response(200, {"messages": [{"id": "wamid.abc123"}]})

    with patch("app.services.whatsapp_service.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
        result = await wa.send_text(to="56912345678", text="Hola!")

    assert result == "wamid.abc123"


@pytest.mark.asyncio
async def test_send_text_formats_phone(wa: WhatsAppService):
    """El número debe llegar sin + ni espacios."""
    mock_resp = _mock_response(200, {"messages": [{"id": "wamid.abc"}]})
    captured_payload = {}

    async def fake_post(url, json, headers):
        captured_payload.update(json)
        return mock_resp

    with patch("app.services.whatsapp_service.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = fake_post
        await wa.send_text(to="+56 9 1234 5678", text="Test")

    assert captured_payload["to"] == "56912345678"


@pytest.mark.asyncio
async def test_send_text_expired_window(wa: WhatsAppService):
    """Error 131047 (ventana expirada) → retorna None, no explota."""
    mock_resp = _mock_response(400, {
        "error": {"code": 131047, "message": "Message failed to send because more than 24 hours have passed"}
    })

    with patch("app.services.whatsapp_service.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
        result = await wa.send_text(to="56912345678", text="Follow up")

    assert result is None


@pytest.mark.asyncio
async def test_send_template_success(wa: WhatsAppService):
    mock_resp = _mock_response(200, {"messages": [{"id": "wamid.template_001"}]})

    with patch("app.services.whatsapp_service.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
        result = await wa.send_template(
            to="56912345678",
            template_name="followup_cotizacion_v1",
            template_vars=["Juan", "Clínica Test"],
        )

    assert result == "wamid.template_001"


@pytest.mark.asyncio
async def test_send_interactive_buttons(wa: WhatsAppService):
    mock_resp = _mock_response(200, {"messages": [{"id": "wamid.btn_001"}]})

    with patch("app.services.whatsapp_service.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
        result = await wa.send_interactive_buttons(
            to="56912345678",
            body_text="¿Te interesa agendar una hora?",
            buttons=[
                {"id": "btn_si", "title": "Sí, agendarme"},
                {"id": "btn_no", "title": "No por ahora"},
            ],
        )

    assert result == "wamid.btn_001"


def test_format_phone():
    assert WhatsAppService._format_phone("+56 9 1234 5678") == "56912345678"
    assert WhatsAppService._format_phone("56912345678") == "56912345678"
    assert WhatsAppService._format_phone("+56912345678") == "56912345678"
