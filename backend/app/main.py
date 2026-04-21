from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.rate_limit import RateLimitMiddleware
from app.api.v1.endpoints import auth, webhook, business, conversations, analytics, phone_numbers, integrations, tracking, chat_widget
from app.api.v1.endpoints.contacts import contacts_router, leads_router

settings = get_settings()
logging.basicConfig(
    level=logging.INFO if settings.APP_ENV == "development" else logging.WARNING,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.getLogger(__name__).info(f"VentaBot API iniciando [{settings.APP_ENV}]")
    yield


app = FastAPI(
    title="VentaBot API",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)

_cors_origins = list({
    "http://localhost:3000",
    "http://localhost:3001",
    settings.NEXT_PUBLIC_API_URL,
    settings.WIDGET_ORIGIN,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

PREFIX = "/api/v1"
app.include_router(auth.router,          prefix=PREFIX)
app.include_router(business.router,      prefix=PREFIX)
app.include_router(conversations.router, prefix=PREFIX)
app.include_router(contacts_router,      prefix=PREFIX)
app.include_router(leads_router,         prefix=PREFIX)
app.include_router(analytics.router,     prefix=PREFIX)
app.include_router(phone_numbers.router, prefix=PREFIX)
app.include_router(integrations.router,  prefix=PREFIX)
app.include_router(tracking.router,      prefix=PREFIX)
app.include_router(tracking.public_router)         # /track/{token} — sin prefijo, público
app.include_router(chat_widget.router,   prefix=PREFIX)  # /api/v1/chat/widget — sin auth
app.include_router(webhook.router)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}