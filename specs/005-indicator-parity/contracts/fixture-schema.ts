// Fixture Data Schema for Indicator Parity Validation
// Feature: 005-indicator-parity
// This file defines the TypeScript interfaces for fixture JSON files

/**
 * Complete fixture data structure
 *
 * A fixture contains frozen candle data and pre-computed indicator values
 * for a specific symbol, interval, and time range. Fixtures enable repeatable
 * parity validation against TradingView reference screenshots.
 */
export interface FixtureData {
  /** Unique identifier for this fixture (e.g., "fixture-aapl-1d-100") */
  fixture_id: string;

  /** Stock symbol (e.g., "AAPL", "TSLA", "SPY") */
  symbol: string;

  /** Time interval (e.g., "1m", "5m", "15m", "1h", "1d", "1w") */
  interval: string;

  /** Time range covered by this fixture */
  timestamp_range: TimestampRange;

  /** Candle data (OHLCV) - one entry per time period */
  candles: CandleData[];

  /** Computed indicator values for this fixture */
  indicators: IndicatorData;
}

/**
 * Time range for the fixture data
 */
export interface TimestampRange {
  /** Start timestamp in ISO-8601 format (e.g., "2024-08-01T00:00:00Z") */
  start: string;

  /** End timestamp in ISO-8601 format */
  end: string;
}

/**
 * Single candle (OHLCV) data point
 */
export interface CandleData {
  /** Timestamp in ISO-8601 format */
  time: string;

  /** Open price */
  open: number;

  /** High price */
  high: number;

  /** Low price */
  low: number;

  /** Close price */
  close: number;

  /** Trading volume */
  volume: number;
}

/**
 * Container for all indicator data in a fixture
 *
 * All indicators are optional - a fixture may include any subset.
 * Value arrays must have the same length as the candles array.
 * Null values indicate periods where the indicator could not be computed.
 */
export interface IndicatorData {
  /** cRSI (Connors RSI) - oscillator ranging 0-100 */
  crsi?: CRSIData;

  /** TDFI (Traders Dynamic Index) - oscillator ranging -1 to 1 */
  tdfi?: TDFIData;

  /** ADXVMA (Average Directional Index Volatility Moving Average) - price scale */
  adxvma?: PriceIndicatorData;

  /** EMA (Exponential Moving Average) with period 20 - price scale */
  ema_20?: PriceIndicatorData;

  /** SMA (Simple Moving Average) with period 50 - price scale */
  sma_50?: PriceIndicatorData;
}

/**
 * cRSI indicator data
 *
 * Connors RSI combines RSI, streak length, and percent change.
 * Values range from 0 to 100. Typical thresholds: 30 (oversold), 70 (overbought).
 */
export interface CRSIData {
  /** Main cRSI values - one per candle, or null if not computable */
  values: (number | null)[];

  /** Upper band threshold (typically 70) */
  upper_band: number;

  /** Lower band threshold (typically 30) */
  lower_band: number;
}

/**
 * TDFI indicator data
 *
 * Traders Dynamic Index combines trend, momentum, and volatility.
 * Values range from -1 to 1. Thresholds at +0.05 (bullish) and -0.05 (bearish).
 */
export interface TDFIData {
  /** Main TDFI values - one per candle, or null if not computable */
  values: (number | null)[];

  /** Threshold values for regime determination */
  thresholds: {
    /** Upper threshold (typically 0.05) - above this is bullish */
    upper: number;

    /** Lower threshold (typically -0.05) - below this is bearish */
    lower: number;
  };
}

/**
 * Price-scale indicator data
 *
 * Used for indicators that share the price scale (ADXVMA, EMA, SMA).
 * Values are in the same range as the underlying candle prices.
 */
export interface PriceIndicatorData {
  /** Indicator values - one per candle, or null if not computable */
  values: (number | null)[];
}

/**
 * Fixture loader interface
 *
 * Provides methods for loading fixture data in test mode.
 */
export interface FixtureLoader {
  /**
   * Check if fixture mode is currently enabled
   * @returns true if VITE_FIXTURE_MODE environment variable is set
   */
  isFixtureMode(): boolean;

  /**
   * Load a fixture by its ID
   * @param fixtureId - The fixture identifier (e.g., "fixture-aapl-1d-100")
   * @returns Promise resolving to the fixture data
   * @throws Error if fixture file is not found or invalid
   */
  loadFixture(fixtureId: string): Promise<FixtureData>;

  /**
   * List all available fixture IDs
   * @returns Array of fixture identifiers
   */
  listFixtures(): string[];
}

/**
 * Test result for indicator value validation
 */
export interface IndicatorValueTestResult {
  /** Whether all values passed the tolerance check */
  passed: boolean;

  /** Fixture ID that was tested */
  fixtureId: string;

  /** Indicator that was tested */
  indicator: keyof IndicatorData;

  /** Array of failures (empty if all passed) */
  failures: {
    /** Index in the candles array */
    index: number;

    /** Expected value from fixture */
    expected: number;

    /** Actual computed value */
    actual: number;

    /** Absolute difference */
    difference: number;
  }[];
}

/**
 * Tolerance settings for each indicator type
 *
 * Defines acceptable differences between fixture values and computed values.
 */
export const INDICATOR_TOLERANCES: Record<keyof IndicatorData, number> = {
  // cRSI: ±0.01 (2 decimal places - medium precision for 0-100 range)
  crsi: 0.01,

  // TDFI: ±0.001 (3 decimal places - high precision for -1 to 1 range)
  tdfi: 0.001,

  // ADXVMA: ±0.01 (2 decimal places - price scale ~100-200)
  adxvma: 0.01,

  // EMA: ±0.01 (2 decimal places - price scale)
  ema_20: 0.01,

  // SMA: ±0.01 (2 decimal places - price scale)
  sma_50: 0.01,
} as const;

/**
 * Convert tolerance to digits for Vitest's toBeCloseTo()
 *
 * toBeCloseTo uses "number of decimal digits" rather than absolute tolerance.
 * This mapping provides approximately equivalent precision.
 */
export const TOLERANCE_TO_DIGITS: Record<keyof IndicatorData, number> = {
  crsi: 2,     // 0.01 tolerance → 2 decimal places
  tdfi: 3,     // 0.001 tolerance → 3 decimal places
  adxvma: 2,   // 0.01 tolerance → 2 decimal places
  ema_20: 2,   // 0.01 tolerance → 2 decimal places
  sma_50: 2,   // 0.01 tolerance → 2 decimal places
} as const;
