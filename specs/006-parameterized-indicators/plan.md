# Implementation Plan: Parameterized Indicator Instances

**Branch**: `006-parameterized-indicators` | **Date**: 2025-12-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-parameterized-indicators/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement parameterized indicator instances to allow multiple instances of the same indicator type with different parameter values. Each instance receives a unique auto-generated name (e.g., `sma` for default SMA(20), `sma_50` for SMA(50), `sma_200` for SMA(200)). This eliminates the problem of indicator name collisions when registering the same indicator type multiple times, enabling traders to compare multiple indicator configurations simultaneously.

**Technical Approach**: Modify the base `Indicator` class to accept constructor parameters and generate unique names based on those parameters. Create an initialization module to register standard indicator variants at startup. Zero breaking changes - default instances retain their base names for backward compatibility.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**: FastAPI 0.104+, SQLAlchemy 2.0+, pandas 2.1+, React 19
**Storage**: PostgreSQL (via SQLAlchemy with asyncpg driver) for candles, alerts, alert triggers. Indicator instances are in-memory only.
**Testing**: pytest (Python), vitest (frontend)
**Target Platform**: Linux server (backend), web browser (frontend)
**Project Type**: web - backend/frontend architecture
**Performance Goals**: Name generation <10ms per registration, support 100+ indicator instances without degradation
**Constraints**: No breaking changes to existing API contracts or indicator names
**Scale/Scope**: 5 standard indicators, 20+ variants total, extensible to user-defined variants

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] N/A - This feature is backend-only; no chart interaction changes
- [ ] N/A - No UI changes
- [ ] N/A - No performance impact on chart rendering

### Correctness Over Cleverness

- [x] N/A - No timestamp handling changes
- [x] N/A - No deduplication changes
- [x] N/A - No alert semantic changes
- [x] N/A - No gap handling changes

### Unlimited Alerts Philosophy

- [x] N/A - No alert count changes
- [x] N/A - No alert evaluation changes
- [x] N/A - No degradation changes

### Local-First and Offline-Tolerant

- [x] N/A - No caching changes
- [x] N/A - No offline behavior changes
- [x] N/A - No provider error handling changes

### Testing and Quality Gates

- [x] **Core logic uses TDD** - Indicator naming logic will be test-driven
- [x] **Tests included** - Unit tests for name generation, integration tests for API
- [x] **CI will pass** - All new tests included in CI pipeline

### Performance Budgets

- [x] N/A - No chart load changes
- [x] N/A - No price update changes
- [x] N/A - No alert evaluation changes
- [x] N/A - No UI panning changes
- [x] N/A - No memory changes (indicator instances are lightweight)

### Architecture for Extensibility

- [x] **Indicators use plugin registry pattern** - This enhancement strengthens the existing pattern
- [x] N/A - No data provider changes
- [x] N/A - No provider-specific logic changes

### Security & Privacy

- [x] N/A - No telemetry changes
- [x] N/A - No API key changes
- [x] N/A - No local data changes

### Governance

- [x] No constitution violations - This feature aligns with Architecture for Extensibility principle

## Project Structure

### Documentation (this feature)

```text
specs/006-parameterized-indicators/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - technical decisions
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - implementation guide
├── contracts/           # Phase 1 output - API contracts
│   └── api.yaml         # OpenAPI specification
├── checklists/          # Validation checklists
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── services/
│   │   └── indicator_registry/
│   │       ├── __init__.py          # Remove inline registrations
│   │       ├── registry.py           # Add __init__ to Indicator, update all classes
│   │       └── initialization.py     # NEW - register standard variants
│   └── main.py                       # Add initialize_standard_indicators() call
└── tests/
    └── services/
        └── test_indicator_registry.py  # Add tests for parameterized instances

frontend/
├── src/
│   └── (no changes required - auto-discovers indicators)
└── (existing tests continue to work)
```

**Structure Decision**: Web application with backend/frontend separation. Backend contains indicator registry and calculation logic. Frontend auto-discovers indicators via API. This is a backend-only feature with zero frontend code changes required.

## Complexity Tracking

> No constitution violations - nothing to track

## Implementation Phases

### Phase 0: Research (Complete)

**Output**: [`research.md`](research.md)

**Decisions Made**:
1. Use base name + parameter suffix for unique naming
2. Store instance parameters in `__init__` method
3. Prioritize `period`, `length`, `lookback`, `window` for name generation
4. Default instances use base name for backward compatibility
5. Create dedicated `initialization.py` for standard variants
6. No frontend changes required (auto-discovery)
7. Three-level testing: unit, integration, backward compatibility

