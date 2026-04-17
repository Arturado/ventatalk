"""add conversion_tokens table

Revision ID: 004_conversion_tokens
Revises: 003_business_integrations
Create Date: 2026-04-12 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "004_conversion_tokens"
down_revision = "003_business_integrations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conversion_tokens",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", UUID(as_uuid=True), nullable=True),
        sa.Column("label", sa.String(200), nullable=True),
        sa.Column("destination_url", sa.Text(), nullable=False),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversion_tokens_token", "conversion_tokens", ["token"], unique=True)
    op.create_index("ix_conversion_tokens_business", "conversion_tokens", ["business_id"])


def downgrade() -> None:
    op.drop_index("ix_conversion_tokens_business", table_name="conversion_tokens")
    op.drop_index("ix_conversion_tokens_token", table_name="conversion_tokens")
    op.drop_table("conversion_tokens")
