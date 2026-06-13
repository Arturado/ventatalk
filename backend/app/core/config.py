from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_ENV: str = "development"
    APP_URL: str = "https://app.ventatalk.com"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 días
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # DB
    DATABASE_URL: str
    DATABASE_URL_SYNC: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_CHAT_TEMPERATURE: float = 0.3

    # Meta WhatsApp
    META_VERIFY_TOKEN: str
    META_APP_SECRET: str
    META_APP_ID: str = ""
    META_CONFIG_ID: str = ""
    WHATSAPP_API_VERSION: str = "v19.0"

    # API pública
    API_URL: str = "http://localhost:8000"

    # Frontend
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"

    # Chat widget público
    WIDGET_BUSINESS_ID: Optional[str] = None
    WIDGET_ORIGIN: str = "https://ventatalk.com"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    # Precios mensuales
    STRIPE_PRICE_STARTER: str = ""
    STRIPE_PRICE_PRO: str = ""
    STRIPE_PRICE_MAX: str = ""
    # Precios anuales
    STRIPE_PRICE_STARTER_ANNUAL: str = ""
    STRIPE_PRICE_PRO_ANNUAL: str = ""
    STRIPE_PRICE_MAX_ANNUAL: str = ""

    # Superadmin
    SUPERADMIN_EMAIL: str = ""

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()