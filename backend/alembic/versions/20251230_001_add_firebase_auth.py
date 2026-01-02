"""Add Firebase authentication support

Revision ID: 20251230_001
Revises: 20251229_001
Create Date: 2025-12-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '20251230_001'
down_revision = '20251229_001'
branch_labels = None
depends_on = None


def upgrade():
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('firebase_uid', sa.String(length=128), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('photo_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('firebase_uid'),
        sa.UniqueConstraint('email')
    )
    op.create_index('idx_users_firebase_uid', 'users', ['firebase_uid'])
    op.create_index('idx_users_email', 'users', ['email'])

    # Add columns to alerts table
    op.add_column('alert', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('alert', sa.Column('uuid', postgresql.UUID(), nullable=True))
    op.add_column('alert', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')))

    # Create foreign key to users
    op.create_foreign_key('alert_user_id_fkey', 'alert', 'users', ['user_id'], ['id'], ondelete='SET NULL')

    # Create indexes
    op.create_index('idx_alert_user_id', 'alert', ['user_id'])
    op.create_index('idx_alert_updated_at', 'alert', ['updated_at'])

    # Generate UUIDs for existing alerts
    op.execute("UPDATE alert SET uuid = gen_random_uuid() WHERE uuid IS NULL")

    # Create unique index on (user_id, uuid) - will only affect rows where user_id is not null
    op.create_index('idx_alert_user_uuid', 'alert', ['user_id', 'uuid'], unique=True)

    # Create user_watchlists table (new table for user-specific watchlists)
    op.create_table(
        'user_watchlists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('uuid', postgresql.UUID(), nullable=False),
        sa.Column('symbols', postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text('ARRAY[]::VARCHAR[]')),
        sa.Column('sort_order', postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text('ARRAY[]::VARCHAR[]')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('idx_user_watchlists_user_id', 'user_watchlists', ['user_id'])
    op.create_index('idx_user_watchlists_updated_at', 'user_watchlists', ['updated_at'])
    op.create_index('idx_user_watchlists_user_uuid', 'user_watchlists', ['user_id', 'uuid'], unique=True)

    # Create layouts table
    op.create_table(
        'layouts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('uuid', postgresql.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('config', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('idx_layouts_user_id', 'layouts', ['user_id'])
    op.create_index('idx_layouts_updated_at', 'layouts', ['updated_at'])
    op.create_index('idx_layouts_user_uuid', 'layouts', ['user_id', 'uuid'], unique=True)


def downgrade():
    # Drop in reverse order
    op.drop_index('idx_layouts_user_uuid', table_name='layouts')
    op.drop_index('idx_layouts_updated_at', table_name='layouts')
    op.drop_index('idx_layouts_user_id', table_name='layouts')
    op.drop_table('layouts')

    op.drop_index('idx_user_watchlists_user_uuid', table_name='user_watchlists')
    op.drop_index('idx_user_watchlists_updated_at', table_name='user_watchlists')
    op.drop_index('idx_user_watchlists_user_id', table_name='user_watchlists')
    op.drop_table('user_watchlists')

    op.drop_index('idx_alert_user_uuid', table_name='alert')
    op.drop_index('idx_alert_updated_at', table_name='alert')
    op.drop_index('idx_alert_user_id', table_name='alert')
    op.drop_constraint('alert_user_id_fkey', 'alert')
    op.drop_column('alert', 'updated_at')
    op.drop_column('alert', 'uuid')
    op.drop_column('alert', 'user_id')

    op.drop_index('idx_users_email', table_name='users')
    op.drop_index('idx_users_firebase_uid', table_name='users')
    op.drop_table('users')
