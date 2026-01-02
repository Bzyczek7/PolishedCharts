"""create_alert_notification_settings_table

Revision ID: 92523470b8af
Revises: 19105409eda5
Create Date: 2026-01-02 00:17:27.087585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '92523470b8af'
down_revision: Union[str, Sequence[str], None] = '19105409eda5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create alert_notification_settings table."""
    op.create_table(
        'alert_notification_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('alert_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('alert.uuid'), unique=True, nullable=False, index=True),
        sa.Column('toast_enabled', sa.Boolean(), nullable=True),
        sa.Column('sound_enabled', sa.Boolean(), nullable=True),
        sa.Column('sound_type', sa.String(20), nullable=True),
        sa.Column('telegram_enabled', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    """Downgrade schema - drop alert_notification_settings table."""
    op.drop_table('alert_notification_settings')
