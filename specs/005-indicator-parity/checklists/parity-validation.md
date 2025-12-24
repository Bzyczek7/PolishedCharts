# Indicator Parity Validation Checklist

Use this checklist for complete manual parity validation against TradingView Supercharts reference.

**Date**: _______________
**Tester**: _______________
**Fixture**: _______________
**Symbol/Interval**: _______________

---

## Pre-Test Setup

- [ ] Reference screenshots are available in `/specs/005-indicator-parity/screenshots/reference/`
- [ ] Fixture JSON is loaded in application (test mode)
- [ ] Application is running on branch with indicator implementation
- [ ] Chart is visible at default zoom level

---

## cRSI Parity Validation

### Visual Appearance
- [ ] **Pane placement**: Separate pane below main chart (not overlay)
- [ ] **Main line color**: Cyan (#00bcd4) - verify against reference
- [ ] **Main line thickness**: ~2px (visible but not overwhelming)
- [ ] **Upper band**: Dashed line at value 70, light cyan (#b2ebf2)
- [ ] **Lower band**: Dashed line at value 30, light cyan (#b2ebf2)
- [ ] **Y-axis labels**: Show 0-100 range (e.g., 0, 30, 70, 100 visible)

### Data Accuracy
- [ ] **Value check**: Hover over candle at index 50, note cRSI value
- [ ] **Fixture match**: Compare to fixture JSON value at same index (tolerance: ±0.01)
- [ ] **Range check**: Verify all values fall between 0 and 100

### Behavior
- [ ] **Crosshair sync**: Hover over main chart, verify vertical line appears in cRSI pane at same timestamp
- [ ] **Horizontal zoom**: Zoom in/out, verify cRSI pane time range matches main chart
- [ ] **Vertical zoom**: Zoom vertically in cRSI pane, verify only cRSI pane is affected

### Screenshot Comparison
- [ ] **Capture screenshot** of cRSI pane
- [ ] **Compare to reference** (`{fixture}-crsi.png`)
- [ ] **Curve shape**: Matches reference (no major deviations)
- [ ] **Band positions**: Lines at correct vertical positions
- [ ] **Note discrepancies**: _________________________________________________

**cRSI Parity Status**: [ ] PASS / [ ] FAIL

---

## TDFI Parity Validation

### Visual Appearance
- [ ] **Pane placement**: Separate pane below main chart (or below cRSI if both present)
- [ ] **Positive regime color**: Green (#26a69a) when value > +0.05
- [ ] **Negative regime color**: Red (#ef5350) when value < -0.05
- [ ] **Neutral regime color**: Yellow or muted color when -0.05 < value < +0.05
- [ ] **Zero line**: Dashed horizontal line at center (value 0)
- [ ] **Upper threshold**: Dotted line at +0.05
- [ ] **Lower threshold**: Dotted line at -0.05
- [ ] **Y-axis labels**: Show negative and positive values around 0

### Data Accuracy
- [ ] **Value check**: Hover over candle at index 50, note TDFI value
- [ ] **Fixture match**: Compare to fixture JSON value at same index (tolerance: ±0.001)
- [ ] **Regime check**: Verify color matches value regime (e.g., positive value = green)

### Behavior
- [ ] **Regime transitions**: Observe where line crosses ±0.05 thresholds, verify color changes
- [ ] **Crosshair sync**: Hover over main chart, verify vertical line appears in TDFI pane
- [ ] **Horizontal zoom**: Verify TDFI pane time range matches main chart

### Screenshot Comparison
- [ ] **Capture screenshot** of TDFI pane
- [ ] **Compare to reference** (`{fixture}-tdfi.png`)
- [ ] **Curve shape**: Matches reference
- [ ] **Regime colors**: Color transitions at correct positions
- [ ] **Note discrepancies**: _________________________________________________

**TDFI Parity Status**: [ ] PASS / [ ] FAIL

---

## ADXVMA Parity Validation

### Visual Appearance
- [ ] **Pane placement**: Overlay on main price chart (same pane as candles)
- [ ] **Line color**: Blue (#2962ff)
- [ ] **Line thickness**: ~2px
- [ ] **Line style**: Solid (not dashed or dotted)
- [ ] **Visibility**: Line is clearly visible against candle colors

### Data Accuracy
- [ ] **Value check**: Hover over candle at index 50, note ADXVMA value
- [ ] **Fixture match**: Compare to fixture JSON value at same index (tolerance: ±0.01)
- [ ] **Price relationship**: Verify ADXVMA value is within the candle's high-low range (should be an average)

### Behavior
- [ ] **Crosshair sync**: ADXVMA line shows value on crosshair when hovering
- [ ] **Shared Y-axis**: ADXVMA uses same scale as price (visible on right axis)
- [ ] **Horizontal zoom**: Zoom in/out, verify ADXVMA remains aligned with candles

### Screenshot Comparison
- [ ] **Capture screenshot** of main chart with ADXVMA overlay
- [ ] **Compare to reference** (`{fixture}-adxvma.png`)
- [ ] **Line position**: Line follows price action similarly to reference
- [ ] **Note discrepancies**: _________________________________________________

**ADXVMA Parity Status**: [ ] PASS / [ ] FAIL

---

## EMA/SMA Parity Validation

### Visual Appearance
- [ ] **Pane placement**: Overlay on main price chart
- [ ] **EMA color**: Distinct from SMA and ADXVMA (e.g., orange #ff9800)
- [ ] **SMA color**: Distinct from EMA and ADXVMA (e.g., purple #9c27b0)
- [ ] **Line thickness**: ~2px for both
- [ ] **Distinction**: Both lines are visually distinguishable from each other

### Data Accuracy
- [ ] **EMA value check**: Hover over candle at index 50, note EMA value
- [ ] **EMA fixture match**: Compare to fixture JSON (tolerance: ±0.01)
- [ ] **SMA value check**: Hover over candle at index 50, note SMA value
- [ ] **SMA fixture match**: Compare to fixture JSON (tolerance: ±0.01)
- [ ] **Relationship**: EMA responds faster to price changes than SMA (EMA closer to current price)

### Behavior
- [ ] **Crosshair sync**: Both lines show values on crosshair
- [ ] **Shared Y-axis**: Both use same scale as price
- [ ] **Horizontal zoom**: Both remain aligned with candles during zoom

### Screenshot Comparison
- [ ] **Capture screenshot** of main chart with EMA/SMA overlays
- [ ] **Compare to reference** (`{fixture}-ema-sma.png`)
- [ ] **Line positions**: Both lines follow price action correctly
- [ ] **Crossover points**: Visible where EMA crosses SMA (if applicable in fixture)
- [ ] **Note discrepancies**: _________________________________________________

**EMA/SMA Parity Status**: [ ] PASS / [ ] FAIL

---

## Overall Chart Parity

### Pane Stacking
- [ ] **Stack order**: Main chart → cRSI → TDFI (additional indicators below)
- [ ] **Pane separators**: Visible horizontal lines or gaps between panes
- [ ] **Pane sizing**: Each pane has reasonable height (not too compressed)

### Synchronization
- [ ] **Crosshair vertical line**: Aligns across ALL panes at same timestamp
- [ ] **Horizontal scroll**: All panes scroll together
- [ ] **Horizontal zoom**: All panes show same time range when zooming
- [ ] **Vertical zoom**: Each pane zooms independently

### Visual Quality
- [ ] **No flickering**: Panes update smoothly during interaction
- [ ] **No clipping**: Lines/labels not cut off at pane edges
- [ ] **No misalignment**: Timestamps align vertically across panes
- [ ] **Readability**: All text, labels, and lines are clearly visible

---

## Final Assessment

**Overall Parity Status**: [ ] PASS / [ ] FAIL

**Summary of Failures**:
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

**Severity Levels**:
- [ ] **Critical**: Indicator does not render or values completely wrong
- [ ] **Major**: Visual mismatch that affects usability
- [ ] **Minor**: Color/spacing differences, functionally correct
- [ ] **Trivial**: Minor visual artifacts, no impact on analysis

**Recommendation**: [ ] Approve / [ ] Request changes / [ ] Block merge

---

## Notes

Use this space for additional observations, screenshots, or context:

_________________________________________________________________________________
_________________________________________________________________________________
_________________________________________________________________________________
_________________________________________________________________________________
