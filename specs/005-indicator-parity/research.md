# Research: Indicator Parity Validation

**Feature**: 005-indicator-parity
**Date**: 2025-12-24
**Status**: Complete

## Overview

This document consolidates research findings for implementing the indicator parity validation infrastructure. The feature validates that implemented indicators (cRSI, TDFI, ADXVMA, EMA, SMA) match TradingView Supercharts reference implementation.

---

## Research Topic 1: Fixture Data Source

**Question**: Where to capture the golden candle data + indicator outputs?

### Options Evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Export from TradingView | Exact reference match | No API access, manual data entry error-prone |
| B | Backend yfinance + compute | Automated, reproducible | May differ from TradingView calculations |
| C | Manual entry | Full control | Extremely time-consuming, error-prone |

### Decision: **Option B - Backend yfinance + indicator computation**

**Rationale**:
1. The application already uses yfinance as the data provider (feature 004)
2. Automated generation ensures reproducibility and consistency
3. Any calculation differences can be documented as tolerances
4. Fixtures serve as "expected values for our implementation" rather than "exact TradingView clone"
5. Visual screenshot comparison will catch rendering differences regardless of calculation source

**Implementation Notes**:
- Use existing `backend/app/services/indicators.py` for indicator calculations
- Capture candles from yfinance with the same intervals used in production
- Compute cRSI, TDFI, ADXVMA, EMA(20), SMA(50) using the indicator service
- Store results as JSON fixtures in `/specs/005-indicator-parity/fixtures/`

**Alternatives Considered**:
- TradingView export was evaluated but found infeasible due to lack of public API
- Hybrid approach (TradingView for reference screenshots, yfinance for fixtures) provides best validation coverage

---

## Research Topic 2: Reference Screenshot Capture

**Question**: How to ensure consistent TradingView screenshots?

### Options Evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Manual browser capture | Simple, no tooling | Inconsistent positioning, manual effort |
| B | Browser automation (Puppeteer) | Consistent, reproducible | Complex setup, TradingView may block |
| C | TradingView screenshot API | Native, official | Not publicly available |

### Decision: **Option A - Manual browser capture with documentation**

**Rationale**:
1. TradingView does not provide a public screenshot API
2. Browser automation risks being blocked (TradingView detects headless browsers)
3. Manual capture with a documented process ensures consistency
4. Screenshots are reference material, not automated tests (MVP)
5. Future automation can use Playwright after manual baseline is established

**Process**:
1. Open TradingView Supercharts in browser
2. Load symbol (AAPL, TSLA, SPY) and set interval
3. Add indicator with default parameters
4. Set chart view to show approximately the same time range as fixture
5. Capture screenshot using browser DevTools or OS screenshot tool
6. Save with naming convention: `{fixture-id}-{indicator}.png`
7. Document capture settings (zoom level, visible range) in quickstart guide

**Screenshot Settings** (for consistency):
- Browser: Chrome or Firefox at 1920×1080 resolution
- Dark theme enabled
- Chart type: Candlesticks
- Time range: Match fixture timestamp range
- Indicator settings: Default parameters as documented in 003 spec

**Future Enhancement**: Use Playwright or similar for automated screenshot capture after manual baseline is established.

---

## Research Topic 3: Fixture Loader Integration Point

**Question**: Where to inject fixture data in the frontend?

### Options Evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | API layer mock (MSW) | Standard testing practice | Adds dependency, overhead |
| B | Service layer override | Minimal code change | Tightly coupled to implementation |
| C | Environment flag + URL check | Simple, explicit | Requires conditional logic |

### Decision: **Option C - Environment flag with conditional fixture loading**

**Rationale**:
1. Minimal code changes - single flag check (`VITE_FIXTURE_MODE`)
2. Explicit behavior - easy to understand when fixtures are active
3. No additional dependencies (MSW not required for MVP)
4. Can be enabled via `VITE_FIXTURE_MODE=aapl-1d-100` environment variable
5. Fixture loader module (`frontend/src/lib/fixtureLoader.ts`) provides clean interface

**Implementation**:
```typescript
// frontend/src/lib/fixtureLoader.ts
export function isFixtureMode(): boolean {
  return !!import.meta.env.VITE_FIXTURE_MODE;
}

export async function loadFixture(fixtureId: string): Promise<FixtureData> {
  const response = await fetch(`/specs/005-indicator-parity/fixtures/${fixtureId}.json`);
  return response.json();
}

// In data fetching code (e.g., useCandleData hook)
if (isFixtureMode()) {
  return await loadFixture(import.meta.env.VITE_FIXTURE_MODE);
} else {
  return await fetchFromAPI(symbol, interval); // Normal path
}
```

