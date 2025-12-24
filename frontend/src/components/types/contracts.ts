/**
 * API contract TypeScript types
 * Feature: 002-supercharts-visuals
 */

/**
 * Request: GET /api/v1/candles/{symbol}
 */
export interface ICandlesRequest {
  symbol: string;
  interval: string;
  local_only?: boolean;
}

/**
 * Response: GET /api/v1/candles/{symbol}
 */
export interface ICandlesResponse {
  symbol: string;
  interval: string;
  candles: ICandleData[];
  metadata: {
    from: number; // Unix timestamp (ms)
    to: number; // Unix timestamp (ms)
    count: number;
    has_gaps: boolean;
  };
}

/**
 * Single candle data point (lightweight-charts format)
 */
export interface ICandleData {
  time: number; // Unix timestamp (ms) for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Request: GET /api/v1/indicators/{symbol}/{indicator_name}
 */
export interface IIndicatorRequest {
  symbol: string;
  indicatorName: string; // 'rsi', 'macd', 'sma', etc.
  interval: string;
  params?: Record<string, number | string>;
}

/**
 * Response: GET /api/v1/indicators/{symbol}/{indicator_name}
 */
export interface IIndicatorResponse {
  symbol: string;
  indicatorName: string;
  interval: string;
  data: IIndicatorDataPoint[];
  metadata: {
    params: Record<string, number | string>;
    from: number;
    to: number;
    count: number;
  };
}

/**
 * Single indicator data point
 * Format varies by indicator type:
 * - RSI: { value }
 * - MACD: { macd, signal, histogram }
 * - SMA/EMA: { value }
 * - Stochastic: { k, d }
 * - BB: { upper, middle, lower }
 */
export interface IIndicatorDataPoint {
  time: number; // Unix timestamp (ms) - aligned to candle times

  // RSI: { value }
  // MACD: { macd, signal, histogram }
  // SMA/EMA: { value }
  // Stochastic: { k, d }
  // BB: { upper, middle, lower }
  [key: string]: number | undefined;
}
