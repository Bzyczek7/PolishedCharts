# Implementation Plan: Configurable Indicator Instances

**Branch**: `007-configurable-indicators` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-configurable-indicators/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable dynamic indicator configuration via query string parameters (e.g., `GET /api/v1/indicators/AAPL/sma?period=50`) without requiring pre-registration. Each request creates an ephemeral indicator instance with the provided parameters, validated against indicator-specific parameter definitions. Backward compatible with existing API consumers (default parameters apply when query params omitted).

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.9 (frontend)
**Primary Dependencies**: FastAPI 0.104, SQLAlchemy 2.0, pandas 2.1, React 19
**Storage**: PostgreSQL via SQLAlchemy; indicators in-memory only
**Testing**: pytest (Python), vitest (frontend)
**Target Platform**: Linux server backend, web browser frontend
**Performance Goals**: Name generation <10ms, support 100+ indicator instances
**Constraints**: No breaking changes to existing API
**Scale/Scope**: 5 indicator types (SMA, EMA, TDFI, cRSI, ADXVMA), unlimited parameter combinations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior
  - **No UI changes required** - this is an API-only enhancement
  - Frontend can use existing chart components
- [x] UI changes include before/after verification
  - **N/A** - No UI changes in this feature
- [x] Performance budgets: 60fps panning, 3s initial load
  - **No impact** - Ephemeral indicator creation adds <1ms per request

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented
  - **N/A** - This feature doesn't modify timestamp handling
  - Existing candle data layer handles UTC normalization
- [x] Deduplication strategy: database constraints or idempotent inserts
  - **N/A** - Indicator calculation is read-only, no inserts
- [x] Alert semantics: above/below/crosses defined with edge cases tested
  - **N/A** - This feature doesn't modify alert semantics
- [x] Gap handling: explicit marking and backfill strategy
  - **N/A** - Uses existing candle data service

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count
  - **N/A** - This feature doesn't involve alerts
- [x] Alert evaluation performance budgeted (500ms)
  - **N/A** - No impact on alert evaluation
- [x] Graceful degradation defined for high alert volumes
  - **N/A** - No impact on alerts

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally
  - **No changes** - Uses existing candle cache in PostgreSQL
- [x] Offline behavior: charts, alerts, history remain accessible
  - **No impact** - Indicator calculations work with cached data
- [x] Provider error handling: graceful degradation with user feedback
  - **No changes** - Uses existing orchestrator error handling

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization)
  - **Indicator parameter validation**: TDD approach required
  - Tests written for parameter parsing, validation, type conversion
- [x] Bug fixes include regression tests
  - **N/A** - No bug fixes, new feature implementation
- [x] CI includes: lint, typecheck, unit, integration tests
  - **Tests required**:
    - Unit tests for parameter validation
    - Integration tests for API endpoints
    - Backward compatibility tests

### Performance Budgets

- [x] Initial chart load: 3 seconds
  - **No impact** - Same data fetching as before
- [x] Price update latency: 2 seconds
  - **No impact** - Indicator calculation is <10ms
- [x] Alert evaluation: 500ms
  - **N/A** - No impact on alerts
- [x] UI panning: 60fps
  - **No impact** - No UI changes
- [x] Memory: 500MB for 5 symbols / 20 alerts
  - **No impact** - Ephemeral instances are garbage collected

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern
  - **Strengthens existing pattern** - Adds base name lookup
  - No changes to indicator plugin architecture
- [x] Data providers implement common interface
  - **No changes** - Uses existing YFinanceProvider
- [x] Provider-specific logic isolated from UI
  - **No changes** - All logic in backend API layer

### Security & Privacy

- [x] No telemetry or data upload without consent
  - **No changes** - All processing is local
- [x] API keys stored securely (not in repo)
  - **No changes** - Uses existing provider configuration
- [x] Local data treated as sensitive
  - **No changes** - No new data collection

### Governance

- [x] If any principle violated: justification in Complexity Tracking
  - **No violations** - Feature is additive and backward compatible
- [x] Constitution supersedes spec/plan conflicts
  - **No conflicts** - Feature aligns with all constitution principles

## Project Structure

### Documentation (this feature)

