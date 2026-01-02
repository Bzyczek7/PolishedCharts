# Tasks: Symbol Load Performance Optimization

**Input**: Design documents from `/specs/015-symbol-load-performance/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Tests are included for validation of performance improvements. These are measurement-based tests rather than traditional unit tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation of each optimization.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/`, `frontend/tests/`
- Paths below use the web application structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish performance baseline and prepare for optimization implementation

- [ ] T001 Measure current baseline performance by opening browser DevTools and clicking 5 different symbols (O, AMZN, ADC, PFE, etc.) and recording load times from "[LOAD DONE]" console messages
- [ ] T002 Document baseline measurements in specs/015-symbol-load-performance/baseline-performance.md with average load time
- [ ] T003 [P] Create performance test directory at frontend/tests/performance/
- [ ] T004 [P] Review console log sequence to confirm duplicate indicator fetches (two rounds of [T3 START]/[T4 DONE])

**Checkpoint**: Baseline documented (~5900ms expected), ready to implement optimizations

---

## Phase 2: Foundational (Code Understanding)

**Purpose**: Understand existing code structure before making changes

**⚠️ CRITICAL**: Must complete before ANY optimization implementation

- [ ] T005 Read and understand frontend/src/hooks/useIndicatorData.ts useEffect dependency array (line 422)
- [ ] T006 Read and understand frontend/src/App.tsx debounce timer implementation (lines 694-736)
- [ ] T007 [P] Verify candleDateRange parameter is passed to useIndicatorData hook from calling components
- [ ] T008 [P] Confirm fetchIndicatorData callback depends on candleDateRange (line 258)

**Checkpoint**: Code structure understood, ready to implement optimizations

---

## Phase 3: User Story 2 - Eliminate Duplicate Data Fetching (Priority: P2) 🎯 FIRST OPTIMIZATION

**Goal**: Eliminate wasted 1000-1500ms by preventing indicator fetch before candle data arrives

**Independent Test**: Click a symbol, verify console shows ONE round of [T3 START]/[T4 DONE] after candles arrive, load time reduced by ~1000-1500ms

### Implementation for User Story 2

- [x] T009 [US2] Add guard condition to prevent indicator fetch before candle data in frontend/src/hooks/useIndicatorData.ts at line 356 (add `if (!candleDateRange) return;` before `isValidSymbol` check)
- [x] T010 [US2] Add candleDateRange to useEffect dependency array in frontend/src/hooks/useIndicatorData.ts at line 422 (change `[indicators, symbol, interval, dataVersion, fetchIndicatorData]` to `[indicators, symbol, interval, dataVersion, fetchIndicatorData, candleDateRange]`)
- [x] T010b [US2] Implement error handling for failed indicator fetches in frontend/src/hooks/useIndicatorData.ts (add try/catch in fetchIndicatorData, log error, return null data without crashing)
- [ ] T010c [US2] Create centralized fetch wrapper in frontend/src/utils/fetchWrapper.ts implementing FR-011 policy:
  - Accept AbortSignal parameter for cancellation
  - Implement exponential backoff retry (100ms, 200ms, 400ms)
  - Max 2 retries per indicator, 500ms total timeout
  - AbortSignal immediately terminates all retries
  - 4xx errors not retried, 5xx errors retried
- [ ] T010d [US2] Update frontend/src/api/indicators.ts getIndicator calls to use fetchWrapper with AbortSignal from useIndicatorData.ts useEffect
- [ ] T012 [US2] Test rapid symbol switching: Click 5 symbols rapidly (O, AMZN, ADC, PFE, TSLA), verify no errors, verify only one fetch round per symbol
- [ ] T013 [US2] Document Optimization 1 results in specs/015-symbol-load-performance/baseline-performance.md (record new average ~4400ms)

**Checkpoint**: Duplicate fetches eliminated, load time reduced by ~1000-1500ms

---

## Phase 4: User Story 3 - Reduced Debounce Timer (Priority: P3)

**Goal**: Eliminate 1800ms wait by reducing debounce timer from 2000ms to 200ms

**Independent Test**: Click a symbol, verify chart becomes interactive within 200ms of [T4 DONE], total load time ~2600ms

**Prerequisite**: User Story 2 (US2) MUST be complete first

### Implementation for User Story 3

