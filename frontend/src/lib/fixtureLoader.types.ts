/**
 * TypeScript types for Fixture Loader
 *
 * Defines the fixture data schema for golden fixtures used in parity validation.
 */

export interface CandleData {
  time: string;           // ISO-8601 timestamp
  open: number;           // Open price
  high: number;           // High price
  low: number;            // Low price
  close: number;          // Close price
  volume: number;         // Volume
}

export interface TimestampRange {
  start: string;          // ISO-8601 start timestamp
  end: string;            // ISO-8601 end timestamp
}

export interface CRSIData {
  values: (number | null)[];  // cRSI values (null where not computable)
  upper_band: number;         // Upper band threshold (typically 70)
  lower_band: number;         // Lower band threshold (typically 30)
  params: {
    period: number;           // RSI period
    source: string;           // Price source (e.g., 'close')
  };
}

export interface TDFIData {
  values: (number | null)[];  // TDFI values
  thresholds: {
    upper: number;            // Upper threshold (typically +0.05)
    lower: number;            // Lower threshold (typically -0.05)
  };
  params: {
    rsi_period: number;       // RSI period for TDFI calculation
    band_period: number;      // Band period
  };
}

export interface PriceIndicatorData {
  values: (number | null)[];  // Indicator values
  params: {
    period: number;           // Moving average period
    source: string;           // Price source
  };
}

export interface IndicatorData {
  crsi?: CRSIData;
  tdfi?: TDFIData;
  adxvma?: {
    values: (number | null)[];
    params: {
      period: number;
      threshold: number;
    };
  };
  ema?: PriceIndicatorData;
  sma?: PriceIndicatorData;
}

export interface FixtureData {
  fixture_id: string;
  symbol: string;
  interval: string;
  timestamp_range: TimestampRange;
  candles: CandleData[];
  indicators: IndicatorData;
  generated_at?: string;      // ISO timestamp of generation
}

export interface FixtureManifest {
  fixtures: Array<{
    fixture_id: string;
    symbol: string;
    interval: string;
    candle_count: number;
    generated_at: string;
  }>;
  version: string;
}
