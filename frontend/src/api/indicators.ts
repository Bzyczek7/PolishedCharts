/**
 * Indicators API client
 * Feature: 003-advanced-indicators
 */

import { createAuthenticatedAxios } from '@/services/authService'
import type {
  IndicatorInfo,
  IndicatorOutput,
  IndicatorMetadata,
} from '../components/types/indicators'
import { getTrimmedValidSymbol } from '../utils/validation'

// Re-export types for convenience
export type { IndicatorInfo, IndicatorOutput, IndicatorMetadata }

/**
 * List all available indicators with basic info
 * GET /api/v1/indicators
 */
export const listIndicators = async (): Promise<IndicatorInfo[]> => {
  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<IndicatorInfo[]>('/indicators/')
  return response.data
}

/**
 * List all indicators with full metadata
 * GET /api/v1/indicators/supported
 */
export const listIndicatorsWithMetadata = async (): Promise<IndicatorInfo[]> => {
  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<IndicatorInfo[]>('/indicators/supported')
  return response.data
}

/**
 * Clamp indicator parameters to valid ranges before API call
 * Prevents 400 errors from bad localStorage configs or user input
 */
function clampIndicatorParams(
  indicatorName: string,
  params: Record<string, number | string>
): Record<string, number | string> {
  // Define common min/max constraints (mirrors backend validation)
  const constraints: Record<string, Record<string, { min: number; max: number }>> = {
    rsi: { length: { min: 2, max: 200 } },
    atr: { length: { min: 2, max: 200 } },
    sma: { length: { min: 2, max: 500 } },
    ema: { length: { min: 2, max: 500 } },
    crsi: { period: { min: 2, max: 200 } },  // crsi uses 'period'
    macd: { fast: { min: 2, max: 100 }, slow: { min: 2, max: 200 }, signal: { min: 2, max: 50 } },
    bbands: { length: { min: 2, max: 200 }, std: { min: 0.1, max: 5.0 } },
  };

  const clamped = { ...params };
  const indicatorConstraints = constraints[indicatorName.toLowerCase()];

  if (indicatorConstraints) {
    for (const [key, value] of Object.entries(clamped)) {
      const constraint = indicatorConstraints[key];
      if (constraint && typeof value === 'number') {
        if (value < constraint.min) {
          console.warn(`Clamping ${indicatorName}.${key} from ${value} to min ${constraint.min}`);
          clamped[key] = constraint.min;
        } else if (value > constraint.max) {
          console.warn(`Clamping ${indicatorName}.${key} from ${value} to max ${constraint.max}`);
          clamped[key] = constraint.max;
        }
      }
    }
  }

  return clamped;
}

/**
 * Get indicator data for a symbol
 * GET /api/v1/indicators/{symbol}/{indicator_name}
 *
 * @param symbol Stock ticker (e.g., "AAPL")
 * @param indicatorName Indicator name (e.g., "sma", "ema", "tdfi")
 * @param interval Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
 * @param params Indicator parameters as JSON string
 * @param limit Max data points to return (default 1000, max 10000)
 * @param from Start timestamp as ISO 8601 string (optional, for date range filtering)
 * @param to End timestamp as ISO 8601 string (optional, for date range filtering)
 */
export const getIndicator = async (
  symbol: string,
  indicatorName: string,
  interval: string = '1d',
  params?: Record<string, number | string>,
  limit?: number,
  from?: string,  // NEW - optional date range start
  to?: string     // NEW - optional date range end
): Promise<IndicatorOutput> => {
  // Validate symbol to prevent malformed URLs
  const validSymbol = getTrimmedValidSymbol(symbol);
  if (!validSymbol) {
    throw new Error('Symbol is required for indicator API calls');
  }

  // Clamp parameters to valid ranges to prevent 400 errors
  const safeParams = params ? clampIndicatorParams(indicatorName, params) : undefined

  // Feature 007: Use query parameters instead of JSON string for better REST semantics
  const requestParams: Record<string, string | number> = { interval }

  // Spread individual query parameters instead of using JSON string
  if (safeParams) {
    Object.entries(safeParams).forEach(([key, value]) => {
      // Map frontend parameter names to pandas-ta parameter names
      // pandas-ta uses 'length' not 'period' for most indicators
      let mappedKey = key;
      if (key === 'period') {
        mappedKey = 'length';
      }
      // cRSI: dom_cycle -> domcycle, cyclic_memory -> cyclicmemory
      if (mappedKey === 'dom_cycle') {
        requestParams['dom_cycle'] = value
      } else if (mappedKey === 'cyclic_memory') {
        requestParams['cyclic_memory'] = value
      } else {
        requestParams[mappedKey] = value
      }
    })
  }

  if (limit) {
    requestParams.limit = limit
  }

  // Add date range parameters if provided
  if (from) {
    requestParams['from'] = from
  }
  if (to) {
    requestParams['to'] = to
  }

  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<IndicatorOutput>(
    `/indicators/${validSymbol}/${indicatorName}`,
    { params: requestParams }
  )

  return response.data
}

