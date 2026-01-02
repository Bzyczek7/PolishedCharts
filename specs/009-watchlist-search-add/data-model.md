# Data Model: Feature 009 - Watchlist Search, Add, and Historical Data Backfill

**Feature**: 009-watchlist-search-add
**Date**: 2025-12-27
**Status**: Draft

## Overview

This document defines the database schema changes for the watchlist and ticker search functionality. Two new tables are added: `ticker_universe` for search functionality and `watchlist` for tracking added symbols.

---

## New Tables

### 1. ticker_universe

**Purpose**: Stores searchable US equity ticker symbols with display names. Populated via seed script, optionally refreshed via cron.

```sql
CREATE TABLE ticker_universe (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL,
    asset_class     VARCHAR(20),      -- 'equity', 'crypto', 'forex'
    exchange        VARCHAR(50),      -- 'NASDAQ', 'NYSE', etc.
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search performance
CREATE INDEX ix_ticker_universe_ticker ON ticker_universe(ticker);
CREATE INDEX ix_ticker_universe_display_name ON ticker_universe(display_name);

-- Unique constraint
ALTER TABLE ticker_universe ADD CONSTRAINT uix_ticker_universe_ticker UNIQUE (ticker);
```

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| ticker | VARCHAR(20) | NOT NULL, UNIQUE | Stock symbol (e.g., "AAPL") |
| display_name | VARCHAR(200) | NOT NULL | Company name (e.g., "Apple Inc.") |
| asset_class | VARCHAR(20) | NULLABLE | Asset classification |
| exchange | VARCHAR(50) | NULLABLE | Exchange name |
| created_at | TIMESTAMP | DEFAULT NOW() | Row creation timestamp |

**Indexes**:
- `ix_ticker_universe_ticker`: For exact symbol lookups
- `ix_ticker_universe_display_name`: For company name searches
- `uix_ticker_universe_ticker`: Unique constraint on ticker

**SQLAlchemy Model**:

```python
# backend/app/models/ticker_universe.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class TickerUniverse(Base):
    __tablename__ = "ticker_universe"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False, index=True)
    asset_class = Column(String(20), nullable=True)  # 'equity', 'crypto', 'forex'
    exchange = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<TickerUniverse(ticker={self.ticker}, name={self.display_name})>"
```

---

### 2. watchlist

**Purpose**: Stores symbols added to the global shared watchlist. Only created after successful historical data backfill.

```sql
CREATE TABLE watchlist (
    id          SERIAL PRIMARY KEY,
    symbol_id   INTEGER NOT NULL,
    added_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (symbol_id) REFERENCES symbol(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX ix_watchlist_symbol_id ON watchlist(symbol_id);

-- Unique constraint: one entry per symbol
ALTER TABLE watchlist ADD CONSTRAINT uix_watchlist_symbol_id UNIQUE (symbol_id);
```

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| symbol_id | INTEGER | NOT NULL, FK → symbol(id), UNIQUE | Foreign key to symbol table |
| added_at | TIMESTAMP | DEFAULT NOW() | When the symbol was added |

**Indexes**:
- `ix_watchlist_symbol_id`: For FK lookups and joins
- `uix_watchlist_symbol_id`: Unique constraint (one entry per symbol)

**Foreign Keys**:
- `symbol_id` → `symbol(id)` with `ON DELETE CASCADE`

**SQLAlchemy Model**:

```python
# backend/app/models/watchlist.py
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class WatchlistEntry(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, ForeignKey("symbol.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('symbol_id', name='uix_watchlist_symbol_id'),
    )

    def __repr__(self):
        return f"<WatchlistEntry(symbol_id={self.symbol_id}, added_at={self.added_at})>"
```

---

## Existing Tables (Verification Required)

### symbol (existing)

**Note**: Verify this table exists and has the expected structure.

```sql
-- Expected structure (from existing codebase)
CREATE TABLE symbol (
    id      SERIAL PRIMARY KEY,
    ticker  VARCHAR(20) UNIQUE NOT NULL,
    name    VARCHAR(200)
);
```

