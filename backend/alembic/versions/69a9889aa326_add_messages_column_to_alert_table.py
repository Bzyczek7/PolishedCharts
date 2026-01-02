"""add messages column to alert table

Revision ID: 69a9889aa326
Revises: 20251226002
Create Date: 2025-12-26 22:47:42.785745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '69a9889aa326'
down_revision: Union[str, Sequence[str], None] = '20251226002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add messages column as JSONB for flexible condition->message mapping
    # e.g., {"indicator_crosses_upper": "Sell!", "indicator_turns_positive": "Bullish!"}
    op.add_column('alert',
        sa.Column('messages', postgresql.JSONB(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('alert', 'messages')
