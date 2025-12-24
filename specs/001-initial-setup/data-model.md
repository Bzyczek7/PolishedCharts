# Data Model: Initial Project Setup

**Feature**: 001-initial-setup
**Date**: 2025-12-23
**Status**: Final

## Overview

This document defines the data model for the TradingAlert application. The model supports local caching of market data, unlimited price alerts, and alert trigger history.

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────────┐
│   Symbol    │───────│   Candle    │       │ AlertTrigger    │
│─────────────│ 1   N │─────────────│       │─────────────────│
│ id          │       │ symbol_id   │       │ id              │
│ ticker      │       │ timestamp   │       │ alert_id        │
│ name        │       │ interval    │  1  N │ triggered_at    │
│ exchange    │       │ open        │───────│ observed_price  │
└─────────────┘       │ high        │       └─────────────────┘
                      │ low         │
                      │ close       │       ┌─────────────┐
                      │ volume      │       │   Alert    │
                      └─────────────┘       │─────────────│
                               │             │ id          │
┌─────────────┐                │             │ symbol_id   │
│BackfillJob  │                │             │ condition   │
│─────────────┘                │             │ threshold   │
│ id          │                │             │ is_active   │
│ symbol_id   │                │             │ created_at  │
│ interval    │                │             │ cooldown    │
│ status      │                │             └─────────────┘
│ started_at  │                │                    ▲
│ completed_at│                │                    │
└─────────────┘                └────────────────────┘
                               (Alert evaluates against
                                latest Candle data)
```

## Entities

### Symbol

Represents a tradable asset (stock, ETF, index, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, Auto-increment | Internal identifier |
| ticker | String | UNIQUE, NOT NULL, Indexed | Trading symbol (e.g., "AAPL", "SPY") |
| name | String | NULLABLE | Full name (e.g., "Apple Inc.") |
| exchange | String | NULLABLE | Exchange code (e.g., "NASDAQ", "NYSE") |

**Validation Rules**:
- `ticker`: Must be uppercase, 1-10 characters, alphanumeric plus dots and hyphens
- `exchange`: If present, must be a valid exchange code

**Indexes**:
- `idx_symbol_ticker`: Unique index on ticker for fast lookups

**Existing Implementation**: `backend/app/models/symbol.py`

---

### Candle

Represents a single OHLCV data point for a symbol at a specific timestamp and interval.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| symbol_id | Integer | FK(symbol.id), PK Component | Reference to Symbol |
| timestamp | DateTime | PK Component, Indexed, Timezone-aware | Candle timestamp in **UTC** |
| interval | String | PK Component, Indexed | Time interval (1m, 5m, 15m, 1h, 1d) |
| open | Float | NOT NULL | Opening price |
| high | Float | NOT NULL | Highest price |
| low | Float | NOT NULL | Lowest price |
| close | Float | NOT NULL | Closing price |
| volume | Integer | NULLABLE | Trading volume |

**Validation Rules**:
- `timestamp`: Must be stored in UTC (constitution requirement)
- `interval`: Must be one of the supported intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
- Price validation: `high >= max(open, close)`, `low <= min(open, close)`, `close >= 0`

**Uniqueness Constraint**:
- Composite unique key: `(symbol_id, timestamp, interval)`
- Enables idempotent inserts via `ON CONFLICT DO UPDATE`

**Indexes**:
- `idx_candle_symbol_timestamp`: Composite index on (symbol_id, timestamp) for time-series queries
- `idx_candle_timestamp`: Index on timestamp for gap detection queries

**Gap Handling**:
- Gaps are detected by comparing expected vs actual timestamps
- Expected timestamp = previous timestamp + interval duration
- Gaps are marked visually in the UI; data is not backfilled automatically

**Existing Implementation**: `backend/app/models/candle.py`

---

### Alert

Represents a user-defined price alert rule.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, Auto-increment | Internal identifier |
| symbol_id | Integer | FK(symbol.id), NOT NULL | Reference to Symbol |
| condition | String | NOT NULL | Alert condition type |
| threshold | Float | NOT NULL | Target price for alert |
| is_active | Boolean | Default: True | Whether alert is enabled |
| created_at | DateTime | Default: now() | Creation timestamp |
| cooldown | Integer | NULLABLE | Cooldown period in seconds (optional) |

**Condition Types** (enum values):
- `above`: Triggers when `current > threshold AND previous <= threshold`
- `below`: Triggers when `current < threshold AND previous >= threshold`
- `crosses_up`: Triggers when `previous < threshold AND current >= threshold`
- `crosses_down`: Triggers when `previous > threshold AND current <= threshold`

**Validation Rules**:
- `condition`: Must be one of the defined condition types
- `threshold`: Must be positive (enforced at UI/API layer)
- `cooldown`: If present, must be >= 0, recommended values: 60, 300, 600, 3600

**Constitution Compliance**:
- No application-level limit on number of alerts (Principle III)
- Alert semantics precisely defined (Principle II)

**Existing Implementation**: `backend/app/models/alert.py` (needs updates for clarified semantics)

---

### AlertTrigger

**TO BE ADDED** - Records when an alert condition is met.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, Auto-increment | Internal identifier |
| alert_id | Integer | FK(alert.id), NOT NULL, Indexed | Reference to Alert |
| triggered_at | DateTime | NOT NULL, Indexed | When the alert triggered (UTC) |
| observed_price | Float | NOT NULL | The price that triggered the alert |

**Validation Rules**:
- `triggered_at`: Must be stored in UTC
- `observed_price`: Must be the actual price that triggered the condition

**Indexes**:
- `idx_alert_trigger_alert_id`: Index on alert_id for history queries
- `idx_alert_trigger_triggered_at`: Index on triggered_at for time-based queries

**Purge Policy** (to be configured):
- Retain alert triggers for 90 days by default
- User-configurable retention period

**Status**: New entity to be added

---

### BackfillJob

Represents a historical data backfill job for a symbol/interval pair.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, Auto-increment | Internal identifier |
| symbol_id | Integer | FK(symbol.id), NOT NULL | Reference to Symbol |
| interval | String | NOT NULL | Time interval being backfilled |
| status | String | NOT NULL | Job status (pending, in_progress, completed, failed) |
| started_at | DateTime | NULLABLE | Job start time |
| completed_at | DateTime | NULLABLE | Job completion time |

**Status Values**:
- `pending`: Job queued, not started
- `in_progress`: Job actively fetching data
- `completed`: Job finished successfully
- `failed`: Job failed with error

**Existing Implementation**: `backend/app/models/backfill_job.py`

---

## State Transitions

### Alert Lifecycle

```
┌─────────┐   trigger occurs   ┌─────────────┐   cooldown?   ┌─────────┐
│ Created │───────────────────>│ Triggered   │──────────────>│ Active  │
└─────────┘                   └─────────────┘                └─────────┘
     │                                                           │
     │ user disables                                           │ user deletes
     v                                                           v
