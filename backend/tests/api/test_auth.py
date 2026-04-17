"""Tests de autenticación."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_ok(client: AsyncClient):
    res = await client.post("/api/v1/auth/register", json={
        "name": "Mi Taller",
        "email": "taller@test.cl",
        "password": "segura123",
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, business):
    res = await client.post("/api/v1/auth/register", json={
        "name": "Otro",
        "email": "test@clinica.cl",  # mismo email que fixture business
        "password": "pass123",
    })
    assert res.status_code == 400
    assert "ya registrado" in res.json()["detail"]


@pytest.mark.asyncio
async def test_login_ok(client: AsyncClient, business):
    res = await client.post(
        "/api/v1/auth/login",
        data={"username": "test@clinica.cl", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, business):
    res = await client.post(
        "/api/v1/auth/login",
        data={"username": "test@clinica.cl", "password": "wrong"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "test@clinica.cl"
    assert data["plan"] == "starter"


@pytest.mark.asyncio
async def test_me_no_token(client: AsyncClient):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_bad_token(client: AsyncClient):
    res = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer token_falso"})
    assert res.status_code == 401
