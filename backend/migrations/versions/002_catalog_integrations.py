"""add source and external_id to catalog_items

Revision ID: 002_catalog_integrations
Revises: 001_initial
Create Date: 2025-01-02 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "002_catalog_integrations"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_items",
        sa.Column("source", sa.String(50), server_default="csv", nullable=False)
    )
    op.add_column("catalog_items",
        sa.Column("external_id", sa.String(200), nullable=True)
    )
    # Índice para búsquedas de upsert por external_id
    op.create_index(
        "ix_catalog_source_external",
        "catalog_items",
        ["business_id", "source", "external_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_catalog_source_external", "catalog_items")
    op.drop_column("catalog_items", "external_id")
    op.drop_column("catalog_items", "source")