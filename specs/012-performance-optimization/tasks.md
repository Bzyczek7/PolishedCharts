# Implementation Tasks: Chart and Indicator Performance Optimization

**Feature Branch**: `012-performance-optimization`
**Generated**: 2025-12-31
**Spec**: [spec.md](./spec.md) | Plan: [plan.md](./plan.md)

## Overview

This document contains dependency-ordered implementation tasks for the performance optimization feature. Tasks are organized by user story to enable independent implementation and testing.

**Total Tasks**: 52
**User Stories**: 5 (US1: P1, US2: P1, US3: P2, US4: P2, US5: P3)

---

## Phase 1: Setup

**Goal**: Initialize performance monitoring infrastructure

- [X] T001 Create frontend performance types in frontend/src/types/performance.ts
- [X] T002 Create PerformanceStore class in frontend/src/lib/performanceStore.ts
- [X] T003 Create performance utilities in frontend/src/lib/performance.ts
- [X] T004 Create backend performance config in backend/app/core/performance_config.py
- [X] T005 Create backend performance logging utilities in backend/app/services/performance.py
- [X] T006 Create backend cache service in backend/app/services/cache.py
- [X] T007 Create frontend candle cache in frontend/src/lib/candleCache.ts
- [X] T008 Create frontend indicator cache in frontend/src/lib/indicatorCache.ts
- [X] T009 Create performance API client in frontend/src/api/performance.ts

---

## Phase 2: Foundational

**Goal**: Instrument core hooks with performance logging (prerequisite for all user stories)

- [X] T010 [P] Instrument useCandleData hook with performance logging in frontend/src/hooks/useCandleData.ts
- [X] T011 [P] Instrument useIndicatorData hook with performance logging in frontend/src/hooks/useIndicatorData.ts
- [X] T012 [P] Create PerformanceReport component in frontend/src/components/PerformanceReport.tsx

---

## Phase 3: User Story 1 - Initial Performance Audit (P1)

**Goal**: Enable thorough performance audit to identify top 5 bottlenecks

**Story**: As a developer, I want to perform a thorough performance audit of chart loading and indicator rendering so that I can identify specific bottlenecks causing slow load times.

**Independent Test**: Run application with performance monitoring enabled, navigate to chart, generate report, verify top 5 bottlenecks are identified with actionable data.

**Acceptance Criteria**:
1. System logs all data fetches, rendering operations, and their durations
2. Each indicator's calculation and render time is recorded
3. Performance report shows top 5 slowest operations

### US1: Tasks

- [X] T013 [P] [US1] Create performance log entry type in frontend/src/types/performance.ts
- [X] T014 [P] [US1] Implement PerformanceStore.record() method in frontend/src/lib/performanceStore.ts
- [X] T015 [P] [US1] Implement PerformanceStore.generateReport() in frontend/src/lib/performanceStore.ts
- [X] T016 [US1] Add measurePerformance() helper in frontend/src/lib/performance.ts
- [X] T017 [US1] Instrument ChartComponent rendering with performance logging in frontend/src/components/ChartComponent.tsx
- [X] T018 [US1] Add performance state to App.tsx in frontend/src/App.tsx
- [X] T019 [US1] Integrate PerformanceReport component in App.tsx in frontend/src/App.tsx
- [X] T020 [US1] Create baseline performance test in frontend/tests/benchmarks/test_chart_load.test.ts
- [X] T020a [US1] Instrument backend API endpoints with performance logging in backend/app/api/v1/candles.py
- [X] T020b [US1] Instrument backend API endpoints with performance logging in backend/app/api/v1/indicators.py
- [X] T020c [US1] Create backend performance log aggregation in backend/app/services/performance.py

### US1: Success Criteria

| Criterion | Target | Test Method |
|-----------|--------|-------------|
| SC-001 | Top 5 bottlenecks identified with actionable data | Generate report, verify 5 operations ranked by duration |
| FR-001 | All data fetches logged | Review logs, confirm fetch_candles recorded |
| FR-002 | All rendering operations logged | Review logs, confirm render_chart recorded |
| FR-003 | Report ranks operations by duration | Verify rankings array in report output |
| FR-004 | Logs include timestamp, operation, duration, context | Check log structure |

