# Performance Baseline - Feature 015: Symbol Load Performance

**Date:** 2025-01-02
**Context:** Load time tracker now accurately measures full load time

## Canonical Success Metric

**Definition:** Time from `[T1 START] Symbol click: XXX` to `[LOAD DONE] XXX - XXXXms TOTAL`

**What starts the timer:** User clicks a symbol in the watchlist (`[T1 START]`)

**What ends the timer:** Chart is fully interactive with all indicators rendered (`[LOAD DONE]`)

**Components included:**
- Symbol click processing
- Candle data fetch
- Indicator data fetch(es)
- Chart rendering (triple requestAnimationFrame)
- Debounce wait (after last indicator fetch completes)

**Components excluded:**
- Subsequent price updates after chart becomes interactive
- User interactions (pan, zoom) after initial load

## Current Baseline Metrics

### WebSocket Mode - Initial Symbol Load

| Symbol | Load Time | Feature 015 Target | Stretch Goal |
|--------|-----------|--------------------|--------------|
| O | 5842ms | ~2100-2400ms | <500ms |
| AMZN | 5936ms | ~2100-2400ms | <500ms |
| ADC | 5936ms | ~2100-2400ms | <500ms |
| PFE | ~4000ms (early timer) | ~2100-2400ms | <500ms |

**Average:** ~5900ms
**Feature 015 Target:** ~2100-2400ms (~60% improvement, meets 3s constitution budget)
**<500ms Stretch Goal:** Requires Extended Optimization Targets (Phase A/B - future work)

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

From Feature 015 spec:
- **Feature 015 Target:** ~2100-2400ms (~60% improvement, meets 3s constitution budget)
- **<500ms Stretch Goal:** Requires Extended Optimization Targets (Phase A/B - future work)

### Phase Targets

| Phase | Optimization | Expected Improvement | Target Load Time |
|-------|--------------|---------------------|------------------|
| 1 | Eliminate duplicate fetches | -1000 to -1500ms | ~4400ms |
| 2 | Reduce debounce timer | -1800ms | ~2600ms |
| 3 | Standardized fetch + retry/cancel | -200 to -500ms | ~2100-2400ms |

### Extended Optimization Targets (Future Work)

| Future Phase | Description | Expected Improvement |
|--------------|-------------|---------------------|
| A | Enhanced client-side caching | -1000 to -1500ms |
| B | Backend optimization | -500 to -1000ms |
| **<500ms** | Stretch goal | Requires A+B |

## Improvement Plan

### Phase 1: Fix Duplicate Fetches (Expected: -1.5s)
Only fetch indicators after candles arrive

### Phase 2: Reduce Debounce (Expected: -1.8s)
After fixing duplicates, debounce can be 100-200ms instead of 2000ms

### Phase 3: Standardized Fetch (Expected: -200-500ms)
Implement centralized fetch wrapper with parallel requests, retry, and cancellation

### Feature 015 Expected Result
**Target:** ~2100-2400ms (~60% improvement)
**Meets:** 3s constitution budget

## Next Steps

1. Fix duplicate indicator fetches (Phase 1)
2. Re-measure to see actual improvement (~4400ms expected)
3. Reduce debounce timer (Phase 2)
4. Re-measure (~2600ms expected)
5. Implement standardized fetch (Phase 3)
6. Final measurement (~2100-2400ms target achieved)
7. If <500ms required, plan Extended Optimization Targets (Phase A/B)
