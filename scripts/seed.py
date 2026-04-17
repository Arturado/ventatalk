#!/usr/bin/env python3
"""
seed.py — Carga datos de prueba en la DB.
Crea un negocio de ejemplo (clínica estética) con catálogo, contactos y conversaciones.

Uso:
  docker compose exec api python scripts/seed.py
  # o desde fuera:
  cd backend && python scripts/seed.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.models import (
    Business, CatalogItem, Contact, Conversation, ConversationStatus,
    FollowUpLog, FollowUpSequence, FollowUpStep, Lead, LeadStage,
    Message, MessageIntent, MessageRole, MessageType, PhoneNumber, PlanType,
)

settings = get_settings()

engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def seed():
    async with SessionLocal() as db:
        print("🌱 Creando datos de prueba...")

        # ── Business ─────────────────────────────────────────────────
        business = Business(
            name="Clínica Estética Lumina",
            slug="clinica-lumina",
            email="admin@lumina.cl",
            hashed_password=hash_password("demo1234"),
            ai_tone="amigable",
            ai_instructions=(
                "Siempre mencionar que ofrecemos evaluación gratuita el primer mes. "
                "Horarios de atención: Lun-Vie 9am-7pm, Sáb 10am-2pm. "
                "Si preguntan por precio de paquetes, ofrecer 10% descuento en combos."
            ),
            ai_enabled=True,
            plan=PlanType.PRO,
            max_phone_numbers=2,
            max_conversations_per_month=2000,
        )
        db.add(business)
        await db.flush()
        print(f"  ✓ Business: {business.name} (id: {business.id})")
        print(f"    Email: admin@lumina.cl | Password: demo1234")

        # ── Phone Number ─────────────────────────────────────────────
        phone = PhoneNumber(
            business_id=business.id,
            phone_number_id="REEMPLAZA_CON_TU_PHONE_NUMBER_ID",
            phone_number="+56912345678",
            display_name="Lumina WA Business",
            access_token="REEMPLAZA_CON_TU_ACCESS_TOKEN",
            waba_id="REEMPLAZA_CON_TU_WABA_ID",
        )
        db.add(phone)
        await db.flush()

        # ── Catálogo ─────────────────────────────────────────────────
        catalog = [
            ("Botox Frente", "Tratamiento con toxina botulínica para arrugas frontales. Dura 4-6 meses.", 150_000, "Inyectables"),
            ("Botox Patas de Gallo", "Corrección de arrugas periorbitales. Efecto natural.", 120_000, "Inyectables"),
            ("Ácido Hialurónico Labios", "Aumento y definición de labios. Resultado inmediato.", 180_000, "Rellenos"),
            ("Ácido Hialurónico Surcos", "Relleno de surcos nasogenianos. Rejuvenecimiento facial.", 200_000, "Rellenos"),
            ("Limpieza Facial Profunda", "Limpieza con extracción, vapor y mascarilla. 60 min.", 45_000, "Facial"),
            ("Hidratación Facial Premium", "Tratamiento con hialurónico tópico e iontoforesis.", 65_000, "Facial"),
            ("Peeling Químico Suave", "Ácidos AHA/BHA para renovación celular. Luminosidad inmediata.", 55_000, "Facial"),
            ("Radiofrecuencia Facial", "Reafirmación y lifting no invasivo. 6 sesiones recomendadas.", 80_000, "Tecnología"),
            ("Láser CO2 Fraccionado", "Rejuvenecimiento profundo, manchas y cicatrices.", 250_000, "Tecnología"),
            ("Depilación Láser Axilas", "Sesión de depilación láser diodo. Piel suave permanente.", 35_000, "Depilación"),
            ("Depilación Láser Piernas Completas", "Sesión completa piernas. Requiere 6-8 sesiones.", 90_000, "Depilación"),
            ("Consulta Médica Estética", "Evaluación con médico especialista. GRATIS primer mes.", 0, "Consultas"),
            ("Pack Botox + Hialurónico", "Combo frente + labios. 15% de descuento incluido.", 279_000, "Packs"),
            ("Pack Facial x4 Sesiones", "4 limpiezas faciales profundas. Ahorra $35.000.", 145_000, "Packs"),
        ]

        for name, desc, price, cat in catalog:
            item = CatalogItem(
                business_id=business.id,
                name=name,
                description=desc,
                price=price,
                category=cat,
                # Nota: en producción aquí se generarían embeddings reales vía OpenAI
                # embedding=await AIService.generate_embedding(f"{name}. {desc}")
            )
            db.add(item)
        await db.flush()
        print(f"  ✓ Catálogo: {len(catalog)} productos cargados")

        # ── Follow-up sequence ───────────────────────────────────────
        seq = FollowUpSequence(
            business_id=business.id,
            name="Seguimiento post-cotización",
            trigger_intent="quote_request",
            is_active=True,
        )
        db.add(seq)
        await db.flush()

        steps = [
            (1, 24, "followup_24h_v1", "Hola {{1}}, te escribimos de {{2}} 😊 ¿Pudiste revisar la cotización que te compartimos? Estamos disponibles para cualquier duda."),
            (2, 72, "followup_72h_v1", "Hola {{1}}! Queríamos recordarte que tu cotización de {{2}} sigue vigente. Esta semana tenemos disponibilidad. ¿Te gustaría agendar tu evaluación gratuita?"),
            (3, 168, "followup_7d_v1", "Hola {{1}}, pasó una semana desde tu consulta en {{2}}. Si sigues interesado/a, podemos ofrecerte un 10% de descuento esta semana. ¿Quieres aprovechar?"),
        ]
        for step_num, delay, template, text in steps:
            db.add(FollowUpStep(
                sequence_id=seq.id,
                step_number=step_num,
                delay_hours=delay,
                template_name=template,
                message_text=text,
            ))
        await db.flush()
        print(f"  ✓ Follow-up sequence con 3 pasos")

        # ── Contactos y conversaciones de ejemplo ────────────────────
        now = datetime.now(timezone.utc)

        contacts_data = [
            ("Valentina Muñoz", "56911111111", LeadStage.QUOTED, MessageIntent.QUOTE_REQUEST,
             [("¿Cuánto cuesta el botox de frente?", MessageRole.USER),
              ("Hola Valentina! El botox de frente tiene un valor de $150.000 CLP y dura entre 4-6 meses. ¿Te gustaría agendar una evaluación gratuita esta semana?", MessageRole.ASSISTANT)]),

            ("Carlos Rojas", "56922222222", LeadStage.INTERESTED, MessageIntent.GENERAL_INFO,
             [("Hola, ¿atienden los sábados?", MessageRole.USER),
              ("Hola Carlos! Sí, atendemos los sábados de 10am a 2pm. ¿En qué podemos ayudarte? 😊", MessageRole.ASSISTANT)]),

            ("Andrea Soto", "56933333333", LeadStage.CLOSED_WON, MessageIntent.PURCHASE,
             [("Quiero el pack facial x4", MessageRole.USER),
              ("¡Excelente elección Andrea! El Pack Facial x4 está a $145.000 CLP. ¿Quieres que te agende la primera sesión para esta semana?", MessageRole.ASSISTANT),
              ("Sí, el jueves si hay disponibilidad", MessageRole.USER),
              ("¡Perfecto! Te agendo el jueves. ¿A qué hora te queda mejor, mañana o tarde?", MessageRole.ASSISTANT)]),

            ("Roberto Lagos", "56944444444", LeadStage.NEW, None,
             [("Encontré este número en Instagram", MessageRole.USER),
              ("Hola Roberto! Bienvenido a Clínica Lumina 😊 ¿En qué podemos ayudarte hoy?", MessageRole.ASSISTANT)]),

            ("Camila Torres", "56955555555", LeadStage.CLOSED_LOST, MessageIntent.OBJECTION,
             [("El precio me parece muy caro", MessageRole.USER),
              ("Entiendo Camila. Los precios de los tratamientos incluyen productos de primera línea y personal médico certificado. ¿Te interesaría ver nuestros packs con descuento?", MessageRole.ASSISTANT),
              ("No gracias, buscaré otra opción", MessageRole.USER)]),
        ]

        for name, phone_str, stage, intent, messages in contacts_data:
            contact = Contact(
                business_id=business.id,
                wa_phone=phone_str,
                name=name,
                last_seen_at=now - timedelta(hours=len(messages)),
                tags=[],
            )
            db.add(contact)
            await db.flush()

            lead = Lead(
                contact_id=contact.id,
                business_id=business.id,
                stage=stage,
                estimated_value=150_000 if stage == LeadStage.CLOSED_WON else None,
            )
            db.add(lead)

            conv = Conversation(
                business_id=business.id,
                contact_id=contact.id,
                phone_number_id=phone.id,
                status=ConversationStatus.CLOSED if stage in (LeadStage.CLOSED_WON, LeadStage.CLOSED_LOST) else ConversationStatus.AI_HANDLING,
                detected_intent=intent,
                last_message_at=now - timedelta(minutes=30),
                wa_window_expires_at=now + timedelta(hours=20),
            )
            db.add(conv)
            await db.flush()

            for i, (content, role) in enumerate(messages):
                msg = Message(
                    conversation_id=conv.id,
                    role=role,
                    message_type=MessageType.TEXT,
                    content=content,
                    wa_message_id=f"wamid.seed_{phone_str}_{i}",
                    wa_status="read",
                    ai_tokens_used=150 if role == MessageRole.ASSISTANT else 0,
                    ai_cost_usd=0.00012 if role == MessageRole.ASSISTANT else 0,
                )
                db.add(msg)

        await db.commit()
        print(f"  ✓ {len(contacts_data)} contactos con conversaciones")

        print("")
        print("✅ Seed completado.")
        print("")
        print("  Dashboard: http://localhost:3000")
        print("  Login:     admin@lumina.cl / demo1234")
        print("")
        print("  ⚠️  Recuerda actualizar el PhoneNumber con tus credenciales reales de Meta.")


if __name__ == "__main__":
    asyncio.run(seed())