// Legacy typed exports for backward compatibility
export interface TDFIOutput {
  timestamps: string[]
  tdfi: (number | null)[]
  tdfi_signal: (number | null)[]
  metadata: IndicatorMetadata
}

export interface cRSIOutput {
  timestamps: string[]
  crsi: (number | null)[]
  upper_band: (number | null)[]
  lower_band: (number | null)[]
  metadata: IndicatorMetadata
}

export interface ADXVMAOutput {
  timestamps: string[]
  adxvma: (number | null)[]
  metadata: IndicatorMetadata
}

/**
 * Legacy helper: Get TDFI indicator
 */
export const getTDFI = async (symbol: string, interval: string = '1d'): Promise<TDFIOutput> => {
  // Validate symbol to prevent malformed URLs
  const validSymbol = getTrimmedValidSymbol(symbol);
  if (!validSymbol) {
    throw new Error('Symbol is required for TDFI indicator API calls');
  }

  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<TDFIOutput>(`/indicators/${validSymbol}/tdfi`, { params: { interval } })
  return response.data
}

/**
 * Legacy helper: Get cRSI indicator
 */
export const getcRSI = async (symbol: string, interval: string = '1d'): Promise<cRSIOutput> => {
  // Validate symbol to prevent malformed URLs
  const validSymbol = getTrimmedValidSymbol(symbol);
  if (!validSymbol) {
    throw new Error('Symbol is required for cRSI indicator API calls');
  }

  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<cRSIOutput>(`/indicators/${validSymbol}/crsi`, { params: { interval } })
  return response.data
}

/**
 * Legacy helper: Get ADXVMA indicator
 */
export const getADXVMA = async (symbol: string, interval: string = '1d'): Promise<ADXVMAOutput> => {
  // Validate symbol to prevent malformed URLs
  const validSymbol = getTrimmedValidSymbol(symbol);
  if (!validSymbol) {
    throw new Error('Symbol is required for ADXVMA indicator API calls');
  }

  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<ADXVMAOutput>(`/indicators/${validSymbol}/adxvma`, { params: { interval } })
  return response.data
}

/**
 * Batch request type for fetching multiple indicators
 */
export interface IndicatorBatchRequest {
  symbol: string;
  interval: string;
  indicator_name: string;
  params?: Record<string, number | string>;
  from_ts?: string;
  to_ts?: string;
}

/**
 * Batch response type from backend
 */
export interface IndicatorBatchResponse {
  results: IndicatorOutput[];
  errors: Array<{
    index: number;
    symbol: string;
    indicator_name: string;
    error: string;
  }>;
  total_duration_ms: number;
  cache_hits: number;
  cache_misses: number;
}

/**
 * Batch fetch multiple indicators for the same symbol/interval
 * POST /api/v1/indicators/batch
 *
 * This is optimized to fetch candles once for all indicators
 * that share the same symbol/interval/date_range combination.
 *
 * @param requests Array of indicator requests to batch
 */
export const batchGetIndicators = async (
  requests: IndicatorBatchRequest[]
): Promise<IndicatorBatchResponse> => {
  const authClient = await createAuthenticatedAxios()

  // Prepare batch request with properly clamped parameters
  const preparedRequests = requests.map((req) => {
    const safeParams = req.params
      ? clampIndicatorParams(req.indicator_name, req.params)
      : undefined

    return {
      symbol: req.symbol,
      interval: req.interval,
      indicator_name: req.indicator_name,
      params: safeParams,
      from_ts: req.from_ts,
      to_ts: req.to_ts,
    }
  })

  const response = await authClient.post<IndicatorBatchResponse>(
    '/indicators/batch',
    { requests: preparedRequests }
  )

  return response.data
}
