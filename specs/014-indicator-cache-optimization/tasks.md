# Implementation Tasks: Indicator API Performance Optimization

**Feature Branch**: `014-indicator-cache-optimization`
**Created**: 2026-01-02
**Status**: Ready for Implementation
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

Optimize indicator API performance from ~325ms to <100ms for cached requests by implementing:
1. Indicator result caching (FR-001)
2. Candle data caching (FR-002)
3. Batch API endpoint (FR-004)
4. Cache invalidation (FR-003)
5. Database index verification (FR-013)

**Performance Targets**: <100ms cached, <500ms uncached, <200ms batch of 3, >70% cache hit rate

## Task Summary

- **Total Tasks**: 63 (60 original + 3 cache failure tests)
- **Phase 1 (Setup)**: 4 tasks (T001-T004)
- **Phase 2 (Foundational)**: 6 tasks (T005-T010)
- **Phase 3 (US1: Fast Indicator Loading)**: 17 tasks (T011-T027)
- **Phase 4 (US2: Batch Loading)**: 14 tasks (T028-T041)
- **Phase 5 (US3: Concurrent Access)**: 6 tasks (T042-T047)
- **Phase 6 (Cache Invalidation)**: 4 tasks (T048-T051)
- **Phase 7 (Database Optimization)**: 4 tasks (T052-T055)
- **Phase 8 (Polish)**: 8 tasks (T056-T063)

## Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1: Fast Indicator Loading) ← MVP CORE
    ↓
Phase 4 (US2: Batch Loading)
    ↓
Phase 5 (US3: Concurrent Access)
    ↓
