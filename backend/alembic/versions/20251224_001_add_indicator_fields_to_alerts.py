"""add_indicator_fields_to_alerts

Revision ID: 20251224001
Revises: b15f7bf697c2
Create Date: 2025-12-24 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251224001'
down_revision: Union[str, Sequence[str], None] = 'b15f7bf697c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add indicator columns to alerts table."""
    # Add indicator-specific columns for indicator-based alerts
    op.add_column('alert', sa.Column('indicator_name', sa.String(50), nullable=True))
    op.add_column('alert', sa.Column('indicator_field', sa.String(50), nullable=True))
    op.add_column('alert', sa.Column('indicator_params', sa.JSON(), nullable=True))

    # Create index for filtering by indicator
    op.create_index(
        'ix_alerts_indicator_name',
        'alert',
        ['indicator_name'],
        unique=False,
        postgresql_where=sa.text('indicator_name IS NOT NULL')
    )


def downgrade() -> None:
    """Downgrade schema - remove indicator columns from alerts table."""
    op.drop_index('ix_alerts_indicator_name', table_name='alert')
    op.drop_column('alert', 'indicator_params')
    op.drop_column('alert', 'indicator_field')
    op.drop_column('alert', 'indicator_name')
