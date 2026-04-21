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
from app.core.plan_limits import PLAN_LIMITS
from app.core.security import get_current_business
from app.models.models import Business, PlanType

logger = logging.getLogger(__name__)
settings = get_settings()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])


def _price_to_plan() -> dict[str, str]:
    return {
        settings.STRIPE_PRICE_STARTER: "starter",
        settings.STRIPE_PRICE_PRO: "pro",
        settings.STRIPE_PRICE_BUSINESS: "business",
    }


def _plan_to_price() -> dict[str, str]:
    return {
        "starter": settings.STRIPE_PRICE_STARTER,
        "pro": settings.STRIPE_PRICE_PRO,
        "business": settings.STRIPE_PRICE_BUSINESS,
    }


class CheckoutRequest(BaseModel):
    plan: str  # "starter" | "pro" | "business"


@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CheckoutRequest,
    business: Business = Depends(get_current_business),
):
    """Crea una Stripe Checkout Session y devuelve la URL de pago."""
    plan = body.plan.lower()
    price_id = _plan_to_price().get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Plan inválido: {plan}")

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            customer_email=business.email,
            success_url="https://app.ventatalk.com/dashboard?upgraded=true",
            cancel_url="https://app.ventatalk.com/dashboard",
            metadata={"business_id": str(business.id)},
        )
    except stripe.StripeError as e:
        logger.error("Stripe error creating checkout session: %s", e)
        raise HTTPException(status_code=502, detail="Error al conectar con Stripe")

    return {"checkout_url": session.url}


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
        session = event["data"]["object"]
        business_id = (session.get("metadata") or {}).get("business_id")
        subscription_id = session.get("subscription")

        if not business_id or not subscription_id:
            logger.warning("Webhook checkout.session.completed sin business_id o subscription_id")
            return {"status": "ok"}

        try:
            subscription = stripe.Subscription.retrieve(
                subscription_id, expand=["items.data.price"]
            )
            price_id = subscription["items"]["data"][0]["price"]["id"]
            plan_name = _price_to_plan().get(price_id)

            if not plan_name:
                logger.warning("Webhook: price_id desconocido %s", price_id)
                return {"status": "ok"}

            limits = PLAN_LIMITS[plan_name]
            business = await db.get(Business, business_id)
            if not business:
                logger.warning("Webhook: business %s no encontrado", business_id)
                return {"status": "ok"}

            business.plan = PlanType(plan_name)
            business.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            business.max_phone_numbers = limits["max_phone_numbers"]
            business.max_conversations_per_month = limits["max_conversations_per_month"]
            business.max_catalog_items = limits["max_catalog_items"]
            await db.commit()
            logger.info("Plan actualizado a %s para business %s", plan_name, business_id)

        except Exception as e:
            logger.error("Webhook: error procesando checkout.session.completed: %s", e)

    return {"status": "ok"}


@router.get("/portal")
async def billing_portal(business: Business = Depends(get_current_business)):
    """Crea una Stripe Billing Portal Session para que el cliente gestione su suscripción."""
    try:
        customers = stripe.Customer.list(email=business.email, limit=1)
        if not customers.data:
            raise HTTPException(
                status_code=404,
                detail="No se encontró una suscripción activa para este negocio",
            )
        customer_id = customers.data[0].id

        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url="https://app.ventatalk.com/dashboard/settings",
        )
    except HTTPException:
        raise
    except stripe.StripeError as e:
        logger.error("Stripe error creating portal session: %s", e)
        raise HTTPException(status_code=502, detail="Error al conectar con Stripe")

    return {"portal_url": portal_session.url}
