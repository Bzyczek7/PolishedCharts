# Feature Specification: Indicator Parity Validation

**Feature Branch**: `005-indicator-parity`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: "Create a focused parity validation feature that measures visual and behavioral alignment between the portal's indicators and a TradingView Supercharts reference. This spec defines the test fixtures, acceptance criteria, and validation workflow for confirming that cRSI, TDFI, ADXVMA, EMA, and SMA indicators match the reference implementation."

## Purpose and Scope

This specification defines a **measurable, repeatable process** for validating that the portal's technical indicators match the TradingView Supercharts reference implementation in visual appearance and behavior. It is **not** an implementation spec—that belongs to `003-advanced-indicators`. Instead, this spec serves as the **acceptance gate** for indicator work.

**Key distinction**:
- `003-advanced-indicators` = "Build the indicator pipeline, renderers, and generic metadata contract"
- `005-indicator-parity` = "Validate that the implemented indicators match the TradingView reference within defined tolerances"

---

## Clarifications

### Session 2025-12-25

- Q: How should fixture mode be activated in the application? → A: Environment variable (e.g., `VITE_FIXTURE_MODE=fixture-id`) at dev server start
- Q: Should fixture JSON files be committed to the repository or generated on-demand? → A: Committed to git in `specs/005-indicator-parity/fixtures/` (version-controlled, reproducible)
- Q: What should happen when fixture mode is enabled but fixtures are missing or corrupted? → A: Fail-fast: Application throws descriptive error and refuses to load
- Q: Should CI automatically run parity tests (data value validation, fixture integrity) on every PR? → A: Yes, CI runs pytest data value tests and fixture integrity checks automatically
- Q: When should fixtures be regenerated? → A: Intentional only: Manual script run for new symbols/interval or data source changes

## Parity Dimensions to Validate

Parity is measured across specific, testable dimensions—not a subjective "looks similar" assessment.

### 1. Pane Placement

| Indicator Type | Expected Placement | Validation Method |
|----------------|-------------------|-------------------|
| Overlay indicators (EMA, SMA, ADXVMA) | Rendered in main price chart pane | Verify indicator appears on same Y-axis as price candles |
| Oscillator indicators (cRSI, TDFI) | Separate pane stacked below main chart | Verify distinct pane with own Y-axis scale |
| Volume | Bottom of main chart pane (10-20% height) | Verify volume bars anchor to bottom of price pane |

**Acceptance**: Indicators appear in correct pane type (overlay vs separate) with proper stacking order.

### 2. Series Types

Each indicator renders specific visual series types. Validate each component:

| Indicator | Series Components | Visual Type | Validation Checklist |
|-----------|-------------------|-------------|---------------------|
| **cRSI** | Main cRSI line | Solid line (2px) | Line is continuous, no gaps where data exists |
| | Upper band (70) | Dashed horizontal line | Line is dashed, labeled at value scale |
| | Lower band (30) | Dashed horizontal line | Line is dashed, labeled at value scale |
| **TDFI** | Main TDFI line | Line colored by threshold | Above +0.05 = green, below -0.05 = red, between = neutral |
| | Zero line | Dashed horizontal line | Center baseline |
| | Threshold lines (+0.05, -0.05) | Dotted horizontal lines | Visual markers at threshold values |
| **ADXVMA** | Main ADXVMA line | Solid line (2px) | Continuous line overlaid on price |
| **EMA/SMA** | Moving average line | Solid line (2px) | Continuous line overlaid on price |

**Acceptance**: Each series component renders with correct visual type (line style, thickness) and is distinguishable from other elements.

### 3. Axis Scaling Rules

Y-axis behavior per indicator type:

| Indicator | Scale Type | Range | Validation Method |
|-----------|------------|-------|-------------------|
| cRSI | Fixed | 0 to 100 | Verify Y-axis labels show 0, 30, 70, 100 (or similar) |
| TDFI | Fixed | -1 to 1 | Verify Y-axis labels show negative and positive values around 0 |
| ADXVMA | Dynamic (price) | Matches price range | Verify indicator shares Y-axis with candles |
| EMA/SMA | Dynamic (price) | Matches price range | Verify indicator shares Y-axis with candles |

**Acceptance**: Fixed-scale indicators have rigid Y-axis bounds (0-100 for RSI-type). Price indicators scale with the visible candle range.

### 4. Color and Regime Rules

Indicator colors based on value state:

