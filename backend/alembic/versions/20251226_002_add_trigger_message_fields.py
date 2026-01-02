"""Add trigger message and type fields to AlertTrigger model

Revision ID: 20251226002
Revises: 20251226001
Create Date: 2025-12-26 22:31:00.000000

Adds direction-specific message and trigger type to AlertTrigger for
per-event context in the alert history log.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251226002'
down_revision: Union[str, Sequence[str], None] = '20251226001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add trigger_message and trigger_type to alert_triggers table."""
    # Add trigger_message column for direction-specific message at trigger time
    op.add_column('alert_trigger', sa.Column('trigger_message', sa.String(200), nullable=True))

    # Add trigger_type column to distinguish which condition fired (upper/lower)
    op.add_column('alert_trigger', sa.Column('trigger_type', sa.String(10), nullable=True))

    # Set server defaults for new triggers
    op.execute("""
        ALTER TABLE alert_trigger
        ALTER COLUMN trigger_message SET DEFAULT 'Alert triggered',
        ALTER COLUMN trigger_type SET DEFAULT 'upper'
    """)

    # For existing triggers, derive message and type from alert configuration
    op.execute("""
        UPDATE alert_trigger t
        SET trigger_message = CASE
            WHEN a.indicator_name = 'crsi' AND a.condition = 'indicator_crosses_upper' THEN 'It''s time to sell!'
            WHEN a.indicator_name = 'crsi' AND a.condition = 'indicator_crosses_lower' THEN 'It''s time to buy!'
            ELSE 'Alert triggered'
        END,
        trigger_type = CASE
            WHEN a.condition = 'indicator_crosses_upper' THEN 'upper'
            WHEN a.condition = 'indicator_crosses_lower' THEN 'lower'
            ELSE 'upper'
        END
        FROM alert a
        WHERE t.alert_id = a.id
          AND t.trigger_message IS NULL
    """)


def downgrade() -> None:
    """Downgrade schema - remove trigger_message and trigger_type from alert_triggers table."""
    op.drop_column('alert_trigger', 'trigger_type')
    op.drop_column('alert_trigger', 'trigger_message')