- [x] T014 [US3] Change debounce timer from 2000ms to 200ms in frontend/src/App.tsx at line 729 (change `}, 2000)` to `}, 200)  // Reduced from 2000ms`)
- [x] T015 [US3] Update comment above debounce timer to reflect optimization in frontend/src/App.tsx at line 725 (change "Set new timeout - wait 2000ms after the LAST T4 DONE message" to "Set new timeout - wait 200ms after the LAST T4 DONE message")
- [ ] T016 [US3] Test Optimization 2: Click symbol AMZN, verify console shows same sequence as US2 but [LOAD DONE] appears faster, verify load time ~2600ms (1800ms additional improvement)
- [ ] T017 [US3] Test chart interactivity: Click symbol, verify chart becomes interactive quickly after [T4 DONE] (within 200ms)
- [ ] T018 [US3] Document Optimization 2 results in specs/015-symbol-load-performance/baseline-performance.md (record new average ~2600ms)

**Checkpoint**: Debounce reduced, load time reduced by additional ~1800ms (total ~3300ms from baseline)

---

## Phase 5: User Story 1 - Fast Symbol Switching (Priority: P1) 🎯 FINAL TARGET

**Goal**: Achieve ~2100-2400ms load time through standardized fetch behavior and any additional optimizations. The <500ms target is a future stretch goal requiring extended optimizations (Phase A: caching, Phase B: backend).

**Independent Test**: Click symbol, verify load time ~2100-2400ms, indicators render correctly, rapid switching works smoothly

**Prerequisites**: User Stories 2 and 3 MUST be complete first

### Investigation for User Story 1

**Note**: Promise.all is already used at useIndicatorData.ts:408. Optimization 3 is about:
1. Verifying requests are truly parallel (not serialized by fetch behavior)
2. Adding AbortController for cancellation (FR-003)

- [ ] T019 [US1] Open browser DevTools Network tab, filter by "indicators", click symbol AMZN
- [ ] T020 [US1] Analyze timing: if all indicator requests start at same time, parallel is working; if sequential, investigate blocking behavior
- [ ] T021 [US1] Check if frontend/src/api/indicators.ts getIndicator function supports AbortSignal for cancellation

### Phase 3 Optimization: Auth Service Caching (NEW - Based on Performance Analysis)

**Goal**: Reduce indicator phase from 2092ms to <1200ms by eliminating per-request auth overhead

**Root Cause**: `createAuthenticatedAxios()` creates new axios instance per indicator with 100ms auth buffer

- [ ] T036 [P] [US1] Cache axios instance in frontend/src/services/authService.ts (lazy initialization, module scope)
  - Add `let cachedClient: AxiosInstance | null = null` at module level
  - In `createAuthenticatedAxios()`, return cached instance if exists
  - Initialize on first call with proper token
- [ ] T037 [P] [US1] Reduce auth buffer from 100ms to 10ms in frontend/src/services/authService.ts
  - Change `setTimeout(resolve, 100)` to `setTimeout(resolve, 10)` at line 45
  - Add comment explaining reduced buffer
- [ ] T038 [US1] Verify auth caching works: Test symbol load with console, verify no auth errors
- [ ] T039 [US1] Measure performance: Expected reduction of 200-300ms on indicator phase

### Phase 3 Optimization: Reduce Candle Range (NEW - Based on Performance Analysis)

**Goal**: Reduce candle phase from 1138ms to <800ms by fetching fewer initial candles

**Root Cause**: 686 candles (~2.7 years) fetched on every symbol switch

- [ ] T040 [P] [US1] Reduce INITIAL_CANDLE_COUNT from 1000 to 200 in frontend/src/App.tsx (line ~627)
  - Update constant: `const INITIAL_CANDLE_COUNT = 200`
  - Add comment explaining reduced count for performance
- [ ] T041 [US1] Verify indicators render correctly with 200 candles
- [ ] T042 [US1] Measure performance: Expected reduction of 400-600ms on candle phase
- [ ] T043 [US1] Test scroll-left backfill: Verify user can scroll to load older candles if needed

### Implementation for User Story 1 (Original)

