"""catalog_product_url

Revision ID: 008_catalog_product_url
Revises: fdadc6a23121
Create Date: 2026-05-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '008_catalog_product_url'
down_revision: Union[str, None] = 'fdadc6a23121'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('catalog_items', sa.Column('product_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('catalog_items', 'product_url')
