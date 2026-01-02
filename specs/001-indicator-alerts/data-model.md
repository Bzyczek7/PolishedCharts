# Data Model: Indicator-based Alerts (cRSI only)

**Feature**: 001-indicator-alerts
**Date**: 2025-12-26
**Status**: Final

## Overview

This document defines the data model extensions required for implementing TradingView-style indicator-based alerts with configurable conditions and direction-specific trigger messages.

---

## Entity: Alert

### Purpose

Represents a single alert definition for an indicator. Extends the existing `Alert` model to support:
- Configurable trigger conditions (upper band, lower band, or both)
- Direction-specific trigger messages
- Association with specific indicator parameters
- Computed human-readable label for display

### Schema Changes

```python
# backend/app/models/alert.py (extensions)
class Alert(Base):
    # ... existing fields ...

    # NEW: Direction-specific trigger messages
    message_upper: String = "It's time to sell!"
    message_lower: String = "It's time to buy!"

    # NEW: Enabled conditions (JSONB for extensibility)
    enabled_conditions: JSONB = {"upper": True, "lower": True}
```

### Computed Fields (not stored)

```python
# Computed at query time, not stored in database
def get_alert_label(alert: Alert) -> str:
    """Generate a human-readable label for the alert."""
    # Extract primary parameter (e.g., domcycle for cRSI)
    primary_param = alert.indicator_params.get('domcycle', 20) if alert.indicator_params else 20

    # Generate label based on enabled conditions
    if alert.enabled_conditions.get('upper') and alert.enabled_conditions.get('lower'):
        return f"cRSI({primary_param}) band cross"
    elif alert.enabled_conditions.get('upper'):
        return f"cRSI({primary_param}) upper only"
    elif alert.enabled_conditions.get('lower'):
        return f"cRSI({primary_param}) lower only"
    else:
        return f"cRSI({primary_param}) alert"
```

### Field Definitions

| Field | Type | Default | Description | Validation |
|-------|------|---------|-------------|------------|
| `message_upper` | String(200) | "It's time to sell!" | Message triggered when indicator crosses above upper band | Non-empty if `enabled_conditions.upper == True` |
| `message_lower` | String(200) | "It's time to buy!" | Message triggered when indicator crosses below lower band | Non-empty if `enabled_conditions.lower == True` |
| `enabled_conditions` | JSONB | `{"upper": True, "lower": True}` | Which trigger conditions are enabled | Must have at least one key set to `true` |

### State Transitions

```
[Creation] --> active
active <--> muted (user toggle)
active --> triggered (condition met) --> active (auto-reset after cooldown)
muted --> [deleted]
active --> [deleted]
triggered --> [deleted]
```

**State descriptions**:
- **active**: Alert is armed and will create triggers when conditions are met
- **muted**: Alert is disabled and will not create triggers
- **triggered**: Alert recently fired (transient state, returns to active after cooldown)

### Relationships

```
Alert (1) ----< (many) AlertTrigger
Alert (1) ----< (1) Symbol (via symbol_id)
```

### Validation Rules

1. **At least one condition enabled**: `enabled_conditions` must have at least one `true` value
2. **Message non-empty for enabled conditions**: If `enabled_conditions.upper == true`, then `message_upper` must be non-empty
3. **Valid indicator parameters**: `indicator_params` must be a valid JSON object with keys matching indicator's parameter schema
4. **Cooldown minimum**: 5 seconds minimum (enforced by backend, not schema)

---

## Entity: AlertTrigger

### Purpose

Represents a single occurrence of an alert condition being met. Extended to include the trigger message.

### Schema Changes

```python
# backend/app/models/alert_trigger.py (extensions)
class AlertTrigger(Base):
    # ... existing fields ...

    # NEW: The specific message used for this trigger
    trigger_message: String = None

    # NEW: Which condition triggered (upper or lower band cross)
    trigger_type: String = None  # "upper" or "lower"
```

### Field Definitions

