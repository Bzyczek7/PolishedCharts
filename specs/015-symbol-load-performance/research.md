# Research: Symbol Load Performance Optimization

**Feature**: 015-symbol-load-performance
**Date**: 2025-01-02

## Overview

This document consolidates research findings for the three planned optimizations to reduce symbol load time from ~5900ms to <500ms.

## Research Topic 1: React Best Practices for useEffect Dependencies

### Question
Is adding `candleDateRange` to the dependency array and using a guard condition the correct React pattern for preventing premature indicator fetches?

### Findings

**Decision**: YES - This is the standard React pattern.

**Rationale**:
- The `useEffect` hook already receives `candleDateRange` as a parameter to the parent component
- Adding it to the dependency array ensures the effect re-runs when candle data becomes available
- The guard pattern (`if (!candleDateRange) return;`) is the recommended way to skip effects when prerequisites aren't met
- This pattern is documented in the [React Hooks documentation](https://react.dev/reference/react/useEffect)

**Alternatives Considered**:
1. **Separate "ready" flag**: Would require additional state management, redundant since `candleDateRange` already signals readiness
2. **Move fetch logic to separate hook**: Would add complexity and make the code harder to validate
3. **Use useLayoutEffect**: Not appropriate - would block rendering, useEffect is correct for data fetching

**Implementation**:
```typescript
useEffect(() => {
  // Guard: Only fetch when we have candle data
  if (!candleDateRange) {
    return;
  }

  // ... rest of fetch logic
}, [indicators, symbol, interval, dataVersion, fetchIndicatorData, candleDateRange]);
```

**Edge Cases Handled**:
- `candleDateRange` is `undefined` → Effect exits early, no fetch
- `candleDateRange` changes → Effect re-runs with new range
- Symbol changes → `fetchedRefs.current.clear()` happens before guard, so cache is cleared

## Research Topic 2: Promise.all vs Sequential Indicator API Calls

### Question
Are indicator API calls currently sequential or parallel? Can they be parallelized safely?

### Findings

**Current Implementation Analysis**:
Looking at `useIndicatorData.ts` lines 385-395:
```typescript
for (const indicator of indicators) {
  const fetchKey = getIndicatorFetchKey(indicator);
  if (!fetchedRefs.current.has(fetchKey)) {
    newFetches.push(fetchIndicatorData(indicator));
    fetchedRefs.current.add(fetchKey);
  }
}
if (newFetches.length > 0) {
  const fetchedResults = await Promise.all(newFetches);
  // ... process results
}
```

**Decision**: The code ALREADY uses `Promise.all`, so fetches are parallel.

**Impact**: This optimization is partially implemented. However, the duplicate fetch issue means `Promise.all` is called twice (Round 1 and Round 2), negating the parallel benefit.

**Expected Net Impact**:
- After Optimization 1 (eliminate duplicate fetches): `Promise.all` will be called once, parallelizing all indicator fetches
- Additional parallel optimization may not be needed beyond eliminating duplicates
- Will measure during implementation to confirm

**Alternative: Batch Endpoint**
- Backend doesn't currently have a batch indicator endpoint for mixed indicator types
- Would require backend changes (out of scope for this frontend-only feature)

## Research Topic 3: Cancellation Token for Pending Indicator Fetches

### Question
Should pending indicator fetches be cancelled when user switches symbols? What's the best pattern?

### Findings

**Decision**: YES - Use AbortController for cancellation.

**Rationale**:
- When user rapidly switches symbols, pending fetches for the previous symbol waste bandwidth
- Cancelled fetches prevent race conditions where old data might overwrite new data
- Browser-native AbortController API is well-supported and integrates with fetch
- The existing `getIndicator()` function in `frontend/src/api/indicators.ts` should support AbortSignal

**Implementation Pattern**:
```typescript
useEffect(() => {
  if (!candleDateRange) return;

  const abortController = new AbortController();

  const fetchAll = async () => {
    try {
      // Pass abortController.signal to fetch function
      const results = await Promise.all(
        indicators.map(ind => fetchIndicatorData(ind, abortController.signal))
      );
      // ... process results
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Indicator fetch cancelled');
        return;
      }
      // ... handle other errors
    }
  };

  fetchAll();

  return () => {
    abortController.abort(); // Cancel pending fetches on cleanup
  };
}, [indicators, symbol, interval, dataVersion, fetchIndicatorData, candleDateRange]);
```

**Alternatives Considered**:
1. **Ignore stale results**: Check symbol match on return, but still wastes bandwidth
2. **Request counter**: Compare request IDs (e.g., `if (requestId !== currentRequestId) return`), but still completes fetch
3. **Debounce**: Add delay before fetch, but makes UI feel less responsive

**Edge Cases**:
- Fetch completes before abort → Result is processed (fast response is good)
- Fetch is aborted → Error is caught and silently ignored (expected behavior)
- User switches back to same symbol → Cache hit, no re-fetch needed

## Summary

| Topic | Decision | Implementation |
|-------|----------|----------------|
| useEffect dependencies | Add guard + dependency | `if (!candleDateRange) return;` |
| Parallel fetches | Already implemented | `Promise.all` already used |
| Cancellation | Use AbortController | Add to fetch with cleanup |

## Open Questions

1. **Does the existing `getIndicator()` API function support AbortSignal?**
   - Need to verify during implementation
   - If not, may need to add support as part of this optimization

2. **What is the actual parallelization benefit of Promise.all?**
   - Network latency may be the bottleneck, not request queuing
   - Will measure during implementation to validate expected improvement

3. **Should debounce be configurable?**
   - Currently hardcoded to 2000ms
   - After optimization, 200ms may be appropriate for all scenarios
   - Will make constant but keep it easily adjustable
