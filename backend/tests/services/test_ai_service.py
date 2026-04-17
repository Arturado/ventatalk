"""Tests del AIService — clasificación de intención y construcción de prompt."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Business, Conversation, ConversationStatus, Contact, MessageIntent
from app.services.ai_service import AIService


@pytest.fixture
def ai_service(db: AsyncSession, business: Business) -> AIService:
    return AIService(db, business)


@pytest.mark.asyncio
async def test_classify_intent_quote_request(ai_service: AIService):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"intent": "quote_request"}'

    with patch.object(ai_service, "_classify_intent", return_value=MessageIntent.QUOTE_REQUEST):
        intent = await ai_service._classify_intent("¿Cuánto cuesta el botox?")
    assert intent == MessageIntent.QUOTE_REQUEST


@pytest.mark.asyncio
async def test_classify_intent_fallback_on_error(ai_service: AIService):
    """Si OpenAI falla, debe retornar OTHER sin explotar."""
    with patch("app.services.ai_service.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("OpenAI down"))
        intent = await ai_service._classify_intent("texto cualquiera")
    assert intent == MessageIntent.OTHER


@pytest.mark.asyncio
async def test_classify_intent_invalid_json(ai_service: AIService):
    """JSON malformado → fallback a OTHER."""
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "esto no es json"

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        intent = await ai_service._classify_intent("algo")
    assert intent == MessageIntent.OTHER


@pytest.mark.asyncio
async def test_system_prompt_includes_business_name(ai_service: AIService):
    prompt = ai_service._build_system_prompt("contexto del catálogo", MessageIntent.GENERAL_INFO)
    assert "Clínica Test" in prompt


@pytest.mark.asyncio
async def test_system_prompt_includes_catalog(ai_service: AIService):
    catalog = "• Botox: tratamiento facial — $150.000 CLP"
    prompt = ai_service._build_system_prompt(catalog, MessageIntent.QUOTE_REQUEST)
    assert "Botox" in prompt
    assert "150.000" in prompt


@pytest.mark.asyncio
async def test_system_prompt_escalation_rule(ai_service: AIService):
    prompt = ai_service._build_system_prompt("", MessageIntent.COMPLAINT)
    assert "[ESCALAR]" in prompt


@pytest.mark.asyncio
async def test_generate_response_detects_escalation(ai_service: AIService):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "[ESCALAR] No puedo resolver esto."
    mock_response.usage.prompt_tokens = 80
    mock_response.usage.completion_tokens = 20

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        text, _, _, should_escalate = await ai_service._generate_response(
            user_text="Estoy muy enojado",
            intent=MessageIntent.COMPLAINT,
            catalog_context="",
            history=[],
        )
    assert should_escalate is True
    assert "[ESCALAR]" not in text  # se limpia del texto final


@pytest.mark.asyncio
async def test_generate_response_no_escalation(ai_service: AIService):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "El botox cuesta $150.000 CLP. ¿Te interesa agendar?"
    mock_response.usage.prompt_tokens = 120
    mock_response.usage.completion_tokens = 30

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        text, tokens_in, tokens_out, should_escalate = await ai_service._generate_response(
            user_text="¿Cuánto cuesta el botox?",
            intent=MessageIntent.QUOTE_REQUEST,
            catalog_context="• Botox — $150.000 CLP",
            history=[],
        )
    assert should_escalate is False
    assert "150.000" in text
    assert tokens_in == 120
    assert tokens_out == 30


@pytest.mark.asyncio
async def test_generate_response_fallback_on_error(ai_service: AIService):
    """Si OpenAI falla en la generación, retorna mensaje de fallback y escala."""
    with patch("app.services.ai_service.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("timeout"))
        text, _, _, should_escalate = await ai_service._generate_response(
            user_text="algo", intent=MessageIntent.OTHER,
            catalog_context="", history=[],
        )
    assert should_escalate is True
    assert "agente" in text.lower()
