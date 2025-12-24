/**
 * useCandleData Hook - Manages candle data fetching with polling
 *
 * Feature: 004-candle-data-refresh
 * User Story 1 - View Historical Candle Data
 *
 * Provides polling-based candle data refresh for the main chart.
 * Automatically fetches data on mount and refreshes at interval-appropriate frequencies.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCandles, type Candle } from '../api/candles';
import { createPollTimer, clearPollTimer, getAdjustedPollIntervalMs, type PollTimer } from '../lib/pollingScheduler';

/**
 * Validates a stock symbol format.
 * Accepts alphanumeric symbols with dots, hyphens, and equals (e.g., AAPL, BTC-USD, ^GSPC)
 */
function isValidSymbol(symbol: string): boolean {
  if (!symbol || typeof symbol !== 'string') return false;
  // Allow 1-20 characters, alphanumeric, dots, hyphens, equals, caret (for indices)
  const symbolRegex = /^[A-Za-z0-9=.^_-]{1,20}$/;
  return symbolRegex.test(symbol);
}

/**
 * State managed by useCandleData hook
 */
export interface CandlePollingState {
  candles: Candle[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isStale: boolean;
  hasMore: boolean;
}

export function useCandleData(symbol: string, interval: string = '1d') {
  const [state, setState] = useState<CandlePollingState>({
    candles: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdate: null,
    isStale: false,
    hasMore: true,
  });

  // Refs to track current symbol/interval and avoid stale closures
  const pollTimerRef = useRef<PollTimer | null>(null);
  const currentSymbolRef = useRef(symbol);
  const currentIntervalRef = useRef(interval);

  /**
   * Fetch candles from API
   *
   * @param isRefresh - True if this is a background refresh (shows isRefreshing state)
   */
  const fetchCandles = useCallback(async (isRefresh = false) => {
    // Cancel if symbol or interval changed (avoid race conditions)
    if (symbol !== currentSymbolRef.current || interval !== currentIntervalRef.current) {
      return;
    }

    // T074: Symbol validation before data fetch
    if (!isValidSymbol(symbol)) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: `Invalid symbol format: "${symbol}". Please use a valid stock symbol.`,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
      error: null,
    }));

    try {
      const candles = await getCandles(symbol, interval);

      setState(prev => ({
        ...prev,
        candles,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdate: new Date(),
        isStale: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: err instanceof Error ? err.message : 'Failed to fetch candles',
      }));
    }
  }, [symbol, interval]);

  /**
   * Manual refresh function - allows user to trigger refresh on demand
   */
  const refresh = useCallback(() => {
    fetchCandles(false);
  }, [fetchCandles]);

  /**
   * Fetch candles with date range for backfill (User Story 4)
   *
   * @param fromDate - ISO string of start date for backfill
   * @param toDate - ISO string of end date for backfill
   */
  const fetchCandlesWithRange = useCallback(async (fromDate: string, toDate: string) => {
    // Cancel if symbol or interval changed (avoid race conditions)
    if (symbol !== currentSymbolRef.current || interval !== currentIntervalRef.current) {
      return;
    }

    setState(prev => ({
      ...prev,
      isRefreshing: true,
      error: null,
    }));

    try {
      const newCandles = await getCandles(symbol, interval, fromDate, toDate);

      // Merge new candles with existing candles, avoiding duplicates
      setState(prev => {
        const existingTimestamps = new Set(prev.candles.map(c => c.timestamp));
        const uniqueNewCandles = newCandles.filter(c => !existingTimestamps.has(c.timestamp));

        // Merge and sort by timestamp
        const mergedCandles = [...prev.candles, ...uniqueNewCandles].sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Update hasMore based on whether we got new data
        const hasMore = uniqueNewCandles.length > 0;

        return {
          ...prev,
          candles: mergedCandles,
          isRefreshing: false,
          lastUpdate: new Date(),
          hasMore,
        };
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: err instanceof Error ? err.message : 'Failed to fetch backfill data',
      }));
    }
  }, [symbol, interval]);

  /**
   * Setup polling on mount and when symbol/interval changes
   * T073: Uses adjusted poll interval based on market schedule
   */
  useEffect(() => {
    // Update refs
    currentSymbolRef.current = symbol;
    currentIntervalRef.current = interval;

    // Cancel existing timer if any
    if (pollTimerRef.current) {
      clearPollTimer(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // Initial fetch
    fetchCandles();

    // Setup polling timer with market-aware interval (T073)
    const pollInterval = getAdjustedPollIntervalMs(interval);
    pollTimerRef.current = createPollTimer(() => {
      fetchCandles(true); // Background refresh
    }, pollInterval);

    // Cleanup on unmount
    return () => {
      if (pollTimerRef.current) {
        clearPollTimer(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [symbol, interval, fetchCandles]);

  return {
    ...state,
    refresh,
    fetchCandlesWithRange, // T059: Backfill data fetching method
  };
}
