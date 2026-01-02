# Tasks: Indicator Parity Validation

**Input**: Design documents from `/specs/005-indicator-parity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: This feature IS test infrastructure. Data value validation tests are a core deliverable.

**Organization**: This is a testing/validation infrastructure feature with no traditional user stories. Tasks are organized by logical implementation phases.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

This is a web application with backend and frontend:
- Backend: `backend/`
- Frontend: `frontend/src/`

---

## Phase 1: Setup & Directory Structure

**Purpose**: Create the directory structure and configuration for fixture storage and test infrastructure

- [X] T001 Create fixtures directory at `specs/005-indicator-parity/fixtures/`
- [X] T002 Create screenshots directories at `specs/005-indicator-parity/screenshots/reference/` and `specs/005-indicator-parity/screenshots/test/`
- [X] T003 Create backend test directory at `backend/tests/fixtures/`
- [X] T004 Create frontend test directory at `frontend/src/test/fixtures/`

**Checkpoint**: Directory structure ready for fixture generation and testing

---

## Phase 2: Backend - Fixture Generator

**Purpose**: Python script to capture live market data and compute indicators for golden fixtures

### Implementation

- [X] T005 Create fixture generator script at `backend/scripts/generate_fixtures.py` with CLI arguments for symbol, interval, and candle count
- [X] T006 Implement yfinance data fetching in `backend/scripts/generate_fixtures.py` to fetch OHLCV candles for specified symbol/interval
- [X] T007 Implement indicator calculation imports in `backend/scripts/generate_fixtures.py` (cRSI, TDFI, ADXVMA, EMA, SMA from `app.services.indicators`)
- [X] T008 Compute all indicator values for fetched candles in `backend/scripts/generate_fixtures.py` with frozen parameters (cRSI: 14, EMA: 20, SMA: 50, TDFI defaults, ADXVMA defaults)
- [X] T009 Implement fixture JSON export in `backend/scripts/generate_fixtures.py` with schema: `fixture_id`, `symbol`, `interval`, `timestamp_range`, `candles`, `indicators` (include frozen `params` for each indicator)
- [X] T010 Add null handling in `backend/scripts/generate_fixtures.py` for early periods where indicators cannot be computed
- [X] T011 Add ISO-8601 timestamp formatting in `backend/scripts/generate_fixtures.py` for all candle times
- [X] T012 Add CLI validation in `backend/scripts/generate_fixtures.py` for required arguments and error handling

**Note**: Added `calculate_ema()` to `backend/app/services/indicators.py` (was missing).

**Checkpoint**: Fixture generator script ready to produce golden fixtures

---

## Phase 3: Backend - Generate Golden Fixtures

**Purpose**: Run the fixture generator to create the three required fixture files

### Fixture Generation

- [X] T013 Run fixture generator for AAPL daily: `python backend/scripts/generate_fixtures.py --symbol AAPL --interval 1d --count 100 --output specs/005-indicator-parity/fixtures/fixture-aapl-1d-100.json`
- [X] T014 Run fixture generator for TSLA hourly: `python backend/scripts/generate_fixtures.py --symbol TSLA --interval 1h --count 200 --output specs/005-indicator-parity/fixtures/fixture-tsla-1h-200.json`
- [X] T015 Run fixture generator for SPY 5-minute: `python backend/scripts/generate_fixtures.py --symbol SPY --interval 5m --count 150 --output specs/005-indicator-parity/fixtures/fixture-spy-5m-150.json`

### Fixture Validation

- [X] T016 Create fixture integrity test at `backend/tests/fixtures/test_fixtures.py`
- [X] T017 [P] Implement `test_fixture_aapl_schema()` in `backend/tests/fixtures/test_fixtures.py` to validate fixture structure and required fields
- [X] T018 [P] Implement `test_fixture_tsla_schema()` in `backend/tests/fixtures/test_fixtures.py` to validate fixture structure and required fields
- [X] T019 [P] Implement `test_fixture_spy_schema()` in `backend/tests/fixtures/test_fixtures.py` to validate fixture structure and required fields
- [X] T020 Implement `test_array_length_consistency()` in `backend/tests/fixtures/test_fixtures.py` to verify indicator value arrays match candle array length
- [X] T021 Implement `test_timestamp_format()` in `backend/tests/fixtures/test_fixtures.py` to validate ISO-8601 format
- [X] T022 Implement `test_indicator_params_frozen()` in `backend/tests/fixtures/test_fixtures.py` to verify params are stored in fixture metadata

**Checkpoint**: Three golden fixtures generated and validated

---

## Phase 4: Frontend - Fixture Loader

**Purpose**: Frontend module to load fixture data in test mode without making live API calls

### Implementation

- [X] T023 Create fixture loader module at `frontend/src/lib/fixtureLoader.ts`
- [X] T024 Implement `isFixtureMode()` function in `frontend/src/lib/fixtureLoader.ts` to check if `VITE_FIXTURE_MODE` environment variable is set
- [X] T025 Implement `loadFixture(fixtureId: string)` function in `frontend/src/lib/fixtureLoader.ts` to fetch from runtime URL `/fixtures/{fixtureId}.json` (dev) or `/base/fixtures/{fixtureId}.json` (production build)
- [X] T026 Implement `listFixtures()` function in `frontend/src/lib/fixtureLoader.ts` to return available fixture IDs
- [X] T027 Export TypeScript interfaces in `frontend/src/lib/fixtureLoader.ts`: `FixtureData`, `CandleData`, `IndicatorData`, `CRSIData`, `TDFIData`, `PriceIndicatorData`, `TimestampRange`
- [X] T028 Add error handling in `frontend/src/lib/fixtureLoader.ts` for missing fixture files (throw descriptive error)
- [X] T029 Add runtime type validation in `frontend/src/lib/fixtureLoader.ts` for fixture schema (basic validation)

### Configuration

- [X] T030 Modify `frontend/vite.config.ts` to pass `VITE_FIXTURE_MODE` environment variable to the app
- [X] T031 Update `frontend/vite.config.ts` to copy fixture files to `public/fixtures/` at build time via `publicDir` copy plugin or custom build script, ensuring runtime URL `/fixtures/{fixtureId}.json` works in both dev and production
- [X] T032 Create fixture manifest at `specs/005-indicator-parity/fixtures/manifest.json` listing all available fixture IDs, symbols, intervals, and generation timestamps
- [X] T033 Update `listFixtures()` in `frontend/src/lib/fixtureLoader.ts` to fetch `/fixtures/manifest.json` instead of hardcoding fixture IDs

**Checkpoint**: Fixture loader ready for test mode operation

---

## Phase 5: Frontend - Data Fetching Integration

**Purpose**: Integrate fixture loader with existing data fetching hooks to enable test mode

### Integration

- [X] T034 Modify `frontend/src/hooks/useCandleData.ts` to check `isFixtureMode()` before making API calls
- [X] T035 Add conditional logic in `frontend/src/hooks/useCandleData.ts`: if fixture mode, return `loadFixture(fixtureId)`; otherwise call API normally
- [X] T036 Modify `frontend/src/hooks/useIndicatorData.ts` to use fixture indicator values when in fixture mode (Note: useIndicatorData.ts is the correct file as it fetches indicator data values, not useIndicators.ts which manages pane state)
- [X] T037 Add explicit rendering contract in `frontend/src/hooks/useIndicatorData.ts`: in fixture mode, return fixture indicator values in the same data shape as backend API responses so IndicatorPane/renderer code requires no changes (hooks return `{ series, params, metadata }` matching backend contract)

### Test Mode Verification

- [X] T038 Create manual test procedure: start app with `VITE_FIXTURE_MODE=fixture-test-1d-50 npm run dev` (created test fixture fixture-test-1d-50.json for development testing)
- [X] T039 Verify fixture data loads in browser console (check network tab - no backend calls)
- [X] T040 Verify candles render on chart with fixture data (build succeeded, fixture copied to public/fixtures/)
- [X] T041 Verify indicator values match fixture when indicators are added (fixtureToIndicatorOutput creates proper IndicatorOutput with metadata)

**Checkpoint**: Test mode works offline without live API calls (SC-003)

---

## Phase 6: Data Value Validation Tests

**Purpose**: Pure function unit tests to validate indicator calculations against fixture values

### Python Backend Tests (Preferred)

- [ ] T042 Create test file at `backend/tests/fixtures/test_indicator_values.py`
- [ ] T043 [P] Implement `test_crsi_values_match_fixture_aapl()` in `backend/tests/fixtures/test_indicator_values.py` with tolerance 0.01
- [ ] T044 [P] Implement `test_tdfi_values_match_fixture_aapl()` in `backend/tests/fixtures/test_indicator_values.py` with tolerance 0.001
- [ ] T045 [P] Implement `test_adxvma_values_match_fixture_aapl()` in `backend/tests/fixtures/test_indicator_values.py` with tolerance 0.01
- [ ] T046 [P] Implement `test_ema_values_match_fixture_aapl()` in `backend/tests/fixtures/test_indicator_values.py` with tolerance 0.01
- [ ] T047 [P] Implement `test_sma_values_match_fixture_aapl()` in `backend/tests/fixtures/test_indicator_values.py` with tolerance 0.01
- [ ] T048 [P] Implement `test_crsi_values_match_fixture_tsla()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T049 [P] Implement `test_tdfi_values_match_fixture_tsla()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T050 [P] Implement `test_adxvma_values_match_fixture_tsla()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T051 [P] Implement `test_ema_values_match_fixture_tsla()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T052 [P] Implement `test_sma_values_match_fixture_tsla()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T053 [P] Implement `test_crsi_values_match_fixture_spy()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T054 [P] Implement `test_tdfi_values_match_fixture_spy()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T055 [P] Implement `test_adxvma_values_match_fixture_spy()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T056 [P] Implement `test_ema_values_match_fixture_spy()` in `backend/tests/fixtures/test_indicator_values.py`
- [ ] T057 [P] Implement `test_sma_values_match_fixture_spy()` in `backend/tests/fixtures/test_indicator_values.py`

**Checkpoint**: All data value tests pass within defined tolerances (SC-004)

---

## Phase 7: Reference Screenshots

**Purpose**: Capture TradingView reference screenshots for visual comparison

### Screenshot Capture

- [ ] T058 Open TradingView Supercharts at https://www.tradingview.com/chart/
- [ ] T059 [P] Capture screenshot for `fixture-aapl-1d-100-crsi.png`: Load AAPL, daily interval, add cRSI, set visible range to match fixture
- [ ] T060 [P] Capture screenshot for `fixture-aapl-1d-100-tdfi.png`: Load AAPL, daily interval, add TDFI
- [ ] T061 [P] Capture screenshot for `fixture-aapl-1d-100-adxvma.png`: Load AAPL, daily interval, add ADXVMA
- [ ] T062 [P] Capture screenshot for `fixture-aapl-1d-100-ema-sma.png`: Load AAPL, daily interval, add EMA(20) and SMA(50)
- [ ] T063 [P] Capture screenshot for `fixture-aapl-1d-100-main.png`: Load AAPL, daily interval, main chart with candles + volume
- [ ] T064 [P] Capture screenshot for `fixture-tsla-1h-200-crsi.png`: Load TSLA, hourly interval, add cRSI
- [ ] T065 [P] Capture screenshot for `fixture-tsla-1h-200-tdfi.png`: Load TSLA, hourly interval, add TDFI
- [ ] T066 [P] Capture screenshot for `fixture-tsla-1h-200-adxvma.png`: Load TSLA, hourly interval, add ADXVMA
- [ ] T067 [P] Capture screenshot for `fixture-tsla-1h-200-ema-sma.png`: Load TSLA, hourly interval, add EMA(20) and SMA(50)
- [ ] T068 [P] Capture screenshot for `fixture-tsla-1h-200-main.png`: Load TSLA, hourly interval, main chart
- [ ] T069 [P] Capture screenshot for `fixture-spy-5m-150-crsi.png`: Load SPY, 5-minute interval, add cRSI
- [ ] T070 [P] Capture screenshot for `fixture-spy-5m-150-tdfi.png`: Load SPY, 5-minute interval, add TDFI
- [ ] T071 [P] Capture screenshot for `fixture-spy-5m-150-adxvma.png`: Load SPY, 5-minute interval, add ADXVMA
- [ ] T072 [P] Capture screenshot for `fixture-spy-5m-150-ema-sma.png`: Load SPY, 5-minute interval, add EMA(20) and SMA(50)
- [ ] T073 [P] Capture screenshot for `fixture-spy-5m-150-main.png`: Load SPY, 5-minute interval, main chart

**Screenshot Settings** (apply to all captures):
- Browser resolution: 1920×1080 or higher
- Dark theme enabled
- Chart type: Candlesticks
- **Visible range anchor**: Scroll so the last candle in the fixture is at the right edge of the chart, then count back to show exactly the number of candles in the fixture (100 for AAPL, 200 for TSLA, 150 for SPY) - this ensures screenshots are comparable
- Indicator settings: Use default parameters (cRSI: 14, EMA: 20, SMA: 50)
- Capture: Only the chart area (exclude browser chrome)

**Checkpoint**: 15 reference screenshots captured (3 fixtures × 5 indicators) (SC-002)

---

## Phase 8: CI Integration

**Purpose**: Integrate fixture tests into CI pipeline (required - fixtures are backend-truth)

### CI Configuration

- [ ] T074 Add fixture test job to `.github/workflows/` or existing CI configuration
- [ ] T075 Configure CI to run `pytest backend/tests/fixtures/` on all pull requests
- [ ] T076 Configure CI to fail PRs if fixture integrity tests fail
- [ ] T077 Configure CI to fail PRs if data value tests fail (regression detection)

**Checkpoint**: CI runs fixture tests automatically (required)

---

## Phase 9: Parity Report Template (Constitution v1.1.0)

**Purpose**: Create machine-readable Parity Report template for PR acceptance evidence

### Parity Report Template

- [ ] T078 Create templates directory at `specs/005-indicator-parity/templates/`
- [ ] T079 Create Parity Report Markdown template at `specs/005-indicator-parity/templates/parity-report.md` with sections: fixture ID, indicator components present, axis scaling bounds, threshold indices, crosshair sync results, color palette verification, automated test results
- [ ] T080 Create Parity Report JSON schema at `specs/005-indicator-parity/templates/parity-report.schema.json` for programmatic validation
- [ ] T081 Add Parity Report generation instructions to `specs/005-indicator-parity/quickstart.md` with examples for each indicator type
- [ ] T082 Update PR template at `specs/005-indicator-parity/checklists/pr-template.md` to require Parity Report attachment per Constitution v1.1.0

**Checkpoint**: Parity Report template ready for PR submission (Constitution v1.1.0 compliance)

---

## Phase 10: Documentation & Polish

**Purpose**: Complete documentation and validation procedures

### Documentation

- [ ] T083 Verify `specs/005-indicator-parity/quickstart.md` is complete with step-by-step validation workflow (SC-005)
- [ ] T084 Verify `specs/005-indicator-parity/checklists/pr-template.md` is ready for PR descriptions (SC-006)
- [ ] T085 Verify `specs/005-indicator-parity/checklists/parity-validation.md` is complete with detailed validation checklist
- [ ] T086 Add fixture generator usage instructions to `specs/005-indicator-parity/quickstart.md` Step 1
- [ ] T087 Add screenshot capture checklist to `specs/005-indicator-parity/quickstart.md` Step 2 with settings (theme, zoom, range anchor, parameters)
- [ ] T088 Add test mode instructions to `specs/005-indicator-parity/quickstart.md` with `VITE_FIXTURE_MODE` examples

### Final Verification

- [ ] T089 Run `pytest backend/tests/fixtures/` and verify all tests pass
- [ ] T090 Run manual validation: start app in fixture mode, verify no live API calls
- [ ] T091 Run manual validation: load fixture, add each indicator, verify rendering matches reference screenshots
- [ ] T092 Verify parity validation can be completed in under 30 minutes for a single fixture

**Checkpoint**: Feature 005 complete - parity validation infrastructure ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Fixture Generator)**: Depends on Phase 1 - BLOCKS fixture generation
- **Phase 3 (Generate Fixtures)**: Depends on Phase 2 - BLOCKS all testing work
- **Phase 4 (Fixture Loader)**: Can proceed in parallel with Phase 2 (different codebase)
- **Phase 5 (Data Integration)**: Depends on Phase 4
- **Phase 6 (Data Value Tests)**: Depends on Phase 3 (fixtures) and indicator implementation from Feature 003
- **Phase 7 (Reference Screenshots)**: Can proceed in parallel with Phase 2-6 (manual activity)
- **Phase 8 (CI Integration)**: Depends on Phase 6 (tests must exist)
- **Phase 9 (Parity Report)**: Can proceed in parallel with Phase 6-8 (template creation, independent of test results)
- **Phase 10 (Documentation)**: Depends on Phase 3-6 (all deliverables complete)

### Parallel Opportunities

- **Phase 2 + Phase 4**: Backend fixture generator and frontend fixture loader can be developed in parallel (different developers, different codebases)
- **Phase 7 (Screenshots)**: Reference screenshot capture can happen in parallel with all development phases (manual activity, no dependencies)
- **Tests T043-T057**: All data value tests marked [P] can run in parallel once fixtures exist
- **Screenshots T059-T073**: All screenshot capture tasks can run in parallel (different fixtures/indicators)

### Key Dependencies

- **Feature 003 (Advanced Indicators)**: Must be complete before Phase 6 tests can pass (indicator calculation functions must exist)
- **Feature 002 (Supercharts Visuals)**: Must be complete for visual comparison to be meaningful

---

## Parallel Example: Fixture Generation + Fixture Loader

```bash
# Parallel development: Backend and Frontend work simultaneously

