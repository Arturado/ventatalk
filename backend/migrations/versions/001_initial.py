"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgvector ya está habilitado por init_db.sql

    # ── businesses ───────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')
    op.create_table(
        "businesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("ai_tone", sa.String(50), server_default="amigable"),
        sa.Column("ai_instructions", sa.Text),
        sa.Column("ai_enabled", sa.Boolean, server_default="true"),
        sa.Column("plan", sa.Enum("starter", "pro", "business", name="plan_type"), server_default="starter"),
        sa.Column("plan_expires_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("max_phone_numbers", sa.Integer, server_default="1"),
        sa.Column("max_conversations_per_month", sa.Integer, server_default="500"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── phone_numbers ────────────────────────────────────────────────
    op.create_table(
        "phone_numbers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phone_number_id", sa.String(100), nullable=False, unique=True),
        sa.Column("phone_number", sa.String(20), nullable=False),
        sa.Column("display_name", sa.String(200)),
        sa.Column("access_token", sa.Text, nullable=False),
        sa.Column("waba_id", sa.String(100)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── contacts ─────────────────────────────────────────────────────
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("wa_phone", sa.String(20), nullable=False),
        sa.Column("name", sa.String(200)),
        sa.Column("email", sa.String(255)),
        sa.Column("notes", sa.Text),
        sa.Column("tags", postgresql.JSONB, server_default="[]"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("business_id", "wa_phone", name="uq_contact_business_phone"),
    )
    op.create_index("ix_contacts_business", "contacts", ["business_id"])

    # ── conversations ────────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phone_number_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("phone_numbers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.Enum("open", "ai_handling", "human_assigned", "closed", name="conversation_status"), server_default="ai_handling"),
        sa.Column("detected_intent", sa.Enum("quote_request", "purchase", "objection", "complaint", "scheduling", "general_info", "other", name="message_intent"), nullable=True),
        sa.Column("assigned_agent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column("wa_window_expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_conversation_business_status", "conversations", ["business_id", "status"])
    op.create_index("ix_conversation_contact", "conversations", ["contact_id"])

    # ── messages ─────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.Enum("user", "assistant", "agent", "system", name="message_role"), nullable=False),
        sa.Column("message_type", sa.Enum("text", "image", "audio", "video", "document", "interactive", "template", name="message_type"), server_default="text"),
        sa.Column("content", sa.Text),
        sa.Column("media_url", sa.String(500)),
        sa.Column("wa_message_id", sa.String(100), unique=True, nullable=True),
        sa.Column("wa_status", sa.String(50)),
        sa.Column("intent", sa.Enum("quote_request", "purchase", "objection", "complaint", "scheduling", "general_info", "other", name="message_intent_msg"), nullable=True),
        sa.Column("ai_tokens_used", sa.Integer, server_default="0"),
        sa.Column("ai_cost_usd", sa.Float, server_default="0"),
        sa.Column("escalate_to_human", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_message_conversation", "messages", ["conversation_id"])
    op.create_index("ix_message_wa_id", "messages", ["wa_message_id"])

    # ── leads ────────────────────────────────────────────────────────
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage", sa.Enum("new", "interested", "quoted", "closed_won", "closed_lost", name="lead_stage"), server_default="new"),
        sa.Column("estimated_value", sa.Float),
        sa.Column("notes", sa.Text),
        sa.Column("lost_reason", sa.String(300)),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_leads_business", "leads", ["business_id", "stage"])

    # ── catalog_items ────────────────────────────────────────────────
    op.create_table(
        "catalog_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("price", sa.Float),
        sa.Column("category", sa.String(100)),
        sa.Column("is_available", sa.Boolean, server_default="true"),
        sa.Column("metadata", postgresql.JSONB, server_default="{}"),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_catalog_business", "catalog_items", ["business_id"])
    # Índice HNSW para búsqueda vectorial (crear manualmente porque Alembic no lo soporta nativo)
    op.execute("""
        CREATE INDEX ix_catalog_embedding_hnsw ON catalog_items
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # ── followup_sequences ───────────────────────────────────────────
    op.create_table(
        "followup_sequences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("trigger_intent", sa.Enum("quote_request", "purchase", "objection", "complaint", "scheduling", "general_info", "other", name="message_intent_seq"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── followup_steps ───────────────────────────────────────────────
    op.create_table(
        "followup_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("sequence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("followup_sequences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_number", sa.Integer, nullable=False),
        sa.Column("delay_hours", sa.Integer, nullable=False),
        sa.Column("template_name", sa.String(200)),
        sa.Column("message_text", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── followup_logs ────────────────────────────────────────────────
    op.create_table(
        "followup_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("sequence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("followup_sequences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_number", sa.Integer, nullable=False),
        sa.Column("status", sa.Enum("pending", "sent", "failed", "cancelled", name="followup_status"), server_default="pending"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.Text),
        sa.Column("wa_message_id", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_followup_logs_pending", "followup_logs", ["status", "scheduled_at"])


def downgrade() -> None:
    op.drop_table("followup_logs")
    op.drop_table("followup_steps")
    op.drop_table("followup_sequences")
    op.drop_table("catalog_items")
    op.drop_table("leads")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("contacts")
    op.drop_table("phone_numbers")
    op.drop_table("businesses")
    op.execute("DROP TYPE IF EXISTS followup_status")
    op.execute("DROP TYPE IF EXISTS message_intent_seq")
    op.execute("DROP TYPE IF EXISTS message_intent_msg")
    op.execute("DROP TYPE IF EXISTS message_intent")
    op.execute("DROP TYPE IF EXISTS message_type")
    op.execute("DROP TYPE IF EXISTS message_role")
    op.execute("DROP TYPE IF EXISTS conversation_status")
    op.execute("DROP TYPE IF EXISTS lead_stage")
    op.execute("DROP TYPE IF EXISTS plan_type")
