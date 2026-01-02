# Research: Configurable Indicator Instances

**Feature**: 007-configurable-indicators
**Date**: 2025-12-25
**Status**: Complete

## Overview

This document summarizes research findings for implementing dynamic indicator configuration via query string parameters. The goal is to allow users to request any indicator with custom parameters (e.g., `GET /api/v1/indicators/AAPL/sma?period=50`) without pre-registering variants.

## Existing Codebase Analysis

### Current Implementation

**Indicator Registry** (`backend/app/services/indicator_registry/registry.py`):
- Plugin-based architecture with `Indicator` base class
- Each indicator (SMA, EMA, TDFI, cRSI, ADXVMA) extends `Indicator`
- `parameter_definitions` property provides type, range, and default validation
- `validate_params()` method validates parameters against definitions
- `IndicatorRegistry` manages indicator instances by name

**API Endpoints** (`backend/app/api/v1/indicators.py`):
- `GET /api/v1/indicators/supported` - Lists all indicators with metadata
- `GET /api/v1/indicators/{symbol}/{indicator_name}` - Calculates indicator data
- Currently accepts `params` as JSON string: `?params={"period": 50}`
- Validates parameters using `parameter_definitions`

### Current Parameter Flow

```
User Request → API Endpoint → Parse JSON params → Validate → Calculate → Return
```

### Key Insight

The existing code already has:
1. Parameter definitions with validation
2. Dynamic calculation via `**kwargs`
3. Registry pattern for indicator management

**Only change needed**: Accept individual query parameters instead of/in addition to JSON string.

## Technical Decisions

### 1. Query Parameter Format

**Decision**: Accept individual query parameters (e.g., `?period=50&lookback=13`)

**Rationale**:
- More intuitive for users
- Enables HTTP caching
- Aligns with REST conventions
- FastAPI has built-in support

**Alternatives Considered**:
| Option | Pros | Cons | Decision |
|--------|------|-------|----------|
| Query params | Simple, cacheable | Verbose for multi-param | ✅ Selected |
| JSON string | Compact | Harder to use, not cacheable | Keep for backward compat |
| POST body | Unlimited params | Breaks REST semantics for GET | ❌ Rejected |

### 2. Indicator Lookup Strategy

**Decision**: Look up by base name (sma, ema, etc.) instead of instance name (sma_50)

**Rationale**:
- Single registry entry per indicator type
- Unlimited parameter combinations
- Stateless - each request independent
- Simpler architecture

**Implementation**:
- Add `get_by_base_name()` method to `IndicatorRegistry`
- Lookup indicator by `base_name` property
- Pass query parameters to `calculate()` method

### 3. Backward Compatibility

**Decision**: Maintain support for existing `params` JSON string

**Approach**:
1. Check for individual query parameters first
2. Fall back to `params` JSON string if no query params
3. Merge both if both present (query params take precedence)

**Example**:
```python
# Query params: ?period=50
# JSON params: ?params={"lookback": 13}
# Result: {"period": 50, "lookback": 13}
```

### 4. Parameter Validation Timing

**Decision**: Validate in API layer before calculation

**Rationale**:
- Fast fail before expensive data fetching
- Clear error messages
- Consistent with existing validation pattern

**Flow**:
```
Request → Parse Query Params → Validate Against Definitions → Fetch Data → Calculate → Return
```

## Implementation Approach

### Backend Changes

**1. IndicatorRegistry** (`registry.py`):
```python
def get_by_base_name(self, base_name: str) -> Optional[Indicator]:
    """Get indicator by base name (case-insensitive)."""
    base_name_lower = base_name.lower()
    for indicator in self._indicators.values():
        if indicator.base_name.lower() == base_name_lower:
            return indicator
    return None
```

**2. API Endpoint** (`indicators.py`):
```python
@router.get("/{symbol}/{indicator_name}")
async def get_indicator(
    symbol: str,
    indicator_name: str,
    period: Optional[int] = Query(None, description="Indicator period"),
    lookback: Optional[int] = Query(None, description="Lookback period"),
    dom_cycle: Optional[int] = Query(None, description="cRSI dominant cycle"),
    vibration: Optional[int] = Query(None, description="cRSI vibration"),
    leveling: Optional[float] = Query(None, description="cRSI leveling"),
    cyclic_memory: Optional[int] = Query(None, description="cRSI cyclic memory"),
    adxvma_period: Optional[int] = Query(None, description="ADXVMA period"),
    # ... existing params
):
    # Build params dict from query params
    params = {}
    for param_name in VALID_PARAM_NAMES:
        value = locals().get(param_name)
        if value is not None:
            params[param_name] = value

    # Merge with JSON params if present
    # ... existing code
```

**3. Schema Updates** (`indicator.py`):
- Add `IndicatorParameterResponse` for parameter definitions in `/supported` endpoint

### Frontend Changes

**1. Hook Updates** (`useIndicatorData.ts`):
```typescript
const fetchIndicator = async (
  symbol: string,
  indicatorName: string,
  params?: Record<string, number | string>
) => {
  const queryString = params
    ? '?' + new URLSearchParams(params as any).toString()
    : '';
  const response = await fetch(
    `/api/v1/indicators/${symbol}/${indicatorName}${queryString}`
  );
  // ...
};
```

