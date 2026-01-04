# Data Model: Indicator Database Storage

**Feature**: Indicator Database Storage
**Date**: 2025-01-04
**Status**: Complete

## Entity: IndicatorConfig

**Description**: Represents a single indicator instance configured by a user, including its type, parameters, visual styling, and visibility state.

### Primary Key

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Auto-generated primary key (internal database identifier) |

### Foreign Keys

| Field | Type | Reference | On Delete | Nullable | Description |
|-------|------|-----------|-----------|----------|-------------|
| `user_id` | Integer | `users.id` | SET NULL | Yes | Owner of this indicator configuration (NULL for guest/unassigned) |

### Core Fields

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `uuid` | UUID | NOT NULL | `uuid.uuid4()` | Stable identifier for merge operations (per-user unique, not globally unique) |
| `indicator_name` | String(50) | NOT NULL, Indexed | - | Indicator type name (e.g., 'sma', 'ema', 'tdfi', 'crsi') |
| `indicator_category` | String(20) | NOT NULL | - | Category classification ('overlay' or 'oscillator') |
| `indicator_params` | JSON | NOT NULL | - | Parameter values (e.g., `{'length': 20}`, `{'period': 14}`) |
| `display_name` | String(255) | NOT NULL | - | Human-readable name (e.g., "SMA (20)", "cRSI (14)") |
| `style` | JSON | NOT NULL | - | Visual styling (color, lineWidth, showLastValue, seriesColors) |
| `is_visible` | Boolean | NOT NULL | `true` | Visibility state (hide without removing) |

### Timestamps

| Field | Type | Constraints | Default | On Update | Description |
|-------|------|-------------|---------|-----------|-------------|
| `created_at` | DateTime(timezone=True) | NOT NULL | `datetime.now(timezone.utc)` | - | Config creation timestamp |
| `updated_at` | DateTime(timezone=True) | NOT NULL | `datetime.now(timezone.utc)` | Auto | Last update timestamp (used for merge conflict resolution) |

### Constraints

| Name | Type | Fields | Description |
|------|------|--------|-------------|
| `uq_indicator_config_user_uuid` | Unique | `(user_id, uuid)` | Ensures UUID is unique within each user's scope |

### Relationships

| Relationship | Target | Type | Back Populates | Description |
|--------------|--------|------|----------------|-------------|
| `user` | `User` | Many-to-One | (none defined) | Owner of this indicator configuration |

---

## Entity Relationships

### User → IndicatorConfig (One-to-Many)

**Description**: A user can have multiple indicator configurations. Each indicator belongs to exactly one user (or is unassigned/guest).

```
User (1) ----< (0..*) IndicatorConfig
```

**Relationship Details**:
- **From**: `User.id`
- **To**: `IndicatorConfig.user_id`
- **Cardinality**: One user can have zero or more indicators
- **On Delete**: SET NULL (indicators become orphaned when user deleted)
- **Nullable**: Yes (guest/unassigned indicators have `user_id = NULL`)

**Use Cases**:
1. Retrieve all indicators for authenticated user: `SELECT * FROM indicator_configs WHERE user_id = ?`
2. Merge guest indicators into user account: `UPDATE indicator_configs SET user_id = ? WHERE uuid IN (?)`
3. Delete user account: Indicators become orphaned (user_id set to NULL)

---

## State Transitions

### Indicator Lifecycle

```
[Created] → [Updated] → [Deleted]
     ↓           ↓           ↓
  (visible)   (visible)   (removed)
```

**States**:
1. **Created**: New indicator added to database (from API or guest merge)
2. **Updated**: Indicator parameters or styling modified
3. **Deleted**: Indicator removed from database (hard delete via DELETE endpoint)

**Transition Validations**:
- **Create**: `indicator_name` must be valid, `indicator_params` must be validated against indicator schema
- **Update**: `uuid` must not change (immutable identifier)
- **Delete**: No validations; hard delete removes record

---

## Merge Semantics

### Guest → Authenticated User Transition

**Operation**: Upsert by `uuid` within `user_id` scope

**Algorithm**:
```python
for guest_indicator in guest_indicators:
    existing = db.query(IndicatorConfig)
        .filter_by(user_id=auth_user_id, uuid=guest_indicator.uuid)
        .first()

    if not existing:
        # Insert new indicator
        guest_indicator.user_id = auth_user_id
        db.add(guest_indicator)
    elif guest_indicator.updated_at > existing.updated_at + timedelta(minutes=2):
        # Update if guest version is significantly newer
        existing.indicator_params = guest_indicator.indicator_params
        existing.style = guest_indicator.style
        existing.updated_at = guest_indicator.updated_at
    # else: keep existing (prefer cloud, timestamps within ±2 minutes)
```

**Edge Cases**:
1. **No existing indicators**: All guest indicators inserted
2. **Existing indicators with same UUID**: Merge based on timestamp comparison
3. **Concurrent edits**: 2-minute buffer prevents race conditions
4. **Timestamps exactly 2 minutes apart**: Keep existing (deterministic)

---

## Validation Rules