```text
specs/007-configurable-indicators/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── openapi.yaml     # API specification
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Backend changes
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── indicators.py       # Add query parameter handling
│   └── services/
│       └── indicator_registry/
│           ├── __init__.py         # No changes
│           ├── registry.py         # Add get_by_base_name() method
│           └── initialization.py   # No changes (already has standard variants)
└── tests/
    ├── api/
    │   └── test_indicators.py      # Add query param tests
    └── services/
        └── test_indicator_registry.py  # Add base name lookup tests

# Frontend changes
frontend/
└── src/
    ├── hooks/
    │   └── useIndicatorData.ts     # Update to use query params
    └── utils/
        └── chartHelpers.ts         # Update URL building helpers
```

**Structure Decision**: Web application (backend + frontend). This is an API-focused enhancement that adds query parameter support to existing indicator endpoints. Frontend changes are minimal - updating URL construction to use query strings instead of JSON params.

## Complexity Tracking

> **No violations** - This feature strengthens the existing architecture without introducing complexity.

| Aspect | Design Decision | Rationale |
|--------|----------------|-----------|
| **Indicator Lookup** | Add `get_by_base_name()` method | Cleaner than modifying existing `get()` which looks up instance names |
| **Parameter Format** | Query params instead of JSON | More RESTful, better caching, easier to use |
| **Instance Creation** | Ephemeral per-request | Simpler than caching, stateless, <1ms overhead |
| **Backward Compatibility** | Support both query and JSON params | No breaking changes for existing API consumers |

## Implementation Phases

### Phase 0: Research ✅ Complete

**Status**: All research artifacts complete
- [research.md](./research.md) - Technical decisions and alternatives
- [data-model.md](./data-model.md) - Parameter definitions and validation
- [quickstart.md](./quickstart.md) - Developer guide with examples
- [contracts/openapi.yaml](./contracts/openapi.yaml) - API specification

**Key Decisions**:
1. Query parameter format (not JSON string) for better REST semantics
2. Ephemeral indicator instances per-request (no caching)
3. Base name lookup (single registry entry per indicator type)
4. Backward compatible with existing `params` JSON string

### Phase 1: Design ✅ Complete

**Status**: All design artifacts complete
- Data model defined with parameter validation rules
- API contracts specified in OpenAPI format
- Quickstart guide with TypeScript examples
- Constitution check passed with no violations

### Phase 2: Implementation 🔄 In Progress

**Backend Tasks**:
1. Add `get_by_base_name()` method to `IndicatorRegistry`
2. Update `get_indicator()` endpoint to parse query parameters
3. Implement parameter name normalization (camelCase → snake_case)
4. Add enhanced validation with descriptive error messages
5. Maintain backward compatibility with `params` JSON string

**Frontend Tasks**:
1. Update `useIndicatorData` hook to use query parameters
2. Update `chartHelpers.ts` URL building functions
3. Add TypeScript interfaces for query parameters

**Testing Tasks**:
1. Unit tests for parameter parsing and validation
2. Integration tests for API endpoints with query params
3. Backward compatibility tests (no params = defaults)
4. Performance tests (100+ concurrent requests)

### Phase 3: Deployment

**Prerequisites**:
- All tests passing
- API verified with manual testing
- Frontend auto-discovery confirmed
- Backward compatibility verified

**Acceptance Criteria**:
- [ ] SC-001: Custom params without pre-registration
- [ ] SC-002: Request processing <100ms
- [ ] SC-003: 100% backward compatibility
- [ ] SC-004: Invalid params rejected with clear errors
- [ ] SC-005: 100+ concurrent requests handled

## Success Criteria Mapping

| Criterion | Verification | Status |
|-----------|--------------|--------|
| SC-001: Custom params without pre-registration | API accepts any valid parameter values | ⏳ Implementation |
| SC-002: Request processing <100ms | Performance benchmark test | ⏳ Pending |
| SC-003: 100% backward compatibility | Integration tests with existing endpoints | ⏳ Implementation |
| SC-004: Invalid params rejected with clear errors | API tests for validation error responses | ⏳ Implementation |
| SC-005: 100+ concurrent requests handled | Load test with concurrent API calls | ⏳ Pending |

## References

- [Feature Specification](./spec.md)
- [Research Findings](./research.md)
- [Data Model](./data-model.md)
- [Quickstart Guide](./quickstart.md)
- [API Contract](./contracts/openapi.yaml)
- [Constitution](../../.specify/memory/constitution.md)
