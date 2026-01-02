/**
 * Symbols API
 *
 * Provides API for fetching symbol metadata including display name and exchange.
 */

import client from './client'

export interface SymbolInfo {
  symbol: string
  display_name: string
  exchange: string | null
}

/**
 * Get symbol info by ticker
 * Uses the search API with exact match
 */
export async function getSymbolInfo(ticker: string): Promise<SymbolInfo> {
  const response = await client.get<SymbolInfo[]>('/symbols/search', {
    params: { q: ticker }
  })

  const results = response.data
  if (results.length === 0) {
    // Return fallback if not found
    return {
      symbol: ticker.toUpperCase(),
      display_name: ticker.toUpperCase(),
      exchange: null
    }
  }

  // Find exact match (case-insensitive)
  const exactMatch = results.find(
    r => r.symbol.toLowerCase() === ticker.toLowerCase()
  )

  return exactMatch || results[0]
}

/**
 * Get symbol info for multiple tickers
 */
export async function getSymbolsInfo(tickers: string[]): Promise<SymbolInfo[]> {
  const promises = tickers.map(t => getSymbolInfo(t))
  return Promise.all(promises)
}
