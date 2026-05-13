"""
Modelos principales de VentaBot.

Relaciones:
  Business  ──< PhoneNumber
  Business  ──< Contact
  Business  ──< CatalogItem
  Contact   ──< Conversation
  Conversation ──< Message
  Contact   ──< Lead
  Business  ──< FollowUpSequence ──< FollowUpStep
  FollowUpSequence ──< FollowUpLog
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


# ────────────────────────────────────────────────────────────────────
# ENUMS
# ────────────────────────────────────────────────────────────────────

class PlanType(str, PyEnum):
    STARTER = "starter"
    PRO = "pro"
    MAX = "max"

class ConversationChannel(str, PyEnum):
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"


class LeadStage(str, PyEnum):
    NEW = "new"
    INTERESTED = "interested"
    QUOTED = "quoted"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


class ConversationStatus(str, PyEnum):
    OPEN = "open"
    AI_HANDLING = "ai_handling"
    HUMAN_ASSIGNED = "human_assigned"
    CLOSED = "closed"


class MessageRole(str, PyEnum):
    USER = "user"       # cliente → negocio
    ASSISTANT = "assistant"  # IA respondiendo
    AGENT = "agent"     # humano respondiendo
    SYSTEM = "system"   # evento interno


class MessageType(str, PyEnum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"
    INTERACTIVE = "interactive"
    TEMPLATE = "template"


class FollowUpStatus(str, PyEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessageIntent(str, PyEnum):
    QUOTE_REQUEST = "quote_request"
    PURCHASE = "purchase"
    OBJECTION = "objection"
    COMPLAINT = "complaint"
    SCHEDULING = "scheduling"
    GENERAL_INFO = "general_info"
    OTHER = "other"


# ────────────────────────────────────────────────────────────────────
# BUSINESS (cada negocio cliente del SaaS)
# ────────────────────────────────────────────────────────────────────

class Business(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "businesses"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Configuración IA
    ai_tone: Mapped[str] = mapped_column(String(50), default="amigable")  # amigable | formal | técnico
    ai_instructions: Mapped[Optional[str]] = mapped_column(Text)          # instrucciones extra del negocio
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Plan
    plan: Mapped[PlanType] = mapped_column(
        Enum(PlanType, name="plan_type", values_callable=lambda x: [e.value for e in x]),
        default=PlanType.STARTER
    )
    plan_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Billing
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    billing_cycle: Mapped[str] = mapped_column(String(20), default="monthly")  # monthly | annual

    # Features activos (controlados por plan + add-ons)
    features: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    # Contador conversaciones mes actual
    conversations_this_month: Mapped[int] = mapped_column(Integer, default=0)
    conversations_reset_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Meta: límites según plan
    max_phone_numbers: Mapped[int] = mapped_column(Integer, default=1)
    max_conversations_per_month: Mapped[int] = mapped_column(Integer, default=500)
    max_catalog_items: Mapped[int] = mapped_column(Integer, default=50)

    # Integraciones externas (jumpseller, bsale, shopify, etc.)
    integrations: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    # Relationships
    phone_numbers: Mapped[List["PhoneNumber"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    contacts: Mapped[List["Contact"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    catalog_items: Mapped[List["CatalogItem"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    followup_sequences: Mapped[List["FollowUpSequence"]] = relationship(back_populates="business", cascade="all, delete-orphan")


# ────────────────────────────────────────────────────────────────────
# PHONE NUMBER (cada número WA asociado a un negocio)
# ────────────────────────────────────────────────────────────────────

class PhoneNumber(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "phone_numbers"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE")
    )

    # Datos de Meta Cloud API
    phone_number_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # ID en Meta
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)                   # ej: +56912345678
    display_name: Mapped[str] = mapped_column(String(200))
    access_token: Mapped[str] = mapped_column(Text, nullable=False)                         # token de la app Meta
    waba_id: Mapped[str] = mapped_column(String(100))                                       # WhatsApp Business Account ID
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    business: Mapped["Business"] = relationship(back_populates="phone_numbers")
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="phone_number")


# ────────────────────────────────────────────────────────────────────
# CONTACT (cada cliente del negocio)
# ────────────────────────────────────────────────────────────────────

class Contact(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("business_id", "wa_phone", name="uq_contact_business_phone"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE")
    )
    wa_phone: Mapped[str] = mapped_column(String(20), nullable=False)   # sin +, ej: 56912345678
    name: Mapped[Optional[str]] = mapped_column(String(200))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    business: Mapped["Business"] = relationship(back_populates="contacts")
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="contact")
    lead: Mapped[Optional["Lead"]] = relationship(back_populates="contact", uselist=False)
    followup_logs: Mapped[List["FollowUpLog"]] = relationship(back_populates="contact")


# ────────────────────────────────────────────────────────────────────
# CONVERSATION
# ────────────────────────────────────────────────────────────────────

class Conversation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "conversations"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE")
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE")
    )
    phone_number_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("phone_numbers.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus, name="conversation_status", values_callable=lambda x: [e.value for e in x]),
        default=ConversationStatus.AI_HANDLING,
    )

    # La IA detecta la intención dominante de esta conversación
    detected_intent: Mapped[Optional[MessageIntent]] = mapped_column(
        Enum(MessageIntent, name="message_intent", values_callable=lambda x: [e.value for e in x]), nullable=True
    )

    assigned_agent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Canal de origen
    channel: Mapped[str] = mapped_column(String(20), default="whatsapp")  # whatsapp | instagram

    # Ventana de 24h de Meta: si el cliente escribió en las últimas 24h podemos responder libremente
    wa_window_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    contact: Mapped["Contact"] = relationship(back_populates="conversations")
    phone_number: Mapped[Optional["PhoneNumber"]] = relationship(back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(back_populates="conversation", order_by="Message.created_at")

    __table_args__ = (
        Index("ix_conversation_business_status", "business_id", "status"),
        Index("ix_conversation_contact", "contact_id"),
    )


# ────────────────────────────────────────────────────────────────────
# MESSAGE
# ────────────────────────────────────────────────────────────────────

class Message(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE")
    )

    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, name="message_role", values_callable=lambda x: [e.value for e in x]))
    message_type: Mapped[MessageType] = mapped_column(
        Enum(MessageType, name="message_type", values_callable=lambda x: [e.value for e in x]), default=MessageType.TEXT
    )
    content: Mapped[Optional[str]] = mapped_column(Text)
    media_url: Mapped[Optional[str]] = mapped_column(String(500))

    # ID del mensaje en Meta (para idempotencia y delivery tracking)
    wa_message_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    wa_status: Mapped[Optional[str]] = mapped_column(String(50))  # sent | delivered | read | failed

    # Metadata de IA
    intent: Mapped[Optional[MessageIntent]] = mapped_column(
        Enum(MessageIntent, name="message_intent_msg", values_callable=lambda x: [e.value for e in x]), nullable=True
    )
    ai_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    ai_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    escalate_to_human: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

    __table_args__ = (
        Index("ix_message_conversation", "conversation_id"),
        Index("ix_message_wa_id", "wa_message_id"),
    )


# ────────────────────────────────────────────────────────────────────
# LEAD (pipeline de ventas)
# ────────────────────────────────────────────────────────────────────

class Lead(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "leads"

    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), unique=True
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE")
    )

    stage: Mapped[LeadStage] = mapped_column(
        Enum(LeadStage, name="lead_stage", values_callable=lambda x: [e.value for e in x]), default=LeadStage.NEW
    )
    estimated_value: Mapped[Optional[float]] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    lost_reason: Mapped[Optional[str]] = mapped_column(String(300))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    contact: Mapped["Contact"] = relationship(back_populates="lead")


# ────────────────────────────────────────────────────────────────────
# CATALOG ITEM + EMBEDDINGS (RAG)
# ────────────────────────────────────────────────────────────────────

class CatalogItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "catalog_items"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE")
    )

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    price: Mapped[Optional[float]] = mapped_column(Float)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    product_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Integración externa (jumpseller, bsale, shopify, csv)
    source: Mapped[str] = mapped_column(String(50), default="csv")
    external_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Vector de embedding para búsqueda semántica (1536 dims = text-embedding-3-small)
    embedding: Mapped[Optional[list]] = mapped_column(Vector(1536), nullable=True)

    # Relationships
    business: Mapped["Business"] = relationship(back_populates="catalog_items")

    __table_args__ = (
        Index("ix_catalog_business", "business_id"),
        # Índice HNSW para búsqueda vectorial eficiente
        Index(
            "ix_catalog_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


# ────────────────────────────────────────────────────────────────────
# FOLLOW-UP SEQUENCES
# ────────────────────────────────────────────────────────────────────

class FollowUpSequence(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "followup_sequences"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    trigger_intent: Mapped[Optional[MessageIntent]] = mapped_column(
        Enum(MessageIntent, name="message_intent_seq", values_callable=lambda x: [e.value for e in x]), nullable=True
    )  # Se activa cuando la IA detecta esta intención
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    business: Mapped["Business"] = relationship(back_populates="followup_sequences")
    steps: Mapped[List["FollowUpStep"]] = relationship(
        back_populates="sequence", order_by="FollowUpStep.delay_hours", cascade="all, delete-orphan"
    )
    logs: Mapped[List["FollowUpLog"]] = relationship(back_populates="sequence")


class FollowUpStep(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "followup_steps"

    sequence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("followup_sequences.id", ondelete="CASCADE")
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    delay_hours: Mapped[int] = mapped_column(Integer, nullable=False)  # horas después del trigger
    # Template aprobado por Meta (requerido si han pasado +24h desde último mensaje del cliente)
    template_name: Mapped[Optional[str]] = mapped_column(String(200))
    message_text: Mapped[str] = mapped_column(Text, nullable=False)    # texto plano o con {{variables}}

    # Relationships
    sequence: Mapped["FollowUpSequence"] = relationship(back_populates="steps")


class FollowUpLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "followup_logs"

    sequence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("followup_sequences.id", ondelete="CASCADE")
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE")
    )
    step_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[FollowUpStatus] = mapped_column(
        Enum(FollowUpStatus, name="followup_status", values_callable=lambda x: [e.value for e in x]), default=FollowUpStatus.PENDING
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error: Mapped[Optional[str]] = mapped_column(Text)
    wa_message_id: Mapped[Optional[str]] = mapped_column(String(100))

    # Relationships
    sequence: Mapped["FollowUpSequence"] = relationship(back_populates="logs")
    contact: Mapped["Contact"] = relationship(back_populates="followup_logs")


# ────────────────────────────────────────────────────────────────────
# CONVERSION TOKEN (tracking de conversiones ?vt_conv=)
# ────────────────────────────────────────────────────────────────────

class ConversionToken(Base, UUIDMixin, TimestampMixin):
    """
    Cada token representa un link de seguimiento generado desde una conversación.
    Cuando el cliente hace clic en el link, se registra la conversión y se redirige
    a destination_url. El parámetro ?vt_conv=TOKEN aparece en la URL final.
    """
    __tablename__ = "conversion_tokens"

    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE")
    )
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    label: Mapped[Optional[str]] = mapped_column(String(200))
    destination_url: Mapped[str] = mapped_column(Text, nullable=False)
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    business: Mapped["Business"] = relationship()
    conversation: Mapped[Optional["Conversation"]] = relationship()

    __table_args__ = (
        Index("ix_conversion_tokens_business", "business_id"),
    )


# ────────────────────────────────────────────────────────────────────
# ORDER (pedidos sincronizados desde plataformas ecommerce)
# ────────────────────────────────────────────────────────────────────

class Order(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "orders"

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(50), nullable=False)          # woocommerce | jumpseller | bsale | shopify
    external_id: Mapped[str] = mapped_column(String(200), nullable=False)
    order_number: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")       # pending | processing | completed | cancelled | refunded
    total: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="CLP")
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    items: Mapped[Optional[dict]] = mapped_column(JSONB, default=list)       # [{name, qty, price, sku}]
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ordered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    business: Mapped["Business"] = relationship()

    __table_args__ = (
        UniqueConstraint("business_id", "source", "external_id", name="uq_order_business_source_external"),
        Index("ix_order_business", "business_id"),
    )


# ────────────────────────────────────────────────────────────────────
# COUPON (cupones sincronizados desde plataformas ecommerce)
# ────────────────────────────────────────────────────────────────────

class Coupon(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "coupons"

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(50), default="percent")  # percent | fixed
    discount_value: Mapped[float] = mapped_column(Float, default=0)
    min_order_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    usage_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    business: Mapped["Business"] = relationship()

    __table_args__ = (
        UniqueConstraint("business_id", "source", "code", name="uq_coupon_business_source_code"),
        Index("ix_coupon_business", "business_id"),
    )