| Field | Type | Nullable | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | Integer | No | Primary key | Auto-increment |
| `alert_id` | Integer | No | Foreign key to Alert | FK constraint |
| `triggered_at` | DateTime(timezone=True) | No | When the trigger occurred | UTC normalized |
| `observed_price` | Float | Yes | Price at trigger time | Optional, for price alerts |
| `indicator_value` | Float | Yes | Indicator value at trigger time | Optional, for indicator alerts |
| `trigger_message` | String(200) | No | Direction-specific message | Non-empty |
| `trigger_type` | String(10) | No | Which condition triggered | Enum: "upper" or "lower" |
| `delivery_status` | String(20) | No | 'pending', 'sent', 'failed' | Enum validation |
| `retry_count` | Integer | No | Number of delivery retries | Default: 0 |
| `last_retry_at` | DateTime | Yes | Last delivery retry timestamp | Nullable |

### Relationships

```
AlertTrigger (many) ----> (1) Alert
```

### Validation Rules

1. **trigger_message required**: Must always be populated with the appropriate message from the parent Alert
2. **triggered_at timezone**: Must be stored in UTC
3. **Foreign key constraint**: `alert_id` must reference an existing Alert

### Cascade Behavior

```
DELETE Alert ----> DELETE all AlertTrigger (cascade)
```

**Rationale**: Trigger history is tied to the alert's lifecycle. Deleting the alert removes all its triggers.

---

## Entity: cRSI Alert Configuration (Derived)

### Purpose

While not a separate database table, this represents the derived configuration for a cRSI alert based on the Alert model fields.

### Type Definition (Frontend)

```typescript
// frontend/src/types/indicators.ts
interface IndicatorAlertConfig {
  indicator_name: 'crsi'
  indicator_params: {
    domcycle: number      // e.g., 20
    vibration: number     // e.g., 14
    leveling: number      // e.g., 11.0
    cyclicmemory: number  // e.g., 40
  }
  enabled_conditions: {
    upper: boolean        // Enable upper band cross
    lower: boolean        // Enable lower band cross
  }
  messages: {
    upper: string         // e.g., "It's time to sell!"
    lower: string         // e.g., "It's time to buy!"
  }
}
```

### Evaluation Semantics

```
FOR each candle update:
  IF alert.is_active AND NOT alert.is_on_cooldown():
    Fetch current and previous cRSI values
    Fetch upper_band and lower_band from indicator data

    triggers = []

    IF enabled_conditions.lower:
      IF previous_crsi >= lower_band AND current_crsi < lower_band:
        triggers.append(AlertTrigger(
          trigger_message = messages.lower,
          trigger_type = "lower",
          indicator_value = current_crsi
        ))

    IF enabled_conditions.upper:
      IF previous_crsi <= upper_band AND current_crsi > upper_band:
        triggers.append(AlertTrigger(
          trigger_message = messages.upper,
          trigger_type = "upper",
          indicator_value = current_crsi
        ))

    IF triggers.length > 0:
      Save all triggers to database
      Apply cooldown to alert
```

---

## Frontend Type Definitions

### Alert (Extended)

```typescript
// frontend/src/types/indicators.ts
export interface Alert {
  id: string
  symbol: string
  condition: AlertCondition
  threshold: number | null

  // NEW: Computed human-readable label
  alert_label: string

  // Indicator fields (existing)
  indicator_name?: string | null
  indicator_field?: string | null
  indicator_params?: Record<string, number | string> | null

  // NEW: Message configuration
  message_upper?: string
  message_lower?: string

  // NEW: Enabled conditions
  enabled_conditions?: {
    upper?: boolean
    lower?: boolean
  }

  // State
  status: 'active' | 'triggered' | 'muted'
  cooldown: number  // seconds
  created_at: string

  // History
  history?: TriggerEvent[]
  statistics?: {
    triggerCount24h: number
    lastTriggered?: string
  }
}
```

### TriggerEvent (Extended)

```typescript
// frontend/src/types/indicators.ts
export interface TriggerEvent {
  id: string
  alert_id: string

  // NEW: Computed alert label
  alert_label: string

  // NEW: Which condition triggered
  trigger_type: 'upper' | 'lower'

  timestamp: string
  symbol: string
  price?: number
  indicator_value?: number

  // The actual message used for this trigger
  trigger_message: string

  delivery_status?: 'pending' | 'sent' | 'failed'
}
```

