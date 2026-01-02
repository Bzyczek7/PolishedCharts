# Research: Indicator-based Alerts (cRSI only)

**Feature**: 001-indicator-alerts
**Date**: 2025-12-26
**Status**: Complete

## Overview

This document captures research findings and technical decisions for implementing TradingView-style indicator-based alerts for the cRSI indicator.

---

## Decision 1: Alert Message Storage Pattern

### Question

Where to store direction-specific messages (Alert vs AlertTrigger vs separate table)?

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: String columns on Alert | Store `message_upper` and `message_lower` as separate string columns on Alert model | Simple query, one source of truth, messages editable | Requires schema change to add more message types |
| B: Separate AlertMessage table | One-to-many relationship for messages | Extensible to future message types, normalized schema | Extra join required, more complex |
| C: Computed at evaluation | Store template, resolve message at trigger time | Flexible, supports dynamic messages | Evaluation complexity, harder to audit |

### Decision: **Option A - Two string columns on Alert model + JSONB enabled_conditions**

**Rationale**:
1. **Simplicity**: For cRSI-only MVP, two string columns (`message_upper`, `message_lower`) plus a JSONB `enabled_conditions` column are sufficient
2. **User expectations**: Messages should be editable per-alert (like TradingView), not global templates
3. **Auditable**: Storing messages with Alert makes it clear what message each alert will produce
4. **Extensible**: JSONB `enabled_conditions` field can grow to support more condition types in future
5. **Performance**: No extra joins required during evaluation

**Implementation**:
```python
# Alert model extensions
message_upper: String = "It's time to sell!"
message_lower: String = "It's time to buy!"
enabled_conditions: JSONB = {"upper": True, "lower": True}
```

**Future extensibility**: When adding more indicators, can extend `enabled_conditions` to support other condition types (e.g., `{"tdfi_turns_positive": True}`).

### Alternative Rejected Because

- **Option B (separate table)**: Over-engineering for cRSI-only scope. Extra complexity not justified yet.
- **Option C (computed)**: Makes it harder to show users what message their alert will produce. Auditing becomes difficult (what message was used at trigger time?).

---

## Decision 2: Frontend-Backend Alert Sync Strategy

### Question

Current implementation has frontend localStorage alerts disconnected from backend API alerts. What sync strategy should we use?

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: Pure backend | All alerts stored in PostgreSQL, frontend is read-through | Single source of truth, syncs across devices | Requires backend for all operations |
| B: Pure frontend | All alerts in localStorage, backend only evaluates | Works offline, simple | No cross-device sync, backend can't evaluate without frontend data |
| C: Hybrid with sync queue | Frontend creates in localStorage, queues sync to backend | Offline-first, cross-device sync | Complex conflict resolution, duplicate alerts possible |

### Decision: **Option A - Pure backend with frontend caching**

**Rationale**:
1. **Alert evaluation requires backend**: The backend `AlertEngine` evaluates alerts on price updates. It needs alerts in the database to evaluate them.
2. **Local-first doesn't mean local-only**: Alerts can still be **viewed** offline (from cache), but creation requires backend connection for evaluation to work.
3. **Simpler architecture**: Avoids sync conflicts, duplicate detection, and eventual consistency issues.
4. **Cross-device benefit**: Users can access alerts from multiple devices (future feature).

**Implementation**:
- Frontend treats backend API as source of truth
- Frontend caches alerts in localStorage for offline viewing (not creation)
- When backend unavailable, show "Backend unavailable - alerts in read-only mode"
- Alert creation requires backend connection; queue creation requests if offline (future enhancement)

**User Experience**:
```typescript
// Alert creation flow
async function createAlert(alertData: AlertCreate) {
  try {
    const response = await fetch('/api/v1/alerts/', { method: 'POST', body: JSON.stringify(alertData) });
    return await response.json();
  } catch (error) {
    if (error.name === 'NetworkError') {
      // Show: "Alert creation requires internet connection. Request queued for sync."
      // Queue alert in localStorage for later sync (future feature)
      queueAlertForSync(alertData);
    }
  }
}
```

### Alternative Rejected Because

- **Option B (pure frontend)**: Backend can't evaluate alerts it doesn't know about. Defeats the purpose of server-side alert evaluation.
- **Option C (hybrid with sync queue)**: Adds significant complexity for MVP. Sync conflicts, duplicate detection, and eventual consistency are non-trivial problems. Can be added later if offline creation is a hard requirement.

---

## Decision 3: Context Menu Alert Action Pattern

### Question

How to associate alerts with specific indicator instances?

### Context

When a user has multiple cRSI indicators on a chart with different parameters (e.g., cRSI(20) and cRSI(14)), which one does the "Add alert..." action create an alert for?

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: Indicator instance ID | Track each indicator instance by unique ID | Precise association, supports multiple instances | Complex instance tracking |
| B: Symbol + type + params | Match by symbol, indicator name, and parameters | Simpler, works without instance IDs | Ambiguous if duplicate params |
| C: Type only | Ignore params, associate all cRSI alerts with any cRSI instance | Simplest | Confusing if multiple cRSI instances |

