# Manual Verification Guide: Feature 008 User Story 1

## Goal
Verify that overlay indicators render correctly on the main price chart with calculated values aligned to timestamps.

## Prerequisites
1. Backend is running (`cd backend && python -m uvicorn app.main:app --reload`)
2. Frontend is running (`cd frontend && npm run dev`)
3. Can access the app at `http://localhost:5173`

## Quick Start Test (5 minutes)

### Option 1: Using Browser Console

1. Open the app in your browser
2. Open DevTools Console (F12)
3. Load the test module by adding this import somewhere (or paste the test code):
   ```javascript
   // The test module will be available at window.Feature008Test
   // (Need to import it first in App.tsx or index.tsx)
   ```

4. Run the automated test:
   ```javascript
   Feature008Test.runManualTest('AAPL')
   ```

5. Refresh the page - you should see an orange SMA(20) line on the chart

6. Clean up:
   ```javascript
   Feature008Test.clearAllOverlayInstances('AAPL')
   ```

### Option 2: Manual localStorage Test

1. Open DevTools → Application → Local Storage
2. Add a new entry with key `indicator_list:AAPL` and value:
   ```json
   {
     "instances": ["test-sma-20"],
     "updatedAt": "2024-01-01T00:00:00.000Z"
   }
   ```

3. Add another entry with key `indicator_instance:test-sma-20` and value:
   ```json
   {
     "id": "test-sma-20",
     "symbol": "AAPL",
     "indicatorType": {
       "category": "overlay",
       "name": "sma",
       "params": { "period": 20 }
     },
     "displayName": "SMA(20)",
     "style": {
       "color": "#ff6d00",
       "lineWidth": 2,
       "showLastValue": true
     },
     "isVisible": true,
     "createdAt": "2024-01-01T00:00:00.000Z"
   }
   ```

4. Refresh the page
5. Expected result: Orange line appears on the chart

## Detailed Verification Steps

### Step 1: Verify hooks are loaded
```javascript
console.log('useIndicatorInstances:', typeof window.useIndicatorInstances);
console.log('formatIndicatorData:', typeof window.formatIndicatorData);
```
Expected: Both should show `function` or `object`

### Step 2: Check localStorage schema

Run in console:
```javascript
// Check list
JSON.parse(localStorage.getItem('indicator_list:AAPL'));

// Check all instance keys
Object.keys(localStorage).filter(k => k.startsWith('indicator_instance:'));
```

Expected:
- `indicator_list:AAPL` exists with `instances` array and `updatedAt` timestamp
- Individual `indicator_instance:${id}` keys exist

### Step 3: Verify overlay renders

1. Add an instance via localStorage (see Option 2 above)
2. Refresh the page
3. Check that:
   - [ ] Orange line (#ff6d00) appears on the chart
   - [ ] Line has 2px width
   - [ ] Last value label is shown on price scale
   - [ ] Line data points align with candle timestamps

### Step 4: Verify removal

1. Open DevTools → Application → Local Storage
2. Delete `indicator_instance:test-sma-20`
3. Update `indicator_list:AAPL` to remove `"test-sma-20"` from instances array:
   ```json
   {
     "instances": [],
     "updatedAt": "2024-01-01T00:00:00.000Z"
   }
   ```
4. Refresh the page
5. Expected: Orange line is gone

### Step 5: Verify visibility toggle

1. Update the instance to set `isVisible: false`:
   ```json
   {
     "id": "test-sma-20",
     "isVisible": false,
     ...
   }
   ```
2. Refresh the page
3. Expected: Line still exists in memory but not visible on chart

## Common Issues & Debugging

### Issue: Line doesn't appear
**Check:**
1. Browser console for errors
2. Network tab - is indicator data being fetched?
3. `indicatorDataMap` in React DevTools - does the instance have data?

**Debug:**
```javascript
// Check if instance is loaded
window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.forEach(r => {
  r.getRoots().forEach(root => {
    const fiber = root.current;
    // Look for overlayInstances in component state
  });
});
```

### Issue: Wrong color displayed
**Check:**
1. Instance `style.color` in localStorage
2. Merged overlays in App.tsx - is Feature 008 overlay taking precedence?

**Debug:**
```javascript
// Check merged overlays
const merged = /* get from React DevTools */;
console.log('Overlay colors:', merged.map(o => ({ id: o.id, color: o.color })));
```

### Issue: Data not aligned with timestamps
**Check:**
1. Indicator data timestamps vs candle timestamps
2. `formatIndicatorData` output - are timestamps in Unix seconds?

**Debug:**
```javascript
// Check timestamp formats
import { formatIndicatorData } from './utils/chartHelpers';
const data = indicatorInstanceDataMap[instanceId];
const formatted = formatIndicatorData(data);
console.log('First 3 points:', formatted.slice(0, 3));
```

## Success Criteria

User Story 1 is complete when:
- [x] Can add an overlay indicator instance
- [ ] Instance renders as a line on the main chart
- [ ] Line shows correct calculated values
- [ ] Values align with candle timestamps
- [ ] Can remove instance and line disappears
- [ ] Can toggle visibility without removing
- [ ] Per-instance color/style is applied correctly

## Next Steps After Verification

1. If all checks pass → Proceed to write tests (T009-T011)
2. If any check fails → Debug and fix before proceeding
3. Document any edge cases found

## Test Data Reference

### Valid Indicator Types for Overlays
- `sma` - Simple Moving Average (params: `{ period: number }`)
- `ema` - Exponential Moving Average (params: `{ period: number }`)
- `adxvma` - ADXVMA (params: `{ period: number }`)
- `tdfi` - TDFI (params: `{ period: number }`)

### Default Colors
- SMA: `#ff6d00` (orange)
- EMA: `#2962ff` (blue)
- TDFI: `#9e9e9e` (gray)
- ADXVMA: `#ff6d00` (orange)

### Style Options
- `color`: Hex color code (e.g., `#ff6d00`)
- `lineWidth`: 1-4 pixels
- `showLastValue`: true/false
