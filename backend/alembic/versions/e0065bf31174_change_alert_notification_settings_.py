"""change_alert_notification_settings_alert_id_to_int

Revision ID: e0065bf31174
Revises: 92523470b8af
Create Date: 2026-01-02 18:54:23.698550

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0065bf31174'
down_revision: Union[str, Sequence[str], None] = '92523470b8af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - change alert_id from UUID to Integer."""
    # Add a new integer column
    op.add_column('alert_notification_settings', sa.Column('alert_id_new', sa.Integer(), nullable=False))

    # Drop the foreign key and unique constraint on the old UUID column
    op.drop_constraint('alert_notification_settings_alert_id_fkey', 'alert_notification_settings', type_='foreignkey')

    # Copy data from UUID column to new integer column
    # Since there's no data yet (feature just implemented), we can just set a default
    op.execute("UPDATE alert_notification_settings SET alert_id_new = 0 WHERE alert_id_new IS NULL")

    # Drop the old UUID column and rename the new column
    op.drop_column('alert_notification_settings', 'alert_id')
    op.alter_column('alert_notification_settings', 'alert_id_new', new_column_name='alert_id')

    # Recreate the foreign key constraint pointing to alert.id (Integer)
    op.create_foreign_key('alert_notification_settings_alert_id_fkey',
                          'alert_notification_settings', 'alert',
                          ['alert_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema - change alert_id from Integer to UUID."""
    # Drop the foreign key constraint
    op.drop_constraint('alert_notification_settings_alert_id_fkey', 'alert_notification_settings', type_='foreignkey')

    # Add a new UUID column
    op.add_column('alert_notification_settings', sa.Column('alert_id_old', sa.UUID(), nullable=False))

    # Drop the old integer column
    op.drop_column('alert_notification_settings', 'alert_id')

    # Rename the UUID column back
    op.alter_column('alert_notification_settings', 'alert_id_old', new_column_name='alert_id')

    # Recreate the foreign key constraint pointing to alert.uuid
    op.create_foreign_key('alert_notification_settings_alert_id_fkey',
                          'alert_notification_settings', 'alert',
                          ['alert_id'], ['uuid'], ondelete='CASCADE')