**Relationship to new tables**:
- `watchlist.symbol_id` → `symbol.id`
- `candle.symbol_id` → `symbol.id`

### candle (existing)

**Note**: Verify unique constraint exists.

```sql
-- Expected structure (from existing codebase)
CREATE TABLE candle (
    symbol_id   INTEGER NOT NULL,
    timestamp   TIMESTAMP WITH TIME ZONE NOT NULL,
    interval    VARCHAR(10) NOT NULL,
    open        FLOAT NOT NULL,
    high        FLOAT NOT NULL,
    low         FLOAT NOT NULL,
    close       FLOAT NOT NULL,
    volume      INTEGER,
    PRIMARY KEY (symbol_id, timestamp, interval),
    CONSTRAINT uix_candle_symbol_timestamp_interval
        UNIQUE (symbol_id, timestamp, interval)
);
```

**Important**: The unique constraint on `(symbol_id, timestamp, interval)` enables idempotent backfill.

---

## Entity Relationships

```
┌─────────────────┐
│ ticker_universe │
│ ─────────────── │
│ id (PK)         │
│ ticker          │
│ display_name    │
└─────────────────┘
         │
         │ (via ticker string, not FK)
         │
         ▼
┌─────────────────┐         ┌─────────────────┐
│   watchlist     │    ┌────│     symbol      │
│ ─────────────── │    │    │ ─────────────── │
│ id (PK)         │    │    │ id (PK)         │
│ symbol_id (FK)──┼────┘    │ ticker          │
│ added_at        │         │ name            │
└─────────────────┘         └────────┬────────┘
                                     │
                                     │
                                     ▼
                            ┌─────────────────┐
                            │     candle      │
                            │ ─────────────── │
                            │ symbol_id (FK)  │
                            │ timestamp       │
                            │ interval        │
                            │ open/high/low   │
                            │ close/volume    │
                            └─────────────────┘
```

**Notes**:
- `ticker_universe` is NOT directly joined to `symbol` via FK
- The relationship is logical: `ticker_universe.ticker` matches `symbol.ticker`
- During watchlist add:
  1. Lookup in `ticker_universe` for validation
  2. Get or create `symbol` entry
  3. Create `watchlist` entry with `symbol_id`

---

## Data Flow: Watchlist Add Operation

```
1. User submits: POST /api/v1/watchlist { symbol: "AAPL" }

2. Validate ticker exists in ticker_universe
   SELECT * FROM ticker_universe WHERE ticker = 'AAPL'

3. Get or create symbol
   BEGIN TRANSACTION
   SELECT * FROM symbol WHERE ticker = 'AAPL'
   IF NOT FOUND:
       INSERT INTO symbol (ticker, name) VALUES ('AAPL', 'Apple Inc.')

4. Backfill historical data (idempotent)
   -- Fetch from yfinance
   -- Insert using ON CONFLICT DO UPDATE
   INSERT INTO candle (symbol_id, timestamp, interval, open, high, low, close, volume)
   VALUES (...)
   ON CONFLICT (symbol_id, timestamp, interval) DO UPDATE SET
       open = EXCLUDED.open, high = EXCLUDED.high, ...

5. Create watchlist entry
   INSERT INTO watchlist (symbol_id) VALUES (symbol_id)
   -- If already exists: unique constraint violation → return "already_present"

6. COMMIT (or ROLLBACK on any failure)
```

---

## Validation Rules

### ticker_universe
- `ticker` must be 1-5 characters (per spec FR-001)
- `ticker` must be uppercase (normalized before insert)
- `display_name` required

### watchlist
- `symbol_id` must reference existing `symbol.id`
- One entry per symbol (unique constraint)
- Only created after successful backfill

### symbol (existing)
- `ticker` must be unique
- Get-or-create pattern used during watchlist add

---

## Migration Strategy

### Alembic Migration

