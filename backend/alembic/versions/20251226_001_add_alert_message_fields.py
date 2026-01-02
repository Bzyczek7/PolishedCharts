"""Add message configuration fields to Alert model

Revision ID: 20251226001
Revises: 20251224002
Create Date: 2025-12-26 22:30:00.000000

Adds direction-specific trigger messages and enabled conditions configuration
for indicator-based alerts, supporting the TradingView-style alert system.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '20251226001'
down_revision: Union[str, Sequence[str], None] = '20251224002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add message fields and enabled_conditions to alerts table."""
    # Add direction-specific trigger message columns (nullable for existing price alerts)
    op.add_column('alert', sa.Column('message_upper', sa.String(200), nullable=True))
    op.add_column('alert', sa.Column('message_lower', sa.String(200), nullable=True))

    # Add enabled_conditions JSONB column for configurable trigger conditions
    op.add_column('alert', sa.Column('enabled_conditions', postgresql.JSONB(), nullable=True))

    # Add last_triggered_at timestamp for tracking recency (replaces "triggered" status)
    op.add_column('alert', sa.Column('last_triggered_at', sa.DateTime(timezone=True), nullable=True))

    # Set defaults for existing indicator-based alerts only (price alerts keep NULL)
    op.execute("""
        UPDATE alert
        SET message_upper = 'It''s time to sell!',
            message_lower = 'It''s time to buy!',
            enabled_conditions = '{"upper": true, "lower": true}'::jsonb
        WHERE indicator_name IS NOT NULL
          AND message_upper IS NULL
    """)

    # Set server defaults for new indicator alerts (price alerts remain NULL)
    op.execute("""
        ALTER TABLE alert
        ALTER COLUMN message_upper SET DEFAULT 'It''s time to sell!',
        ALTER COLUMN message_lower SET DEFAULT 'It''s time to buy!'
    """)

    # Create index for JSONB queries on enabled_conditions (PostgreSQL GIN)
    op.create_index(
        'ix_alerts_enabled_conditions',
        'alert',
        ['enabled_conditions'],
        unique=False,
        postgresql_using='gin'
    )


def downgrade() -> None:
    """Downgrade schema - remove message fields from alerts table."""
    op.drop_index('ix_alerts_enabled_conditions', table_name='alert')
    op.drop_column('alert', 'last_triggered_at')
    op.drop_column('alert', 'enabled_conditions')
    op.drop_column('alert', 'message_lower')
    op.drop_column('alert', 'message_upper')
