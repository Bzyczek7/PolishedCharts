# Quickstart: Indicator Parity Validation

**Feature**: 005-indicator-parity
**Last Updated**: 2025-12-24

This guide walks you through the indicator parity validation workflow. Use this to validate that implemented indicators (cRSI, TDFI, ADXVMA, EMA, SMA) match the TradingView Supercharts reference implementation.

---

## Prerequisites

1. **Feature 003 implemented**: Indicators (cRSI, TDFI, ADXVMA, EMA, SMA) must be working
2. **Feature 004 implemented**: Candle data fetching from yfinance must be working
3. **Fixtures generated**: Run the fixture generator script (see Step 1 below)
4. **Reference screenshots captured**: Manual screenshots from TradingView (see Step 2 below)

---

## Step 1: Generate Golden Fixtures

Fixtures are frozen candle data + indicator outputs used for repeatable testing.

### Run the Fixture Generator

```bash
# From backend directory
cd backend

# Run the fixture generator script
python scripts/generate_fixtures.py
```

This creates three fixture files:
- `specs/005-indicator-parity/fixtures/fixture-aapl-1d-100.json`
- `specs/005-indicator-parity/fixtures/fixture-tsla-1h-200.json`
- `specs/005-indicator-parity/fixtures/fixture-spy-5m-150.json`

### Verify Fixture Integrity

```bash
# Run fixture validation tests
cd backend
pytest tests/fixtures/test_fixtures.py
```

---

## Step 2: Capture Reference Screenshots

Reference screenshots from TradingView serve as the visual baseline.

### Setup

1. Open TradingView Supercharts in your browser: https://www.tradingview.com/chart/
2. Use browser at 1920×1080 resolution or larger
3. Enable dark theme (same as our application)

### Capture Process

For each fixture (AAPL-1d-100, TSLA-1h-200, SPY-5m-150):

1. **Load the symbol and interval**
   - AAPL, Daily interval (D)
   - TSLA, Hourly interval (60 or 1H)
   - SPY, 5-minute interval (5)

2. **Set the time range**
   - Approximate the fixture's timestamp range
   - Use the "Fit" tool or manual zoom to show ~100-200 candles

3. **Add indicators** (one at a time for separate screenshots)
   - cRSI: Search "Connors RSI" or "RSI" with length 14
   - TDFI: Search "Traders Dynamic Index" or "TDI"
   - ADXVMA: Search "ADX VMA" or "Average Directional Index"
   - EMA: Add "Moving Average Exponential" with length 20
   - SMA: Add "Moving Average Simple" with length 50

4. **Capture screenshot**
   - Use browser DevTools (F12) → Ctrl+Shift+P → "Capture node screenshot"
   - Or use OS screenshot tool (Windows: Win+Shift+S, Mac: Cmd+Shift+4)
   - Ensure only the chart area is captured (exclude browser chrome)

5. **Save with naming convention**
   ```
   specs/005-indicator-parity/screenshots/reference/
   ├── fixture-aapl-1d-100-crsi.png
   ├── fixture-aapl-1d-100-tdfi.png
   ├── fixture-aapl-1d-100-adxvma.png
   ├── fixture-aapl-1d-100-ema-sma.png
   ├── fixture-aapl-1d-100-main.png
   └── (repeat for tsla-1h-200 and spy-5m-150)
   ```

### Screenshot Settings Checklist

- [ ] Dark theme enabled
- [ ] Chart type: Candlesticks
- [ ] Interval matches fixture (1d, 1h, 5m)
- [ ] Time range shows ~100-200 candles
- [ ] Indicators use default parameters (cRSI: 14, EMA: 20, SMA: 50)
- [ ] Screenshot captures only the chart area (not full browser)

---

## Step 3: Run Data Value Validation

Automated tests validate that indicator calculations match fixture values within tolerance.

### Run Tests

```bash
# From frontend directory
cd frontend

# Run indicator value tests
npm test -- indicator-values.test.ts
```

### Expected Output

All tests should pass:
```
✓ Indicator Parity - Data Values
  ✓ fixture-aapl-1d-100
    ✓ cRSI values match within tolerance
    ✓ TDFI values match within tolerance
    ✓ ADXVMA values match within tolerance
    ✓ EMA values match within tolerance
    ✓ SMA values match within tolerance
  ✓ fixture-tsla-1h-200
    ✓ (same indicators)
  ✓ fixture-spy-5m-150
    ✓ (same indicators)
```

### Troubleshooting Failed Tests

If tests fail:

1. **Check tolerances**: Verify `INDICATOR_TOLERANCES` in `contracts/fixture-schema.ts`
2. **Review calculation logic**: Compare indicator calculation in `backend/app/services/indicators.py`
3. **Fixture integrity**: Run `python scripts/generate_fixtures.py --validate` to check fixtures
4. **Log specific failures**: Test output shows which indices failed and by how much

---

## Step 4: Visual Comparison (Manual)

Compare your application's rendering to the reference screenshots.

### Enable Fixture Mode

