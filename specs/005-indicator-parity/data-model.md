# Data Model: Indicator Parity Validation

**Feature**: 005-indicator-parity
**Date**: 2025-12-24

## Overview

This feature does not introduce new database entities. It uses static JSON files for fixture data and screenshot artifacts for visual comparison.

---

## Fixture Data Structure

### Fixture JSON Schema

```typescript
interface FixtureData {
  // Unique identifier for this fixture
  fixture_id: string;

  // Stock symbol (e.g., "AAPL")
  symbol: string;

  // Time interval (e.g., "1d", "1h", "5m")
  interval: string;

  // Time range covered by this fixture
  timestamp_range: {
    start: string;  // ISO-8601 format
    end: string;    // ISO-8601 format
  };

  // Candle data (OHLCV)
  candles: CandleData[];

  // Computed indicator values for this fixture
  indicators: IndicatorData;
}

interface CandleData {
  time: string;    // ISO-8601 timestamp
  open: number;    // Open price
  high: number;    // High price
  low: number;     // Low price
  close: number;   // Close price
  volume: number;  // Trading volume
}

interface IndicatorData {
  // cRSI (Connors RSI) - oscillator 0-100
  crsi?: {
    values: number[];      // Main cRSI values, one per candle
    upper_band: number;    // Upper threshold (default: 70)
    lower_band: number;    // Lower threshold (default: 30)
  };

  // TDFI (Traders Dynamic Index) - oscillator -1 to 1
  tdfi?: {
    values: number[];      // Main TDFI values, one per candle
    thresholds: {
      upper: number;       // Upper threshold (default: 0.05)
      lower: number;       // Lower threshold (default: -0.05)
    };
  };

  // ADXVMA (Average Directional Index Volatility Moving Average) - price scale
  adxvma?: {
    values: number[];      // ADXVMA values, one per candle
  };

  // EMA (Exponential Moving Average) - price scale
  ema_20?: {
    values: number[];      // EMA(20) values, one per candle
  };

  // SMA (Simple Moving Average) - price scale
  sma_50?: {
    values: number[];      // SMA(50) values, one per candle
  };
}
```

### Validation Rules

1. **Array Length Consistency**: All indicator value arrays must have the same length as the candles array
2. **Null Handling**: Early periods where indicator cannot be computed should be represented as `null`
3. **Timestamp Format**: All timestamps must be valid ISO-8601 strings
4. **Numeric Precision**: Values should use standard JavaScript number precision (IEEE 754)

---

## Fixture Files

### Required Fixtures

| Fixture ID | Symbol | Interval | Candle Count | Time Range | Purpose |
|------------|--------|----------|--------------|------------|---------|
| `fixture-aapl-1d-100` | AAPL | 1d | 100 | ~5 months | Daily chart validation |
| `fixture-tsla-1h-200` | TSLA | 1h | 200 | ~1 month | Hourly chart validation |
| `fixture-spy-5m-150` | SPY | 5m | 150 | ~2 days | Intraday validation |

### File Location

```
specs/005-indicator-parity/fixtures/
├── fixture-aapl-1d-100.json
├── fixture-tsla-1h-200.json
└── fixture-spy-5m-150.json
```

---

## Screenshot Artifacts

### Reference Screenshots

Captured from TradingView Supercharts for visual comparison:

| File | Description |
|------|-------------|
| `fixture-aapl-1d-100-crsi.png` | TradingView cRSI indicator for AAPL daily |
| `fixture-aapl-1d-100-tdfi.png` | TradingView TDFI indicator for AAPL daily |
| `fixture-aapl-1d-100-adxvma.png` | TradingView ADXVMA overlay for AAPL daily |
| `fixture-aapl-1d-100-ema-sma.png` | TradingView EMA(20) + SMA(50) for AAPL daily |
| `fixture-aapl-1d-100-main.png` | TradingView main chart (candles + volume) for AAPL daily |
| *(repeat for TSLA-1h-200 and SPY-5m-150)* | ... |

### File Location