| Indicator | Regime Condition | Expected Color | Hex Reference |
|-----------|------------------|----------------|---------------|
| **cRSI** | Default state | Cyan | `#00bcd4` |
| | Upper band | Light cyan | `#b2ebf2` |
| | Lower band | Light cyan | `#b2ebf2` |
| **TDFI** | Positive (above +0.05) | Green | `#26a69a` |
| | Negative (below -0.05) | Red | `#ef5350` |
| | Neutral (-0.05 to +0.05) | Yellow or muted | `#ffeb3b` or `#9e9e9e` |
| **ADXVMA** | Default | Blue | `#2962ff` |
| **EMA/SMA** | Per-period unique colors | Varied | Configurable (default: EMA 20 = `#ff9800`, SMA 50 = `#9c27b0`) |

**Regime transitions**:
- **cRSI**: Line does not change color based on value (single color for main line)
- **TDFI**: Line color changes when crossing thresholds +0.05 / -0.05
- **ADXVMA**: Line color may flip on slope direction change (rising vs falling)

**Acceptance**: Colors match hex values within 5% tolerance. Regime transitions occur at correct thresholds.

### 5. Crosshair Synchronization

When crosshair is active on main chart:
- **Requirement**: Vertical crosshair line appears in ALL panes at same timestamp
- **Validation**: Hover over a candle; verify vertical line aligns across main chart and all indicator panes
- **Acceptance**: Crosshair timestamps match exactly (within chart library precision)

### 6. Zoom and Pan Behavior

Indicator panes must inherit zoom/pan from main chart:
- **Horizontal scroll**: All panes scroll together (time axis synchronized)
- **Horizontal zoom**: All panes zoom together (same time range visible)
- **Vertical zoom**: Each pane zooms independently (price scale per pane)

**Acceptance**: Panning left/right shows same time period across all panes. Vertical zoom affects only focused pane.

### 7. Data Point Alignment

Indicator values must align temporally with candle data:
- **Validation**: For a specific timestamp, the indicator value should correspond to the candle at that timestamp (using same data source/preprocessing)
- **Acceptance**: When crosshair hovers a candle, displayed indicator value matches calculation based on that candle's OHLCV

## Golden Fixtures

To enable repeatable testing without daily data changes, we use **frozen fixture data**—pre-captured candle data and computed indicator outputs stored as JSON.

### Fixture Format

Each fixture file contains:

```json
{
  "fixture_id": "string",
  "symbol": "string",
  "interval": "string",
  "timestamp_range": {
    "start": "ISO-8601",
    "end": "ISO-8601"
  },
  "candles": [
    {
      "time": "ISO-8601",
      "open": number,
      "high": number,
      "low": number,
      "close": number,
      "volume": number
    }
  ],
  "indicators": {
    "crsi": {
      "values": [number, ...],
      "upper_band": number,
      "lower_band": number
    },
    "tdfi": {
      "values": [number, ...],
      "thresholds": {
        "upper": 0.05,
        "lower": -0.05
      }
    },
    "adxvma": {
      "values": [number, ...]
    },
    "ema_20": {
      "values": [number, ...]
    },
    "sma_50": {
      "values": [number, ...]
    }
  }
}
```

### Required Fixtures

Create fixtures for the following symbol/interval combinations:

| Fixture ID | Symbol | Interval | Description |
|------------|--------|----------|-------------|
| `fixture-aapl-1d-100` | AAPL | 1d | 100 daily candles (approx 5 months) |
| `fixture-tsla-1h-200` | TSLA | 1h | 200 hourly candles (approx 1 month) |
| `fixture-spy-5m-150` | SPY | 5m | 150 5-minute candles (approx 2 days) |

**Fixture storage**: `/specs/005-indicator-parity/fixtures/` as JSON files, committed to git for version control and reproducible testing.

### Reference Screenshots

For each fixture, capture reference screenshots from TradingView Supercharts showing:
1. Main chart with candles + volume
2. cRSI indicator pane
3. TDFI indicator pane
4. ADXVMA overlay on price
5. EMA(20) and SMA(50) overlays

Store screenshots in: `/specs/005-indicator-parity/screenshots/reference/`

**Screenshot naming**: `{fixture-id}-{indicator}.png`

Example: `fixture-aapl-1d-100-crsi.png`

### Edge Cases & Error Handling

**Fixture load failures**:
- Missing fixture file: Application throws descriptive error at startup with expected fixture path
- Corrupted fixture JSON: Application throws validation error indicating which field/schema failed
- Invalid fixture ID in `VITE_FIXTURE_MODE`: Application lists available fixture IDs from manifest