### Decision: **Option B - Symbol + indicator type + parameters**

**Rationale**:
1. **Current infrastructure**: Frontend already tracks indicators by `(symbol, type, params)` tuple in `IndicatorContext`
2. **User expectation**: Alert created from cRSI(20) should use the same parameters (period: 20)
3. **No instance ID needed**: We don't need to track which specific pane the alert came from
4. **Extensible**: Pattern works for any indicator with configurable parameters

**Implementation**:
```typescript
// Context menu action payload
interface AlertFromIndicatorAction {
  symbol: string
  indicator_name: 'crsi' | 'tdfi' | 'vtx' | ...
  indicator_params: Record<string, number | string>
  // These are stored with the Alert, so evaluation knows which indicator values to use
}
```

**Backend evaluation**:
```python
# When evaluating cRSI alert, fetch indicator values using the stored params
indicator_values = get_indicator_values(
    alert.symbol,
    alert.indicator_name,
    alert.indicator_params  # e.g., {'domcycle': 20, 'vibration': 14}
)
```

### TradingView Parity

TradingView associates alerts with the specific indicator series (by ID). Our approach is functionally equivalent but uses parameters instead of instance IDs.

### Alternative Rejected Because

- **Option A (instance ID)**: Requires significant refactoring to add unique IDs to all indicator instances. Over-engineering for MVP.
- **Option C (type only)**: Would be confusing when user has multiple cRSI instances with different parameters. Alert might use wrong parameter values.

---

## Decision 4: Log Tab Performance Strategy

### Question

How to display potentially thousands of trigger events without performance issues?

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: Pagination | Show 50 triggers per page with next/prev | Proven pattern, efficient | Breaks chronological flow |
| B: Infinite scroll | Load more as user scrolls | Smooth UX, mobile-friendly | State complexity, scroll jank |
| C: Virtualization | Render only visible items | Best performance, 100k+ items | More complex implementation |
| D: Limit + pruning | Show only recent 500, prune older ones | Simple, guaranteed performance | Loses historical data |

### Decision: **Option A (Pagination) with Option D (limit) as initial implementation**

**Rationale**:
1. **MVP simplicity**: Start with a simple limit (most recent 500 triggers)
2. **Proven pattern**: Pagination is well-understood and easy to implement
3. **Performance guarantee**: 500 entries is trivial to render (~50KB JSON)
4. **User expectation**: Most users care about recent triggers, not ancient history
5. **Future enhancement**: Can add pagination or virtualization if users request more history

**Implementation**:
```typescript
// Initial implementation: simple limit
const TRIGGER_LOG_LIMIT = 500;

async function loadTriggerLog(symbol?: string): Promise<TriggerEvent[]> {
  const response = await fetch(`/api/v1/alerts/triggers/recent?limit=${TRIGGER_LOG_LIMIT}`);
  return await response.json();
}

// Future: Add pagination
// async function loadTriggerLog(symbol?: string, page: number, pageSize: number)
```

**Backend endpoint**:
```python
@router.get("/alerts/triggers/recent")
async def get_recent_triggers(
    symbol_id: Optional[int] = None,
    limit: int = 500,
    max_limit: int = 1000  # Cap to prevent abuse
):
    """Return recent trigger events across all alerts, newest first."""
    triggers = await fetch_triggers(symbol_id, limit=limit)
    return triggers
```

### Performance Benchmark

Assuming 500 trigger events:
- Each trigger: ~200 bytes JSON (timestamp, symbol, alert_name, message, price, value)
- Total: ~100KB JSON
- Parse time: <10ms
- Render time: <50ms (vanilla React)
- **Well within performance budget**

### Alternative Rejected Because

- **Option B (infinite scroll)**: Adds state complexity (loading state, scroll handlers, fetching triggers). Not worth it for MVP.
- **Option C (virtualization)**: Over-engineering for 500 entries. Consider if user feedback shows need for >5000 entries.

---

## Decision 5: Multi-Trigger Per Evaluation Behavior

### Question

When cRSI crosses both upper and lower bands within a single candle update (extreme volatility), should we create one or two AlertTrigger records?

### Edge Case Scenario

```
Candle N-1:  cRSI = 50,  upper_band = 70,  lower_band = 30
Candle N:    cRSI = 80,  upper_band = 70,  lower_band = 30

Result: cRSI crossed from 50 to 80
- Crossed upper band? YES (50 < 70, 80 >= 70)
- Crossed lower band? NO (stayed above lower band)
```

```
Extreme case:
Candle N-1:  cRSI = 50,  upper_band = 70,  lower_band = 30
Candle N:    cRSI = 25,  upper_band = 70,  lower_band = 30

Result: cRSI crossed from 50 to 25
- Crossed upper band? NO (stayed below upper band)
- Crossed lower band? YES (50 >= 30, 25 < 30)
```

