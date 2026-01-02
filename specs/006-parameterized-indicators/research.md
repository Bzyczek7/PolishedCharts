# Research: Parameterized Indicator Instances

**Feature**: 006-parameterized-indicators
**Date**: 2025-12-25

## Overview

This research document summarizes the technical decisions for implementing parameterized indicator instances, allowing multiple instances of the same indicator type with different parameter values.

## Decision 1: Indicator Instance Naming Strategy

**Decision**: Use base name + parameter suffix for unique names.

**Pattern**: `{base_name}` for default parameters, `{base_name}_{param_value}` for custom parameters.

Examples:
- `SMAIndicator()` → name = "sma"
- `SMAIndicator(50)` → name = "sma_50"
- `EMAIndicator(9)` → name = "ema_9"

**Rationale**:
- Intuitive for users (common trading convention)
- Preserves backward compatibility (default instance gets base name)
- No ambiguity in indicator identification
- Simple to implement and maintain

**Alternatives Considered**:
- **UUID-based naming**: More unique but less user-friendly
- **Fully qualified names** (e.g., "sma_period_50"): Too verbose for common cases
- **Separate display name**: Adds complexity without clear benefit

## Decision 2: Parameter Storage in Indicator Instances

**Decision**: Store instance-specific parameters in `__init__` method as instance variables.

**Rationale**:
- Each instance has its own parameter values
- Parameters are accessible in the `calculate()` method via instance state
- Clean separation between default values and instance overrides
- Thread-safe (each instance is independent)

**Alternatives Considered**:
- **Class-level defaults**: Doesn't support multiple instances with different parameters
- **Global parameter registry**: Adds unnecessary complexity
- **Dynamic parameter binding**: Too complex, harder to debug

## Decision 3: Name Generation Priority

**Decision**: When generating names, prioritize specific parameter names in order: `period`, `length`, `lookback`, `window`.

**Rationale**:
- Most indicators use one of these as their primary "length" parameter
- Prevents verbose names like "sma_period_50" when "sma_50" suffices
- For multi-parameter indicators, fall back to concatenating all distinguishing values
- Consistent with trading platform conventions

**Alternatives Considered**:
- **Always use full parameter names**: Too verbose (e.g., "sma_period_50_length_20")
- **Use first parameter alphabetically**: Unpredictable behavior
- **Require explicit naming**: Increases user burden

## Decision 4: Backward Compatibility Strategy

**Decision**: Default parameter instances use the base name without suffix.

**Rationale**:
- Existing API endpoints like `/indicators/AAPL/sma` continue to work
- Existing alert configurations referencing "sma" remain valid
- Zero breaking changes to external contracts
- New variants are purely additive

**Alternatives Considered**:
- **Versioned names (e.g., "sma_v2")**: Breaking change, confusing
- **Migration script**: Unnecessary complexity
- **Separate namespace**: Adds complexity without benefit

## Decision 5: Registration Location

**Decision**: Create a dedicated `initialization.py` module that registers standard variants at startup.

**Rationale**:
- Centralizes indicator registration logic
- Easy to add/remove variants
- Clear separation between indicator definitions and registration
- Can be extended to support user-defined variants

**Alternatives Considered**:
- **Register in `__init__.py`**: Clutters the module, harder to maintain
- **Dynamic registration on demand**: Inconsistent behavior, harder to cache
- **Configuration file**: Adds parsing complexity, harder to maintain

## Decision 6: Frontend Impact

**Decision**: No frontend code changes required for basic functionality.

**Rationale**:
- Frontend already queries `/api/v1/indicators/supported` endpoint
- New variants auto-discover through existing API
- Indicator selection UI already supports dynamic indicator lists
- Optional: Group variants by base indicator for better UX (cosmetic)

**Alternatives Considered**:
- **Hardcode variant names**: Defeats auto-discovery, maintenance burden
- **Separate API endpoint**: Unnecessary complexity
- **Client-side variant generation**: Risk of desync with backend

## Decision 7: Testing Strategy

**Decision**: Test at three levels: (1) unit tests for name generation, (2) integration tests for API endpoints, (3) backward compatibility tests.

**Rationale**:
- Unit tests verify naming logic correctness
- Integration tests verify API behavior with variants
- Backward compatibility tests ensure existing functionality isn't broken
- TDD approach prevents regressions

**Alternatives Considered**:
- **Manual testing only**: Insufficient for core functionality
- **End-to-end UI testing**: Overkill for this feature
- **Skip testing**: Violates constitution principles

## Technical Constraints

1. **Name collision handling**: If two instances have identical parameters, the second registration overwrites the first. This is acceptable for MVP.
2. **Parameter serialization**: For this phase, parameters are stored in-memory only. Persistence is handled by the existing configuration system.
3. **Performance**: Name generation must be sub-10ms per registration. Current implementation is O(1) string operations.

## Open Questions (Resolved)

### Q1: How to handle indicators with multiple distinguishing parameters?

**Resolution**: For indicators with 2+ parameters that distinguish instances (e.g., cRSI), concatenate all values: `crsi_20_14_11.0_40`. This is rare in practice but supported.

### Q2: What if someone registers SMA(20) after SMA()?

**Resolution**: SMA() → "sma", SMA(20) → "sma_20". No conflict because names differ. The registry uses the instance's `name` property as the key.

### Q3: Should we allow duplicate registrations with identical parameters?

**Resolution**: For MVP, allow overwrites. The last registration wins. This matches the current behavior and is acceptable for the standard variants use case.

## Dependencies

- **Existing Indicator base class**: Requires modification to add `__init__` and `base_name` property
- **IndicatorRegistry**: No changes required (works with any Indicator instance)
- **API endpoints**: No changes required (already dynamic)
- **Frontend**: No changes required (already auto-discovers indicators)

## Migration Path

1. Update base Indicator class
2. Update each indicator class (SMA, EMA, TDFI, cRSI, ADXVMA)
3. Create initialization.py with standard variants
4. Update app startup to call initialization
5. Run tests to verify backward compatibility

Zero downtime, zero breaking changes.
