# Plan: Historical Data Management & Indicator Visual Parity

## Phase 1: Data Store & API Contract [checkpoint: ]
- [x] Task: Create SQLAlchemy migration for expanded `candles` table including `interval` column and unique constraint on `(symbol_id, interval, timestamp)`. 1a39a11
- [ ] Task: Implement `CandleService.upsert_candles` with bulk operations and locking to prevent duplicate concurrent backfills.
- [ ] Task: Define Range Semantics: Establish UTC timestamps, inclusive bounds, and default window behavior (last 300 bars) for omitted `from/to`.
- [ ] Task: Write failing tests for idempotent upsert and multi-segment gap detection (Head, Tail, and Middle Gaps) (Red Phase).
- [ ] Task: Implement gap detection logic to identify missing segments, including holes between existing data points (Green Phase).
- [ ] Task: Update Backend API: Define `GET /candles` parameters and update the endpoint to use the orchestrator.
- [ ] Task: Conductor - User Manual Verification 'Data Store & API Contract' (Protocol in workflow.md)

## Phase 2: Orchestration & UI Wiring [checkpoint: ]
- [ ] Task: Implement `YFinanceProvider` with per-interval chunking and explicit handling for interval-specific lookback limits.
- [ ] Task: Implement `AlphaVantageProvider` with configurable rate limits and "Rate Exceeded" detection.
- [ ] Task: Write failing tests for the Missing Middle stitching logic, verifying the orchestrator fills holes without redundant re-fetches (Red Phase).
- [ ] Task: Add Provider Truth integration tests to validate that intraday limits are enforced per-interval (e.g., 1m lookback < 1h lookback) (Red Phase).
- [ ] Task: Implement the `DataOrchestrator` to coordinate multi-segment fetching and deduplicated merging.
- [ ] Task: Update Frontend: Add timeframe selection state and update `getCandles()` for interval/range-based requests.
- [ ] Task: Implement exponential backoff and retry scheduling for providers (Green Phase).
- [ ] Task: Conductor - User Manual Verification 'Orchestration & UI Wiring' (Protocol in workflow.md)

## Phase 3: Metadata & Indicator Transforms [checkpoint: ]
- [ ] Task: Extend backend Pydantic schemas to support `thresholds`, `color_mode`, and line styling.
- [ ] Task: Update TDFI service to calculate and return thresholds and regime metadata (Above/Neutral/Below colors).
- [ ] Task: Create a reusable `indicatorTransform` utility layer in the frontend to handle multi-series splitting logic.
- [ ] Task: Write failing tests for splitting a single TDFI series into three regime-based segments driven by thresholds (Red Phase).
- [ ] Task: Wire the transformation layer into `App.tsx` to prepare data for the parity renderer (Green Phase).
- [ ] Task: Conductor - User Manual Verification 'Metadata & Indicator Transforms' (Protocol in workflow.md)

## Phase 4: Stable Rendering & Price Lines [checkpoint: ]
- [ ] Task: Refactor `IndicatorPane` to use stable `seriesId` keys instead of index-based keys to prevent visual glitches.
- [ ] Task: Implement the explicit "removePriceLine + Rebuild" mechanism in `IndicatorPane` using refs for deterministic cleanup.
- [ ] Task: Update `IndicatorPane` to render the three TDFI line series sharing a single vertical price scale and shared autoscale logic.
- [ ] Task: Write failing tests for Price Line cleanup and series ID stability (Red Phase).
- [ ] Task: Implement the full parity rendering logic in `IndicatorPane` driven by `metadata.reference_levels` and `metadata.scale_ranges` (Green Phase).
- [ ] Task: Conductor - User Manual Verification 'High-Fidelity Pane Rendering' (Protocol in workflow.md)

## Phase 5: Verification & Stress Testing [checkpoint: ]
- [ ] Task: Verify 1d backfill to August 2025 and 1h backfill depth (~730 days) across multiple symbols.
- [ ] Task: Middle Gap Verification: Manually simulate a data hole in the DB and confirm the system fetches only the missing segment.
- [ ] Task: Stress Test: Repeatedly scroll left to trigger consecutive stitched fetches; confirm zero duplicate candles and zero UI freezes.
- [ ] Task: Manual Visual QA: Compare TDFI coloring and cRSI 30/70 levels against TradingView reference.
- [ ] Task: Conductor - User Manual Verification 'Verification & Stress Testing' (Protocol in workflow.md)
