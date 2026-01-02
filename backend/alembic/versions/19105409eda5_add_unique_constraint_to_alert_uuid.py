"""add_unique_constraint_to_alert_uuid

Revision ID: 19105409eda5
Revises: 374956f06596
Create Date: 2026-01-02 00:16:35.916084

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '19105409eda5'
down_revision: Union[str, Sequence[str], None] = '374956f06596'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add unique constraint to alert.uuid."""
    # Add unique constraint to alert.uuid for foreign key references
    # This is needed by alert_notification_settings.alert_id
    op.create_unique_constraint('uq_alert_uuid', 'alert', ['uuid'])


def downgrade() -> None:
    """Downgrade schema - remove unique constraint from alert.uuid."""
    op.drop_constraint('uq_alert_uuid', 'alert', type_='unique')
