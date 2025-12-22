# Specification: Historical Data Management & Indicator Visual Parity

## 1. Overview
This track implements a robust local candle storage system to enable instant chart loading and incremental data fetching. Simultaneously, it brings TDFI and cRSI visualizations to TradingView parity by implementing threshold-driven line segment coloring and rendering reference levels (e.g., ±0.05, 30/70) using the charting API.

## 2. Functional Requirements

### 2.1. Historical Data Store & Caching
- **Local Persistence:** Implement a `candles` table/store keyed by `(symbol, interval, timestamp)` with idempotent upsert.
- **Intervals & Lookback:**
    - Support: `1m, 5m, 15m, 1h, 1d, 1wk, 1mo`.
    - **Note:** Backfill depth is interval-dependent. `1m` is often ~7 days. Per `yfinance` constraints, "Intraday data cannot extend last 60 days." The system must fallback gracefully to the maximum supported window.
- **Provider Strategy:**
    - **Backfill:** Use `yfinance` for bulk history.
    - **Incremental:** Use Alpha Vantage (or similar) for the "latest" tail.
- **Stitching & Merging:** Requests should be stitched by fetching only missing segments (including head, tail, and middle gaps), then merging and deduping by `(symbol, interval, timestamp)`.

### 2.2. Indicator Visual Parity (TDFI & cRSI)
- **Threshold-Driven Regime Coloring:**
    - The frontend will compute colors using thresholds (e.g., `filterHigh`, `filterLow`) when `color_mode="threshold"` in metadata.
    - **TDFI Rendering (TradingView Parity):** TDFI will be rendered as a **line**. To achieve regime coloring, the renderer will implement **three separate line series** (Above High, Neutral, Below Low) driven by the thresholds.
- **Reference Levels:**
    - `IndicatorPane` must explicitly call `createPriceLine` for all entries in `metadata.reference_levels` (e.g., cRSI 30/70, TDFI ±0.05).
    - Lines must use a **dashed style**.
- **Metadata Schema Update:**
    - Backend must send `thresholds`, `color_mode`, `line_style` (solid/dashed), and `line_width`.

## 3. Non-Functional Requirements
- **Price Line Management:** Prevent duplicate price lines by tracking created line handles in React refs. On every update or prop change, the component must iterate through these handles, call `removePriceLine` on the series, and then rebuild the lines to ensure a clean state.
- **API Resilience:** 
    - Implement throttling and exponential backoff for incremental updates.
    - Treat provider limits (especially Alpha Vantage free-tier) as **configurable**.
    - Robustly handle "rate limit exceeded" responses with retry/backoff.
- **Data Handling:** `formatDataForChart` currently drops nulls; "whitespace points" for gaps are considered out of scope for this track.

## 4. Acceptance Criteria
- [ ] **1d History:** Users can backfill to at least August 2025.
- [ ] **1h History:** System attempts backfill up to ~730 days where provider allows; fallback is graceful.
- [ ] **Intraday (1m/5m/15m):** Backfill succeeds within provider constraints (7-60 days).
- [ ] **Cache Efficiency:** Cached candles are served instantly without redundant upstream API calls.
- [ ] **TDFI Parity:** TDFI displays dynamic regime coloring (Green/Red/Gray) via the 3-series line implementation.
- [ ] **Reference Level Integrity:** `IndicatorPane` renders dashed reference levels that do not "stack" or duplicate.

## 5. Out of Scope
- Implementation of "whitespace points" for indicator gaps.
- Multi-provider data averaging.
