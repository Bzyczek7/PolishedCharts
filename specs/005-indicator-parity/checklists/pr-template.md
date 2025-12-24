# PR Parity Validation Checklist

Copy this section into your PR description when submitting indicator-related changes.

---

## Parity Validation (005-indicator-parity)

### Fixtures Tested
- [ ] `fixture-aapl-1d-100` - AAPL daily candles (100 bars)
- [ ] `fixture-tsla-1h-200` - TSLA hourly candles (200 bars)
- [ ] `fixture-spy-5m-150` - SPY 5-minute candles (150 bars)

### Indicator Parity Checks

#### cRSI
- [ ] Main line color: cyan `#00bcd4`
- [ ] Upper band: 70, dashed light cyan `#b2ebf2`
- [ ] Lower band: 30, dashed light cyan `#b2ebf2`
- [ ] Pane: Separate, Y-axis 0-100 (fixed)
- [ ] Data values match fixture within 0.01 tolerance

#### TDFI
- [ ] Regime colors: green `#26a69a` (above +0.05), red `#ef5350` (below -0.05), neutral (between)
- [ ] Threshold lines: +0.05 and -0.05 (dotted)
- [ ] Zero line: dashed baseline
- [ ] Pane: Separate, Y-axis approx -1 to 1
- [ ] Data values match fixture within 0.001 tolerance

#### ADXVMA
- [ ] Overlay placement: on main price chart
- [ ] Color: blue `#2962ff`
- [ ] Line thickness: 2px
- [ ] Data values match fixture within 0.01 tolerance

#### EMA/SMA
- [ ] Overlay placement: on main price chart
- [ ] EMA(20) and SMA(50) use distinct colors
- [ ] Both share Y-axis with price
- [ ] Data values match fixture within 0.01 tolerance

### Crosshair & Zoom
- [ ] Crosshair vertical line synchronized across all panes
- [ ] Horizontal scroll/zoom synchronized across all panes
- [ ] Vertical zoom affects only focused pane

### Screenshots
- [ ] Main chart + overlays captured
- [ ] cRSI pane captured
- [ ] TDFI pane captured
- [ ] Screenshots attached to PR (optional but recommended)

### Notes
<!-- Add any discrepancies or observations here -->

---

## Full Parity Validation Checklist

For complete parity validation, use the detailed checklist in `/specs/005-indicator-parity/checklists/parity-validation.md`.
