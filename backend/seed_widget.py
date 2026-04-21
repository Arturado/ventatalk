#!/usr/bin/env python3
"""
seed_widget.py — Crea el negocio interno 'VentaTalk Web' para el chat widget público.

El negocio se usa como tenant de las conversaciones que llegan desde ventatalk.com.
No tiene teléfonos WhatsApp ni acceso al dashboard (contraseña aleatoria).

Uso:
  docker compose exec api python seed_widget.py
  # o en local:
  cd backend && python seed_widget.py

Al finalizar, imprime el WIDGET_BUSINESS_ID que debes agregar al .env
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.models import Business, PlanType

settings = get_settings()
engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

_WIDGET_EMAIL = "widget@ventatalk.com"
_WIDGET_NAME = "VentaTalk Web"
_WIDGET_SLUG = "ventatalk-web"


async def main() -> None:
    async with SessionLocal() as db:
        result = await db.execute(
            select(Business).where(Business.email == _WIDGET_EMAIL)
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"⚠️  El negocio '{existing.name}' ya existe (id: {existing.id}).")
            _print_env(existing.id)
            return

        business = Business(
            name=_WIDGET_NAME,
            slug=_WIDGET_SLUG,
            email=_WIDGET_EMAIL,
            hashed_password=hash_password(os.urandom(32).hex()),
            ai_tone="amigable",
            ai_enabled=True,
            plan=PlanType.BUSINESS,
            max_phone_numbers=0,
            max_conversations_per_month=100_000,
        )
        db.add(business)
        await db.commit()
        await db.refresh(business)

        print(f"✅  Negocio creado: {business.name}")
        _print_env(business.id)


def _print_env(business_id) -> None:
    print()
    print("Agrega esta línea a tu .env:")
    print()
    print(f"  WIDGET_BUSINESS_ID={business_id}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