```
specs/005-indicator-parity/screenshots/
├── reference/           # TradingView reference screenshots
│   ├── fixture-aapl-1d-100-*.png
│   ├── fixture-tsla-1h-200-*.png
│   └── fixture-spy-5m-150-*.png
└── test/                # Screenshots captured during validation (runtime)
```

---

## Frontend Types

### FixtureLoader Interface

```typescript
// frontend/src/lib/fixtureLoader.ts

export interface FixtureData {
  fixture_id: string;
  symbol: string;
  interval: string;
  timestamp_range: TimestampRange;
  candles: CandleData[];
  indicators: IndicatorData;
}

export interface TimestampRange {
  start: string;
  end: string;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  crsi?: CRSIData;
  tdfi?: TDFIData;
  adxvma?: PriceIndicatorData;
  ema_20?: PriceIndicatorData;
  sma_50?: PriceIndicatorData;
}

export interface CRSIData {
  values: (number | null)[];
  upper_band: number;
  lower_band: number;
}

export interface TDFIData {
  values: (number | null)[];
  thresholds: {
    upper: number;
    lower: number;
  };
}

export interface PriceIndicatorData {
  values: (number | null)[];
}

export class FixtureLoader {
  // Check if fixture mode is enabled
  isFixtureMode(): boolean;

  // Load fixture by ID
  loadFixture(fixtureId: string): Promise<FixtureData>;

  // List available fixtures
  listFixtures(): string[];
}
```

---

## Test Data Structures

### Data Value Test Schema

```typescript
// frontend/src/test/fixtures/indicator-values.test.ts

interface IndicatorValueTest {
  fixtureId: string;
  indicator: keyof IndicatorData;
  tolerance: number;
  toleranceDigits: number; // For toBeCloseTo()
}

interface TestResult {
  passed: boolean;
  fixtureId: string;
  indicator: string;
  failures: {
    index: number;
    expected: number;
    actual: number;
    difference: number;
  }[];
}
```

---

## Data Flow

### Fixture Mode Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  VITE_FIXTURE_MODE=aapl-1d-100                               │
│         │                                                      │
│         ▼                                                      │
│  ┌──────────────┐                                            │
│  │ useCandleData│                                            │
│  │    Hook      │                                            │
│  └──────┬───────┘                                            │
│         │                                                      │
│         ▼                                                      │
│  ┌──────────────────┐                                        │
│  │ isFixtureMode()? │──── Yes ────┐                          │
│  └──────────────────┘              │                          │
│         │ No                       │                          │
│         ▼                          │                          │
│  ┌─────────────┐                   │                          │
│  │  API Call   │                   │                          │
│  │ (Normal)    │                   │                          │
│  └─────────────┘                   │                          │
│                                    │                          │
│                           ┌────────▼────────┐                │
│                           │ fixtureLoader   │                │
│                           │  .loadFixture() │                │
│                           └────────┬────────┘                │
│                                    │                          │
│                                    ▼                          │
│                           ┌────────────────┐                 │
│                           │ Fixture JSON   │                 │
│                           │   File         │                 │
│                           └────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Validation Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Validation Workflow                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Load Fixture Data                                        │
│     └──> fixtureLoader.loadFixture(fixtureId)                │
│                                                               │
│  2. Compute Indicators (or use pre-computed values)          │
│     └──> indicatorService.calculate(candles, type)           │
│                                                               │
│  3. Validate Data Values                                     │
│     └──> expect(actual).toBeCloseTo(expected, digits)        │
│                                                               │
│  4. Capture Screenshot                                       │
│     └──> browser screenshot tool or Playwright               │
│                                                               │
│  5. Visual Comparison                                        │
│     └──> Side-by-side with reference screenshot             │
│                                                               │
│  6. Document Discrepancies                                    │
│     └──> parity-validation.md checklist                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

- **No database changes** - Fixtures are static JSON files
- **Frontend types** - TypeScript interfaces for fixture data
- **Screenshot artifacts** - Reference and test images for visual comparison
- **Test data structures** - Schemas for automated validation tests
