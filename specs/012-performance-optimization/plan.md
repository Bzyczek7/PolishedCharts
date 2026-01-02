# Implementation Plan: Chart and Indicator Performance Optimization

**Branch**: `012-performance-optimization` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-performance-optimization/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement comprehensive performance monitoring and sequential bottleneck optimization for the TradingAlert application. The approach is to measure first (identify top 5 bottlenecks), then optimize one bottleneck at a time, verifying improvement after each fix.

**Technical Approach**:
1. Add in-memory performance logging infrastructure (frontend and backend)
2. Generate performance reports identifying top bottlenecks by duration
3. Implement fixes sequentially: candle caching → indicator batch API → rendering optimization
4. Verify each fix improves performance by >= 30% before moving to next

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**: FastAPI 0.104+, SQLAlchemy 2.0+, React 19, lightweight-charts 5.1.0
**Storage**: PostgreSQL (existing), In-memory (new - for performance logs and caching)
**Testing**: pytest (backend), Vitest (frontend), existing performance test infrastructure
**Target Platform**: Web browser (Chrome, Firefox, Edge)
**Project Type**: web (frontend + backend)

**Performance Goals**:
- Initial chart load: 3 seconds (Constitution VI, SC-003)
- Indicator calculation: 1 second (FR-012, SC-004)
- Symbol switch (cached): 1 second (SC-005)
- 5 indicators total: 5 seconds (SC-006)
- UI feedback: 200ms (FR-013, SC-007)
- No single operation > 20% of total load time (SC-008)

**Constraints**:
- Single-user context (no multi-user concurrent optimization needed)
- Memory budget: 500MB for 5 symbols / 20 alerts (Constitution VI)
- No external APM services (use browser-native Performance API)
- Offline-capable (local-first principle)

**Scale/Scope**:
- Standard date range: 2 years of daily data (~500 candles)
- Standard indicators: 5-10 indicators per chart
- Watchlist: 10-20 symbols

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior - *existing feature maintained*
- [ ] UI changes include before/after verification - *N/A for performance feature*
- [x] Performance budgets: 60fps panning, 3s initial load - *defined in goals*

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented - *existing, not modified*
- [x] Deduplication strategy: database constraints or idempotent inserts - *existing, not modified*
- [x] Alert semantics: above/below/crosses defined with edge cases tested - *existing, not modified*
- [x] Gap handling: explicit marking and backfill strategy - *existing, not modified*

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count - *existing, not modified*
- [x] Alert evaluation performance budgeted (500ms) - *existing, monitored*
- [x] Graceful degradation defined for high alert volumes - *existing, not modified*

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally - *enhanced with in-memory caching*
- [x] Offline behavior: charts, alerts, history remain accessible - *existing, not modified*
- [x] Provider error handling: graceful degradation with user feedback - *existing, not modified*

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization) - *existing, performance logging added non-invasively*
- [x] Bug fixes include regression tests - *existing practice continues*
- [x] CI includes: lint, typecheck, unit, integration tests - *existing, not modified*

### Performance Budgets

- [x] Initial chart load: 3 seconds - *target defined*
- [x] Price update latency: 2 seconds - *existing, monitored*
- [x] Alert evaluation: 500ms - *existing, monitored*
- [x] UI panning: 60fps - *existing, verified*
- [x] Memory: 500MB for 5 symbols / 20 alerts - *monitored with new logging*

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern - *existing, not modified*
- [x] Data providers implement common interface - *existing, not modified*
- [x] Provider-specific logic isolated from UI - *existing, not modified*

### Security & Privacy

- [x] No telemetry or data upload without consent - *performance logs local only*
- [x] API keys stored securely (not in repo) - *existing, not modified*
- [x] Local data treated as sensitive - *performance logs local only*

### Governance

- [x] If any principle violated: justification in Complexity Tracking - *no violations*
- [x] Constitution supersedes spec/plan conflicts - *verified, no conflicts*

## Project Structure

### Documentation (this feature)

