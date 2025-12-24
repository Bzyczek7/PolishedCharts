# Implementation Plan: Indicator Parity Validation

**Branch**: `005-indicator-parity` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-indicator-parity/spec.md`

**Note**: This is a **validation/testing infrastructure feature**, not a feature implementation. The indicators are built in `003-advanced-indicators`; this feature provides the acceptance gate through fixture data, test tooling, and validation workflows.

## Summary

Create a measurable, repeatable process for validating that implemented indicators (cRSI, TDFI, ADXVMA, EMA, SMA) match the TradingView Supercharts reference implementation in visual appearance and behavior. The feature delivers:

1. **Golden fixtures** - Frozen candle data + indicator outputs for consistent testing
2. **Reference screenshots** - TradingView captures for visual comparison
3. **Fixture tooling** - Generator script and frontend loader for test mode
4. **Validation checklists** - PR templates and detailed test procedures
5. **Data value tests** - Automated tolerance validation for indicator calculations

This is a **testing/validation feature** with minimal production code changes. The primary deliverables are test infrastructure and documentation.

## Technical Context

**Language/Version**: TypeScript 5.9+ (frontend), Python 3.11+ (fixture generator)
**Primary Dependencies**: lightweight-charts 5.1+, React 19, Playwright (future), Vitest
**Storage**: JSON files in `/specs/005-indicator-parity/fixtures/`
**Testing**: Manual screenshot comparison (MVP), Vitest unit tests for data value validation, Playwright (future for automated visual diff)
**Target Platform**: Web browser (same as main application)
**Project Type**: web (testing infrastructure for existing web app)
**Performance Goals**: Fixture generation < 30 seconds, data value tests < 5 seconds
**Constraints**: Fixtures must be immutable (committed to repo), no live API calls during validation
**Scale/Scope**: 3 fixtures × 5 indicators = 15 validation scenarios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior **(inherited from 002/003)**
- [x] UI changes include machine-verifiable parity evidence **(Parity Report + automated tests per Constitution v1.1.0)**
- [x] Performance budgets: 60fps panning, 3s initial load **(inherited from 002)**

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented **(inherited from 003/004)**
- [x] Deduplication strategy: database constraints or idempotent inserts **(N/A - this is test infrastructure)**
- [x] Alert semantics: above/below/crosses defined with edge cases tested **(N/A - alerts are in 001/003)**
- [x] Gap handling: explicit marking and backfill strategy **(N/A - fixtures are static)**

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count **(N/A - testing feature)**
- [x] Alert evaluation performance budgeted (500ms) **(N/A - testing feature)**
- [x] Graceful degradation defined for high alert volumes **(N/A - testing feature)**

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally **(fixtures are local JSON)**
- [x] Offline behavior: charts, alerts, history remain accessible **(fixtures enable offline testing)**
- [x] Provider error handling: graceful degradation with user feedback **(N/A - no provider calls during validation)**

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization) **(inherited from 003)**
- [ ] **Bug fixes include regression tests** **(NEW: fixture-based regression tests for indicator rendering)**
- [x] CI includes: lint, typecheck, unit, integration tests **(extend to include fixture validation)**

### Performance Budgets

- [x] Initial chart load: 3 seconds **(inherited from 002/004)**
- [x] Price update latency: 2 seconds **(N/A - static fixtures)**
- [x] Alert evaluation: 500ms **(N/A - testing feature)**
- [x] UI panning: 60fps **(inherited from 002)**
- [x] Memory: 500MB for 5 symbols / 20 alerts **(N/A - testing feature)**

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern **(inherited from 003)**
- [x] Data providers implement common interface **(inherited from 004)**
- [ ] **Provider-specific logic isolated from UI** **(NEW: fixture loader isolates test data from provider)**

### Security & Privacy

- [x] No telemetry or data upload without consent **(fixtures are local, no external calls)**
- [x] API keys stored securely (not in repo) **(N/A - fixtures use public data)**
- [x] Local data treated as sensitive **(fixtures contain public market data only)**

### Governance

- [x] If any principle violated: justification in Complexity Tracking **(no violations)**
- [x] Constitution supersedes spec/plan conflicts **(no conflicts)**

**Constitution Status**: ✅ PASS - This feature extends testing infrastructure; all core principles are inherited from parent features (002, 003, 004) or are N/A for a testing feature.

## Project Structure

### Documentation (this feature)

```text
specs/005-indicator-parity/
├── plan.md              # This file
├── spec.md              # Feature specification (already created)
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
├── fixtures/            # Golden fixture JSON files (Phase 1)
│   ├── fixture-aapl-1d-100.json
│   ├── fixture-tsla-1h-200.json
│   └── fixture-spy-5m-150.json
├── screenshots/         # Reference and test screenshots
│   ├── reference/       # TradingView reference screenshots (Phase 1)
│   └── test/            # Captured screenshots during validation (runtime)
└── checklists/          # Validation checklists (already created)
    ├── pr-template.md
    └── parity-validation.md