---

## Phase 4: User Story 2 - Sequential Bottleneck Resolution (P1)

**Goal**: Fix bottlenecks one at a time with measurable improvement verification

**Story**: As a developer, I want to fix performance bottlenecks one at a time in order of severity so that each fix provides measurable improvement and doesn't introduce new issues.

**Independent Test**: Fix one bottleneck, re-measure performance, confirm >= 30% improvement OR meets threshold, verify no regressions in other categories.

**Acceptance Criteria**:
1. Bottlenecks prioritized by impact
2. Each fix shows measurable improvement (>= 30% or meets threshold)
3. No regressions introduced in other operations

### US2: Tasks

- [X] T021 [US2] Create bottleneck analysis utility in frontend/src/lib/performanceStore.ts
- [X] T022 [US2] Add before/after comparison function in frontend/src/lib/performance.ts
- [X] T023 [US2] Create regression detection in frontend/src/lib/performanceStore.ts
- [X] T024 [US2] Add performance verification workflow in frontend/tests/benchmarks/test_chart_load.test.ts

### US2: Done Gate per Bottleneck

| Condition | Criteria | Measurement |
|-----------|----------|-------------|
| Improvement | >= 30% reduction OR meets threshold | Compare before/after p95 values |
| No Regressions | Each category (fetch/calc/render/ui) within ±10% of baseline per-category p95 | Degradation measured **per category**, not global total |
| Stability | Consistent across 3+ runs | p95 variance < 20% |

**Category Definition (for regression detection)**:
- `fetch`: data_fetch operations (candles, indicators, watchlist, alerts)
- `calc`: calculation operations (indicator computation, data transformations)
- `render`: rendering operations (chart render, pane render, component updates)
- `ui`: ui_interaction operations (button clicks, menu opens, form submissions)

### US2: Success Criteria

| Criterion | Target | Test Method |
|-----------|--------|-------------|
| SC-002 | >= 30% improvement per fix | Before/after report comparison |
| FR-008 | Each fix tested independently | Verify isolated testing |
| FR-009 | Re-measure after each fix | Generate new report post-fix |
| FR-010 | No regressions in other operations | Check category stats |

---

## Phase 5: User Story 3 - Chart Loading Performance (P2)

**Goal**: Optimize chart loading to meet 3-second target

**Story**: As a user, I want the chart to load quickly when I select a symbol so that I can start analyzing data without waiting.

**Independent Test**: Select symbol, measure time from selection to chart fully interactive. Verify <= 3 seconds for standard dataset (2 years daily candles, ~500 bars).

**Acceptance Criteria**:
1. Chart displays within 3 seconds of symbol selection
2. Symbol switch loads within same threshold
3. Previously viewed symbols load faster (cache hit)

### US3: Tasks

- [X] T025 [P] [US3] Implement candle cache in useCandleData hook in frontend/src/hooks/useCandleData.ts
- [X] T026 [P] [US3] Add cache key generation in frontend/src/lib/candleCache.ts
- [X] T027 [P] [US3] Implement TTL-based eviction in frontend/src/lib/candleCache.ts
- [X] T028 [P] [US3] Add LRU eviction policy in frontend/src/lib/candleCache.ts
- [X] T029 [US3] Instrument candle cache hits in frontend/src/hooks/useCandleData.ts
- [X] T030 [US3] Create chart load benchmark test in frontend/tests/benchmarks/test_chart_load.test.ts
- [X] T031 [US3] Verify cache hit performance in frontend/tests/performance/test_caching.test.ts

### US3: Success Criteria

| Criterion | Target | Test Method |
|-----------|--------|-------------|
| SC-003 | Chart load <= 3s | Measure symbol selection to render |
| SC-005 | Cached symbol switch <= 1s | Measure revisit to same symbol |
| FR-014 | Cache prevents redundant requests | Verify network tab shows cache hit |
| FR-016 | Cache has size limit + eviction | Test with 20+ symbols |