```text
specs/012-performance-optimization/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - Research findings
├── data-model.md        # Phase 1 output - Performance logging data model
├── quickstart.md        # Phase 1 output - Implementation quickstart guide
├── contracts/           # Phase 1 output - API contracts
│   └── performance-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```text
# Option 2: Web application
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── performance.py       # NEW: Performance monitoring endpoints
│   ├── services/
│   │   ├── performance.py           # NEW: Performance logging utilities
│   │   └── cache.py                 # NEW: In-memory caching layer
│   └── core/
│       └── performance_config.py    # NEW: Performance thresholds config
├── tests/
│   ├── performance/                 # NEW: Performance test suite
│   │   ├── test_frontend_api.py
│   │   └── test_caching.py
│   └── benchmarks/
│       └── test_api_performance.py  # NEW: API performance benchmarks
└── requirements.txt                 # UPDATE: Add any new dependencies

frontend/
├── src/
│   ├── lib/
│   │   ├── performance.ts           # NEW: Performance logging utilities
│   │   ├── performanceStore.ts      # NEW: In-memory log storage
│   │   ├── candleCache.ts           # NEW: Candle data cache
│   │   └── indicatorCache.ts        # NEW: Indicator result cache
│   ├── components/
│   │   └── PerformanceReport.tsx    # NEW: Performance report UI
│   ├── hooks/
│   │   ├── useCandleData.ts         # MODIFY: Add performance logging
│   │   └── useIndicatorData.ts      # MODIFY: Add performance logging
│   └── api/
│       └── performance.ts           # NEW: Performance API client
└── tests/
    ├── performance/                 # NEW: Frontend performance tests
    │   ├── test_performance_logging.test.ts
    │   └── test_caching.test.ts
    └── benchmarks/
        └── test_chart_load.test.ts  # NEW: Chart load benchmarks
