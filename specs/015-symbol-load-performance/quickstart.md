# Quickstart: Symbol Load Performance Optimization

**Feature**: 015-symbol-load-performance
**Date**: 2025-01-02

## Overview

This guide provides step-by-step instructions for implementing and validating the three performance optimizations to reduce symbol load time from ~5900ms to ~2100-2400ms. The <500ms target is a future stretch goal requiring extended optimizations (see spec.md Extended Optimization Targets).

## Prerequisites

- Node.js and npm installed
- Frontend development server can run (`npm run dev`)
- Browser with DevTools (Chrome/Firefox recommended)

## Setup

1. **Start the frontend development server**:
   ```bash
   cd frontend && npm run dev
   ```

2. **Open browser DevTools**:
   - Press F12 or right-click → Inspect
   - Go to Console tab
   - Go to Network tab (in separate DevTools instance or split view)

3. **Establish baseline** (before any changes):
   - Click a symbol in the watchlist (e.g., AMZN)
   - Observe console logs:
     ```
     [T1 START] Symbol click: AMZN
     [T3 START] Fetching 2 indicators for AMZN 1d
     [T3 START] Fetching 1 indicators for AMZN 1d
     [T4 DONE] Fetched 2 indicators for AMZN 1d
     [T4 DONE] Fetched 1 indicators for AMZN 1d
     [Initial Fetch] Fetching candles from...
     [Initial Fetch] Received 686 candles
     [T2 DONE] Candles received for AMZN
     [T3 START] Fetching 2 indicators for AMZN 1d
     [T3 START] Fetching 1 indicators for AMZN 1d
     [T4 DONE] Fetched 2 indicators for AMZN 1d
     [T4 DONE] Fetched 1 indicators for AMZN 1d
     [T5 DONE] Chart render complete for AMZN
     [LOAD DONE] AMZN - 5936ms TOTAL
     ```
   - **Expected baseline**: ~5900ms
   - **Note**: TWO rounds of [T3 START]/[T4 DONE] (the problem)

## Optimization 1: Eliminate Duplicate Indicator Fetches

**Expected Impact**: -1000 to -1500ms

### Implementation

1. **Edit `frontend/src/hooks/useIndicatorData.ts`**:

   Find the `useEffect` hook (around line 352):
   ```typescript
   useEffect(() => {
     // Check if symbol is valid before proceeding
     if (!isValidSymbol(symbol)) {
       // ... existing code
     }
   ```

   Add guard condition at the START of the useEffect (before `isValidSymbol` check):
   ```typescript
   useEffect(() => {
     // Guard: Only fetch when we have candle data
     if (!candleDateRange) {
       return;
     }

     // Check if symbol is valid before proceeding
     if (!isValidSymbol(symbol)) {
       // ... existing code
     }
   ```

2. **Update dependency array** (around line 421):
   ```typescript
   // Before:
   }, [indicators, symbol, interval, dataVersion, fetchIndicatorData]);

   // After:
   }, [indicators, symbol, interval, dataVersion, fetchIndicatorData, candleDateRange]);
   ```

### Validation

1. **Reload the page** (Cmd+R / Ctrl+R)

2. **Click a symbol** (e.g., AMZN)

3. **Verify console output**:
   ```
   [T1 START] Symbol click: AMZN
   [Initial Fetch] Fetching candles from...
   [Initial Fetch] Received 686 candles
   [T2 DONE] Candles received for AMZN
   [T3 START] Fetching 2 indicators for AMZN 1d
   [T3 START] Fetching 1 indicators for AMZN 1d
   [T4 DONE] Fetched 2 indicators for AMZN 1d
   [T4 DONE] Fetched 1 indicators for AMZN 1d
   [T5 DONE] Chart render complete for AMZN
   [LOAD DONE] AMZN - 4400ms TOTAL
   ```

4. **Checklist**:
   - [ ] Only ONE round of [T3 START]/[T4 DONE] (after candle fetch)
   - [ ] No indicator fetch occurs before "[Initial Fetch] Received X candles"
   - [ ] Load time reduced by ~1000-1500ms
   - [ ] Indicators render correctly on chart

**Expected Result**: Load time ~4400ms (1500ms improvement)

## Optimization 2: Reduce Debounce Timer

**Expected Impact**: -1800ms

**Prerequisite**: Optimization 1 complete and validated

### Implementation

