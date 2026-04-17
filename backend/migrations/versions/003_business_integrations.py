"""add integrations to businesses

Revision ID: 003_business_integrations
Revises: 002_catalog_integrations
Create Date: 2025-01-03 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "003_business_integrations"
down_revision = "002_catalog_integrations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("businesses",
        sa.Column("integrations", JSONB, server_default="{}", nullable=True)
    )


def downgrade() -> None:
    op.drop_column("businesses", "integrations")