```

### Source Code (repository root)

This feature adds minimal code to the existing web application structure:

```text
# Frontend additions
frontend/src/
├── lib/
│   └── fixtureLoader.ts          # NEW: Load fixture data in test mode
├── test/
│   └── fixtures/
│       ├── indicator-values.test.ts  # NEW: Data value validation tests
│       └── visual-comparison.test.ts # FUTURE: Playwright screenshot tests
└── vite.config.ts                # MODIFY: Add test mode environment variable

# Backend additions (fixture generator)
backend/
├── scripts/
│   └── generate_fixtures.py      # NEW: Script to capture live data as fixtures
└── tests/
    └── fixtures/
        └── test_fixtures.py      # NEW: Validate fixture integrity
```

**Structure Decision**: This is a web application (backend + frontend). The feature adds:
1. Frontend fixture loader for test mode
2. Backend fixture generator script (one-time use)
3. Test files for data value validation
4. Screenshot directories for reference and captured images

## Complexity Tracking

> No constitution violations to justify. This feature extends existing testing infrastructure without architectural changes.

## Phase 0: Research

### Unknowns to Resolve

1. **Fixture data source**: Where to capture the golden candle data + indicator outputs?
   - Options: (a) Run backend with yfinance, (b) Export from TradingView, (c) Manual entry
   - Research: Evaluate data fidelity of yfinance vs TradingView for the 3 symbols

2. **Reference screenshot capture**: How to ensure consistent TradingView screenshots?
   - Options: (a) Manual capture, (b) Browser automation, (c) Image export API
   - Research: TradingView screenshot export capabilities and automation options

3. **Fixture loader implementation**: Where to inject fixture data in the frontend?
   - Options: (a) API layer mock, (b) Service layer override, (c) Environment flag
   - Research: Existing frontend data fetching architecture

4. **Data value tolerance**: What are acceptable tolerances for indicator calculations?
   - Options: (a) Fixed tolerance (0.01), (b) Percentage-based, (c) Per-indicator custom
   - Research: Numerical precision differences between yfinance and TradingView calculations

5. **Test framework for screenshots**: What tool for automated screenshot comparison?
   - Options: (a) Playwright, (b) Cypress, (c) Custom canvas comparison
   - Research: Evaluate against existing frontend test setup (Vitest)

### Source of Truth Policy

**Decision**: Fixtures represent **backend-truth** (yfinance + our indicator calculations), not TradingView-truth.

**Rationale**:
1. We cannot access TradingView's internal candle data or indicator calculations
2. yfinance is our production data source (feature 004), so fixtures reflect actual runtime data
3. Visual screenshot comparison validates against TradingView rendering, not data values
4. Data value tests validate that our calculations are deterministic and reproducible
5. If yfinance candles differ from TradingView, visual comparison will reveal the discrepancy

**Implications**:
- Data value tests validate: "our calculation produces same output from same input" (determinism)
- Screenshot comparison validates: "our rendering matches TradingView's rendering" (visual parity)
- A test failure in data values means our calculation changed (regression)
- A test failure in screenshots means our rendering differs from TradingView (visual bug)
- The two test types are independent and serve different purposes

### Research Tasks

**Note**: Research phase completed. All unknowns resolved:

1. **Fixture data source**: Backend-truth (yfinance + our calculations) - see Source of Truth Policy above
2. **Screenshot capture**: Manual with documented process - see quickstart.md Step 2
3. **Fixture loader**: Environment flag (`VITE_FIXTURE_MODE`) with conditional loading
4. **Tolerances**: Per-indicator absolute tolerances - see Tolerance Policy below
5. **Screenshot comparison**: Manual for MVP, Playwright deferred to future phase

---

### Tolerance Policy

**Decision**: Per-indicator **absolute tolerances** (not percentage-based, not per-timeframe).

| Indicator | Tolerance | Precision Digits | Rationale |
|-----------|-----------|------------------|-----------|
| cRSI | ±0.01 | 2 | 0-100 range, integer-like precision |
| TDFI | ±0.001 | 3 | -1 to 1 range, high precision needed |
| ADXVMA | ±0.01 | 2 | Price scale (~100-200) |
| EMA | ±0.01 | 2 | Price scale (~100-200) |
| SMA | ±0.01 | 2 | Price scale (~100-200) |

**Rationale**:
- Absolute tolerances are simpler and sufficient for this use case
- Per-indicator accounts for different value ranges and precision requirements
- Not per-timeframe: indicator calculation is independent of candle interval
- Tolerances account for floating-point arithmetic differences, not data source differences
- Tests use Vitest's `toBeCloseTo(expected, digits)` for precision-based comparison

**Failure Mode**: If tests fail, investigate:
1. Did indicator calculation logic change? (regression)
2. Did fixture generation use different parameters? (version mismatch)
3. Is floating-point precision causing drift? (tolerance adjustment)

## Phase 1: Design

### Prerequisites

- `research.md` complete with all unknowns resolved
- Dependencies on `003-advanced-indicators` implementation are identified

### Data Model

This feature does not introduce new database entities. It uses:

1. **Fixture JSON structure** (defined in spec):
   - Static files stored in `/specs/005-indicator-parity/fixtures/`
   - Schema: `{ fixture_id, symbol, interval, candles[], indicators[] }`

2. **Screenshot artifacts**:
   - Reference screenshots stored in `/specs/005-indicator-parity/screenshots/reference/`
   - Test screenshots stored at runtime in `/specs/005-indicator-parity/screenshots/test/`

### API Contracts

No new API endpoints. This feature uses existing endpoints from `003-advanced-indicators` and `004-candle-data-refresh`.

**Frontend fixture loader interface** (TypeScript):

```typescript
interface FixtureLoader {
  // Load fixture data for testing
  loadFixture(fixtureId: string): Promise<FixtureData>;

