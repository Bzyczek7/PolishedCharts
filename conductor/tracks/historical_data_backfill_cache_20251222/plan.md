# Plan: Historical Data Backfill & Cache

## Phase 1: Persistence Layer & API Stubs [checkpoint: 7cd28c9]
- [x] Task: Create SQLAlchemy models for `Candle` (composite PK: symbol, interval, timestamp) and `BackfillJob` fbc0105
- [x] Task: Implement repository logic with `INSERT ... ON CONFLICT DO UPDATE` for idempotent database-level upserts 2cf6031
- [x] Task: Write Unit Tests for Repository: verify idempotency, range read ordering, and duplicate prevention 71769fd
- [x] Task: Implement `GET /api/v1/candles` (Local-only: returns existing DB data without gap filling) 59ce98a
- [x] Task: Implement `POST /api/v1/candles/backfill` and `/update-latest` as stubs with response schema placeholders (e.g., `{status, job_id}`) 0e31895
- [x] Task: Write Integration Tests for API: verify basic request/response flow and local data retrieval 9de5f06
- [x] Task: Conductor - User Manual Verification 'Phase 1: Persistence Layer & API Stubs' (Protocol in workflow.md) 7cd28c9

## Phase 2: yfinance Orchestrator & Dynamic Gap Filling [checkpoint: b0403f9]
- [x] Task: Create a central configuration for canonical intervals (mapping 60m to 1h) and best-effort lookback caps c93e8c0
- [x] Task: Implement venue-aware gap detection logic (Equities vs. Crypto rules) c0d0bfd
- [x] Task: Write Unit Tests for Gap Detection: verify missing bars are detected for 1h and weekends are ignored for equities c0d0bfd
- [x] Task: Implement yfinance downloader with chunked request windows and adaptive retry fallbacks (window shrinking) e8699ba
- [x] Task: Write Unit Tests for Downloader: verify chunking behavior, retries, and window shrinking on failure e8699ba
- [x] Task: Integrate downloader into `GET /api/v1/candles` to enable transparent gap filling (up to hard cap) with timeout protection 234394e
- [x] Task: Write Integration Tests for Gap Filling: verify missing bars are fetched and upserted during GET requests e89c797
- [x] Task: Conductor - User Manual Verification 'Phase 2: yfinance Orchestrator & Gap Filling' (Protocol in workflow.md) b0403f9
## Phase 3: Background Workers & Concurrency
- [x] Task: Implement worker task lifecycle management (store task handles, add `done_callback`, and handle graceful shutdown) 322ecba
- [x] Task: Implement backfill worker logic using the `BackfillJob` table for coordination and error state tracking cf67524
- [x] Task: Implement incremental update task that pulls latest candles for active symbols at a controlled cadence f30590d
- [ ] Task: Add rate-limiting and backoff decorators for all yfinance interactions to prevent IP blocks
- [ ] Task: Write Unit/Integration Tests for Workers: verify job state transitions and robust exception handling
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Background Workers & Concurrency' (Protocol in workflow.md)

## Phase 4: Frontend Integration & Stress Testing
- [ ] Task: Update frontend `getCandles` service to capture chart visible range from Lightweight Charts `timeScale` events
- [ ] Task: Pass ISO-8601 `from`/`to` parameters to `/api/v1/candles` based on requested range
- [ ] Task: Implement "Scroll Left" behavior to trigger on-demand fetching of older historical ranges
- [ ] Task: Stress test deep historical scrolling (e.g., Aug 2025 daily) to confirm zero duplicates and seamless stitching
- [ ] Task: Verify sub-second chart loading for fully cached symbol/interval datasets
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Frontend Integration & Stress Testing' (Protocol in workflow.md)