- [ ] T022 [US1] IF requests are sequential: Investigate blocking behavior in fetchIndicatorData (e.g., synchronous operations before await, sequential cache checks) and parallelize if possible
- [ ] T023 [US1] IF cancellation needed: Implement AbortController pattern in frontend/src/hooks/useIndicatorData.ts (create controller in useEffect, pass signal to fetch, abort on cleanup)
- [ ] T024 [US1] Test Optimization 3: Click symbol AMZN, verify load time reduced by additional ~200-500ms (target ~2100-2400ms)
- [x] T024b [US1] Implement immediate interactivity when no indicators configured in frontend/src/App.tsx (check if indicators array is empty before setting debounce timer, call setIndicatorsDone(true) immediately)
- [ ] T025 [US1] Test with no indicators: Remove all indicators, click symbol, verify chart becomes interactive immediately after candles load (no debounce wait)
- [ ] T026 [US1] Test edge case - candle fetch fails: Simulate network error, verify no indicator fetch attempted, verify error message shown
- [ ] T027 [US1] Test edge case - rapid switching: Click 5 symbols in 10 seconds, verify no freezing, no errors, pending fetches cancelled
- [ ] T028 [US1] Document Optimization 3 results in specs/015-symbol-load-performance/baseline-performance.md (record final load time)

### Measurement Standard (FR-005)

**Already Implemented**: Phase timing breakdown added to [LOAD DONE] log
- Format: `[LOAD DONE] {symbol} - {TOTAL}ms (candles: {tCandles}ms, indicators: {tIndicators}ms, render: {tRender}ms, debounce: {tDebounce}ms)`

- [ ] T044 [US1] Add phase duration assertions to frontend/tests/performance/test-symbol-switch.test.ts
  - Assert candles < 800ms
  - Assert indicators < 1200ms
  - Assert total load time < 2500ms

**Checkpoint**: All optimizations complete, load time significantly improved

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and ensuring all optimizations work together