```
Theoretical extreme (gapped data):
Candle N-1:  cRSI = 80,  upper_band = 70,  lower_band = 30
Candle N:    cRSI = 25,  upper_band = 70,  lower_band = 30

Result: cRSI gapped from 80 to 25 (massive drop)
- Crossed upper band? Hard to say (was above, now below)
- Crossed lower band? YES (80 >= 30, 25 < 30)
```

### Decision: **Create separate AlertTrigger for each condition that triggers**

**Rationale**:
1. **Correctness**: Each band cross is a distinct signal. Both should be recorded.
2. **User expectation**: If both conditions are enabled, users expect both triggers.
3. **Append-only design**: Our spec says "append each trigger event... no overwrites"
4. **TradingView parity**: TradingView creates separate alert events for each condition.

**Implementation**:
```python
# AlertEngine evaluation for cRSI band-cross
def evaluate_crsi_band_cross(alert, current_value, previous_value, upper_band, lower_band):
    triggers = []

    # Check lower band cross
    if alert.enabled_conditions.get('lower', False):
        if previous_value >= lower_band and current_value < lower_band:
            triggers.append(AlertTrigger(
                alert_id=alert.id,
                trigger_message=alert.message_lower,
                indicator_value=current_value,
                triggered_at=datetime.now(timezone.utc)
            ))

    # Check upper band cross (can trigger same alert if gap crosses both)
    if alert.enabled_conditions.get('upper', False):
        if previous_value <= upper_band and current_value > upper_band:
            triggers.append(AlertTrigger(
                alert_id=alert.id,
                trigger_message=alert.message_upper,
                indicator_value=current_value,
                triggered_at=datetime.now(timezone.utc)
            ))

    return triggers  # May contain 0, 1, or 2 triggers
```

**Cooldown handling**: Apply cooldown to the **alert**, not per trigger. If alert triggered for lower band, cooldown prevents both upper and lower triggers until cooldown expires.

```python
# Cooldown check (applies once per alert, not per condition)
if alert.is_on_cooldown():
    return []  # No triggers, regardless of conditions
```

### Alternative Rejected Because

- **Single trigger with compound message**: Loses information about which direction triggered. Makes historical analysis harder.
- **Prefer one condition over other**: Arbitrary prioritization. Why prefer upper over lower? Both are valid signals.

---

## Additional Research Findings

### cRSI Band Cross Semantics

Based on existing `alert_engine.py` implementation (lines 138-153), cRSI band-cross uses these semantics:

```python
# Current (legacy) implementation
upper_cross = prev_value <= upper_band and current_value > upper_band
lower_cross = prev_value >= lower_band and current_value < lower_band
```

**Observation**: This is **asymmetric** - upper uses `>` while lower uses `<`. This means:
- Crossing **exactly** onto the band triggers upper: `prev=60, curr=70, upper=70` → triggers upper
- Crossing **exactly** onto the band does NOT trigger lower: `prev=40, curr=30, lower=30` → does NOT trigger lower

**Decision**: Keep existing semantics for consistency. Fixing asymmetry is out of scope for this feature (can be addressed in a separate bug fix).

### AlertTrigger Storage

Current `AlertTrigger` model already has:
- `triggered_at: DateTime(timezone=True)` ✓
- `observed_price: Float` ✓
- `indicator_value: Float` ✓

**Missing**: `trigger_message: String` field (to be added)

### Context Menu Pattern

Current `IndicatorContextMenu` component supports:
- Hover-triggered with 200ms delay
- Sticky hover behavior
- Viewport-aware positioning
- Actions: 'hide', 'settings', 'source', 'remove'

**Extension needed**: Add 'alert' action type

```typescript
export type IndicatorAction = 'hide' | 'settings' | 'source' | 'remove' | 'alert'
```

---

## Summary of Decisions

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Message storage | Columns on Alert model | Simple, editable, auditable |
| Sync strategy | Pure backend with cache | Evaluation requires backend, simpler architecture |
| Indicator association | Symbol + type + params | Works with existing infrastructure |
| Log performance | Limit 500, paginate later | Simple, performant for MVP |
| Multi-trigger | Separate triggers per condition | Correctness, TradingView parity |

---

## Future Considerations

1. **Offline alert creation**: If user feedback shows strong demand, implement sync queue pattern (Decision 2, Option C)
2. **Virtualized log**: If triggers exceed 5000 entries, implement react-window or react-virtualized
3. **Indicator instance IDs**: If we add indicator-specific settings (colors, line styles), may need unique instance IDs
4. **Symmetric band-cross semantics**: Fix upper/lower asymmetry in a separate bug fix
5. **Per-trigger cooldown**: If users want independent cooldowns for upper/lower conditions, extend cooldown logic