### indicator_name

**Type**: Enum (string)
**Valid Values**: `['sma', 'ema', 'tdfi', 'crsi', 'adxvma', 'macd', 'rsi', 'cci']`
**Validation**: Must match registered indicator names in frontend indicator registry

### indicator_category

**Type**: Enum (string)
**Valid Values**: `['overlay', 'oscillator']`
**Validation**: Must be one of two categories

### indicator_params

**Type**: JSON (dict)
**Validation**: Parameter names and values must be valid for the specified `indicator_name`
- Example SMA: `{'length': 20}` where length > 0 and length <= 500
- Example cRSI: `{'domcycle': 20, 'smooth': 3}` where domcycle > 0 and smooth > 0

### display_name

**Type**: String
**Constraints**: Max length 255, cannot be empty
**Validation**: Frontend typically generates this from indicator_name + params (e.g., "SMA (20)")

### style

**Type**: JSON (dict)
**Validation**: Color format must be valid hex string (e.g., "#FF5733")
**Example Structure**:
```json
{
  "color": "#FF5733",
  "lineWidth": 2,
  "showLastValue": true,
  "seriesColors": {
    "upper": "#4CAF50",
    "lower": "#F44336"
  }
}
```

### is_visible

**Type**: Boolean
**Default**: `true`
**Validation**: Must be boolean value

---

## Indexes

| Name | Columns | Unique | Purpose |
|------|---------|--------|---------|
| `ix_indicator_configs_id` | `id` | No | Primary key lookup |
| `ix_indicator_configs_user_id` | `user_id` | No | Retrieve all indicators for a user |
| `ix_indicator_configs_indicator_name` | `indicator_name` | No | Filter indicators by type (future feature) |

---

## Database Constraints

### Composite Unique Constraint

**SQL**:
```sql
ALTER TABLE indicator_configs
ADD CONSTRAINT uq_indicator_config_user_uuid
UNIQUE (user_id, uuid);
```

**Purpose**: Ensures UUID is unique within each user's scope, allowing multiple users to have indicators with the same UUID.

**Behavior**:
- Allows duplicate UUIDs when `user_id = NULL` (guest users)
- Prevents duplicate UUIDs within the same user
- Enforced at database level (application-level check not sufficient)

---

## Data Migration Strategy

### LocalStorage → Database Migration

**Source**: Browser localStorage keys `indicatorinstance${id}` and `indicatorlistglobal`

**Target**: `indicator_configs` table

**Migration Script**: `frontend/src/migrations/migrateIndicatorsToCloud.ts`

**Process**:
1. Read all indicator instances from localStorage
2. Generate UUID for each indicator (if not present)
3. Upload to database via `POST /api/v1/indicator-configs`
4. Verify upload success
5. Clear localStorage (optional, for cleanup)

**Rollback**: If migration fails, indicators remain in localStorage

---

## Performance Characteristics

### Storage Size

**Per Indicator**: ~500 bytes - 1 KB
- `indicator_name`: 10 bytes average
- `indicator_params`: 100 bytes average (JSON)
- `display_name`: 20 bytes average
- `style`: 300 bytes average (JSON)
- Overhead (timestamps, uuid, indexes): ~100 bytes

**Typical User** (10 indicators): ~5-10 KB
**Heavy User** (50 indicators): ~25-50 KB
**Database Impact**: Negligible (<1 MB per 20,000 users)

### Query Performance

**Batch Retrieve**: `SELECT * FROM indicator_configs WHERE user_id = ?`
- **Expected rows**: 5-50
- **Index usage**: `ix_indicator_configs_user_id`
- **Estimated time**: <50ms (local network), <200ms (remote)

**Merge Operation**: Upsert 10 indicators
- **Estimated time**: <100ms (local network), <300ms (remote)
- **Bottleneck**: Round-trip latency, not data size

---

## Security Considerations

### Data Isolation

**Rule**: Users can only access their own indicators

**Implementation**:
- API endpoints filter by `user_id` from Firebase token
- No direct database access from frontend
- SQL injection prevented via parameterized queries (SQLAlchemy)

### Privacy

**Data Classification**: Sensitive (user's trading strategy and preferences)

**Handling**:
- No telemetry or analytics collection
- Indicators not shared across users
- Hard delete on user account deletion (GDPR compliance)

---

## Future Extensions

### Potential Features (Not in Scope)

1. **Indicator Templates**: Shareable indicator configurations
2. **Indicator Presets**: Pre-built indicator combinations
3. **Import/Export**: Download indicators as JSON file
4. **Indicator Sync Across Symbols**: Apply same indicators to multiple symbols
5. **Indicator Versioning**: Track changes to indicator configurations over time

### Schema Changes Required

- **Templates**: Add `is_template` flag, `template_name` field
- **Presets**: Add `preset_id` foreign key to new `presets` table
- **Import/Export**: No schema changes (use existing export endpoints)
- **Sync Across Symbols**: Add `symbol_id` foreign key (currently symbol-agnostic)
- **Versioning**: Add `version_history` JSONB column or separate `indicator_config_history` table
