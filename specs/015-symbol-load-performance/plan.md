# Implementation Plan: Symbol Load Performance - Phase 3 Optimization

**Branch**: `015-symbol-load-performance` | **Date**: 2025-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Performance analysis from live testing, Feature 015 spec

## Summary

Optimize symbol load time from ~3500ms to ~2500ms by addressing the dominant bottleneck (indicator phase = 2092ms / 59%) and secondary bottleneck (candle phase = 1138ms / 32%).

**Performance Breakdown (DIS example)**:
| Phase | Time | % |
|-------|------|---|
| candles (T2) | 1138ms | 32% |
| **indicators (T3-T4)** | **2092ms** | **59%** |
| render (T5) | 336ms | 9% |
| debounce | 0ms | 0% |

**Root Causes Identified**:
1. **Indicator serialization**: `createAuthenticatedAxios()` called per-indicator with 100ms auth buffer overhead
2. **Excessive candles**: 686 candles (~2.7 years) fetched on every symbol switch
3. **Missing measurement standard**: No phase duration breakdown in logs

## Technical Context

**Language/Version**: TypeScript 5.9, React 19
**Primary Dependencies**: React hooks, lightweight-charts 5.1.0, axios
**Storage**: N/A (frontend-only)
**Testing**: Vitest
**Target Platform**: Web browser
**Project Type**: web (frontend only)
**Performance Goals**:
- Current: ~3500ms average
- Target: ~2500ms (~30% improvement)
- Per-phase targets: candles <800ms, indicators <1200ms, render <500ms
**Constraints**:
- Must maintain existing functionality
- Each optimization must be independently testable
- Timing breakdown mandatory for all symbol-load events
**Scale/Scope**: 3 indicators per symbol (ADXVMA, CRSI, TDFI), 5-20 symbols in watchlist

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior - N/A (performance optimization)
- [x] UI changes include before/after verification - N/A (no visual changes)
- [x] Performance budgets: 60fps panning, 3s initial load - **PRIMARY GOAL**: Current ~3500ms → target ~2500ms

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented - N/A (no timestamp changes)
- [x] Deduplication strategy: database constraints or idempotent inserts - N/A (no DB changes)
- [x] Alert semantics: N/A (no alert changes)
- [x] Gap handling: N/A (no gap handling changes)

### Performance Budgets

- [x] Initial chart load: 3 seconds - **TARGET**: Reduce from 3500ms to 2500ms
- [x] Price update latency: 2 seconds - N/A (not modified)
- [x] Alert evaluation: 500ms - N/A (not modified)
- [x] UI panning: 60fps - N/A (not modified)
- [x] Memory: 500MB for 5 symbols / 20 alerts - N/A (not modified)

### Testing and Quality Gates

- [ ] Core logic uses TDD - N/A (optimization, not new logic)
- [x] Bug fixes include regression tests - Track in `test-symbol-switch.test.ts`
- [x] CI includes: lint, typecheck, unit, integration tests

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern - N/A (not modified)
- [x] Data providers implement common interface - N/A (not modified)
- [x] Provider-specific logic isolated from UI - N/A (not modified)

## Project Structure

```text
frontend/
├── src/
│   ├── services/
│   │   └── authService.ts          # OPTIMIZATION: Cache axios instance, reduce auth buffer
│   ├── hooks/
│   │   └── useIndicatorData.ts     # Validate parallel fetch, add measurement logging
│   └── App.tsx                     # OPTIMIZATION: Add mandatory timing breakdown
└── tests/
    └── performance/
        └── test-symbol-switch.test.ts  # Tests with phase duration assertions

specs/015-symbol-load-performance/
├── plan.md                         # This file
├── research.md                     # Phase 0 output
└── quickstart.md                   # Phase 1 output
```

**Structure Decision**: Web application structure. This phase makes targeted changes to existing frontend files:
- `authService.ts`: Cache axios instance, reduce auth buffer
- `useIndicatorData.ts`: Validate parallel requests, add measurement logging
- `App.tsx`: Mandatory timing breakdown for all symbol-load events

## Phase 0: Research

### Unknowns to Resolve

1. **Auth Buffer Necessity**: Is 100ms buffer in `getAuthToken()` necessary, or can it be reduced to 10ms or 0ms?
2. **Axios Instance Reuse**: What are the implications of reusing a cached axios instance vs creating new ones?
3. **Candle Range Trade-off**: What's the minimum viable candle count for indicator calculation?

### Research Tasks

- [ ] R1: Investigate `getAuthToken()` buffer necessity - can it be reduced?
- [ ] R2: Benchmark axios instance creation overhead
- [ ] R3: Determine minimum candle count for indicator calculation (ADXVMA, CRSI, TDFI)
- [ ] R4: Verify Promise.all behavior in useIndicatorData.ts (true parallelism?)

