"""add_alert_trigger_table

Revision ID: bae1adc8700a
Revises: 60c50f0d4693
Create Date: 2025-12-23 16:13:12.665691

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bae1adc8700a'
down_revision: Union[str, Sequence[str], None] = '60c50f0d4693'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'alert_trigger',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=False),
        sa.Column('triggered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('observed_price', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alert.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_trigger_id'), 'alert_trigger', ['id'], unique=False)
    op.create_index(op.f('ix_alert_trigger_alert_id'), 'alert_trigger', ['alert_id'], unique=False)
    op.create_index(op.f('ix_alert_trigger_triggered_at'), 'alert_trigger', ['triggered_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_alert_trigger_triggered_at'), table_name='alert_trigger')
    op.drop_index(op.f('ix_alert_trigger_alert_id'), table_name='alert_trigger')
    op.drop_index(op.f('ix_alert_trigger_id'), table_name='alert_trigger')
    op.drop_table('alert_trigger')
