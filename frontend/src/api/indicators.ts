/**
 * Indicators API client
 * Feature: 003-advanced-indicators
 */

import client from './client'
import type {
  IndicatorInfo,
  IndicatorOutput,
  IndicatorMetadata,
} from '../components/types/indicators'

// Re-export types for convenience
export type { IndicatorInfo, IndicatorOutput, IndicatorMetadata }

/**
 * List all available indicators with basic info
 * GET /api/v1/indicators
 */
export const listIndicators = async (): Promise<IndicatorInfo[]> => {
  const response = await client.get<IndicatorInfo[]>('/indicators/')
  return response.data
}

/**
 * List all indicators with full metadata
 * GET /api/v1/indicators/supported
 */
export const listIndicatorsWithMetadata = async (): Promise<IndicatorInfo[]> => {
  const response = await client.get<IndicatorInfo[]>('/indicators/supported')
  return response.data
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
 */
export const getIndicator = async (
  symbol: string,
  indicatorName: string,
  interval: string = '1d',
  params?: Record<string, number | string>,
  limit?: number
): Promise<IndicatorOutput> => {
  const requestParams: Record<string, string | number> = { interval }

  if (params) {
    requestParams.params = JSON.stringify(params)
  }

  if (limit) {
    requestParams.limit = limit
  }

  const response = await client.get<IndicatorOutput>(
    `/indicators/${symbol}/${indicatorName}`,
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
  const response = await client.get<TDFIOutput>(`/indicators/${symbol}/tdfi`, { params: { interval } })
  return response.data
}

/**
 * Legacy helper: Get cRSI indicator
 */
export const getcRSI = async (symbol: string, interval: string = '1d'): Promise<cRSIOutput> => {
  const response = await client.get<cRSIOutput>(`/indicators/${symbol}/crsi`, { params: { interval } })
  return response.data
}

/**
 * Legacy helper: Get ADXVMA indicator
 */
export const getADXVMA = async (symbol: string, interval: string = '1d'): Promise<ADXVMAOutput> => {
  const response = await client.get<ADXVMAOutput>(`/indicators/${symbol}/adxvma`, { params: { interval } })
  return response.data
}
