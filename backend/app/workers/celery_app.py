"""
Workers de Celery para tareas asíncronas:
  - Follow-up sequences
  - Re-indexado de embeddings
"""

from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ventabot",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.followup_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Santiago",
    enable_utc=True,
    # Beat schedule: revisar follow-ups pendientes cada minuto
    beat_schedule={
        "check-pending-followups": {
            "task": "app.workers.followup_tasks.send_pending_followups",
            "schedule": 60.0,  # cada 60 segundos
        },
    },
    task_routes={
        "app.workers.followup_tasks.*": {"queue": "followups"},
    },
)
