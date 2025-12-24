"""add_delivery_tracking_to_alert_triggers

Revision ID: 20251224002
Revises: 20251224001
Create Date: 2025-12-24 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251224002'
down_revision: Union[str, Sequence[str], None] = '20251224001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add delivery tracking columns to alert_triggers table."""
    # Add indicator value and delivery tracking columns
    op.add_column('alert_trigger', sa.Column('indicator_value', sa.Float(), nullable=True))
    op.add_column('alert_trigger', sa.Column('delivery_status', sa.String(20), nullable=True, server_default='pending'))
    op.add_column('alert_trigger', sa.Column('retry_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('alert_trigger', sa.Column('last_retry_at', sa.DateTime(timezone=True), nullable=True))

    # Create index for delivery retry queries
    op.create_index(
        'ix_alert_triggers_delivery_status',
        'alert_trigger',
        ['delivery_status', 'retry_count'],
        unique=False,
        postgresql_where=sa.text("delivery_status IN ('pending', 'retrying')")
    )


def downgrade() -> None:
    """Downgrade schema - remove delivery tracking columns from alert_triggers table."""
    op.drop_index('ix_alert_triggers_delivery_status', table_name='alert_trigger')
    op.drop_column('alert_trigger', 'last_retry_at')
    op.drop_column('alert_trigger', 'retry_count')
    op.drop_column('alert_trigger', 'delivery_status')
    op.drop_column('alert_trigger', 'indicator_value')