---

## Phase 6: User Story 4 - Indicator Rendering Performance (P2)

**Goal**: Optimize indicator calculation to meet 1-second target

**Story**: As a user, I want indicators to calculate and render quickly so that I can see my technical analysis without delay.

**Independent Test**: Add indicator to chart, measure time from request to visual display. Verify <= 1 second for standard indicator. Add 5 indicators, verify total <= 5 seconds.

**Acceptance Criteria**:
1. Single indicator calculates and renders within 1 second
2. Multiple indicators scale reasonably (not exponentially slower)
3. Previously calculated indicators display faster (cache hit)

### US4: Tasks

- [X] T032 [P] [US4] Create batch indicator API endpoint in backend/app/api/v1/indicators.py
- [X] T033 [P] [US4] Implement indicator request schema in backend/app/schemas/indicator.py
- [X] T034 [P] [US4] Add batch calculation handler in backend/app/services/indicators.py
- [X] T035 [P] [US4] Add @lru_cache to indicator calculations in backend/app/services/indicator_registry/registry.py
- [X] T036 [P] [US4] Implement indicator result cache in frontend/src/lib/indicatorCache.ts
- [X] T037 [P] [US4] Update useIndicatorData to use batch API in frontend/src/hooks/useIndicatorData.ts
- [X] T038 [US4] Create indicator calculation benchmark in frontend/tests/benchmarks/test_indicator_calc.test.ts

### US4: Success Criteria

| Criterion | Target | Test Method |
|-----------|--------|-------------|
| SC-004 | Single indicator <= 1s | Measure indicator add to render |
| SC-006 | 5 indicators <= 5s total | Add 5 indicators, measure total |
| FR-012 | Indicator calculation <= 1s | Backend benchmark test |
| FR-015 | Cache prevents redundant computation | Verify cache hit on repeat |

---

## Phase 7: User Story 5 - Overall Application Responsiveness (P3)

**Goal**: Ensure 200ms UI feedback across all interactions

**Story**: As a user, I want the application to feel responsive during all interactions so that I can use it efficiently.

**Independent Test**: Perform various user actions (button clicks, menu opens, symbol switches), verify visible feedback within 200ms.

**Acceptance Criteria**:
1. All actions show feedback within 200ms
2. Long-running operations show loading indicator
3. UI remains responsive during simultaneous operations

### US5: Tasks

- [X] T039 [P] [US5] Add loading state management to useCandleData in frontend/src/hooks/useCandleData.ts
- [X] T040 [P] [US5] Add loading state management to useIndicatorData in frontend/src/hooks/useIndicatorData.ts
- [X] T041 [P] [US5] Create global loading indicator component in frontend/src/components/LoadingIndicator.tsx
- [X] T042 [US5] Add debounce to rapid symbol switches in frontend/src/hooks/useCandleData.ts
- [X] T043 [US5] Create UI responsiveness test in frontend/tests/performance/test_ui_responsiveness.test.ts

### US5: Success Criteria

| Criterion | Target | Test Method |
|-----------|--------|-------------|
| SC-007 | UI feedback <= 200ms | Measure interaction to visual feedback |
| FR-013 | Loading state for long operations | Verify spinner appears > 200ms ops |

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Final verification, documentation, cleanup

- [X] T044 Create performance monitoring documentation in frontend/src/lib/performance.ts (JSDoc comments)
- [X] T045 Add memory usage monitoring to PerformanceStore in frontend/src/lib/performanceStore.ts
- [X] T046 Create performance export utility in frontend/src/lib/performance.ts
- [X] T047 Add performance report styling in frontend/src/components/PerformanceReport.tsx
- [X] T048 Verify all success criteria met (manual test run)
- [X] T049 Clean up debug console.log statements in performance files
- [X] T050 Create performance optimization summary in specs/012-performance-optimization/IMPLEMENTATION_SUMMARY.md
- [X] T050a Verify edge case handling in frontend/tests/performance/test_edge_cases.test.ts (provider timeout, large datasets, many indicators, rapid switches, calculation errors, network interruptions)