### IndicatorAlertFormData (New)

```typescript
// frontend/src/types/indicators.ts
export interface IndicatorAlertFormData {
  symbol: string
  indicator_name: 'crsi'
  indicator_params: Record<string, number | string>

  // Condition configuration
  enabled_conditions: {
    upper: boolean
    lower: boolean
  }

  // Message configuration
  messages: {
    upper: string
    lower: string
  }

  // Alert settings
  cooldown?: number  // seconds
}
```

---

## Database Migration Plan

### Migration: `add_indicator_alert_message_fields`

```python
# alembic/versions/XXX_add_indicator_alert_message_fields.py

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add message columns to Alert table
    op.add_column('alerts', sa.Column('message_upper', sa.String(200), nullable=True))
    op.add_column('alerts', sa.Column('message_lower', sa.String(200), nullable=True))

    # Add enabled_conditions column
    op.add_column('alerts', sa.Column('enabled_conditions', sa.JSON(), nullable=True))

    # Set defaults for existing records (backwards compatibility)
    op.execute("""
        UPDATE alerts
        SET message_upper = 'It\\'s time to sell!',
            message_lower = 'It\\'s time to buy!',
            enabled_conditions = '{"upper": true, "lower": true}'::jsonb
        WHERE indicator_name IS NOT NULL
    """)

    # Make columns non-nullable after setting defaults
    op.alter_column('alerts', 'message_upper', nullable=False, server_default="It's time to sell!")
    op.alter_column('alerts', 'message_lower', nullable=False, server_default="It's time to buy!")

def downgrade():
    op.drop_column('alerts', 'enabled_conditions')
    op.drop_column('alerts', 'message_lower')
    op.drop_column('alerts', 'message_upper')
```

### Migration: `add_trigger_message_field`

```python
# alembic/versions/XXX_add_trigger_message_field.py

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add trigger_message column to AlertTrigger table
    op.add_column('alert_triggers', sa.Column('trigger_message', sa.String(200), nullable=True))

    # Add trigger_type column to distinguish upper vs lower triggers
    op.add_column('alert_triggers', sa.Column('trigger_type', sa.String(10), nullable=True))

    # For existing triggers, derive message and type from alert configuration
    op.execute("""
        UPDATE alert_triggers t
        SET trigger_message = CASE
            WHEN a.indicator_name = 'crsi' AND a.condition = 'indicator_crosses_upper' THEN 'It\\'s time to sell!'
            WHEN a.indicator_name = 'crsi' AND a.condition = 'indicator_crosses_lower' THEN 'It\\'s time to buy!'
            ELSE 'Alert triggered'
        END,
        trigger_type = CASE
            WHEN a.condition = 'indicator_crosses_upper' THEN 'upper'
            WHEN a.condition = 'indicator_crosses_lower' THEN 'lower'
            ELSE 'upper'
        END
        FROM alerts a
        WHERE t.alert_id = a.id
          AND t.trigger_message IS NULL
    """)

    # Make columns non-nullable
    op.alter_column('alert_triggers', 'trigger_message', nullable=False)
    op.alter_column('alert_triggers', 'trigger_type', nullable=False)

def downgrade():
    op.drop_column('alert_triggers', 'trigger_type')
    op.drop_column('alert_triggers', 'trigger_message')
```

---

## API Request/Response Schemas

### AlertCreate (Extended)

```python
# backend/app/schemas/indicator.py
class IndicatorAlertCreate(BaseModel):
    symbol: str
    indicator_name: str = 'crsi'
    indicator_params: Dict[str, Union[int, float, str]]

    # NEW: Condition and message configuration
    enabled_conditions: Dict[str, bool] = {"upper": True, "lower": True}
    message_upper: str = "It's time to sell!"
    message_lower: str = "It's time to buy!"

    cooldown: Optional[int] = None  # seconds, None uses default

    class Config:
        schema_extra = {
            "example": {
                "symbol": "AAPL",
                "indicator_name": "crsi",
                "indicator_params": {"domcycle": 20, "vibration": 14},
                "enabled_conditions": {"upper": True, "lower": True},
                "message_upper": "It's time to sell!",
                "message_lower": "It's time to buy!",
                "cooldown": 60
            }
        }
```