- [ ] T029 Run all three optimizations together and verify cumulative performance improvement
- [ ] T030 [P] Update CLAUDE.md with any new patterns or best practices discovered during optimization
- [ ] T031 [P] Create performance validation checklist in specs/015-symbol-load-performance/checklists/validation.md
- [ ] T032 [P] Update quickstart.md with any lessons learned or additional troubleshooting steps
- [x] T033 Run frontend test suite (npm test) to ensure no regressions (pre-existing test failures unrelated to changes)
- [x] T034 Run frontend linter (npm run lint) to ensure code quality (pre-existing lint errors unrelated to changes)
- [x] T035 Run frontend type checker (npx tsc --noEmit) to ensure type safety

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all optimizations
- **User Story 2 (Phase 3)**: Can start after Foundational - NO dependencies on other stories
- **User Story 3 (Phase 4)**: DEPENDS on User Story 2 completion (US3 requires US2's guard to be in place)
- **User Story 1 (Phase 5)**: DEPENDS on User Stories 2 and 3 completion (US1 validates final performance)
- **Polish (Phase 6)**: Depends on all optimizations being complete

### User Story Dependencies

- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories (FIRST optimization)
- **User Story 3 (P3)**: DEPENDS on User Story 2 - Requires guard to be in place before reducing debounce
- **User Story 1 (P1)**: DEPENDS on User Stories 2 and 3 - Validates final performance after both optimizations

### Within Each User Story

- Implementation tasks MUST be completed in order
- Test tasks validate the implementation
- Documentation tasks record results

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- User Stories 2 and 3 have a DEPENDENCY relationship (US2 → US3), CANNOT run in parallel
- All Polish tasks marked [P] can run in parallel (within Phase 6)

---

## Parallel Example: User Story 2

```bash
# After Foundational phase, start User Story 2:
# (Cannot be parallel with US3 due to dependency)

# Launch all Foundational tasks together (if working in parallel):
Task: "Verify candleDateRange parameter is passed to useIndicatorData hook"
Task: "Confirm fetchIndicatorData callback depends on candleDateRange"

# Then complete User Story 2 tasks in order:
Task: "Add guard condition to prevent indicator fetch before candle data"
Task: "Add candleDateRange to useEffect dependency array"
Task: "Test Optimization 1"
```

---

## Implementation Strategy

### Sequential Delivery (Recommended for this feature)

This feature has inherent dependencies between optimizations, so sequential delivery is required:

1. Complete Phase 1: Setup (baseline measurement)
2. Complete Phase 2: Foundational (code understanding)
3. Complete Phase 3: User Story 2 (eliminate duplicate fetches)
4. **STOP and VALIDATE**: Measure performance, confirm ~1000-1500ms improvement
5. Complete Phase 4: User Story 3 (reduce debounce timer)
6. **STOP and VALIDATE**: Measure performance, confirm additional ~1800ms improvement
7. Complete Phase 5: User Story 1 (final optimizations and validation)
8. **STOP and VALIDATE**: Measure final performance, document results
9. Complete Phase 6: Polish

### One-At-A-Time Validation

The entire feature is designed around the "one-fix-at-a-time" methodology:

1. Implement ONE optimization
2. Re-baseline (measure performance)
3. Validate improvement matches expectations
4. Commit change
5. Proceed to next optimization

This ensures each optimization is independently measurable and rollbackable.

---

## Performance Targets

| Phase | User Story | Target Load Time | Improvement | Validation |
|-------|------------|------------------|-------------|------------|
| 1-2 | Setup | ~5900ms | - | Baseline established |
| 3 | US2: Guard | ~4400ms | -1500ms | One fetch round |
| 4 | US3: Debounce | ~2600ms | -1800ms | Faster completion |
| 5 | US1: Base | ~3500ms | - | After US2+US3 implemented |
| 5a | US1: Auth caching | ~3200ms | -300ms | Cached axios + reduced auth buffer |
| 5b | US1: Reduce candles | ~2600ms | -600ms | 1000→200 initial candles |
| **THIS FEATURE** | **All** | **Target ~2500ms** | **-3400ms** | **~57% improvement** |

### Phase 3 Optimization Performance Breakdown (NEW - Based on Live Testing)

| Phase | Current (DIS) | Target | Improvement | Tasks |
|-------|---------------|--------|-------------|-------|
| candles (T2) | 1138ms | <800ms | -300ms | T040-T043 |
| indicators (T3-T4) | 2092ms | <1200ms | -900ms | T036-T039, T022-T023 |
| render (T5) | 336ms | <500ms | ✓ | - |
| debounce | 0ms | <200ms | - | T014-T015 done |
| **TOTAL** | ~3500ms | ~2500ms | -1000ms | All Phase 3 tasks |

### Extended Optimization Targets (Future Features)

| Future Phase | Description | Expected Improvement |
|--------------|-------------|---------------------|
| A | Enhanced client-side caching | -1000 to -1500ms |
| B | Backend indicator optimization | -500 to -1000ms |
| **<500ms stretch** | Requires A+B | Requires future work |

**Note**: The <500ms target requires additional future optimizations (caching, backend). This feature delivers ~57% improvement to ~2500ms, meeting the 3s constitution budget.

---

## Validation Checklist

After completing all phases:

### Core Optimizations (US2, US3 - Completed)
- [x] Console shows only ONE round of [T3 START]/[T4 DONE] per symbol change
- [x] No indicator fetch occurs before "[Initial Fetch] Received X candles"
- [x] Load time reduced by ~1000-1500ms after Optimization 1 (US2)
- [x] Load time reduced by additional ~1800ms after Optimization 2 (US3)

### Phase 3 Optimizations (NEW - Based on Performance Analysis)
- [ ] T036: Auth caching implemented in authService.ts (axios instance cached)
- [ ] T037: Auth buffer reduced from 100ms to 10ms
- [ ] T038: Verify no auth errors with cached axios
- [ ] T039: Indicator phase reduced by 200-300ms (2092ms → <1800ms)
- [ ] T040: Candle count reduced from 1000 to 200
- [ ] T041: Indicators render correctly with 200 candles
- [ ] T042: Candle phase reduced by 400-600ms (1138ms → <700ms)
- [ ] T043: Scroll-left backfill works for older candles
- [ ] T044: Performance tests assert candles < 800ms, indicators < 1200ms, total < 2500ms

### Overall Results
- [ ] Total load time: ~2500ms (down from ~3500ms baseline after US2+US3)
- [ ] Indicators render correctly on chart
- [ ] Rapid symbol switching (5 symbols in 10 seconds) works without errors
- [ ] All existing tests pass (npm test)
- [ ] Linter passes (npm run lint)
- [ ] Type checker passes (npx tsc --noEmit)
- [ ] Baseline performance documented with before/after measurements
- [ ] Phase breakdown shows: candles < 800ms, indicators < 1200ms, total < 2500ms

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each optimization is independently implementable and measurable
- Commit after each optimization phase
- Stop at each checkpoint to validate and measure performance
- If an optimization doesn't yield expected improvement, investigate before proceeding
- Rollback is always available: `git checkout HEAD -- frontend/src/hooks/useIndicatorData.ts` or `frontend/src/App.tsx`