```python
# alembic/versions/XXXXXXXX_add_watchlist_tables.py
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'  # Previous migration
branch_labels = None
depends_on = None

def upgrade():
    # Create ticker_universe table
    op.create_table(
        'ticker_universe',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ticker', sa.String(length=20), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=False),
        sa.Column('asset_class', sa.String(length=20), nullable=True),
        sa.Column('exchange', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticker', name='uix_ticker_universe_ticker')
    )
    op.create_index('ix_ticker_universe_ticker', 'ticker_universe', ['ticker'])
    op.create_index('ix_ticker_universe_display_name', 'ticker_universe', ['display_name'])

    # Create watchlist table
    op.create_table(
        'watchlist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['symbol_id'], ['symbol.id'], name=op.f('fk_watchlist_symbol_id_symbol'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_watchlist_symbol_id', 'watchlist', ['symbol_id'])
    op.create_unique_constraint('uix_watchlist_symbol_id', 'watchlist', ['symbol_id'])

def downgrade():
    op.drop_table('watchlist')
    op.drop_table('ticker_universe')
```

### Seed Data Migration

```python
# Separate migration for seed data (run after table creation)
# or run via standalone script

import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.ticker_universe import TickerUniverse
from app.scripts.seed_ticker_universe import fetch_and_seed

async def seed_ticker_data():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(TickerUniverse).limit(1))
        if result.scalars().first():
            print("Ticker universe already seeded")
            return

        await fetch_and_seed(db)
        print("Ticker universe seeded successfully")
```

---

## Query Patterns

### Search (Ticker Lookup)

```sql
-- Partial match on ticker
SELECT ticker, display_name
FROM ticker_universe
WHERE ticker LIKE 'AAP%'
LIMIT 10;

-- Partial match on display_name
SELECT ticker, display_name
FROM ticker_universe
WHERE display_name ILIKE '%Apple%'
LIMIT 10;
```

### Watchlist List

```sql
-- Get all watchlist entries with symbol info
SELECT
    w.id,
    w.added_at,
    s.ticker,
    s.name
FROM watchlist w
JOIN symbol s ON w.symbol_id = s.id
ORDER BY w.added_at DESC;
```

### Poller Integration

```sql
-- Get all ticker symbols for polling
SELECT s.ticker
FROM watchlist w
JOIN symbol s ON w.symbol_id = s.id;
```

---

## Performance Considerations

### Expected Data Volume
- `ticker_universe`: ~8,000 rows (US equities)
- `watchlist`: Typically 10-50 rows, up to 100+

### Index Effectiveness
- Indexes on `ticker` and `display_name` support fast prefix searches
- Unique constraint on `watchlist.symbol_id` prevents duplicates without additional queries
- FK indexes ensure fast joins for watchlist display

### Query Performance
- Search query: <10ms with 8,000 rows (simple prefix match)
- Watchlist list: <5ms with 100 entries
- Poller load: <50ms for 100 symbols

---

## Data Integrity

### Idempotent Backfill
The `candle` table unique constraint ensures:
```sql
INSERT INTO candle (...)
VALUES (...)
ON CONFLICT (symbol_id, timestamp, interval)
DO UPDATE SET open=EXCLUDED.open, ...
```
Safe to re-run - no duplicates.

### Transactional Add
```python
async with db.begin():  # All-or-nothing
    # Validate ticker
    # Backfill data
    # Create watchlist entry
    # If any step fails, ROLLBACK
```

### Cascade Delete
If a `symbol` is deleted, all associated `watchlist` and `candle` entries are removed (via `ON DELETE CASCADE`).

---

## Testing Requirements

### Unit Tests
1. `TickerUniverse` model creation and validation
2. `WatchlistEntry` model creation and uniqueness
3. FK constraint enforcement
4. Unique constraint violations

### Integration Tests
1. Seed script populates `ticker_universe`
2. Watchlist add creates symbol, candles, and watchlist entry atomically
3. Duplicate add returns "already_present"
4. Failed backfill does not create partial entries

### Performance Tests
1. Search query performance with 8,000+ rows
2. Watchlist list performance with 100+ entries
3. Poller load performance

---

**Next Steps**:
1. Review and approve data model
2. Generate API contracts
3. Implement Alembic migration
4. Create seed script