### AlertResponse (Extended)

```python
class AlertResponse(BaseModel):
    id: int
    symbol: str
    condition: str
    threshold: Optional[float]

    indicator_name: Optional[str]
    indicator_field: Optional[str]
    indicator_params: Optional[Dict[str, Union[int, float, str]]]

    # NEW: Message configuration
    message_upper: str
    message_lower: str
    enabled_conditions: Dict[str, bool]

    # State
    is_active: bool
    created_at: datetime
    cooldown: Optional[int]
```

### TriggerResponse (Extended)

```python
class TriggerResponse(BaseModel):
    id: int
    alert_id: int
    triggered_at: datetime
    observed_price: Optional[float]
    indicator_value: Optional[float]

    # NEW: The specific message used
    trigger_message: str

    delivery_status: str
```

---

## Data Flow Diagrams

### Alert Creation Flow

```
User (context menu)
  |
  v
IndicatorAlertModal (collects form data)
  |
  v
POST /api/v1/alerts/
  {
    symbol: "AAPL",
    indicator_name: "crsi",
    indicator_params: {domcycle: 20},
    enabled_conditions: {upper: true, lower: true},
    message_upper: "It's time to sell!",
    message_lower: "It's time to buy!"
  }
  |
  v
Alert model (created in database)
  |
  v
AlertResponse (returned to frontend)
  |
  v
AlertsList (displays new alert)
```

### Trigger Evaluation Flow

```
Price/Indicator Update
  |
  v
AlertEngine.evaluate_symbol_alerts()
  |
  +--> Fetch active alerts for symbol
  |
  +--> For each alert:
  |     |
  |     +--> Check cooldown
  |     |
  |     +--> Fetch current/previous indicator values
  |     |
  |     +--> Evaluate enabled_conditions:
  |           |
  |           +--> If lower enabled AND crosses lower:
  |           |      Create AlertTrigger(trigger_message=message_lower)
  |           |
  |           +--> If upper enabled AND crosses upper:
  |                  Create AlertTrigger(trigger_message=message_upper)
  |     |
  |     +--> If any triggers created:
  |           Save to database
  |           Apply cooldown
  |
  v
Return list of triggered alerts
```

### Log Display Flow

```
User opens Log tab
  |
  v
GET /api/v1/alerts/triggers/recent?limit=500
  |
  v
Backend queries:
  SELECT * FROM alert_triggers
  JOIN alerts ON alert_triggers.alert_id = alerts.id
  ORDER BY triggered_at DESC
  LIMIT 500
  |
  v
TriggerResponse[] (returned to frontend)
  |
  v
LogTab (displays triggers in reverse chronological order)
```

---

## Indexes and Performance

### Recommended Indexes

```sql
-- For trigger log queries (sorted by time, filtered by symbol)
CREATE INDEX idx_alert_triggers_triggered_at ON alert_triggers(triggered_at DESC);
CREATE INDEX idx_alert_triggers_alert_id ON alert_triggers(alert_id);

-- For alert evaluation queries (filter by symbol and status)
CREATE INDEX idx_alerts_symbol_active ON alerts(symbol_id, is_active) WHERE is_active = true;

-- For JSONB queries on enabled_conditions (PostgreSQL)
CREATE INDEX idx_alerts_enabled_conditions ON alerts USING gin(enabled_conditions);
```

### Query Performance Estimates

| Query | Index Used | Estimated Rows | Time (p95) |
|-------|------------|----------------|------------|
| Get active alerts for symbol | `idx_alerts_symbol_active` | <100 | <5ms |
| Create trigger | `idx_alert_triggers_alert_id` | 1 insert | <10ms |
| Get recent triggers (log) | `idx_alert_triggers_triggered_at` | 500 | <20ms |

---

## Validation Examples

### Example 1: Valid cRSI Alert (both conditions)

```json
{
  "symbol": "AAPL",
  "indicator_name": "crsi",
  "indicator_params": {"domcycle": 20, "vibration": 14, "leveling": 11.0, "cyclicmemory": 40},
  "enabled_conditions": {"upper": true, "lower": true},
  "message_upper": "Time to sell AAPL!",
  "message_lower": "Time to buy AAPL!",
  "cooldown": 60
}
```

