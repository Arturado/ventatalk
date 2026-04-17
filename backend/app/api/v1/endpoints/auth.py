from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_business,
)
from app.models.models import Business
import re

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


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

    business = Business(
        name=body.name,
        slug=slug,
        email=body.email,
        hashed_password=hash_password(body.password),
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


@router.get("/me")
async def me(business: Business = Depends(get_current_business)):
    return {
        "id": str(business.id),
        "name": business.name,
        "email": business.email,
        "plan": business.plan,
        "ai_tone": business.ai_tone,
        "ai_enabled": business.ai_enabled,
        "ai_instructions": business.ai_instructions,
    }