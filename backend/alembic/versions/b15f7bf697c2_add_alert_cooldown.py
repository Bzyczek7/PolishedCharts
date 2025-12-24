"""add_alert_cooldown

Revision ID: b15f7bf697c2
Revises: bae1adc8700a
Create Date: 2025-12-23 16:14:07.793341

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b15f7bf697c2'
down_revision: Union[str, Sequence[str], None] = 'bae1adc8700a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('alert', sa.Column('cooldown', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('alert', 'cooldown')