Phase 6 (Polish)
```

**MVP Scope**: Phases 1-3 (Setup + Foundational + User Story 1)
**Parallel Opportunities**: Marked with [P] tag

---

## Phase 1: Setup & Configuration

**Goal**: Configure cache infrastructure with interval-based TTL

### Tasks

- [X] T001 Add `cache_ttl_by_interval` dictionary to PerformanceSettings class in backend/app/core/performance_config.py
- [X] T002 Add `get_cache_ttl_for_interval(interval: str) -> int` helper function in backend/app/core/performance_config.py
- [X] T003 Add `generate_candle_cache_key()` function in backend/app/services/cache.py
- [X] T004 Add `get_candle_data()` and `cache_candle_data()` functions in backend/app/services/cache.py

**Completion Criteria**:
- Configuration can be imported without errors
- Cache key generation produces consistent results for same inputs
- TTL lookup returns correct values for all intervals

---

## Phase 2: Foundational (Cache Layer)

**Goal**: Implement candle caching before user stories (blocks all indicator caching)

### Tasks

- [X] T005 [P] Write unit test `test_candle_cache_key_generation()` in backend/tests/services/test_cache.py
- [X] T006 [P] Write unit test `test_candle_cache_set_and_get()` in backend/tests/services/test_cache.py
- [X] T007 [P] Write unit test `test_candle_cache_expiration()` in backend/tests/services/test_cache.py
- [X] T008 Integrate candle cache into `orchestrator.get_candles()` method in backend/app/services/orchestrator.py (check cache before DB query)
- [X] T009 Add cache miss logging with performance_logger in backend/app/services/orchestrator.py
- [X] T010 Add cache result storage after successful DB query in backend/app/services/orchestrator.py

**Completion Criteria**:
- All cache tests pass
- Candle requests check cache before database
- Cache hits return in <10ms
- Cache misses trigger database query and store result

---

## Phase 3: User Story 1 - Fast Indicator Loading (P1)

**User Story**: As a trader, I want indicator data to load instantly (<100ms) when I add indicators

**Independent Test**: Measure time from "Add Indicator" click to chart display. Target: <100ms

**Acceptance Scenarios**:
1. Add new indicator → displays within 100ms
2. Change indicator parameter → recalculated within 100ms
3. Add same indicator twice → second load within 50ms (cached)
4. Switch symbols and return → indicators load within 100ms

### Tasks

#### Schema & Models

- [X] T011 [P] [US1] Create `IndicatorRequest` Pydantic model in backend/app/schemas/indicator.py
- [X] T012 [P] [US1] Create `ErrorDetail` Pydantic model in backend/app/schemas/indicator.py
- [X] T013 [P] [US1] Create `BatchIndicatorRequest` Pydantic model in backend/app/schemas/indicator.py
- [X] T014 [P] [US1] Create `BatchIndicatorResponse` Pydantic model in backend/app/schemas/indicator.py

#### Tests (TDD per Constitution V)

- [X] T015 [P] [US1] Write unit test `test_indicator_cache_key_generation()` in backend/tests/services/test_cache.py
- [X] T016 [P] [US1] Write unit test `test_indicator_cache_key_params_order()` in backend/tests/services/test_cache.py
- [X] T017 [P] [US1] Write unit test `test_indicator_cache_set_and_get()` in backend/tests/services/test_cache.py
- [X] T018 [P] [US1] Write unit test `test_indicator_cache_invalidation()` in backend/tests/services/test_cache.py

#### Implementation

- [X] T019 [US1] Integrate indicator cache check in `get_indicator()` endpoint in backend/app/api/v1/indicators.py (before candle fetch)
- [X] T020 [US1] Add indicator result storage after calculation in backend/app/api/v1/indicators.py
- [X] T021 [US1] Add cache hit/miss logging with performance_logger in backend/app/api/v1/indicators.py
- [X] T022 [US1] Add graceful error handling for cache failures (fallback to DB) in backend/app/api/v1/indicators.py

#### Edge Case Tests (Cache Failures)

- [X] T022a [P] [US1] Write unit test `test_cache_get_failure_falls_back_to_db()` in backend/tests/services/test_cache.py
- [X] T022b [P] [US1] Write unit test `test_cache_set_failure_continues_without_error()` in backend/tests/services/test_cache.py
- [X] T022c [P] [US1] Write integration test `test_unavailable_database_returns_user_friendly_error()` in backend/tests/api/test_indicators.py

#### Integration Tests

- [X] T023 [P] [US1] Write integration test `test_cached_indicator_p90_under_100ms()` in backend/tests/api/test_indicators.py (measure 90th percentile of 50 samples)
- [X] T024 [P] [US1] Write integration test `test_uncached_indicator_p90_under_500ms()` in backend/tests/api/test_indicators.py (measure 90th percentile of 50 samples)

**Completion Criteria**:
- Cached indicator requests complete in <100ms (90th percentile), targeting <50ms median
- Uncached indicator requests complete in <500ms (90th percentile)
- Second request for same indicator completes in <50ms (cached)
- Cache invalidation removes entries correctly
- Cache failures gracefully fall back to database queries
- All tests pass

---

## Phase 4: User Story 2 - Batch Indicator Loading (P2)

**User Story**: As a trader, I want to add multiple indicators at once with total time <200ms

**Independent Test**: Add 3 indicators simultaneously, measure total time. Target: <200ms

**Acceptance Scenarios**:
1. Add 3 different indicators → all display within 200ms total
2. Multiple indicators same symbol, different params → each calculated independently
3. One indicator fails → others still return with clear error messaging

### Tasks

#### Tests (TDD per Constitution V)

- [X] T028 [P] [US2] Write unit test `test_batch_request_validation()` in backend/tests/api/test_indicators.py (max 10 items)
- [X] T029 [P] [US2] Write unit test `test_batch_cache_check_first()` in backend/tests/api/test_indicators.py
- [X] T030 [P] [US2] Write unit test `test_batch_parallel_processing()` in backend/tests/api/test_indicators.py
- [X] T031 [P] [US2] Write unit test `test_batch_partial_failure()` in backend/tests/api/test_indicators.py

#### Implementation

- [X] T032 [US2] Create `calculate_batch_indicators()` endpoint function in backend/app/api/v1/indicators.py
- [X] T033 [US2] Implement request validation (1-10 items) in backend/app/api/v1/indicators.py
- [X] T034 [US2] Implement cache-first check for all batch requests in backend/app/api/v1/indicators.py
- [X] T035 [US2] Implement parallel processing with asyncio.gather() in backend/app/api/v1/indicators.py
- [X] T036 [US2] Implement deduplication logic for identical requests in backend/app/api/v1/indicators.py
- [X] T037 [US2] Add timeout protection (5 second max) in backend/app/api/v1/indicators.py
- [X] T038 [US2] Implement partial failure handling (continue on individual errors) in backend/app/api/v1/indicators.py
- [X] T039 [US2] Add performance logging (cache_hits, cache_misses, duration_ms) in backend/app/api/v1/indicators.py

#### Integration Tests

- [X] T040 [P] [US2] Write integration test `test_batch_endpoint_returns_3_indicators()` in backend/tests/api/test_indicators.py
- [X] T041 [P] [US2] Write integration test `test_batch_3_indicators_p90_under_200ms()` in backend/tests/api/test_indicators.py (measure 90th percentile of 50 samples)

**Completion Criteria**:
- Batch of 3 indicators completes in <200ms (90th percentile)
- Batch requests up to 10 items work correctly
- Partial failure returns successful results + error details
- Deduplication prevents redundant calculations
- All tests pass

---

## Phase 5: User Story 3 - High-Volume Concurrent Access (P3)

**User Story**: As a system, support 50 concurrent users without degradation beyond 2 seconds

**Independent Test**: Simulate 50 concurrent indicator requests. Target: all complete within 2 seconds

**Acceptance Scenarios**:
1. 50 users simultaneously request indicators → each completes within 2 seconds
2. Cache under heavy load (expirations/evictions) → graceful fallback to DB
3. Multiple users request same indicator → share cached results

### Tasks

#### Implementation

- [ ] T042 [US3] Verify database connection pool sizing in backend/app/db/session.py (support 50+ concurrent connections)
- [ ] T043 [US3] Add cache statistics collection in backend/app/services/cache.py (track eviction rate)
- [ ] T044 [US3] Implement cache health check endpoint GET /api/v1/cache/stats in backend/app/api/v1/indicators.py

#### Tests

- [ ] T045 [P] [US3] Write load test `test_50_concurrent_indicator_requests()` in backend/tests/load/test_concurrent_indicators.py
- [ ] T046 [P] [US3] Write load test `test_cache_eviction_rate_below_10_percent()` in backend/tests/load/test_cache_eviction.py
- [ ] T047 [P] [US3] Write integration test `test_concurrent_users_share_cached_results()` in backend/tests/integration/test_cache_sharing.py

**Completion Criteria**:
- 50 concurrent requests complete within 2 seconds each
- Cache eviction rate <10% per hour under load
- Multiple users share cached results (no duplicate calculations)
- Cache stats endpoint returns accurate metrics
- All tests pass

---

## Phase 6: Cache Invalidation (Cross-Story)

**Goal**: Invalidate cached indicators when candle data updates

### Tasks

- [ ] T048 Find candle save points in backend/app/services/data_updater.py
- [ ] T049 Add `invalidate_symbol()` call after candle save in backend/app/services/data_updater.py
- [ ] T050 Write integration test `test_cache_invalidation_on_candle_update()` in backend/tests/integration/test_cache_invalidation.py
- [ ] T051 Verify TTL-based expiration works as fallback in backend/tests/services/test_cache.py

**Completion Criteria**:
- Candle updates trigger cache invalidation for affected symbol
- Invalidated indicators recalculate on next request
- TTL expiration acts as safety net

---

## Phase 7: Database Optimization (Cross-Story)

**Goal**: Verify database indexes for <100ms query time

### Tasks

- [ ] T052 Check existing candle table indexes in PostgreSQL (query pg_indexes)
- [ ] T053 Create index migration if missing: alembic revision -m "add_candle_performance_index" in backend/
- [ ] T054 Run EXPLAIN ANALYZE on candle query to verify index usage in backend/
- [ ] T055 Write benchmark test comparing query time before/after index in backend/tests/benchmarks/test_db_query.py

**Completion Criteria**:
- Composite index exists on (symbol_id, interval, timestamp)
- Query execution uses index scan (not sequential scan)
- Query time <100ms for typical request

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Documentation, monitoring, edge cases

### Tasks

- [ ] T056 Add docstring to batch endpoint with performance targets in backend/app/api/v1/indicators.py
- [ ] T057 Add cache statistics endpoint response example to API documentation
- [ ] T058 Update CLAUDE.md with cache configuration details in /home/marek/DQN/TradingAlert/
- [ ] T059 Add troubleshooting section to quickstart.md for cache issues
- [ ] T060 Run all unit tests: pytest backend/tests/ -v
- [ ] T061 Run all integration tests: pytest backend/tests/integration/ -v
- [ ] T062 Run all benchmarks: pytest backend/tests/benchmarks/ -v
- [ ] T063 Run final end-to-end performance test with 3 indicators

**Completion Criteria**:
- All tests pass (unit, integration, benchmark)
- Documentation is complete and accurate
- Performance targets met across all scenarios
- No regressions in existing functionality

---

## Parallel Execution Examples

### Within Phase 3 (US1)
```bash
# Schema tasks can run in parallel (different models)
async { T011 & T012 & T013 & T014 }

