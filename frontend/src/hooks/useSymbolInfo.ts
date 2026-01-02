/**
 * useSymbolInfo Hook
 *
 * Fetches and caches symbol metadata (display name, exchange).
 * Uses a simple Map cache to avoid redundant API calls.
 */

import { useState, useEffect } from 'react'
import { getSymbolInfo, type SymbolInfo } from '../api/symbols'

const symbolCache = new Map<string, SymbolInfo>()

export function useSymbolInfo(ticker: string | null) {
  const [data, setData] = useState<SymbolInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!ticker) {
      setData(null)
      return
    }

    // Check cache first
    const cached = symbolCache.get(ticker.toUpperCase())
    if (cached) {
      setData(cached)
      return
    }

    // Fetch from API
    setIsLoading(true)
    setError(null)

    getSymbolInfo(ticker)
      .then(info => {
        symbolCache.set(ticker.toUpperCase(), info)
        setData(info)
      })
      .catch(err => {
        console.error(`Failed to fetch symbol info for ${ticker}:`, err)
        setError(err)
        // Set fallback on error
        const fallback: SymbolInfo = {
          symbol: ticker.toUpperCase(),
          display_name: ticker.toUpperCase(),
          exchange: null
        }
        setData(fallback)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [ticker])

  return { data, isLoading, error }
}

/**
 * Clear the symbol cache (useful for testing or forced refresh)
 */
export function clearSymbolInfoCache() {
  symbolCache.clear()
}
