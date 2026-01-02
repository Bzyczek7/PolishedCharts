"""create_watchlist_table

Revision ID: 20251227_002
Revises: 20251227_001
Create Date: 2025-12-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251227_002'
down_revision: Union[str, Sequence[str], None] = '20251227_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'watchlist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['symbol_id'], ['symbol.id'], name='fk_watchlist_symbol_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol_id', name='uix_watchlist_symbol_id')
    )
    op.create_index(op.f('ix_watchlist_symbol_id'), 'watchlist', ['symbol_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_watchlist_symbol_id'), table_name='watchlist')
    op.drop_table('watchlist')
