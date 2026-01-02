"""add sort_order to watchlist

Revision ID: 20251229_001
Revises: 20251227_002
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251229_001'
down_revision: Union[str, None] = '20251227_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 1: Add nullable column
    op.add_column('watchlist', sa.Column('sort_order', sa.Integer(), nullable=True))

    # Phase 2: Backfill existing data with deterministic ordering
    # Use 0-based indexing with tiebreaker for stability
    op.execute("""
        UPDATE watchlist
        SET sort_order = subquery.row_num
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY added_at ASC, id ASC) - 1 as row_num
            FROM watchlist
        ) subquery
        WHERE watchlist.id = subquery.id
    """)

    # Phase 3: Make column non-nullable
    op.alter_column('watchlist', 'sort_order', nullable=False)

    # Phase 4: Create index for efficient ordering queries
    op.create_index('ix_watchlist_sort_order', 'watchlist', ['sort_order'])


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_watchlist_sort_order', table_name='watchlist')

    # Remove column
    op.drop_column('watchlist', 'sort_order')
