/**
 * useInitialSymbolFromWatchlist hook
 *
 * Reusable pattern for initializing the chart symbol from watchlist data.
 * Ensures symbol selection happens exactly once after watchlist loading completes.
 *
 * Global Standard: "Initial symbol selection must happen exactly once after
 * watchlist loading completes."
 */

import { useEffect, useRef } from 'react'

interface WatchlistData {
  isLoading: boolean
  symbols: string[]
}

/**
 * Initializes the symbol from watchlist, falling back to SPY if empty.
 *
 * This hook:
 * - Waits for watchlist to finish loading
 * - Only initializes once (prevents race conditions)
 * - Uses the first watchlist symbol if available
 * - Falls back to SPY if watchlist is empty
 * - Includes guard to prevent unnecessary state updates
 *
 * @param watchlistData - The watchlist state (isLoading and symbols)
 * @param currentSymbol - The current symbol value
 * @param setSymbol - Function to update the symbol
 */
export function useInitialSymbolFromWatchlist(
  watchlistData: WatchlistData,
  currentSymbol: string,
  setSymbol: (symbol: string) => void
): void {
  const initializedRef = useRef(false)

  useEffect(() => {
    // Skip if watchlist is still loading
    if (watchlistData.isLoading) {
      return
    }

    // Only initialize once
    if (initializedRef.current) {
      return
    }

    // Determine next symbol
    const nextSymbol = watchlistData.symbols.length > 0
      ? watchlistData.symbols[0]
      : currentSymbol === 'LOADING' ? 'SPY' : currentSymbol

    // Guard: only set if different (prevents extra fetches)
    if (nextSymbol !== currentSymbol) {
      setSymbol(nextSymbol)
    }

    initializedRef.current = true
  }, [watchlistData.isLoading, watchlistData.symbols, currentSymbol, setSymbol])
}
