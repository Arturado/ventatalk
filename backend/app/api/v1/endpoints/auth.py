from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
import uuid

from app.core.database import get_db
from app.core.config import get_settings
from app.core.plan_limits import get_plan_features, get_plan_limits
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_business,
)
from app.models.models import Business
import re

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Verificar email único
    result = await db.execute(select(Business).where(Business.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email ya registrado")

    slug = _slugify(body.name)
    # Slug único
    existing_slug = await db.execute(select(Business).where(Business.slug == slug))
    if existing_slug.scalar_one_or_none():
        slug = f"{slug}-{body.email.split('@')[0]}"

    # Asignar límites y features del plan Starter por defecto
    starter_limits = get_plan_limits("starter")
    starter_features = get_plan_features("starter")

    business = Business(
        name=body.name,
        slug=slug,
        email=body.email,
        hashed_password=hash_password(body.password),
        # Límites
        max_phone_numbers=starter_limits["max_phone_numbers"],
        max_conversations_per_month=starter_limits["max_conversations_per_month"],
        # Features
        features=starter_features,
        # Contadores
        conversations_this_month=0,
        billing_cycle="monthly",
    )
    db.add(business)
    await db.commit()
    await db.refresh(business)

    return TokenResponse(
        access_token=create_access_token(business.id),
        refresh_token=create_refresh_token(business.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Business).where(Business.email == form.username))
    business = result.scalar_one_or_none()

    if not business or not verify_password(form.password, business.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    return TokenResponse(
        access_token=create_access_token(business.id),
        refresh_token=create_refresh_token(business.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Intercambia un refresh token válido por un nuevo par de tokens (rotation)."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido o expirado",
    )
    try:
        payload = jwt.decode(body.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        business_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if not business_id or token_type != "refresh":
            raise invalid
    except JWTError:
        raise invalid

    result = await db.execute(select(Business).where(Business.id == uuid.UUID(business_id)))
    business = result.scalar_one_or_none()
    if not business or not business.is_active:
        raise invalid

    return TokenResponse(
        access_token=create_access_token(business.id),
        refresh_token=create_refresh_token(business.id),
    )


@router.get("/me")
async def me(business: Business = Depends(get_current_business)):
    return {
        "id": str(business.id),
        "name": business.name,
        "email": business.email,
        "plan": business.plan,
        "billing_cycle": business.billing_cycle,
        "features": business.features,
        "ai_tone": business.ai_tone,
        "ai_enabled": business.ai_enabled,
        "ai_instructions": business.ai_instructions,
        "conversations_this_month": business.conversations_this_month,
        "max_conversations_per_month": business.max_conversations_per_month,
    }