**Error message format**:
```
Fixture mode error: Could not load fixture 'fixture-aapl-1d-100'
Expected file: /fixtures/fixture-aapl-1d-100.json
Available fixtures: fixture-aapl-1d-100, fixture-tsla-1h-200, fixture-spy-5m-150
```

## Acceptance Criteria

For each indicator, parity is achieved when the following criteria pass:

### cRSI Indicator Parity

- [ ] Main cRSI line renders in cyan color (#00bcd4)
- [ ] Upper band at 70 renders as dashed light cyan line (#b2ebf2)
- [ ] Lower band at 30 renders as dashed light cyan line (#b2ebf2)
- [ ] Indicator pane has Y-axis range 0-100 (fixed)
- [ ] cRSI values match fixture data within 0.01 tolerance
- [ ] Visual comparison to reference screenshot shows matching curve shape
- [ ] Crosshair synchronization works when hovering

### TDFI Indicator Parity

- [ ] Main TDFI line is colored by threshold regime
- [ ] Values above +0.05 render in green (#26a69a)
- [ ] Values below -0.05 render in red (#ef5350)
- [ ] Values between -0.05 and +0.05 render in neutral color
- [ ] Dotted reference lines at +0.05 and -0.05 are visible
- [ ] Dashed zero line is visible at center
- [ ] Indicator pane has Y-axis range approximately -1 to 1
- [ ] TDFI values match fixture data within 0.001 tolerance
- [ ] Regime transitions occur at exact threshold values
- [ ] Visual comparison to reference screenshot shows matching curve shape

### ADXVMA Indicator Parity

- [ ] ADXVMA line renders in blue (#2962ff) as overlay on price chart
- [ ] Line shares Y-axis scale with candle prices
- [ ] Line is 2px thickness (distinct from grid lines)
- [ ] ADXVMA values match fixture data within 0.01 tolerance
- [ ] Visual comparison to reference screenshot shows matching curve position relative to price
- [ ] Line smoothly follows price action without jagged artifacts

### EMA/SMA Indicators Parity

- [ ] EMA(20) line renders as overlay on price chart with distinct color
- [ ] SMA(50) line renders as overlay on price chart with different color
- [ ] Both lines share Y-axis scale with candle prices
- [ ] EMA values match fixture data within 0.01 tolerance
- [ ] SMA values match fixture data within 0.01 tolerance
- [ ] Visual comparison to reference screenshot shows correct relationship (EMA faster/smooth than SMA)
- [ ] Lines are distinguishable from each other and from ADXVMA

### Overall Chart Parity

- [ ] Pane stacking order: main chart (candles + volume + overlays) → cRSI → TDFI (additional indicators append below)
- [ ] Pane separator lines are visible (1px solid or gap)
- [ ] All panes share synchronized horizontal scroll and zoom
- [ ] Crosshair vertical line aligns across all panes
- [ ] No rendering artifacts (flicker, misaligned timestamps, clipping)

## Validation Workflow

### Manual Screenshot Comparison (MVP)

**Prerequisites**:
- Fixture JSON files are loaded by the application
- Reference screenshots are captured from TradingView

**Steps**:

1. **Enable fixture mode**: Start dev server with `VITE_FIXTURE_MODE=fixture-aapl-1d-100` (or target fixture ID)
2. **Add indicators**: For each indicator (cRSI, TDFI, ADXVMA, EMA, SMA):
   - Add indicator to chart
   - Configure with default parameters (cRSI: 14-period, TDFI: default, ADXVMA: default, EMA: 20, SMA: 50)
3. **Capture screenshot**: Take screenshot of each indicator pane/main chart
4. **Compare**: Visually compare captured screenshot to reference screenshot
5. **Document discrepancies**: Log any differences in parity checklist

**Tools**: Browser screenshot, image diff tool (optional), parity checklist

### Automated Snapshot Testing (Future)

Using a testing framework (Playwright, Cypress) to:
1. Load fixture data programmatically
2. Render indicators
3. Capture screenshots
4. Compare pixel-by-pixel to reference images
5. Report diff percentage

**Acceptance threshold**: < 1% pixel diff for parity pass

### Data Value Validation

**Steps**:

1. Parse fixture JSON
2. For each indicator value in fixture:
   - Query application for indicator value at same timestamp
   - Assert difference is within tolerance (0.01 for price-scale, 0.001 for oscillators)
3. Report any values outside tolerance

**Implementation**: Unit test or integration test that loads fixture and validates computed values

## Test Plan and Checklist

### Pre-Test Setup

- [ ] All fixture JSON files are created and committed to `/specs/005-indicator-parity/fixtures/`
- [ ] All reference screenshots are captured and committed to `/specs/005-indicator-parity/screenshots/reference/`
- [ ] Application supports loading fixture data (test mode configuration)
- [ ] Parity checklist template is available for PR descriptions

### Indicator-Specific Tests

For each indicator (cRSI, TDFI, ADXVMA, EMA, SMA):

1. **Load fixture**: `fixture-aapl-1d-100`
2. **Add indicator** to chart with default parameters
3. **Validate pane placement** (overlay vs separate pane)
4. **Validate series types** (line styles, thickness)
5. **Validate axis scaling** (fixed 0-100 for cRSI, dynamic for overlays)
6. **Validate colors** using hex codes from spec
7. **Validate data values** against fixture JSON
8. **Capture screenshot** and compare to reference
9. **Document any discrepancies**

### Regression Testing

When making changes to indicator rendering or calculation:
1. Re-run full parity validation on all fixtures
2. Ensure no previously passing criteria now fail
3. Update reference images only if intentional change is documented

### Continuous Validation

- Before each PR merging indicator work: Run parity checklist
- After any data source changes: Re-validate fixtures
- Weekly (during active development): Re-run full parity test suite

### CI Integration (Required)

CI must automatically run parity validation tests on all pull requests:

**Tests to run**:
1. Fixture integrity tests: Validate JSON schema, timestamp formats, array lengths
2. Data value tests: Assert indicator calculations match fixture values within tolerance
3. Fail PR if any parity tests fail (regression detection)

**CI command**:
```bash
pytest backend/tests/fixtures/
```

**Rationale**: Fixtures are "backend-truth"; CI automation catches calculation regressions before manual screenshot review.</think></tool_call>

## Deliverables

### For Developers

1. **Fixture generator script**: Python/TypeScript script to capture live data and export as fixture JSON
2. **Fixture loader in frontend**: Test mode that loads fixtures instead of API data
3. **Parity validation UI**: Optional UI overlay that shows fixture status and data values

**Fixture regeneration policy**: Fixtures are regenerated intentionally (not automatically) when:
- Adding new symbols or intervals to the test suite
- Data source changes (yfinance API updates, candle normalization changes)
- Indicator calculation algorithm changes (documented in PR)
- Fixtures are NOT regenerated for indicator visual/cosmetic changes only

### For QA/Testers

1. **Parity test checklist**: Template for manual validation (see `/checklists/parity-validation.md`)
2. **Screenshot comparison guide**: Step-by-step visual comparison instructions
3. **Discrepancy log template**: Format for reporting parity issues

### For PR Templates

Include this checklist in PR description for indicator-related work:

```markdown
## Parity Validation (005-indicator-parity)

- [ ] Tested against fixtures: fixture-aapl-1d-100, fixture-tsla-1h-200, fixture-spy-5m-150
- [ ] cRSI parity: colors (cyan #00bcd4), bands (30/70), pane placement, data values match fixture
- [ ] TDFI parity: regime colors (green/red/neutral), thresholds (±0.05), pane placement, data values match fixture
- [ ] ADXVMA parity: overlay placement, color (#2962ff), data values match fixture
- [ ] EMA/SMA parity: overlay placement, colors distinct, data values match fixture
- [ ] Crosshair synchronization verified across all panes
- [ ] Screenshot comparison shows acceptable match (attach screenshots if available)
```

## Dependencies

- **Feature 003 - Advanced Indicators**: Indicator implementation must be complete before parity validation can begin
- **Feature 002 - Supercharts Visuals**: Chart rendering infrastructure (panes, crosshair, zoom/pan) must be functional

## Out of Scope

- **Real-time data parity validation**: Fixtures are static; live data parity is not tested in this spec
- **Automated pixel-perfect matching**: MVP uses manual screenshot comparison; automated diff is future work
- **Pine Script validation**: We are matching visual output, not Pine Script source code
- **Non-flagship indicators**: Parity validation covers only cRSI, TDFI, ADXVMA, EMA, SMA (extensible to others later)

## Success Criteria

- **SC-001**: All flagship indicators (cRSI, TDFI, ADXVMA) pass visual parity checks using fixture data
- **SC-002**: All flagship indicators pass data value validation against fixtures (within tolerance)
- **SC-003**: Screenshot comparison shows > 95% visual similarity to reference screenshots
- **SC-004**: Parity validation can be completed in under 30 minutes for a single fixture
- **SC-005**: PR template includes parity checklist that is filled out for all indicator-related changes