1. **Edit `frontend/src/App.tsx`**:

   Find the debounce timer (around line 727):
   ```typescript
   // Set new timeout - wait 2000ms after the LAST T4 DONE message
   // This accounts for multiple rounds of indicator fetching
   indicatorDoneTimeoutRef.current = setTimeout(() => {
     setIndicatorsDone(true)
   }, 2000)
   ```

   Change to:
   ```typescript
   // Set new timeout - wait 200ms after the LAST T4 DONE message
   // After Optimization 1, there's only ONE round of fetching
   indicatorDoneTimeoutRef.current = setTimeout(() => {
     setIndicatorsDone(true)
   }, 200)  // Reduced from 2000ms
   ```

### Validation

1. **Reload the page**

2. **Click a symbol**

3. **Verify console output**:
   ```
   [T1 START] Symbol click: AMZN
   [Initial Fetch] Fetching candles from...
   [Initial Fetch] Received 686 candles
   [T2 DONE] Candles received for AMZN
   [T3 START] Fetching 2 indicators for AMZN 1d
   [T3 START] Fetching 1 indicators for AMZN 1d
   [T4 DONE] Fetched 2 indicators for AMZN 1d
   [T4 DONE] Fetched 1 indicators for AMZN 1d
   [T5 DONE] Chart render complete for AMZN
   [LOAD DONE] AMZN - 2600ms TOTAL
   ```

4. **Checklist**:
   - [ ] Console sequence is same as Optimization 1
   - [ ] Load time reduced by additional ~1800ms (total ~2800-3300ms from baseline)
   - [ ] Chart becomes interactive quickly after [T4 DONE]

**Expected Result**: Load time ~2600ms (3300ms improvement from baseline)

## Optimization 3: Parallel Indicator Fetches

**Expected Impact**: -200 to -500ms

**Prerequisite**: Optimizations 1 and 2 complete and validated

### Investigation

1. **Check Network tab**:
   - Open DevTools Network tab
   - Filter by "indicators"
   - Click a symbol
   - Observe timing of indicator API requests

2. **Analyze**:
   - If requests are sequential (waterfall pattern), parallelization will help
   - If requests are already parallel (all start at same time), this optimization may not be needed
   - Current code uses `Promise.all`, so requests should already be parallel

### Implementation (if needed)

If requests are sequential, investigate why:
1. Check if `fetchIndicatorData` has any blocking behavior
2. Verify API supports concurrent requests
3. May need to add AbortController support for proper cancellation

### Validation

1. **Network tab shows parallel requests** (all indicator requests start at similar time)

2. **Load time reduced by additional ~200-500ms**

3. **Expected Result**: Load time ~2100-2400ms (3500-3800ms improvement from baseline)

## Running Tests

```bash
# Unit tests
cd frontend && npm test

# Performance tests (manual)
# 1. Start dev server: npm run dev
# 2. Open browser DevTools
# 3. Click symbols and measure load times
# 4. Record results in baseline-performance.md
```

## Rollback

If any optimization breaks functionality:

```bash
# Revert specific optimization
git checkout HEAD -- frontend/src/hooks/useIndicatorData.ts
# or
git checkout HEAD -- frontend/src/App.tsx

# Re-measure baseline and investigate
```

## Performance Tracking

Update `specs/015-symbol-load-performance/baseline-performance.md` after each optimization:

| Date | Optimization | Load Time | Improvement |
|------|--------------|-----------|-------------|
| 2025-01-02 | Baseline | 5900ms | - |
| | Opt 1: Guard | ~4400ms | -1500ms |
| | Opt 2: Debounce | ~2600ms | -3300ms |
| | Opt 3: Standardized Fetch | ~2100-2400ms | -3500-3800ms |
| | **THIS FEATURE** | **~2100-2400ms** | **-3500ms** | **~60% improvement** |
| | **<500ms stretch** | Future work | Requires extended optimizations | See spec.md Extended Optimization Targets |

## Troubleshooting

### Problem: Indicators don't appear on chart

**Solution**: Check browser console for errors. Verify `candleDateRange` is being set correctly.

### Problem: Load time didn't improve

**Solution**: Verify changes were applied. Check that only ONE round of indicator fetching occurs.

### Problem: Rapid symbol switching causes errors

**Solution**: May need to add AbortController for cancellation (Optimization 3).

## Next Steps

After implementing all three optimizations:
1. Run full test suite
2. Perform manual testing with multiple symbols
3. Update baseline-performance.md with final measurements (~2100-2400ms target)
4. If <500ms is required, investigate Extended Optimization Targets (Phase A: enhanced caching, Phase B: backend optimization)