---

## Dependencies

### User Story Completion Order

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational - instrumentation)
    ↓
Phase 3 (US1 - Audit) → Generates baseline report
    ↓
Phase 4 (US2 - Resolution Framework) → Defines done gate
    ↓
    ├─→ Phase 5 (US3 - Chart Loading) → Fix #1 (likely)
    ├─→ Phase 6 (US4 - Indicators) → Fix #2 (likely)
    └─→ Phase 7 (US5 - Responsiveness) → Fix #3+ (if needed)
    ↓
Phase 8 (Polish)
```

**Critical Path**: US1 → US2 → US3 → US4 → US5 → Polish

**Note**: US3, US4, US5 execution order depends on baseline audit results from US1. The diagram above shows expected priority based on research findings.

---

## Parallel Execution Opportunities

### Within Phases

**Phase 1 (Setup)**: All tasks parallel (T001-T009)
- Different files, no dependencies

**Phase 2 (Foundational)**: All tasks parallel (T010-T012)
- Different files, independent instrumentation

**Phase 3 (US1)**: T013-T016 parallel (types + core logic), T020a-T020c parallel (backend instrumentation)
- T017-T019 depend on T013-T016

**Phase 5 (US3)**: T025-T028 parallel (cache implementation)
- T029-T031 depend on cache being built

**Phase 6 (US4)**: T032-T036 parallel (backend + frontend cache)
- T037-T038 depend on cache + batch API

**Phase 7 (US5)**: T039-T042 parallel (loading state + debounce)
- T043 depends on loading states

### Between User Stories

US3 and US4 can be developed in parallel after US2 framework is complete:
- US3 focuses on candle caching (frontend)
- US4 focuses on indicator batching (backend + frontend)
- No shared files between them

---

## Implementation Strategy

### Recommended First Execution Slice

**Start Here**: Phase 1 + Phase 2 (T001-T012) → US1 (T013-T020c) → US2 (T021-T024)

**Why This Order**:
1. **T001-T012**: Build performance logging infrastructure
2. **T013-T020c**: Generate first "top 5 bottlenecks" report → stop guessing
3. **T021-T024**: Implement verification workflow → every optimization has measurable gate

**Before touching caching/batching**: You need data. Without the baseline report from US1 and the done gate from US2, any optimization is speculation. This slice delivers the audit capability first, so subsequent work targets actual bottlenecks.

**Deliverable after first slice**: A performance report showing top 5 bottlenecks with p95 timings, ready for systematic optimization.

### MVP Scope (Suggested)

**Minimum Viable Product**: US1 + US2 + US3

This delivers:
1. Performance audit capability (US1)
2. Verification framework (US2)
3. First bottleneck fix (US3 - candle caching)

**Expected Outcome**: 30-40% improvement in chart load time, baseline for further optimization.

### Incremental Delivery

| Iteration | Scope | Expected Outcome |
|-----------|-------|------------------|
| 1 | US1 + US2 | Audit + verification framework |
| 2 | US3 | Candle caching, ~30% improvement |
| 3 | US4 | Indicator batching, additional ~20% improvement |
| 4 | US5 | UI responsiveness polish |
| 5 | Polish | Documentation, cleanup |

---

## Test Dataset (Standard Benchmark)

All performance measurements use consistent dataset for apples-to-apples comparison:

- **Candles**: 2 years daily (~500 bars)
- **Indicators**: 5 indicators
- **Watchlist**: 20 symbols
- **Browser**: Chrome/Firefox/Edge matrix
- **Runs**: Minimum 3 per operation
- **Tracked Metric**: p95 (not average)

---

## Format Validation

**All 52 tasks follow checklist format**: ✅

- Checkbox: `- [ ]`
- Task ID: T001-T050a (including T020a-T020c for backend audit)
- Parallel marker: `[P]` where applicable
- Story label: `[US1]`-[US5]` for user story tasks
- File path: Included in all implementation tasks

**Total Parallel Tasks**: 23
**Total Sequential Tasks**: 29
**Parallelization Opportunity**: 44%