**2. Chart Helpers** (`chartHelpers.ts`):
- Build query strings from indicator parameter objects

## Testing Strategy

### Unit Tests

**Parameter Processing**:
- `test_query_params_parsed_correctly()`
- `test_query_params_override_json_params()`
- `test_invalid_parameter_rejected()`

**Validation**:
- `test_parameter_bounds_enforced()`
- `test_parameter_type_validation()`

### Integration Tests

**API Endpoints**:
- `test_sma_with_period_50()`
- `test_ema_with_period_9()`
- `test_crsi_with_multiple_params()`
- `test_backward_compatibility_json_params()`

### Performance Tests

- `test_request_processing_under_100ms()`
- `test_concurrent_requests_100_plus()`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change | High | Maintain `params` JSON string support |
| Parameter name collisions | Medium | Document reserved parameter names |
| URL length limits | Low | Document max params, warn users |
| Type coercion issues | Medium | Explicit type conversion in validation |

## Frontend Configuration Analysis

**Current Architecture** (from codebase investigation):

1. **Indicator Selection** (`Toolbar.tsx` → `useIndicators.ts`):
   - User selects indicators from a dropdown/list
   - Selection stores `IndicatorType` object with `{ name, params }`
   - Default params are empty `{}` for base indicators

2. **Parameter Storage** (`useIndicators.ts:231-248`):
   - `updateIndicatorParams()` function updates params via `IndicatorType.params`
   - Changes persist to localStorage per symbol
   - No UI controls currently exist for parameter editing

3. **API Calls** (`useIndicatorData.ts:249-254`):
   - `getIndicator(symbol, indicatorType.name, interval, indicatorType.params)`
   - Currently passes params as an object to the API client
   - API client (`indicators.ts`) converts to `params` JSON string

4. **Indicator Display Name** (`indicatorLabel.ts`):
   - `formatTvIndicatorLabel(name, params)` generates labels like "SMA(50)"
   - Called when indicators are added to display list

**Implication for Feature 007**:
- Frontend already passes params via `indicatorType.params` object
- Backend API client needs to convert params object to query string
- No UI changes required unless we add parameter editing controls

## Parameter Naming Convention

**Decision**: Use `snake_case` for all query parameter names.

**Rationale**:
- Consistent with existing Python backend code
- Matches `parameter_definitions` keys in indicator classes
- Standard convention for REST APIs

**Parameter Names**:
| Indicator | Parameter | Type | Range |
|-----------|-----------|------|-------|
| SMA, EMA | `period` | integer | 1-500 |
| TDFI | `lookback` | integer | 1-100 |
| TDFI | `filter_high` | float | -1.0 to 1.0 |
| TDFI | `filter_low` | float | -1.0 to 1.0 |
| cRSI | `dom_cycle` | integer | 1-50 |
| cRSI | `vibration` | integer | 1-50 |
| cRSI | `leveling` | float | 1.0-50.0 |
| cRSI | `cyclic_memory` | integer | 1-100 |
| ADXVMA | `adxvma_period` | integer | 1-100 |

**Case Sensitivity**: Query parameter names are case-sensitive. Use exact `snake_case` spelling.

**Examples**:
```
✅ Correct: ?period=50&lookback=13
❌ Incorrect: ?Period=50&Lookback=13
❌ Incorrect: ?period=50&lookBack=13
```

## Resolved Questions

1. **Q**: Should we pre-register indicator variants?
   **A**: No - use base name lookup with dynamic parameters

2. **Q**: How to handle conflicting parameters?
   **A**: Query params take precedence over JSON params (see test case below)

3. **Q**: What about complex parameter types?
   **A**: Out of scope - only simple types (int, float, bool, string)

4. **Q**: Do we need an initialization module?
   **A**: No - indicators are already registered as singletons

5. **Q**: What parameter naming convention?
   **A**: `snake_case` (period, lookback, dom_cycle, etc.) - case-sensitive

## Backward Compatibility Test Case

**Edge Case**: Query params and JSON params both provided

```python
# Test: Query params override JSON params
GET /api/v1/indicators/AAPL/sma?period=50&params={"period":30}

# Expected behavior:
# 1. Parse query params: {"period": 50}
# 2. Parse JSON params: {"period": 30}
# 3. Merge with query params taking precedence
# 4. Final params: {"period": 50}
# 5. Response includes: "parameters": {"period": 50}
```

**Test Implementation** (pytest):
```python
def test_query_params_override_json_params(client):
    """Query parameters should take precedence over JSON params."""
    response = client.get(
        "/api/v1/indicators/AAPL/sma",
        params={"period": 50, "params": '{"period": 30}'}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parameters"]["period"] == 50  # Query param wins
```

## Next Steps

1. Create `data-model.md` with parameter schemas
2. Create `contracts/openapi.yaml` with updated API spec
3. Create `quickstart.md` for developers
4. Use `/speckit.tasks` to generate implementation tasks

## References

- Existing code: `backend/app/services/indicator_registry/registry.py`
- Existing API: `backend/app/api/v1/indicators.py`
- Feature spec: `specs/007-configurable-indicators/spec.md`