# Test tasks can run in parallel (different test files)
async { T015 & T016 & T017 & T018 & T022a & T022b & T022c }

# Integration tests can run in parallel
async { T023 & T024 }
```

### Within Phase 4 (US2)
```bash
# Tests can run in parallel
async { T028 & T029 & T030 & T031 }

# Integration tests can run in parallel
async { T040 & T041 }
```

### Within Phase 5 (US3)
```bash
# Load tests can run in parallel
async { T045 & T046 & T047 }
```

---

## Implementation Strategy

### MVP First (Phases 1-3)

**MVP delivers**:
- Candle data caching (eliminates 300ms DB query)
- Indicator result caching (eliminates redundant calculations)
- Fast indicator loading (<100ms for cached requests)
- Cache invalidation on candle updates

**MVP value**: Primary user pain point addressed - indicators load instantly

### Incremental Delivery

**Sprint 2**: Add batch endpoint (Phase 4)
- Enables multi-indicator workflows
- Reduces total time for power users

**Sprint 3**: Concurrent access optimization (Phase 5)
- Ensures platform scales to multiple users
- Validates cache behavior under load

**Sprint 4**: Polish and production hardening (Phases 6-8)
- Database optimization
- Comprehensive monitoring
- Production readiness

---

## Format Validation

**All tasks follow checklist format**:
- ✅ Start with `- [ ]`
- ✅ Include Task ID (T001-T060)
- ✅ [P] marker for parallelizable tasks
- ✅ [US1], [US2], [US3] labels for user story tasks
- ✅ Clear description with file path
- ✅ No tasks without IDs
- ✅ No tasks without checkboxes

---

## Success Criteria Validation

| Success Criterion | Verification |
|-------------------|--------------|
| SC-001: <100ms cached | T023 integration test measures 90th percentile response time |
| SC-002: <500ms uncached | T024 integration test measures 90th percentile response time |
| SC-003: <200ms batch of 3 | T041 integration test measures 90th percentile batch time |
| SC-004: >70% cache hit rate | T046 load test measures hit rate |
| SC-005: 50 concurrent users | T045 load test with 50 concurrent requests |
| SC-006: <10% evictions/hour | T046 eviction rate test |
| SC-007: DB query <100ms | T054 EXPLAIN ANALYZE + T055 benchmark |
| SC-008: User latency <150ms | T023/T024/T041 combined measurements |

---

**Generated**: 2026-01-02
**Updated**: 2026-01-02 (remediated analysis findings)
**Ready for Implementation**: Yes
**MVP Scope**: Phases 1-3 (Tasks T001-T027)
