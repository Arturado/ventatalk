"""add max_catalog_items to businesses

Revision ID: 005_plan_catalog_limit
Revises: 004_conversion_tokens
Create Date: 2026-04-20 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "005_plan_catalog_limit"
down_revision = "004_conversion_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("max_catalog_items", sa.Integer(), nullable=False, server_default="50"),
    )


def downgrade() -> None:
    op.drop_column("businesses", "max_catalog_items")
