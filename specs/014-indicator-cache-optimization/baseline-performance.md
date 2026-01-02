# Performance Baseline - Feature 014

**Date:** 2025-01-02
**Context:** Load time tracker now accurately measures full load time

---

## DEPRECATED: Performance tracking moved to Feature 015

**For symbol load performance tracking, use:**
- `specs/015-symbol-load-performance/baseline-performance.md`

Feature 014 focused on indicator caching. Feature 015 now tracks symbol load performance optimizations.

---

## Current Baseline Metrics

### WebSocket Mode - Initial Symbol Load

| Symbol | Load Time | Target | Multiple of Target |
|--------|-----------|--------|-------------------|
| O | 5842ms | <500ms | 11.7x slower |
| AMZN | 5936ms | <500ms | 11.9x slower |
| ADC | 5936ms | <500ms | 11.9x slower |
| PFE | ~4000ms (early timer) | <500ms | 8x slower |

**Average:** ~5900ms
**Target:** <500ms
**Gap:** ~5400ms (10.8x slower than target)

## Load Phase Breakdown

From console logs, the sequence is:

1. **T1: Symbol Click** (0ms)
   - User clicks symbol
   - `[T1 START] Symbol click: XXX`

2. **Round 1 Indicator Fetch** (WASTED - fetched before candles exist)
   - `[T3 START] Fetching 2 indicators for XXX 1d` (oscillators: ADXVMA, CRSI)
   - `[T3 START] Fetching 1 indicators for XXX 1d` (overlays: TDFI)
   - `[T4 DONE] Fetched 2 indicators for XXX 1d`
   - `[T4 DONE] Fetched 1 indicators for XXX 1d`
   - **Time: ~500-1000ms**

3. **T2: Candle Fetch**
   - `[Initial Fetch] Fetching candles from...`
   - `[Initial Fetch] Received 686 candles`
   - `[T2 DONE] Candles received`
   - **Time: ~500-1000ms**

4. **Round 2 Indicator Fetch** (Needed - fetched with correct candle data)
   - `[T3 START] Fetching 2 indicators for XXX 1d`
   - `[T3 START] Fetching 1 indicators for XXX 1d`
   - `[T4 DONE] Fetched 2 indicators for XXX 1d`
   - `[T4 DONE] Fetched 1 indicators for XXX 1d`
   - **Time: ~500-1000ms**

5. **T5: Chart Render**
   - Triple requestAnimationFrame wait
   - `[T5 DONE] Chart render complete`
   - **Time: ~100-500ms**

6. **Debounce Wait**
   - 2000ms timer after last T4 DONE
   - Ensures all indicator fetch rounds complete
   - **Time: 2000ms**

## Root Cause Analysis

### Problem 1: Duplicate Indicator Fetches
**Impact:** ~1-1.5 seconds wasted (50% of indicator fetch time)

**Why it happens:**
- Round 1: `useIndicatorData` hook fetches when symbol changes (before candles arrive)
- Round 2: `useIndicatorData` hook refetches when `candleDateRange` updates (after candles arrive)
- Both rounds fetch the same indicators with the same parameters

**Code location:**
- `frontend/src/hooks/useIndicatorData.ts` line 422
- Dependencies: `[indicators, symbol, interval, dataVersion, fetchIndicatorData]`
- Missing: `candleDateRange` should trigger initial fetch, not symbol change

**Fix needed:**
Only fetch indicators after `candleDateRange` is available (candles have arrived)

### Problem 2: 2-Second Debounce Overhead
**Impact:** 2000ms added to every load (33% of total time)

**Why it's needed:**
- Multiple rounds of indicator fetching happen at different times
- Need to wait for ALL `[T4 DONE]` messages before declaring load complete
- Current solution: 2000ms debounce after last T4 message

**Fix needed:**
Eliminate duplicate fetches (Problem 1), then debounce can be reduced to 100-200ms

### Problem 3: Sequential API Calls
**Impact:** Each indicator API call adds latency

**Current behavior:**
- 3 separate API calls (ADXVMA, CRSI, TDFI)
- Each call has its own network latency + backend processing time
- Called twice (round 1 + round 2) = 6 total API calls per symbol change

**Potential fix:**
Batch endpoint that fetches all indicators in one request (already exists but not always used)

## Performance Targets

From Feature 014 spec:
- Cached requests: <100ms (P90)
- Uncached requests: <500ms (P90)
- Current: ~5900ms (12x slower than target)

## Improvement Plan

### Phase 1: Fix Duplicate Fetches (Expected: -1.5s)
Only fetch indicators after candles arrive

### Phase 2: Reduce Debounce (Expected: -1.8s)
After fixing duplicates, debounce can be 100-200ms instead of 2000ms

### Phase 3: Optimize API Calls (Expected: -500ms)
Use batch endpoint, parallel requests, or caching

### Expected Final Result
**Target:** <500ms (11.8x improvement)
**Realistic:** 1000-1500ms (4-6x improvement)

## Next Steps

1. Fix duplicate indicator fetches
2. Re-measure to see actual improvement
3. Continue optimization until <500ms target is met
