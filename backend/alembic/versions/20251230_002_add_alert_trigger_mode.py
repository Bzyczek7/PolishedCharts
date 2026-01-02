"""Add alert trigger_mode and last_triggered_bar_timestamp columns

Revision ID: 20251230_002
Revises: 20251230_001
Create Date: 2025-12-30

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251230_002'
down_revision = '20251230_001'
branch_labels = None
depends_on = None


def upgrade():
    # Add trigger_mode column with default 'once_per_bar_close' for backward compatibility
    op.add_column('alert', sa.Column('trigger_mode', sa.String(20), nullable=False, server_default='once_per_bar_close'))

    # Add last_triggered_bar_timestamp column for bar-based trigger modes
    op.add_column('alert', sa.Column('last_triggered_bar_timestamp', sa.DateTime(timezone=True), nullable=True))

    # Update cooldown column comment to indicate minutes (was seconds)
    op.execute("COMMENT ON COLUMN alert.cooldown IS 'Cooldown period in minutes (default: 1)'")


def downgrade():
    op.drop_column('alert', 'last_triggered_bar_timestamp')
    op.drop_column('alert', 'trigger_mode')
