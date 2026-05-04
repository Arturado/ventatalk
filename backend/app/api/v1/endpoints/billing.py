"""
Endpoints de facturación con Stripe: checkout, webhook y portal del cliente.
"""
import logging
from datetime import datetime, timezone, timedelta

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.plan_limits import get_plan_limits, get_plan_features
from app.core.security import get_current_business
from app.models.models import Business, PlanType

logger = logging.getLogger(__name__)
settings = get_settings()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])


def _price_to_plan() -> dict[str, str]:
    return {
        settings.STRIPE_PRICE_STARTER: "starter",
        settings.STRIPE_PRICE_STARTER_ANNUAL: "starter",
        settings.STRIPE_PRICE_PRO: "pro",
        settings.STRIPE_PRICE_PRO_ANNUAL: "pro",
        settings.STRIPE_PRICE_MAX: "max",
        settings.STRIPE_PRICE_MAX_ANNUAL: "max",
    }


def _plan_to_price(plan: str, annual: bool = False) -> str | None:
    mapping = {
        ("starter", False): settings.STRIPE_PRICE_STARTER,
        ("starter", True): settings.STRIPE_PRICE_STARTER_ANNUAL,
        ("pro", False): settings.STRIPE_PRICE_PRO,
        ("pro", True): settings.STRIPE_PRICE_PRO_ANNUAL,
        ("max", False): settings.STRIPE_PRICE_MAX,
        ("max", True): settings.STRIPE_PRICE_MAX_ANNUAL,
    }
    return mapping.get((plan.lower(), annual))


class CheckoutRequest(BaseModel):
    plan: str        # "starter" | "pro" | "max"
    annual: bool = False


@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CheckoutRequest,
    business: Business = Depends(get_current_business),
):
    """Crea una Stripe Embedded Checkout Session y devuelve el client_secret."""
    plan = body.plan.lower()
    price_id = _plan_to_price(plan, body.annual)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Plan inválido: {plan}")

    try:
        # Usar customer existente si ya tiene stripe_customer_id
        customer_kwargs = {}
        if business.stripe_customer_id:
            customer_kwargs["customer"] = business.stripe_customer_id
        else:
            customer_kwargs["customer_email"] = business.email

        session = stripe.checkout.Session.create(
            ui_mode="embedded",
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            return_url=f"{settings.APP_URL}/dashboard?upgraded=true",
            metadata={
                "business_id": str(business.id),
                "plan": plan,
                "annual": str(body.annual),
            },
            **customer_kwargs,
        )
    except stripe.StripeError as e:
        logger.error("Stripe error creating checkout session: %s", e)
        raise HTTPException(status_code=502, detail="Error al conectar con Stripe")

    return {"client_secret": session.client_secret}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Procesa eventos de Stripe. Siempre retorna 200."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        logger.warning("Stripe webhook: firma inválida")
        return {"status": "invalid_signature"}
    except Exception as e:
        logger.error("Stripe webhook parse error: %s", e)
        return {"status": "error"}

    if event["type"] == "checkout.session.completed":
        await _handle_checkout_completed(event["data"]["object"], db)

    elif event["type"] == "customer.subscription.updated":
        await _handle_subscription_updated(event["data"]["object"], db)

    elif event["type"] == "customer.subscription.deleted":
        await _handle_subscription_deleted(event["data"]["object"], db)

    return {"status": "ok"}