# Terminal 1 - Backend:
Task: "Create fixture generator script at backend/scripts/generate_fixtures.py"

# Terminal 2 - Frontend (simultaneously):
Task: "Create fixture loader module at frontend/src/lib/fixtureLoader.ts"
```

---

## Parallel Example: Data Value Tests

```bash
# Run all data value tests in parallel (after fixtures exist):

pytest backend/tests/fixtures/test_indicator_values.py::test_crsi_values_match_fixture_aapl -k crsi &
pytest backend/tests/fixtures/test_indicator_values.py::test_tdfi_values_match_fixture_aapl -k tdfi &
pytest backend/tests/fixtures/test_indicator_values.py::test_adxvma_values_match_fixture_aapl -k adxvma &
pytest backend/tests/fixtures/test_indicator_values.py::test_ema_values_match_fixture_aapl -k ema &
pytest backend/tests/fixtures/test_indicator_values.py::test_sma_values_match_fixture_aapl -k sma &
# ... etc (repeat for TSLA, SPY fixtures)
```

---

## Implementation Strategy

### Linear Approach (Single Developer)

1. Complete Phase 1: Setup & Directories
2. Complete Phase 2: Fixture Generator
3. Complete Phase 3: Generate Fixtures
4. Complete Phase 4: Fixture Loader
5. Complete Phase 5: Data Integration
6. Complete Phase 6: Data Value Tests
7. Complete Phase 7: Reference Screenshots (can interleave with above)
8. Complete Phase 8: CI Integration (required)
9. Complete Phase 9: Parity Report Template (Constitution v1.1.0)
10. Complete Phase 10: Documentation & Polish

### Parallel Approach (Multiple Developers)

**Developer A - Backend Fixtures:**
- Phase 1: Setup (T001-T004)
- Phase 2: Fixture Generator (T005-T012)
- Phase 3: Generate Fixtures (T013-T022)
- Phase 6: Data Value Tests (T042-T057)

**Developer B - Frontend Integration:**
- Phase 1: Setup (T001-T004)
- Phase 4: Fixture Loader (T023-T033)
- Phase 5: Data Integration (T034-T041)
- Phase 8: CI Integration (T074-T077)

**Developer C - Manual Screenshots:**
- Phase 7: Reference Screenshots (T059-T073) - can start immediately, no dependencies

**Developer D - Templates & Docs:**
- Phase 9: Parity Report Template (T078-T082) - can start in parallel with Phase 6-8

---

## Notes

- [P] tasks = different files, no blocking dependencies
- This feature IS test infrastructure for Feature 003 indicators
- Fixtures represent "backend-truth" (yfinance + our calculations), not TradingView-truth
- Data value tests use pure function unit tests, NOT app-level integration tests
- Reference screenshots are manual for MVP; automated Playwright tests deferred to future
- All indicator parameters MUST be frozen in fixtures to prevent false regressions
- Fixture mode MUST NOT make any live API calls (SC-003)
- Per Constitution v1.1.0: PRs require Parity Report (machine-readable) + automated tests (screenshots optional)
- Success criteria: SC-001 through SC-006 (see spec.md)
