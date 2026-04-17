"""Tests de conversations."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Contact, Conversation, ConversationStatus, Message, MessageRole


async def _create_conversation(db: AsyncSession, business, phone_number) -> tuple:
    contact = Contact(business_id=business.id, wa_phone="56911111111", name="María")
    db.add(contact)
    await db.flush()

    conv = Conversation(
        business_id=business.id,
        contact_id=contact.id,
        phone_number_id=phone_number.id,
        status=ConversationStatus.AI_HANDLING,
    )
    db.add(conv)
    await db.flush()

    msg = Message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content="Hola, quiero información",
        wa_message_id="wamid.test_list_001",
    )
    db.add(msg)
    await db.flush()
    return contact, conv


@pytest.mark.asyncio
async def test_list_conversations_empty(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/conversations", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_list_conversations(client: AsyncClient, db, business, phone_number, auth_headers):
    await _create_conversation(db, business, phone_number)
    res = await client.get("/api/v1/conversations", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["contact_name"] == "María"
    assert data[0]["status"] == "ai_handling"


@pytest.mark.asyncio
async def test_get_conversation_detail(client: AsyncClient, db, business, phone_number, auth_headers):
    _, conv = await _create_conversation(db, business, phone_number)
    res = await client.get(f"/api/v1/conversations/{conv.id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(conv.id)
    assert len(data["messages"]) == 1
    assert data["messages"][0]["role"] == "user"


@pytest.mark.asyncio
async def test_get_conversation_not_found(client: AsyncClient, auth_headers):
    import uuid
    res = await client.get(f"/api/v1/conversations/{uuid.uuid4()}", headers=auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_close_conversation(client: AsyncClient, db, business, phone_number, auth_headers):
    _, conv = await _create_conversation(db, business, phone_number)
    res = await client.put(f"/api/v1/conversations/{conv.id}/close", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "closed"


@pytest.mark.asyncio
async def test_assign_conversation(client: AsyncClient, db, business, phone_number, auth_headers):
    _, conv = await _create_conversation(db, business, phone_number)
    res = await client.put(f"/api/v1/conversations/{conv.id}/assign", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "human_assigned"


@pytest.mark.asyncio
async def test_filter_by_status(client: AsyncClient, db, business, phone_number, auth_headers):
    _, conv = await _create_conversation(db, business, phone_number)
    # Filtro que no coincide
    res = await client.get("/api/v1/conversations?status=closed", headers=auth_headers)
    assert res.json() == []
    # Filtro que sí coincide
    res = await client.get("/api/v1/conversations?status=ai_handling", headers=auth_headers)
    assert len(res.json()) == 1
