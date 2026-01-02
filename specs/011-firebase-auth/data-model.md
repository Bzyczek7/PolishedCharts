# Data Model: Firebase Authentication

**Feature**: 011-firebase-auth
**Date**: 2025-12-30
**Phase**: Phase 1 - Data Model Design

## Overview

This document defines the data model for implementing Firebase Authentication, including user accounts, guest data storage, and the merge strategy for syncing localStorage data to the cloud.

---

## 1. PostgreSQL Database Schema

### 1.1 New Table: `users`

Stores Firebase-authenticated user profiles and links to user-specific entities.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,  -- Firebase user ID
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    display_name VARCHAR(255),
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
```

**Fields**:
- `firebase_uid`: Firebase user ID (from token's `uid` claim), unique identifier
- `email`: User's email address (from token's `email` claim), unique
- `email_verified`: Mirror of Firebase's `email_verified` claim, for backend queries
- `display_name`: User's display name (from Google OAuth or custom)
- `photo_url`: Profile photo URL (from Google OAuth)
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update timestamp

**Validation Rules**:
- `firebase_uid` must match Firebase token's `uid` claim
- `email` must match Firebase token's `email` claim
- `email_verified` must match Firebase token's `email_verified` claim (dual enforcement)

---

### 1.2 Modified Table: `alerts`

Add user ownership, UUID, and timestamp fields for merge operations.

```sql
-- Existing alerts table, add these columns:
ALTER TABLE alerts
ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX idx_alerts_user_uuid ON alerts(user_id, uuid);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_updated_at ON alerts(updated_at DESC);
```

**New Fields**:
- `user_id`: Foreign key to `users` table (NULL for guest/unassigned alerts)
- `uuid`: Stable identifier for merge operations (never changes)
- `created_at`: Alert creation timestamp
- `updated_at`: Last update timestamp (used for merge conflict resolution)

**Merge Rule** (FR-013):
- Upsert by `uuid` within `user_id` scope
- If `uuid` exists: update only if new `updated_at` > existing `updated_at` + 2 minutes
- If `uuid` doesn't exist: insert as new
- If timestamps within ±2 minutes: keep existing (prefer cloud, deterministic)

---

### 1.3 Modified Table: `watchlists`

Add user ownership, UUID, and timestamp fields.

```sql
-- Existing watchlists table, add these columns:
ALTER TABLE watchlists
ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX idx_watchlists_user_uuid ON watchlists(user_id, uuid);
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_updated_at ON watchlists(updated_at DESC);
```

**New Fields**: Same as alerts (user_id, uuid, created_at, updated_at)

**Merge Rule** (FR-013):
- Upsert by `uuid` within `user_id` scope
- If `uuid` exists: merge symbols arrays (deduplicate by symbol)
- **Timestamp comparison determines base `sort_order`:**
  - If guest `updated_at` > cloud `updated_at` + 2 minutes: use guest's sort_order
  - If |guest.updated_at - cloud.updated_at| <= 2 minutes: use cloud's sort_order (prefer cloud, deterministic)
  - Else: use cloud's sort_order (cloud is more recent)
- Append any new symbols from the non-base list (deduplicated)
- If `uuid` doesn't exist: insert as new watchlist

---

### 1.4 Modified Table: `layouts`

Add user ownership, UUID, and timestamp fields for saved chart layouts.

```sql
-- New layouts table (if not exists):
CREATE TABLE layouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL,  -- Serialized layout config (indicators, settings, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_layouts_user_uuid ON layouts(user_id, uuid);
CREATE INDEX idx_layouts_user_id ON layouts(user_id);
CREATE INDEX idx_layouts_updated_at ON layouts(updated_at DESC);
```

**New Fields**: Same as alerts (user_id, uuid, created_at, updated_at)

**Merge Rule** (FR-013):
- Upsert by `uuid` within `user_id` scope
- If `uuid` exists: update only if new `updated_at` > existing `updated_at` + 2 minutes
- If `uuid` doesn't exist: insert as new
- If timestamps within ±2 minutes: keep existing (prefer cloud, deterministic)

---

## 2. LocalStorage Schema (Guest Data)

### 2.1 Schema Version 1

```typescript
interface LocalStorageSchema {
  schemaVersion: 1;
  alerts: GuestAlert[];
  watchlist: GuestWatchlist;
  layouts: GuestLayout[];
}

interface GuestAlert {
  uuid: string;        // UUID for merge operations
  symbol: string;
  condition: string;   // e.g., "above", "below", "crosses-up"
  target: number;
  enabled: boolean;
  created_at: string;  // ISO 8601 timestamp
  updated_at: string;  // ISO 8601 timestamp
}

interface GuestWatchlist {
  uuid: string;
  symbols: string[];   // Array of symbol strings
  sort_order: string[]; // Array of symbol strings in display order
  created_at: string;
  updated_at: string;
}

interface GuestLayout {
  uuid: string;
  name: string;
  config: {
    indicators: IndicatorConfig[];
    chartSettings: ChartSettings;
    // ... other layout properties
  };
  created_at: string;
  updated_at: string;
}
```

**Storage Key**: `polishedcharts_data`

**Migration Path**:
- On app load, check `schemaVersion` field
- If missing or < current version, run migrations sequentially
- Update schema version after each migration
- Persist migrated data back to localStorage

---

## 3. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Database                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐                                                    │
│  │    users     │                                                    │
│  ├──────────────┤                                                    │
│  │ id (PK)      │                                                    │
│  │ firebase_uid │─────────────────────────────────────┐             │
│  │ email        │                                      │             │
│  │ email_verified│                                     │             │
│  └──────────────┘                                      │             │
│                                                        │             │
│  ┌──────────────┐      ┌──────────────┐      ┌───────┴─────────┐   │
│  │    alerts    │      │  watchlists  │      │    layouts      │   │
│  ├──────────────┤      ├──────────────┤      ├─────────────────┤   │
│  │ id (PK)      │      │ id (PK)      │      │ id (PK)         │   │
│  │ user_id (FK) │◄─────│ user_id (FK) │◄─────│ user_id (FK)    │   │
│  │ uuid (UQ)    │      │ uuid (UQ)    │      │ uuid (UQ)       │   │
│  │ symbol       │      │ symbols[]    │      │ name            │   │
│  │ condition    │      │ sort_order[] │      │ config (JSONB)  │   │
│  │ created_at   │      │ created_at   │      │ created_at      │   │
│  │ updated_at   │      │ updated_at   │      │ updated_at      │   │
│  └──────────────┘      └──────────────┘      └─────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Firebase Authentication                           │
├─────────────────────────────────────────────────────────────────────┤
│  - User accounts (managed by Firebase)                              │
│  - Email/password authentication                                      │
│  - Google OAuth provider                                             │
│  - Email verification emails                                         │
│  - Password reset emails                                             │
│  - ID token generation                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Browser LocalStorage (Guest)                      │
├─────────────────────────────────────────────────────────────────────┤
│  Key: "polishedcharts_data"                                         │
│                                                                       │
│  {                                                                   │
│    schemaVersion: 1,                                                │
│    alerts: [...],          // GuestAlert[]                           │
│    watchlist: { ... },     // GuestWatchlist                         │
│    layouts: [...]          // GuestLayout[]                          │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Merge Strategy: Guest → User

### 4.1 Merge Algorithm

```
For each entity type (alerts, watchlists, layouts):
  1. Load guest data from localStorage
  2. Fetch existing user data from PostgreSQL (by user_id)
  3. For each guest entity:
     a. If uuid exists in user data:
        - Compare updated_at timestamps
        - If guest.updated_at > user.updated_at + 2 minutes:
          Update user entity with guest data
        - Else if |guest.updated_at - user.updated_at| <= 2 minutes:
          Keep user entity (prefer cloud, deterministic)
        - Else:
          Keep user entity (cloud is more recent)
     b. If uuid doesn't exist in user data:
        - Insert guest entity as new user entity
  4. Clear guest data from localStorage (or keep for backup)
```

### 4.2 Timestamp Comparison

```python
from datetime import datetime, timezone, timedelta

MERGE_TOLERANCE = timedelta(minutes=2)

def should_update(guest_updated: datetime, cloud_updated: datetime) -> bool:
    """
    Determine if guest data should overwrite cloud data.

    Returns True if guest is significantly newer, False otherwise.
    """
    if guest_updated > cloud_updated + MERGE_TOLERANCE:
        return True  # Guest is newer, update cloud
    elif abs(guest_updated - cloud_updated) <= MERGE_TOLERANCE:
        return False  # Within tolerance, prefer cloud (deterministic)
    else:
        return False  # Cloud is newer, keep cloud
```

### 4.3 Watchlist Special Case

Watchlists merge symbols arrays instead of replacing entire entity, but the **timestamp comparison logic remains identical** to the `should_update()` function above:

```python
def merge_watchlists(guest: GuestWatchlist, cloud: Watchlist) -> Watchlist:
    """
    Merge guest and cloud watchlists by combining symbols arrays.

    Timestamp comparison uses the same tolerance logic as should_update():
    - If guest.updated_at > cloud.updated_at + 2 minutes: guest wins
    - If |guest.updated_at - cloud.updated_at| <= 2 minutes: cloud wins (prefer cloud)
    - Else: cloud wins (cloud is more recent)
    """

    # Determine which is more recent (using should_update logic)
    if should_update(guest.updated_at, cloud.updated_at):
        # Guest is significantly newer (> 2 min), use guest's sort_order as base
        base_order = guest.sort_order
        additional_symbols = [
            s for s in cloud.symbols if s not in guest.symbols
        ]
    else:
        # Cloud is newer OR within ±2 minute tolerance (prefer cloud, deterministic)
        base_order = cloud.sort_order
        additional_symbols = [
            s for s in guest.symbols if s not in cloud.symbols
        ]

    # Dedupe and preserve order
    merged_symbols = list(dict.fromkeys(base_order + additional_symbols))

    return Watchlist(
        user_id=cloud.user_id,
        uuid=cloud.uuid,  # Keep cloud UUID
        symbols=merged_symbols,
        sort_order=merged_symbols,
        updated_at=max(guest.updated_at, cloud.updated_at)
    )
```

---

## 5. SQLAlchemy Models

### 5.1 User Model

```python
# backend/app/models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    firebase_uid = Column(String(128), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    display_name = Column(String(255))
    photo_url = Column(String)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")
    watchlists = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    layouts = relationship("Layout", back_populates="user", cascade="all, delete-orphan")
```

### 5.2 Alert Model (Modified)

```python
# backend/app/models/alert.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    uuid = Column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4)

    # Existing fields (symbol, condition, target, enabled, ...)
    symbol = Column(String, nullable=False)
    condition = Column(String, nullable=False)
    target = Column(String, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)

    # New merge fields
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship
    user = relationship("User", back_populates="alerts")

    __table_args__ = (
        # Unique constraint on (user_id, uuid) for upsert-by-UUID
        Index("idx_alerts_user_uuid", "user_id", "uuid", unique=True),
    )
```

### 5.3 Watchlist Model (Modified)

```python
# backend/app/models/watchlist.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UUID, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    uuid = Column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4)

    # Existing fields (symbols array, sort_order array)
    symbols = Column(ARRAY(String), nullable=False, default=list)
    sort_order = Column(ARRAY(String), nullable=False, default=list)

    # New merge fields
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship
    user = relationship("User", back_populates="watchlists")

    __table_args__ = (
        Index("idx_watchlists_user_uuid", "user_id", "uuid", unique=True),
    )
```

### 5.4 Layout Model (New)

```python
# backend/app/models/layout.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

class Layout(Base):
    __tablename__ = "layouts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    uuid = Column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    config = Column(JSONB, nullable=False)  # Serialized layout configuration

    # Merge fields
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship
    user = relationship("User", back_populates="layouts")

    __table_args__ = (
        Index("idx_layouts_user_uuid", "user_id", "uuid", unique=True),
    )
```

---

## 6. TypeScript Types

### 6.1 User Types

```typescript
// src/types/auth.ts

export interface User {
  uid: string;          // Firebase user ID
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
}

export interface AuthContextType {
  user: User | null;
  isSignedIn: boolean;
  isGuest: boolean;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export interface LocalStorageData {
  schemaVersion: number;
  alerts: GuestAlert[];
  watchlist: GuestWatchlist;
  layouts: GuestLayout[];
}

export interface GuestAlert {
  uuid: string;
  symbol: string;
  condition: AlertCondition;
  target: number;
  enabled: boolean;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}

export interface GuestWatchlist {
  uuid: string;
  symbols: string[];
  sort_order: string[];
  created_at: string;
  updated_at: string;
}

export interface GuestLayout {
  uuid: string;
  name: string;
  config: LayoutConfig;
  created_at: string;
  updated_at: string;
}
```

---

## 7. Alembic Migration

### 7.1 Migration Script

```python
# alembic/versions/001_add_firebase_auth.py
"""Add Firebase authentication support

Revision ID: 001_add_firebase_auth
Revises:
Create Date: 2025-12-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '001_add_firebase_auth'
down_revision = None  # Set to previous migration ID
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
    op.add_column('alerts', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('alerts', sa.Column('uuid', postgresql.UUID(), nullable=False))
    op.add_column('alerts', sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')))
    op.add_column('alerts', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')))
    op.create_foreign_key('alerts_user_id_fkey', 'alerts', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_alerts_user_id', 'alerts', ['user_id'])
    op.create_index('idx_alerts_updated_at', 'alerts', ['updated_at'])

    # Generate UUIDs for existing alerts
    op.execute("UPDATE alerts SET uuid = gen_random_uuid() WHERE uuid IS NULL")

    # Create unique index on (user_id, uuid)
    op.create_index('idx_alerts_user_uuid', 'alerts', ['user_id', 'uuid'], unique=True)

    # Add columns to watchlists table
    op.add_column('watchlists', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('watchlists', sa.Column('uuid', postgresql.UUID(), nullable=False))
    op.add_column('watchlists', sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')))
    op.add_column('watchlists', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')))
    op.create_foreign_key('watchlists_user_id_fkey', 'watchlists', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_watchlists_user_id', 'watchlists', ['user_id'])
    op.create_index('idx_watchlists_updated_at', 'watchlists', ['updated_at'])

    # Generate UUIDs for existing watchlists
    op.execute("UPDATE watchlists SET uuid = gen_random_uuid() WHERE uuid IS NULL")

    # Create unique index on (user_id, uuid)
    op.create_index('idx_watchlists_user_uuid', 'watchlists', ['user_id', 'uuid'], unique=True)

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

    op.drop_index('idx_watchlists_user_uuid', table_name='watchlists')
    op.drop_index('idx_watchlists_updated_at', table_name='watchlists')
    op.drop_index('idx_watchlists_user_id', table_name='watchlists')
    op.drop_constraint('watchlists_user_id_fkey', 'watchlists')
    op.drop_column('watchlists', 'updated_at')
    op.drop_column('watchlists', 'created_at')
    op.drop_column('watchlists', 'uuid')
    op.drop_column('watchlists', 'user_id')

    op.drop_index('idx_alerts_user_uuid', table_name='alerts')
    op.drop_index('idx_alerts_updated_at', table_name='alerts')
    op.drop_index('idx_alerts_user_id', table_name='alerts')
    op.drop_constraint('alerts_user_id_fkey', 'alerts')
    op.drop_column('alerts', 'updated_at')
    op.drop_column('alerts', 'created_at')
    op.drop_column('alerts', 'uuid')
    op.drop_column('alerts', 'user_id')

    op.drop_index('idx_users_email', table_name='users')
    op.drop_index('idx_users_firebase_uid', table_name='users')
    op.drop_table('users')
```

---

## 8. Data Integrity Rules

### 8.1 UUID Stability

- UUIDs are generated once (entity creation) and never change
- UUIDs survive merge operations (preserve identity across devices)
- UUIDs used for deduplication and tiebreaking

### 8.2 Timestamp Consistency

- All `created_at` timestamps use UTC timezone
- All `updated_at` timestamps auto-update on entity modification
- Merge comparison uses UTC timestamps exclusively

### 8.3 Foreign Key Constraints

- `user_id` foreign key with `ON DELETE SET NULL` (orphan entities, not cascade delete)
- Prevents accidental data loss when user account is deleted
- Unique constraint on (user_id, uuid) prevents duplicate entities per user

### 8.4 Idempotency

- Upsert-by-UUID ensures identical results on retry
- Merge operations don't create duplicates
- Multiple sign-in attempts from same guest data produce same final state

---

**Phase 1 Complete**: Data model defined with PostgreSQL schema, localStorage schema, merge strategy, SQLAlchemy models, TypeScript types, and Alembic migration. Proceed to contracts and quickstart.
