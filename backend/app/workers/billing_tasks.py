"""
Billing tasks: reset mensual de contadores de conversaciones.

Flujo:
  1. reset_monthly_conversations: corre el día 1 de cada mes a las 00:05 UTC
  2. Busca todos los Business con conversations_reset_at <= ahora
  3. Resetea conversations_this_month = 0
  4. Avanza conversations_reset_at al primer día del mes siguiente
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.models import Business
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.billing_tasks.reset_monthly_conversations")
def reset_monthly_conversations():
    asyncio.run(_reset_monthly_conversations_async())


async def _reset_monthly_conversations_async():
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Business).where(Business.conversations_reset_at <= now)
        )
        businesses = result.scalars().all()

        for business in businesses:
            business.conversations_this_month = 0
            if now.month == 12:
                business.conversations_reset_at = now.replace(
                    year=now.year + 1, month=1, day=1,
                    hour=0, minute=0, second=0, microsecond=0,
                )
            else:
                business.conversations_reset_at = now.replace(
                    month=now.month + 1, day=1,
                    hour=0, minute=0, second=0, microsecond=0,
                )
            logger.info(
                f"Business {business.id}: reset a 0, próximo reset {business.conversations_reset_at}"
            )

        await db.commit()
        logger.info(f"Reset mensual completado: {len(businesses)} businesses actualizados")