  // Check if fixture mode is enabled
  isFixtureMode(): boolean;

  // Get available fixture IDs
  listFixtures(): string[];
}

interface FixtureData {
  fixture_id: string;
  symbol: string;
  interval: string;
  timestamp_range: { start: string; end: string };
  candles: CandleData[];
  indicators: {
    crsi?: { values: number[]; upper_band: number; lower_band: number; params: { period: number; source: string } };
    tdfi?: { values: number[]; thresholds: { upper: number; lower: number }; params: { rsi_period: number; band_period: number } };
    adxvma?: { values: number[]; params: { period: number; threshold: number } };
    ema_20?: { values: number[]; params: { period: number; source: string } };
    sma_50?: { values: number[]; params: { period: number; source: string } };
  };
}

interface CandleData {
  time: string;  // ISO-8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Test Contracts

**Test Seam**: Pure function unit tests, not app-level integration tests.

Data value tests validate indicator calculations directly against fixture values, without running the full application. Tests import the indicator calculation functions (from backend Python or frontend TypeScript) and assert that given the same input candles, they produce the expected output values.

**Python backend tests** (preferred - test the actual calculation logic):

```python
# backend/tests/fixtures/test_fixtures.py
import pytest
from app.services.indicators import calculate_crsi, calculate_tdfi, calculate_adxvma, calculate_ema, calculate_sma

def test_crsi_values_match_fixture(fixture_aapl_1d_100):
    """Test cRSI calculation produces fixture values within tolerance."""
    candles = fixture_aapl_1d_100['candles']
    expected = fixture_aapl_1d_100['indicators']['crsi']['values']

    actual = calculate_crsi(candles, period=14)

    for i, (exp, act) in enumerate(zip(expected, actual)):
        if exp is not None:  # Skip null values (insufficient data)
            assert abs(act - exp) < 0.01, f"cRSI at index {i}: {act} != {exp}"

def test_tdfi_values_match_fixture(fixture_aapl_1d_100):
    """Test TDFI calculation produces fixture values within tolerance."""
    candles = fixture_aapl_1d_100['candles']
    expected = fixture_aapl_1d_100['indicators']['tdfi']['values']

    actual = calculate_tdfi(candles)

    for i, (exp, act) in enumerate(zip(expected, actual)):
        if exp is not None:
            assert abs(act - exp) < 0.001, f"TDFI at index {i}: {act} != {exp}"

# Similar tests for ADXVMA, EMA, SMA
```

**Frontend tests** (alternate - tests rendering layer contracts):

```typescript
// frontend/src/test/fixtures/indicator-values.test.ts
import { describe, test, expect } from 'vitest';
import { loadFixture } from '../../lib/fixtureLoader';
import { calculateIndicator } from '../../lib/indicators'; // Pure calculation function

describe('Indicator Parity - Data Values', () => {
  const fixtures = ['fixture-aapl-1d-100', 'fixture-tsla-1h-200', 'fixture-spy-5m-150'];

  fixtures.forEach(fixtureId => {
    describe(fixtureId, () => {
      const fixture = loadFixture(fixtureId);

      test('cRSI values match within tolerance', () => {
        const { candles, indicators } = fixture;
        const expected = indicators.crsi.values;

        // Pure function: input candles → output indicator values
        const actual = calculateIndicator('crsi', candles, { period: 14 });

        expected.forEach((exp, i) => {
          if (exp !== null) {
            expect(actual[i]).toBeCloseTo(exp, 2); // 0.01 tolerance
          }
        });
      });

      test('TDFI values match within tolerance', () => {
        const { candles, indicators } = fixture;
        const expected = indicators.tdfi.values;
        const actual = calculateIndicator('tdfi', candles);

        expected.forEach((exp, i) => {
          if (exp !== null) {
            expect(actual[i]).toBeCloseTo(exp, 3); // 0.001 tolerance
          }
        });
      });

      // Similar tests for ADXVMA, EMA, SMA
    });
  });
});
```

**Key distinction**: Tests call `calculateIndicator(candles)` directly, not `getIndicatorValue('crsi', timestamp)` from a running app. This avoids:
- Needing to spin up a full React application
- Complex queries into chart state
- Flaky tests dependent on rendering timing

### Parity Report Format

**Per Constitution v1.1.0**, PRs must include a machine-readable Parity Report. Template format (Markdown or JSON):

```markdown
# Parity Report: {Indicator Name}

**Fixture ID**: fixture-aapl-1d-100
**Symbol**: AAPL
**Interval**: 1d
**Date**: 2025-12-25

## Indicator Components Present
- [x] Main line (cRSI)
- [x] Upper band (70)
- [x] Lower band (30)
- [ ] Volume histogram (N/A for cRSI)

## Axis Scaling Bounds
- **Scale Type**: Fixed (0-100)
- **Y-Axis Min**: 0
- **Y-Axis Max**: 100

## Threshold Indices for Regime Transitions
- **Upper Band Crossings**: [indices where cRSI crosses 70]
- **Lower Band Crossings**: [indices where cRSI crosses 30]

## Crosshair Sync Assertion Results
- [x] Main chart and indicator pane synchronized
- [x] Timestamp alignment verified at 5 sample points

## Color Palette Verification
- **Main Line**: #00bcd4 (cyan)
- **Upper Band**: #b2ebf2 (light cyan)
- **Lower Band**: #b2ebf2 (light cyan)

## Automated Test Results
- ✅ Data value tests: PASSED (tolerance ±0.01)
- ✅ Fixture integrity: PASSED
- ✅ Pane placement: PASSED (separate pane below main)

## Screenshot (Optional)
- [Reference screenshot attached](./screenshots/reference/fixture-aapl-1d-100-crsi.png)
```

**JSON variant** (for programmatic consumption):

```json
{
  "fixture_id": "fixture-aapl-1d-100",
  "indicator": "crsi",
  "timestamp": "2025-12-25T00:00:00Z",
  "components": {
    "main_line": true,
    "upper_band": true,
    "lower_band": true
  },
  "axis_scaling": {
    "type": "fixed",
    "min": 0,
    "max": 100
  },
  "threshold_crossings": {
    "upper": [15, 42, 78],
    "lower": [23, 56, 89]
  },
  "crosshair_sync": true,
  "verified_samples": 5,
  "colors": {
    "main": "#00bcd4",
    "upper_band": "#b2ebf2",
    "lower_band": "#b2ebf2"
  },
  "test_results": {
    "data_values": "PASS",
    "fixture_integrity": "PASS",
    "pane_placement": "PASS"
  }
}
```

## Phase 2: Implementation Summary

### Deliverables

| Deliverable | Location | Description |
|-------------|----------|-------------|
| Fixture generator script | `backend/scripts/generate_fixtures.py` | Python script to capture live data as JSON fixtures |
| Golden fixtures | `specs/005-indicator-parity/fixtures/*.json` | 3 fixture files (AAPL, TSLA, SPY) |
| Fixture manifest | `specs/005-indicator-parity/fixtures/manifest.json` | Lists all fixture IDs, symbols, intervals, generation timestamps |
| Reference screenshots | `specs/005-indicator-parity/screenshots/reference/*.png` | TradingView screenshots for each fixture+indicator |
| Fixture loader | `frontend/src/lib/fixtureLoader.ts` | Frontend module to load fixtures in test mode |
| Data value tests | `backend/tests/fixtures/test_indicator_values.py` | Pytest tests for indicator value validation |
| Parity Report template | `specs/005-indicator-parity/templates/parity-report.md` | Machine-readable report template (Constitution v1.1.0) |
| PR template | `specs/005-indicator-parity/checklists/pr-template.md` | ✅ Already created |
| Validation checklist | `specs/005-indicator-parity/checklists/parity-validation.md` | ✅ Already created |
| Quickstart guide | `specs/005-indicator-parity/quickstart.md` | Step-by-step validation workflow |

### Implementation Tasks (Summary)

Full task breakdown will be generated by `/speckit.tasks`:

1. **Create fixture generator script** - Python script using yfinance to capture candles and compute indicators
2. **Generate golden fixtures** - Run script for AAPL-1d-100, TSLA-1h-200, SPY-5m-150
3. **Freeze indicator parameters in fixtures** - Store all indicator parameters (periods, thresholds, sources) in fixture metadata to prevent false regressions from default-parameter changes
4. **Capture reference screenshots** - Manual TradingView captures for all fixtures (strict checklist in quickstart.md Step 2)
5. **Implement fixture loader** - Frontend module with test mode detection (`VITE_FIXTURE_MODE`)
6. **Configure test mode** - Vite environment variable for fixture mode, fail-fast on missing/corrupt fixtures
7. **Write data value tests** - Pure function unit tests for each indicator's computed values (Python or TypeScript)
8. **Document validation workflow** - Quickstart guide for running parity checks
9. **Configure CI integration** - Required: add pytest fixture tests to CI pipeline (Constitution v1.1.0)
10. **Create Parity Report template** - Machine-readable report with indicator components, axis bounds, thresholds, crosshair sync, color palette (Constitution v1.1.0)

### Out of Scope

- Automated pixel-perfect screenshot comparison (deferred to future)
- Live data parity validation (fixtures are static)
- Pine Script source code validation (visual output only)
- Non-flagship indicators (cRSI, TDFI, ADXVMA, EMA, SMA only)

## Success Criteria

- **SC-001**: All 3 fixtures generated with valid candle and indicator data
- **SC-002**: Reference screenshots captured for all fixtures (15 screenshots: 3 fixtures × 5 indicators)
- **SC-003**: Fixture loader successfully loads fixtures in test mode **without making any live API calls** (parity runs offline/deterministically from local JSON)
- **SC-004**: Data value tests pass for all indicators within defined tolerances
- **SC-005**: Validation workflow documented in quickstart guide
- **SC-006**: PR checklist template available and used in indicator-related PRs