### Phase 1: Design (Complete)

**Outputs**:
- [`data-model.md`](data-model.md) - Entity definitions and relationships
- [`contracts/api.yaml`](contracts/api.yaml) - OpenAPI specification
- [`quickstart.md`](quickstart.md) - Implementation guide

**Design Artifacts**:
- Indicator Instance entity with computed `name` property
- Parameter Configuration entity for storing instance-specific values
- API contracts showing existing endpoints work with variants
- Quickstart with step-by-step implementation instructions

### Phase 2: Implementation (Pending)

**Prerequisite**: Run `/speckit.tasks` to generate task list

**High-Level Steps**:

1. **Update Base Indicator Class**
   - Add `__init__(**default_params)` to store instance parameters
   - Add abstract `base_name` property
   - Make `name` a computed property using base_name + parameters

2. **Update Indicator Classes**
   - For each indicator (SMA, EMA, TDFI, cRSI, ADXVMA):
     - Rename `name` property → `base_name`
     - Add `__init__()` with typed parameters
     - Store parameters as instance variables
     - Update `description` to include parameter values

3. **Create Initialization Module**
   - New file: `app/services/indicator_registry/initialization.py`
   - Define `initialize_standard_indicators()` function
   - Register all standard variants (SMA: 5, 10, 20, 50, 200; EMA: 9, 12, 20, 26, 50, 200)

4. **Update App Startup**
   - Import `initialize_standard_indicators`
   - Call in `startup_event()` before other initialization

5. **Update Module Import**
   - Remove inline registrations from `__init__.py`

6. **Write Tests**
   - Unit tests for name generation
   - Integration tests for API endpoints
   - Backward compatibility tests

7. **Verify**
   - Run all tests
   - Test API endpoints manually
   - Verify frontend auto-discovers variants

**Estimated Time**: 6 hours total

## Dependencies

### Internal Dependencies

- `backend/app/services/indicator_registry/registry.py` - Base indicator classes
- `backend/app/main.py` - App startup hook
- `backend/tests/services/test_indicator_registry.py` - Existing tests

### External Dependencies

- None (uses existing dependencies)

### Blocking Dependencies

- None (self-contained feature)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking backward compatibility | HIGH | Default instances use base names; existing API calls continue to work |
| Name collisions | MEDIUM | Last write wins is acceptable for standard variants; documented in quickstart |
| Performance degradation | LOW | Name generation is O(1) string operations; measured <1ms |
| Test coverage gaps | MEDIUM | TDD approach ensures tests written first; comprehensive test plan |

## Success Criteria

From [spec.md](spec.md):

- **SC-001**: Users can register 10+ instances of the same indicator without name conflicts
- **SC-002**: Indicator instance names are auto-generated in under 10ms per registration
- **SC-003**: 100% of existing indicator configurations remain functional (backward compatibility)
- **SC-004**: Users can retrieve and use any registered indicator by its generated name
- **SC-005**: System handles 100+ indicator instances without performance degradation

## Rollout Strategy

### Phase 1: Backend Changes (No User Impact)

1. Update indicator classes
2. Create initialization module
3. Update app startup
4. Run tests

### Phase 2: Verify API (No User Impact)

1. Test `/api/v1/indicators/supported` returns all variants
2. Test variant calculation endpoints
3. Verify backward compatibility

### Phase 3: Deploy (User-Visible)

1. Deploy to production
2. Frontend auto-discovers new variants
3. Users see additional indicator options

### Rollback Plan

If issues occur:
1. Revert `initialization.py` registration to original 5 indicators
2. Or revert `__init__.py` to inline registrations
3. No database rollback needed (no schema changes)

## Post-Implementation

### Future Enhancements

1. Allow users to define custom variants via configuration
2. Add parameter validation (min/max) to `parameter_definitions`
3. Group variants in frontend dropdown by base indicator
4. Support more complex multi-parameter naming strategies

### Monitoring

- Track API usage of variant indicators vs. default indicators
- Monitor name generation performance
- Check for name collision warnings in logs

## References

- [Feature Specification](spec.md)
- [Research Document](research.md)
- [Data Model](data-model.md)
- [API Contracts](contracts/api.yaml)
- [Quickstart Guide](quickstart.md)
- [Constitution](../../.specify/memory/constitution.md)
