"""
conftest.py — fixtures globales de pytest.

Estrategia:
  - Una DB de test separada (ventabot_test)
  - Cada test corre en una transaction que se hace rollback al terminar
  - Se mockea OpenAI y WhatsApp para no gastar dinero ni depender de red
"""
import asyncio
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
from app.models.models import Business, PhoneNumber

settings = get_settings()

# ── Engine de test ────────────────────────────────────────────────────
test_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    """Crea todas las tablas al inicio de la sesión de tests y las borra al final."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """
    Cada test obtiene una sesión en una transaction anidada (savepoint).
    Al terminar el test se hace rollback → DB limpia para el siguiente.
    """
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Cliente HTTP que usa la DB de test inyectada."""
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def business(db: AsyncSession) -> Business:
    """Negocio de prueba ya creado en DB."""
    b = Business(
        name="Clínica Test",
        slug="clinica-test",
        email="test@clinica.cl",
        hashed_password=hash_password("password123"),
        ai_enabled=True,
        ai_tone="amigable",
    )
    db.add(b)
    await db.flush()
    return b


@pytest_asyncio.fixture
async def phone_number(db: AsyncSession, business: Business) -> PhoneNumber:
    """Número de WhatsApp de prueba."""
    p = PhoneNumber(
        business_id=business.id,
        phone_number_id="test_phone_number_id_123",
        phone_number="+56912345678",
        display_name="Test WA",
        access_token="test_access_token",
        waba_id="test_waba_id",
    )
    db.add(p)
    await db.flush()
    return p


@pytest_asyncio.fixture
async def auth_headers(business: Business) -> dict:
    """Headers con JWT válido para el negocio de test."""
    token = create_access_token(business.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_openai():
    """Mockea todas las llamadas a OpenAI."""
    with patch("app.services.ai_service.client") as mock:
        # Mock classify intent
        intent_response = MagicMock()
        intent_response.choices[0].message.content = '{"intent": "general_info"}'
        # Mock generate response
        chat_response = MagicMock()
        chat_response.choices[0].message.content = "Hola, ¿en qué puedo ayudarte?"
        chat_response.usage.prompt_tokens = 100
        chat_response.usage.completion_tokens = 50
        # Mock embeddings
        embed_response = MagicMock()
        embed_response.data[0].embedding = [0.1] * 1536

        mock.chat.completions.create = AsyncMock(side_effect=[intent_response, chat_response])
        mock.embeddings.create = AsyncMock(return_value=embed_response)
        yield mock


@pytest.fixture
def mock_whatsapp():
    """Mockea envíos a WhatsApp."""
    with patch("app.services.whatsapp_service.httpx.AsyncClient") as mock:
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {"messages": [{"id": "wa_msg_test_123"}]}
        mock.return_value.__aenter__.return_value.post = AsyncMock(return_value=response)
        yield mock
