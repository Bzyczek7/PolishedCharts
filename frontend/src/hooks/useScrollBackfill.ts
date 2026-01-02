/**
 * useScrollBackfill hook
 *
 * Memoized scroll backfill handler that triggers historical data fetching
 * when user scrolls near the edge of loaded data.
 *
 * Global Standard: "Route ALL backfills through the existing fetchMoreHistory
 * function with its dedupe/hasMore logic."
 */

import { useCallback, useRef } from 'react'
import type { LogicalRange } from 'lightweight-charts'
import type { Candle } from '../api/candles'

/**
 * Helper function to get interval duration in milliseconds.
 * Used for calculating backfill size.
 */
function getIntervalMilliseconds(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60000, '2m': 120000, '5m': 300000, '15m': 900000,
    '30m': 1800000, '1h': 3600000, '4h': 14400000,
    '1d': 86400000, '1wk': 604800000
  }
  return map[interval] || 86400000
}

interface UseScrollBackfillOptions {
  /** Current candle data */
  candles: Candle[]
  /** Current symbol */
  symbol: string
  /** Chart interval (e.g., '1d', '1h') */
  interval: string
  /** Whether more historical data is available */
  hasMore: boolean
  /** Whether a fetch is currently in progress */
  isFetching: boolean
  /** Callback to fetch more historical data */
  onFetchMore: (from: string, to: string) => Promise<void>
}

/**
 * Creates a memoized scroll backfill handler.
 *
 * This handler:
 * - Triggers when user scrolls beyond loaded data (range.from becomes negative)
 * - Fetches historical data in appropriate chunk sizes based on interval
 * - Routes through onFetchMore (which should call fetchMoreHistory)
 * - Prevents duplicate fetches via useCallback memoization
 *
 * @param options - Hook configuration
 * @returns Memoized callback for scroll range changes
 */
export function useScrollBackfill({
  candles,
  symbol,
  interval,
  hasMore,
  isFetching,
  onFetchMore,
}: UseScrollBackfillOptions) {
  // Use ref to avoid stale closure - chart fires scroll events before React re-renders
  const candlesRef = useRef(candles)
  candlesRef.current = candles

  // Add cooldown to prevent rapid-fire fetches
  const lastFetchTimeRef = useRef<number>(0)
  const FETCH_COOLDOWN_MS = 2000  // Minimum 2 seconds between backfills

  const handleScrollRangeChange = useCallback((range: LogicalRange | null) => {
    if (!range || isFetching) return

    // Add cooldown check to prevent rapid-fire fetches
    const now = Date.now()
    if (now - lastFetchTimeRef.current < FETCH_COOLDOWN_MS) {
      return
    }

    // Use ref to check latest candles value (avoids stale closure)
    // Chart fires scroll events before React re-renders with updated candles state
    if (candlesRef.current.length === 0) return

    const candles = candlesRef.current

    // PREDICTIVE TRIGGER: range.from is the bar index visible at left edge
    // range.from < 0 means scrolled past first candle
    // range.from = 0 means first candle is at left edge
    // range.from = 500 means 501st candle is at left edge
    // Trigger when within 368 candles of edge (includes scrolled past edge)
    const PREDICTIVE_TRIGGER_CANDLES = 368
    const BACKFILL_CANDLE_COUNT = 1000

    if (hasMore && range.from <= PREDICTIVE_TRIGGER_CANDLES) {
      lastFetchTimeRef.current = now  // Set fetch timestamp to prevent rapid-fire

      const earliestDate = new Date(candles[0].timestamp)
      const toDate = earliestDate.toISOString()

      // Compute backfill date range (~1000 candles)
      // Actual count may vary due to market calendar (weekends, holidays)
      const intervalMs = getIntervalMilliseconds(interval)
      const fromDate = new Date(earliestDate.getTime() - (BACKFILL_CANDLE_COUNT * intervalMs))

      // CRITICAL: Route through onFetchMore which calls fetchMoreHistory
      // This ensures dedupe, hasMore locking, and proper merge logic
      onFetchMore(fromDate.toISOString(), toDate)
    }
  }, [symbol, interval, hasMore, isFetching, onFetchMore])

  return handleScrollRangeChange
}