**Integration Points**:
- `frontend/src/hooks/useCandleData.ts` - Primary candle data hook
- `frontend/src/hooks/useIndicators.ts` - Indicator calculation hook
- `frontend/src/api/watchlist.ts` - Watchlist data hook (for price updates)

**Alternatives Considered**:
- MSW (Mock Service Worker) provides more sophisticated API mocking but adds complexity
- Direct service override was rejected due to tight coupling with implementation details

---

## Research Topic 4: Data Value Tolerances

**Question**: What are acceptable tolerances for indicator calculations?

### Analysis

Different indicator types have different precision requirements:

| Indicator | Value Range | Precision Sensitivity | Recommended Tolerance |
|-----------|-------------|----------------------|----------------------|
| cRSI | 0-100 | Medium (integer-like) | ±0.01 |
| TDFI | -1 to 1 | High (small decimals) | ±0.001 |
| ADXVMA | Price scale (~100-200) | Low (dollar values) | ±0.01 |
| EMA/SMA | Price scale (~100-200) | Low (dollar values) | ±0.01 |

### Decision: **Per-indicator tolerances based on value range**

**Rationale**:
1. Fixed tolerance (e.g., ±0.01 for all) is too strict for oscillators
2. Percentage-based tolerance is overly complex for this use case
3. Per-indicator tolerances match the precision of each indicator's domain
4. Tolerances account for floating-point arithmetic differences between pandas/numpy and TradingView's backend

**Tolerance Specification**:
```typescript
const TOLERANCES = {
  crsi: 0.01,      // 2 decimal places
  tdfi: 0.001,     // 3 decimal places (more precision)
  adxvma: 0.01,    // 2 decimal places (price scale)
  ema: 0.01,       // 2 decimal places (price scale)
  sma: 0.01,       // 2 decimal places (price scale)
};
```

**Test Assertion**:
```typescript
expect(actual).toBeCloseTo(expected, 2); // For cRSI, ADXVMA, EMA, SMA
expect(actual).toBeCloseTo(expected, 3); // For TDFI
```

**Validation Strategy**:
1. Use Vitest's `toBeCloseTo()` for floating-point comparison
2. Log any values that exceed tolerance for investigation
3. If systematic bias is found, adjust calculation or tolerance with documentation

---

## Research Topic 5: Screenshot Comparison Tools

**Question**: What tool for automated screenshot comparison?

### Options Evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Playwright image diff | Built-in to browser automation | Requires full E2E setup |
| B | pixelmatch library | Lightweight, flexible | Manual canvas capture required |
| C | Custom canvas comparison | Full control | Implementation effort |

### Decision: **Defer to future phase - Manual screenshot comparison for MVP**

**Rationale**:
1. MVP focuses on establishing the validation workflow, not automation
2. Manual comparison is sufficient for initial parity validation
3. Automated screenshot comparison adds significant implementation complexity
4. Playwright would require E2E test infrastructure beyond current scope
5. Can be added in Phase 2 after fixtures and manual workflow are established

**MVP Approach**:
- Manual screenshot capture (developer or QA)
- Side-by-side visual comparison
- Checklist-based validation (already created in `/checklists/parity-validation.md`)
- Discrepancy logging for investigation

**Future Enhancement (Phase 2)**:
1. Set up Playwright for automated screenshot capture
2. Use `playwright/screenshots` with built-in diff comparison
3. Configure acceptable diff threshold (e.g., < 1% pixel difference)
4. Integrate into CI pipeline for regression detection

**Tool Recommendation for Future**:
- **Playwright** - Already aligned with frontend stack (can use with Vitest)
- `expect(page).toHaveScreenshot()` with `maxDiffPixels` or `maxDiffRatio` options
- Diff output provides visual regression detection

---

## Summary of Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| Fixture data source | yfinance + compute indicators | Automated, reproducible, consistent with app |
| Screenshot capture | Manual with documented process | Simple, avoids blocking, establishes baseline |
| Fixture loader | Environment flag + loader module | Minimal changes, explicit behavior |
| Data tolerances | Per-indicator (0.01 or 0.001) | Matches precision requirements |
| Screenshot comparison | Manual for MVP, Playwright future | Focus on workflow first, automation later |

---

## Dependencies and Prerequisites

1. **Feature 003 - Advanced Indicators**: Must be complete for indicator calculations
2. **Feature 004 - Candle Data Refresh**: Must be complete for yfinance integration
3. **TradingView access**: For manual reference screenshot capture
4. **Browser DevTools**: For screenshot capture and timestamp verification

---

## Next Steps

1. **Phase 1**: Create fixture generator script using yfinance
2. **Phase 1**: Implement fixture loader in frontend
3. **Phase 1**: Generate 3 fixture files with full indicator data
4. **Phase 1**: Capture reference screenshots from TradingView
5. **Phase 1**: Write data value validation tests with Vitest
6. **Phase 1**: Create quickstart guide for validation workflow