```

**Structure Decision**: Web application (existing structure). New files added for performance monitoring without modifying existing core architecture.

## Complexity Tracking

> No constitution violations - this section is empty

## Implementation Phases

### Phase 0: Research (COMPLETE)

**Output**: [research.md](./research.md)

Key findings:
- Existing performance tests use basic `performance.now()`
- No centralized performance logging infrastructure
- Identified potential bottlenecks: network round-trips, indicator calculation, chart rendering
- Decision: Browser-native Performance API + in-memory caching

### Phase 1: Design (COMPLETE)

**Outputs**:
- [data-model.md](./data-model.md) - Performance log and report data structures
- [contracts/performance-api.yaml](./contracts/performance-api.yaml) - API specification
- [quickstart.md](./quickstart.md) - Implementation guide

Design decisions:
- In-memory storage for performance logs (no database changes)
- Multi-tier caching (frontend browser cache + backend LRU)
- Statistical bottleneck identification (Pareto analysis)

### Phase 2: Task Generation (PENDING)

**Command**: `/speckit.tasks`

**Expected Task Count**: ~15-20 tasks across:
1. Performance logging infrastructure (frontend + backend)
2. Frontend caching implementation (candles + indicators)
3. Backend optimization (batch API, LRU cache)
4. Performance tests (unit + integration + benchmarks)
5. Bottleneck fixes (sequential, one at a time)

## Sequential Optimization Strategy

Per spec requirement (User Story 2), bottlenecks will be addressed **one at a time**:

1. **Audit**: Generate initial performance report, identify top 5 bottlenecks
2. **Fix #1**: Implement highest-impact fix (likely candle caching)
3. **Verify**: Re-measure, confirm >= 30% improvement
4. **Fix #2**: Next highest-impact fix
5. **Verify**: Re-measure
6. **Repeat**: Until all targets met

### Done Gate per Bottleneck (NON-NEGOTIABLE)

Each bottleneck fix must satisfy **ALL THREE** conditions before proceeding to next:

| Condition | Criteria | Measurement |
|-----------|----------|-------------|
| **Improvement** | >= 30% reduction in operation duration OR meets target threshold | Compare before/after p95 values from performance report |
| **No Regressions** | Each operation category (fetch/calc/render/ui) within ±10% of baseline per-category p95 | Degradation measured **per category**, not global total |
| **Stability** | Consistent across 3+ runs | p95 values must not vary by >20% between runs |

**Test Dataset (Standard Benchmark)**: All measurements use consistent dataset defined in Scale/Scope: 2 years daily candles (~500 bars), 5 indicators, watchlist of 20 symbols. This ensures apples-to-apples comparison across all runs.

*Rationale*: A fix that improves 30% but still fails success criteria (e.g., candle fetch drops from 5s to 3.5s but target is 3s) requires additional work before moving to next bottleneck. Per-category regression checking prevents gaming total load time (e.g., improving fetch by 40% but worsening render by 25% would fail the render category check).

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Backend API performance varies with external data source** | Performance measurements may be skewed by yfinance response times | Use mock data for frontend performance tests; separate external vs internal timing in reports |
| **Browser performance variance** | Results may differ across browsers (Chrome vs Firefox vs Edge) | Test across Chrome/Firefox/Edge matrix; **p95 is the tracked metric** (not averages) |
| **Baseline capture inconsistency** | Invalid comparisons if baselines aren't stable | **Standard rule: Minimum 3 runs, record p50/p95/p99, use p95 for all tracking** |
| **Cache invalidation complexity** | Stale cache data may show incorrect indicators | Implement TTL-based expiration + symbol/interval change eviction; add cache versioning |
| **Memory bloat from aggressive caching** | May exceed 500MB memory budget (Constitution VI) | Implement LRU eviction with size limits; monitor memory usage in performance logs |
| **Measurement overhead** | Performance logging itself may slow operations | Use passive monitoring where possible; sampling for high-frequency operations |
| **False positives in bottleneck detection** | May optimize non-critical paths | Require minimum sample count (3+) before flagging; manual review of reports |

## Timeline

**Estimated Duration**: 5-7 days total

### Breakdown

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 0**: Research | Analysis, tech decisions | 0.5 day (COMPLETE) |
| **Phase 1**: Design | Data model, contracts, quickstart | 0.5 day (COMPLETE) |
| **Phase 2**: Task Generation | `/speckit.tasks` command | 0.5 days |
| **Implementation**: Infrastructure | Performance logging, caching | 2 days |
| **Audit + Fix #1** | Initial report, first bottleneck | 1 day |
| **Fixes #2-5** | Sequential bottleneck resolution | 2-3 days (+1-2 days contingency if batch API or render pipeline needs refactor) |
| **Final Verification** | All success criteria met | 0.5 day |

### Milestones

1. **Day 1**: Performance logging infrastructure complete, initial audit report generated
2. **Day 2**: First bottleneck fixed and verified (>= 30% improvement)
3. **Day 4**: Three bottlenecks fixed
4. **Day 5-7**: Remaining bottlenecks fixed, all success criteria met

**Note**: Timeline assumes single developer focus on this feature. Adjust if context-switching with other work.

## Success Criteria Tracking

| Criterion | Target | Current | Status |
|-----------|--------|---------|--------|
| SC-001: Identify top 5 bottlenecks | Top 5 with actionable data | TBD | ⬜ |
| SC-002: 30% improvement per fix | >= 30% | TBD | ⬜ |
| SC-003: Chart load < 3s | 3s | TBD | ⬜ |
| SC-004: Single indicator < 1s | 1s | TBD | ⬜ |
| SC-005: Cached symbol switch < 1s | 1s | TBD | ⬜ |
| SC-006: 5 indicators < 5s | 5s | TBD | ⬜ |
| SC-007: UI feedback < 200ms | 200ms | TBD | ⬜ |
| SC-008: No operation > 20% total | < 20% | TBD | ⬜ |

## Dependencies

### Feature Dependencies
- Existing: `002-supercharts-visuals` (lightweight-charts integration)
- Existing: `003-advanced-indicators` (indicator calculation)
- Existing: `010-pandas-ta-indicators` (pandas-ta registry)

### External Dependencies (may need to add)
- None required (browser-native APIs sufficient)

### Internal Dependencies
- `backend/app/services/indicators.py` - for batch API
- `frontend/src/hooks/useCandleData.ts` - for candle caching
- `frontend/src/hooks/useIndicatorData.ts` - for indicator caching

## Next Steps

1. Run `/speckit.tasks` to generate dependency-ordered task list
2. Implement tasks sequentially using `/speckit.implement`
3. Run performance tests after each fix to verify improvement
4. Update success criteria table as progress is made
