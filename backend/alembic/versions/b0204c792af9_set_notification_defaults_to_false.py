"""set_notification_defaults_to_false

Revision ID: b0204c792af9
Revises: e0065bf31174
Create Date: 2026-01-02 19:27:09.159751

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0204c792af9'
down_revision: Union[str, Sequence[str], None] = 'e0065bf31174'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - set notification defaults to False."""
    # Set existing NULL values to False
    op.execute("UPDATE alert_notification_settings SET toast_enabled = FALSE WHERE toast_enabled IS NULL")
    op.execute("UPDATE alert_notification_settings SET sound_enabled = FALSE WHERE sound_enabled IS NULL")
    op.execute("UPDATE alert_notification_settings SET telegram_enabled = FALSE WHERE telegram_enabled IS NULL")

    # Alter columns to be NOT NULL with default False
    op.alter_column('alert_notification_settings', 'toast_enabled',
                    existing_type=sa.Boolean(),
                    nullable=False,
                    existing_server_default=sa.text('FALSE'))
    op.alter_column('alert_notification_settings', 'sound_enabled',
                    existing_type=sa.Boolean(),
                    nullable=False,
                    existing_server_default=sa.text('FALSE'))
    op.alter_column('alert_notification_settings', 'telegram_enabled',
                    existing_type=sa.Boolean(),
                    nullable=False,
                    existing_server_default=sa.text('FALSE'))


def downgrade() -> None:
    """Downgrade schema - allow NULL values again."""
    op.alter_column('alert_notification_settings', 'toast_enabled',
                    existing_type=sa.Boolean(),
                    nullable=True,
                    existing_server_default=sa.text('FALSE'))
    op.alter_column('alert_notification_settings', 'sound_enabled',
                    existing_type=sa.Boolean(),
                    nullable=True,
                    existing_server_default=sa.text('FALSE'))
    op.alter_column('alert_notification_settings', 'telegram_enabled',
                    existing_type=sa.Boolean(),
                    nullable=True,
                    existing_server_default=sa.text('FALSE'))