## Phase 1: Design & Contracts

### Optimization 1: Cache Axios Instance & Reduce Auth Buffer

**Problem**: `createAuthenticatedAxios()` creates new axios instance per indicator, with 100ms buffer in auth.

**Current Code** (`authService.ts`):
```typescript
export async function createAuthenticatedAxios() {
  const token = await getAuthToken();  // ← Called 3x for 3 indicators
  return axios.create({...});
}

async function getAuthToken() {
  setTimeout(resolve, 100);  // ← 100ms per call!
  // ...
}
```

**Design**:
1. Cache axios instance in module scope (lazy initialization)
2. Reduce auth buffer from 100ms → 10ms (or 0ms if safe)
3. Reuse cached instance for all indicator requests

**Expected Impact**: Save ~200-300ms on indicator phase (3 indicators × ~70-100ms auth overhead)

### Optimization 2: Reduce Initial Candle Range

**Problem**: 686 candles (~2.7 years) fetched on every symbol switch.

**Current Code** (`App.tsx`):
```typescript
const INITIAL_CANDLE_COUNT = 1000  // Line ~627
```

**Design**:
1. Reduce initial count from 1000 → 200 (~6 months)
2. Backfill remaining candles after initial render (if needed for scroll-left)
3. Indicator calculation requires only ~50-100 data points minimum

**Expected Impact**: Save ~400-600ms on candle phase (from 1138ms to ~600ms)

### Optimization 3: Mandatory Timing Breakdown

**Problem**: Phase durations only added for debugging; should be mandatory (FR-005).

**Current Code** (`App.tsx` lines 789-799):
```typescript
console.log(`%c[LOAD DONE] ${symbolForTiming} - ${loadTimeMs.toFixed(0)}ms TOTAL (candles: ${tCandles.toFixed(0)}ms, indicators: ${tIndicators.toFixed(0)}ms, render: ${tRender.toFixed(0)}ms, debounce: ${tDebounce.toFixed(0)}ms)`,
```

**Design**:
1. Keep phase breakdown (already implemented)
2. Document as FR-005 measurement standard
3. Add to performance tests (assert phase durations)

**Expected Impact**: Enables data-driven optimization decisions

## Implementation Tasks

### Phase 2: Optimization Implementation

- [ ] T1: Cache axios instance in `authService.ts` (lazy initialization, module scope)
- [ ] T2: Reduce auth buffer from 100ms → 10ms in `authService.ts`
- [ ] T3: Reduce initial candle count from 1000 → 200 in `App.tsx`
- [ ] T4: Verify Promise.all parallelism in `useIndicatorData.ts` (add timing logs)
- [ ] T5: Make timing breakdown mandatory (add to performance tests)

### Phase 3: Validation

- [ ] V1: Test symbol load with timing breakdown
- [ ] V2: Verify candles < 800ms, indicators < 1200ms
- [ ] V3: Test rapid symbol switching (no freezing, proper cancellation)
- [ ] V4: Update `test-symbol-switch.test.ts` with phase duration assertions

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Caching axios instance | Prevents serial auth overhead per indicator | Creating new instance per request adds ~200-300ms |
| Reducing auth buffer | 100ms per request is excessive for local development | 10ms buffer sufficient for auth initialization |

## Quick Reference

### Files Modified

| File | Change | Impact |
|------|--------|--------|
| `frontend/src/services/authService.ts` | Cache axios, reduce auth buffer | -200-300ms indicators |
| `frontend/src/App.tsx` | Reduce candles 1000→200 | -400-600ms candles |
| `frontend/src/hooks/useIndicatorData.ts` | Verify parallelism | Validation |
| `frontend/tests/performance/test-symbol-switch.test.ts` | Add duration assertions | Regression prevention |

### Performance Targets

| Phase | Current | Target | Improvement |
|-------|---------|--------|-------------|
| candles (T2) | 1138ms | <800ms | -300ms |
| indicators (T3-T4) | 2092ms | <1200ms | -900ms |
| render (T5) | 336ms | <500ms | ✓ |
| **TOTAL** | ~3500ms | ~2500ms | -1000ms |

### Measurement Standard (FR-005)

Every symbol-load event must log:
```
[LOAD DONE] {symbol} - {TOTAL}ms (candles: {tCandles}ms, indicators: {tIndicators}ms, render: {tRender}ms, debounce: {tDebounce}ms)
```

## Integration Points

- **Frontend**: `App.tsx` → `useIndicatorData.ts` → `authService.ts`
- **Backend**: No changes required (same API endpoints)
- **Tests**: `test-symbol-switch.test.ts` for regression prevention