┌─────────┐                                                  ┌──────────┐
│Disabled │                                                  │ Deleted  │
└─────────┘                                                  └──────────┘
```

### BackfillJob Lifecycle

```
┌─────────┐   start   ┌─────────────┐   complete   ┌───────────┐
│ Pending │──────────>│ In Progress │─────────────>│ Completed │
└─────────┘           └─────────────┘              └───────────┘
                            │
                            │ error
                            v
                       ┌─────────┐
                       │ Failed  │
                       └─────────┘
```

---

## Validation Rules Summary

| Entity | Rule | Enforcement |
|--------|------|-------------|
| Candle | UTC timestamps | Database constraint + application layer |
| Candle | Unique (symbol, timestamp, interval) | Database unique constraint |
| Candle | high >= max(open, close) | Application layer before insert |
| Candle | low <= min(open, close) | Application layer before insert |
| Alert | Valid condition type | Application layer (enum) |
| Alert | Positive threshold | Application layer validation |
| AlertTrigger | UTC timestamps | Application layer |

---

## Database Migration Strategy

Alembic is used for database migrations. Migration files exist in `backend/alembic/versions/`.

**New Migration Required**: Add `AlertTrigger` table

```python
# alembic/versions/xxx_add_alert_trigger.py
def upgrade():
    op.create_table(
        'alert_trigger',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=False),
        sa.Column('triggered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('observed_price', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alert.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_alert_trigger_alert_id', 'alert_trigger', ['alert_id'])
    op.create_index('idx_alert_trigger_triggered_at', 'alert_trigger', ['triggered_at'])

def downgrade():
    op.drop_index('idx_alert_trigger_triggered_at', table_name='alert_trigger')
    op.drop_index('idx_alert_trigger_alert_id', table_name='alert_trigger')
    op.drop_table('alert_trigger')
```

---

## Constitution Compliance

| Principle | Compliance | Implementation |
|-----------|-------------|----------------|
| II - Correctness: UTC timestamps | ✅ | All timestamp columns use `DateTime(timezone=True)` |
| II - Correctness: Deduplication | ✅ | Unique constraint on (symbol_id, timestamp, interval) |
| II - Correctness: Alert semantics | ✅ | Clarified in Alert condition types |
| III - Unlimited alerts | ✅ | No limit constraints on Alert table |
| IV - Local-first | ✅ | All data stored in SQLite locally |
