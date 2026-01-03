"""Make alert notification settings nullable for global default support

Revision ID: a469670bd6a4
Revises: b0204c792af9
Create Date: 2026-01-02 22:30:41.020037

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a469670bd6a4'
down_revision: Union[str, Sequence[str], None] = 'b0204c792af9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Step 1: Delete any rows with null alert_id (corrupted data)
    op.execute("""
        DELETE FROM alert_notification_settings 
        WHERE alert_id IS NULL
    """)
    
    # Step 2: Alter columns to be nullable first
    op.alter_column('alert_notification_settings', 'toast_enabled',
                   existing_type=sa.Boolean(), nullable=True)
    op.alter_column('alert_notification_settings', 'sound_enabled',
                   existing_type=sa.Boolean(), nullable=True)
    op.alter_column('alert_notification_settings', 'telegram_enabled',
                   existing_type=sa.Boolean(), nullable=True)
    
    # Step 3: Now that columns are nullable, set False to NULL (use global default)
    op.execute("""
        UPDATE alert_notification_settings 
        SET toast_enabled = NULL, sound_enabled = NULL, telegram_enabled = NULL
        WHERE toast_enabled = 'f' AND sound_enabled = 'f' AND telegram_enabled = 'f'
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Convert NULL values to False (the old default)
    op.execute("""
        UPDATE alert_notification_settings 
        SET toast_enabled = 'f', sound_enabled = 'f', telegram_enabled = 'f'
        WHERE toast_enabled IS NULL
    """)
    op.alter_column('alert_notification_settings', 'toast_enabled',
                   existing_type=sa.Boolean(), nullable=False, server_default='f')
    op.alter_column('alert_notification_settings', 'sound_enabled',
                   existing_type=sa.Boolean(), nullable=False, server_default='f')
    op.alter_column('alert_notification_settings', 'telegram_enabled',
                   existing_type=sa.Boolean(), nullable=False, server_default='f')
