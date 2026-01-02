"""create_ticker_universe_table

Revision ID: 20251227_001
Revises: 69a9889aa326
Create Date: 2025-12-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251227_001'
down_revision: Union[str, Sequence[str], None] = '69a9889aa326'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'ticker_universe',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ticker', sa.String(length=20), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=False),
        sa.Column('asset_class', sa.String(length=20), nullable=True),
        sa.Column('exchange', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ticker_universe_ticker'), 'ticker_universe', ['ticker'], unique=True)
    op.create_index(op.f('ix_ticker_universe_display_name'), 'ticker_universe', ['display_name'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_ticker_universe_display_name'), table_name='ticker_universe')
    op.drop_index(op.f('ix_ticker_universe_ticker'), table_name='ticker_universe')
    op.drop_table('ticker_universe')
