from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_business
from app.models.models import Business, PhoneNumber

router = APIRouter(prefix="/phone-numbers", tags=["phone-numbers"])


class PhoneNumberCreate(BaseModel):
    phone_number_id: str   # De Meta (PHONE_NUMBER_ID)
    phone_number: str      # ej: +56912345678
    display_name: str
    access_token: str      # Token de Meta
    waba_id: str           # WhatsApp Business Account ID


class PhoneNumberOut(BaseModel):
    id: str
    phone_number_id: str
    phone_number: str
    display_name: str
    waba_id: str
    is_active: bool


@router.get("", response_model=list[PhoneNumberOut])
async def list_phone_numbers(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PhoneNumber).where(PhoneNumber.business_id == business.id)
    )
    return [_out(p) for p in result.scalars().all()]


@router.post("", response_model=PhoneNumberOut, status_code=201)
async def add_phone_number(
    body: PhoneNumberCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    # Validar límite del plan
    result = await db.execute(
        select(PhoneNumber).where(
            PhoneNumber.business_id == business.id,
            PhoneNumber.is_active == True,
        )
    )
    current_count = len(result.scalars().all())
    if current_count >= business.max_phone_numbers:
        raise HTTPException(
            403,
            f"Tu plan permite máximo {business.max_phone_numbers} número(s). "
            "Actualiza tu plan para agregar más."
        )

    # Verificar que el phone_number_id no esté ya registrado
    existing = await db.execute(
        select(PhoneNumber).where(PhoneNumber.phone_number_id == body.phone_number_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Este número ya está registrado en otra cuenta")

    phone = PhoneNumber(
        business_id=business.id,
        **body.model_dump(),
    )
    db.add(phone)
    await db.commit()
    await db.refresh(phone)
    return _out(phone)


@router.delete("/{phone_id}", status_code=204)
async def remove_phone_number(
    phone_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PhoneNumber).where(
            PhoneNumber.id == phone_id,
            PhoneNumber.business_id == business.id,
        )
    )
    phone = result.scalar_one_or_none()
    if not phone:
        raise HTTPException(404)
    phone.is_active = False  # Soft delete para no romper historial


def _out(p: PhoneNumber) -> PhoneNumberOut:
    return PhoneNumberOut(
        id=str(p.id),
        phone_number_id=p.phone_number_id,
        phone_number=p.phone_number,
        display_name=p.display_name,
        waba_id=p.waba_id,
        is_active=p.is_active,
    )