**Result**: ✓ Valid

### Example 2: Valid cRSI Alert (upper only)

```json
{
  "symbol": "TSLA",
  "indicator_name": "crsi",
  "indicator_params": {"domcycle": 14},
  "enabled_conditions": {"upper": true, "lower": false},
  "message_upper": "TSLA overbought!",
  "message_lower": "It's time to buy!"  // Still required but unused
}
```

**Result**: ✓ Valid (lower message stored but not used)

### Example 3: Invalid - No conditions enabled

```json
{
  "symbol": "MSFT",
  "indicator_name": "crsi",
  "indicator_params": {"domcycle": 20},
  "enabled_conditions": {"upper": false, "lower": false},
  "message_upper": "Sell!",
  "message_lower": "Buy!"
}
```

**Result**: ✗ Invalid (at least one condition must be enabled)

### Example 4: Invalid - Empty message for enabled condition

```json
{
  "symbol": "GOOGL",
  "indicator_name": "crsi",
  "indicator_params": {"domcycle": 20},
  "enabled_conditions": {"upper": true, "lower": true},
  "message_upper": "",  // Empty!
  "message_lower": "Buy!"
}
```

**Result**: ✗ Invalid (message_upper cannot be empty when upper condition is enabled)

---

## Edge Cases and Special Handling

### Edge Case 1: Both Bands Crossed in Single Candle

**Scenario**: cRSI gaps from below lower band to above upper band

```
Previous: cRSI = 25, lower_band = 30, upper_band = 70
Current:  cRSI = 80, lower_band = 30, upper_band = 70
```

**Behavior**:
- Creates **two** AlertTrigger records:
  1. `trigger_message = message_lower` (crossed from 25 to 80, triggered lower)
  2. `trigger_message = message_upper` (crossed from 25 to 80, triggered upper)
- Cooldown applies to alert after both triggers created

### Edge Case 2: Rapid Oscillation

**Scenario**: cRSI crosses upper band, then crosses back in next candle

```
Candle N-1: cRSI = 60, upper_band = 70
Candle N:   cRSI = 75, upper_band = 70  <-- Trigger created
Candle N+1: cRSI = 65, upper_band = 70  <-- No trigger (crossing down not tracked)
```

**Behavior**:
- First upper cross creates trigger
- Cooldown prevents re-trigger even if oscillates back above
- Cooldown duration: user-configurable, minimum 5 seconds

### Edge Case 3: Missing Indicator Data

**Scenario**: Alert exists but indicator data is temporarily unavailable

```
Candle N-1: cRSI = 60
Candle N:   cRSI = NULL (data gap or calculation error)
```

**Behavior**:
- No trigger created (cannot determine cross without current value)
- Alert remains active
- Next valid candle evaluation resumes normally

### Edge Case 4: Indicator Parameter Changed

**Scenario**: User creates alert for cRSI(20), then changes chart to cRSI(14)

**Behavior**:
- Alert is tied to its `indicator_params`, not the current chart state
- Alert continues to evaluate using cRSI(20) values
- User can delete old alert and create new one for cRSI(14)
- **Future enhancement**: Warn user if indicator params on chart don't match alert

---

## Backwards Compatibility

### Existing Alerts

- Alerts created before this feature (without `message_upper`, `message_lower`, `enabled_conditions`) will be migrated with defaults
- Migration sets: `message_upper = "It's time to sell!"`, `message_lower = "It's time to buy!"`, `enabled_conditions = {"upper": true, "lower": true}`
- Existing trigger events will receive generic messages based on condition type

### API Versioning

- Existing `POST /api/v1/alerts/` endpoint is extended (new fields are optional)
- Old clients can continue creating alerts without message/condition fields (defaults applied)
- New clients should provide message/condition fields for cRSI alerts

### Frontend Compatibility

- Old `AlertsList` component displays triggers without `trigger_message` (graceful degradation)
- New `LogTab` component requires `trigger_message` field (will show empty string for old triggers)