async def _handle_checkout_completed(session: dict, db: AsyncSession):
    business_id = (session.get("metadata") or {}).get("business_id")
    subscription_id = session.get("subscription")
    customer_id = session.get("customer")

    if not business_id or not subscription_id:
        logger.warning("checkout.session.completed sin business_id o subscription_id")
        return

    try:
        subscription = stripe.Subscription.retrieve(
            subscription_id, expand=["items.data.price"]
        )
        price_id = subscription["items"]["data"][0]["price"]["id"]
        plan_name = _price_to_plan().get(price_id)

        if not plan_name:
            logger.warning("Webhook: price_id desconocido %s", price_id)
            return

        business = await db.get(Business, business_id)
        if not business:
            logger.warning("Webhook: business %s no encontrado", business_id)
            return

        limits = get_plan_limits(plan_name)
        features = get_plan_features(plan_name)

        # Preservar add-ons activos si ya tenía features
        if business.features:
            existing = business.features
            # Mantener add-ons que el cliente ya pagó
            for addon in ["instagram", "mercadolibre", "extra_stores", "extra_whatsapp_numbers"]:
                if existing.get(addon):
                    features[addon] = existing[addon]

        annual = (session.get("metadata") or {}).get("annual") == "True"

        business.plan = PlanType(plan_name)
        business.stripe_customer_id = customer_id
        business.stripe_subscription_id = subscription_id
        business.billing_cycle = "annual" if annual else "monthly"
        business.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=365 if annual else 30)
        business.max_phone_numbers = limits["max_phone_numbers"]
        business.max_conversations_per_month = limits["max_conversations_per_month"]
        business.features = features

        await db.commit()
        logger.info("Plan actualizado a %s para business %s", plan_name, business_id)

    except Exception as e:
        logger.error("Error procesando checkout.session.completed: %s", e)


async def _handle_subscription_updated(subscription: dict, db: AsyncSession):
    """Maneja cambios de plan (upgrades/downgrades)."""
    try:
        customer_id = subscription.get("customer")
        price_id = subscription["items"]["data"][0]["price"]["id"]
        plan_name = _price_to_plan().get(price_id)

        if not plan_name or not customer_id:
            return

        from sqlalchemy import select
        result = await db.execute(
            select(Business).where(Business.stripe_customer_id == customer_id)
        )
        business = result.scalar_one_or_none()
        if not business:
            logger.warning("subscription.updated: no business para customer %s", customer_id)
            return

        limits = get_plan_limits(plan_name)
        features = get_plan_features(plan_name)

        # Preservar add-ons activos
        if business.features:
            for addon in ["instagram", "mercadolibre", "extra_stores", "extra_whatsapp_numbers"]:
                if business.features.get(addon):
                    features[addon] = business.features[addon]

        business.plan = PlanType(plan_name)
        business.stripe_subscription_id = subscription["id"]
        business.max_phone_numbers = limits["max_phone_numbers"]
        business.max_conversations_per_month = limits["max_conversations_per_month"]
        business.features = features

        await db.commit()
        logger.info("Suscripción actualizada a %s para business %s", plan_name, business.id)

    except Exception as e:
        logger.error("Error procesando subscription.updated: %s", e)


async def _handle_subscription_deleted(subscription: dict, db: AsyncSession):
    """Maneja cancelaciones — desactiva el tenant."""
    try:
        customer_id = subscription.get("customer")
        if not customer_id:
            return

        from sqlalchemy import select
        result = await db.execute(
            select(Business).where(Business.stripe_customer_id == customer_id)
        )
        business = result.scalar_one_or_none()
        if not business:
            return

        business.is_active = False
        business.stripe_subscription_id = None
        await db.commit()
        logger.info("Suscripción cancelada para business %s", business.id)

    except Exception as e:
        logger.error("Error procesando subscription.deleted: %s", e)


@router.get("/portal")
async def billing_portal(business: Business = Depends(get_current_business)):
    """Crea una Stripe Billing Portal Session para que el cliente gestione su suscripción."""
    if not business.stripe_customer_id:
        raise HTTPException(
            status_code=404,
            detail="No se encontró una suscripción activa para este negocio",
        )

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=business.stripe_customer_id,
            return_url=f"{settings.APP_URL}/dashboard/settings",
        )
    except stripe.StripeError as e:
        logger.error("Stripe error creating portal session: %s", e)
        raise HTTPException(status_code=502, detail="Error al conectar con Stripe")

    return {"portal_url": portal_session.url}