```bash
# From frontend directory
cd frontend

# Start dev server with fixture mode
VITE_FIXTURE_MODE=fixture-aapl-1d-100 npm run dev
```

### Capture Application Screenshots

1. Open http://localhost:5173 in your browser
2. The chart should load fixture data (not live data)
3. Add each indicator via the UI
4. Capture screenshots using the same method as reference screenshots
5. Save to `specs/005-indicator-parity/screenshots/test/`

### Side-by-Side Comparison

Open reference and test screenshots side by side:

| Element | Validation Method | Acceptance Criteria |
|---------|------------------|---------------------|
| Pane placement | Visual check | Overlay vs separate pane matches spec |
| Line colors | Compare to hex codes | Within 5% tolerance (#00bcd4, #26a69a, etc.) |
| Line thickness | Visual check | ~2px for main lines |
| Axis scaling | Check Y-axis labels | Fixed scales (0-100 for cRSI, -1 to 1 for TDFI) |
| Reference lines | Check bands/levels | Visible at correct values (30/70 for cRSI, ±0.05 for TDFI) |
| Crosshair sync | Hover over chart | Vertical line aligns across all panes |
| Curve shape | Visual comparison | Matches reference screenshot shape |

### Use the Validation Checklist

For systematic validation, use the detailed checklist:
```
specs/005-indicator-parity/checklists/parity-validation.md
```

Print or open this file and check each item as you validate.

---

## Step 5: Document Results

### For PR Descriptions

Use the PR template when submitting indicator-related changes:

```markdown
## Parity Validation (005-indicator-parity)

- [ ] Tested against fixtures: fixture-aapl-1d-100, fixture-tsla-1h-200, fixture-spy-5m-150
- [ ] cRSI parity: colors (cyan #00bcd4), bands (30/70), pane placement, data values match fixture
- [ ] TDFI parity: regime colors (green/red/neutral), thresholds (±0.05), pane placement, data values match fixture
- [ ] ADXVMA parity: overlay placement, color (#2962ff), data values match fixture
- [ ] EMA/SMA parity: overlay placement, colors distinct, data values match fixture
- [ ] Crosshair synchronization verified across all panes
- [ ] Screenshot comparison shows acceptable match
```

### For Regression Testing

After making changes to indicator rendering or calculation:

1. Re-run data value tests (Step 3)
2. Re-capture screenshots in fixture mode
3. Compare to reference screenshots
4. Document any intentional changes (e.g., adjusted color, corrected calculation)
5. Update reference screenshots if change is intentional and documented

---

## Common Issues and Solutions

### Issue: Fixture data not loading

**Symptoms**: Chart shows no data or error in console

**Solutions**:
- Verify `VITE_FIXTURE_MODE` environment variable is set
- Check that fixture JSON files exist in `specs/005-indicator-parity/fixtures/`
- Check browser console for CORS errors (fixtures should be served as static files)
- Restart dev server after setting environment variable

### Issue: Data value tests failing

**Symptoms**: Test output shows failed assertions

**Solutions**:
- Check if indicator calculation logic changed since fixtures were generated
- Re-run fixture generator: `python backend/scripts/generate_fixtures.py`
- Verify tolerance settings in `contracts/fixture-schema.ts`
- Check for floating-point precision issues in calculation

### Issue: Screenshots don't match

**Symptoms**: Visual comparison shows differences

**Solutions**:
- Verify chart zoom level matches reference
- Check that indicator parameters are correct (periods, thresholds)
- Ensure dark theme is enabled
- Verify time range shows approximately the same candles
- Check that colors match hex codes from spec

### Issue: Crosshair not synchronized

**Symptoms**: Vertical line doesn't align across panes

**Solutions**:
- Verify lightweight-charts crosshair configuration
- Check that all panes use the same time scale
- Ensure `timeScale` is properly shared between chart instances

---

## Continuous Integration

### Running Tests in CI

The data value tests can be integrated into CI:

```yaml
# .github/workflows/indicator-parity.yml
name: Indicator Parity Tests
on: [pull_request]
jobs:
  parity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run parity tests
        run: cd frontend && npm test -- indicator-values.test.ts
```

### Pre-Merge Checklist

Before merging indicator changes:

- [ ] Data value tests pass for all fixtures
- [ ] Visual comparison completed (at least one fixture)
- [ ] PR parity checklist filled out
- [ ] Reference screenshots updated if intentional changes made
- [ ] No regressions in previously passing indicators

---

## Next Steps

After parity validation passes:

1. **Merge indicator implementation** into main branch
2. **Archive screenshots** with commit hash for future reference
3. **Document any deviations** from TradingView in project README
4. **Consider automation** for future parity checks (Playwright screenshot diff)

---

## Additional Resources

- [Feature Specification](./spec.md) - Full requirements and acceptance criteria
- [Data Model](./data-model.md) - Fixture schema and data structures
- [Plan](./plan.md) - Implementation details and research findings
- [Checklists](./checklists/) - PR template and validation checklist
