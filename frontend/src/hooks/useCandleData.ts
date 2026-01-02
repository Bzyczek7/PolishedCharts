/**
 * useCandleData Hook - Manages candle data fetching with polling
 *
 * Feature: 004-candle-data-refresh
 * User Story 1 - View Historical Candle Data
 *
 * Provides polling-based candle data refresh for the main chart.
 * Automatically fetches data on mount and refreshes at interval-appropriate frequencies.
 *
 * Feature 005: Supports fixture mode for parity validation without live API calls
 * Feature 012: Performance monitoring instrumentation and caching
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCandles, type Candle } from '../api/candles';
import { createPollTimer, clearPollTimer, getAdjustedPollIntervalMs, type PollTimer } from '../lib/pollingScheduler';
import { isFixtureMode, loadFixture, getFixtureId, type FixtureData } from '../lib/fixtureLoader';
import { measurePerformance } from '../lib/performance';
import { getCachedCandles, setCachedCandles } from '../lib/candleCache';
import { getCandlesWithCache, mergeAndPersistCandles } from '../lib/candleCacheUnified';
import { invalidateIndicatorCache } from '../lib/indicatorCache';

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
 * Convert fixture candle data to Candle format
 * Feature 005: Keep ISO timestamps for consistency with rest of app
 * Conversion to Unix seconds happens at chart boundary via chartHelpers.formatDataForChart
 */
function fixtureToCandles(fixture: FixtureData): Candle[] {
  return fixture.candles.map((c: { time: string; open: number; high: number; low: number; close: number; volume: number }) => ({
    ticker: fixture.symbol,
    timestamp: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume
  }));
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

  // Data version counter - increments when candles are updated (especially backfill)
  // Used to trigger indicator recalculation when candle data changes
  const [dataVersion, setDataVersion] = useState(0);

  // Refs to track current symbol/interval and avoid stale closures
  const pollTimerRef = useRef<PollTimer | null>(null);
  const currentSymbolRef = useRef(symbol);
  const currentIntervalRef = useRef(interval);

  // T042: Debounce for rapid symbol/interval changes
  // Prevents excessive API calls when user rapidly switches symbols
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSymbolRef = useRef<string | null>(null);
  const pendingIntervalRef = useRef<string | null>(null);

  /**
   * Fetch candles from API or load from fixture (Feature 005)
   *
   * @param isRefresh - True if this is a background refresh (shows isRefreshing state)
   */
  const fetchCandles = useCallback(async (isRefresh = false) => {
    // Cancel if symbol or interval changed (avoid race conditions)
    if (symbol !== currentSymbolRef.current || interval !== currentIntervalRef.current) {
      return;
    }

    // Feature 005: Check if fixture mode is enabled
    if (isFixtureMode()) {
      const fixtureId = getFixtureId();
      if (!fixtureId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: 'Fixture mode enabled but VITE_FIXTURE_MODE not set to a valid fixture ID',
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
        const fixture = await loadFixture(fixtureId);
        const candles = fixtureToCandles(fixture);

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
          error: err instanceof Error ? err.message : 'Failed to load fixture data',
        }));
      }

      // Don't set up polling in fixture mode
      return;
    }

    // Normal API mode
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

    // Performance: Mark candle fetch start
    console.log(`%c[T2 START] Fetching candles for ${symbol} ${interval}`, 'color: #FF9800; font-weight: bold');

    try {
      // Use unified caching layer (memory + IndexedDB + API)
      const candles = await measurePerformance(
        'fetch_candles',
        'data_fetch',
        () => getCandlesWithCache(symbol, interval, async () => {
          return await getCandles(symbol, interval);
        }),
        { symbol, interval, is_refresh: isRefresh }
      );

      // Performance: Mark candle fetch complete
      console.log(`%c[T2 DONE] Fetched ${candles.length} candles for ${symbol} ${interval}`, 'color: #FF9800; font-weight: bold');

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
    // Feature 005: No backfill in fixture mode
    if (isFixtureMode()) {
      console.warn('[Fixture Mode] Backfill not supported in fixture mode');
      return;
    }

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
      // T010: Instrument backfill with performance logging
      const newCandles = await measurePerformance(
        'fetch_candles_backfill',
        'data_fetch',
        () => getCandles(symbol, interval, fromDate, toDate),
        { symbol, interval, from: fromDate, to: toDate }
      );

      // Merge with existing and persist to both caches
      const merged = await mergeAndPersistCandles(symbol, interval, state.candles, newCandles);

      // Invalidate indicator cache so indicators recalculate with the new historical data
      invalidateIndicatorCache(symbol);

      // Increment data version to trigger indicator refetch
      setDataVersion(v => v + 1);

      setState(prev => ({
        ...prev,
        candles: merged,
        isRefreshing: false,
        lastUpdate: new Date(),
        hasMore: newCandles.length > 0,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: err instanceof Error ? err.message : 'Failed to fetch backfill data',
      }));
    }
  }, [symbol, interval, state.candles]);

  /**
   * Setup polling on mount and when symbol/interval changes
   * T073: Uses adjusted poll interval based on market schedule
   * T042: Debounces rapid symbol/interval changes (300ms delay)
   * Feature 005: No polling in fixture mode
   */
  useEffect(() => {
    // Cancel existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Store pending values
    pendingSymbolRef.current = symbol;
    pendingIntervalRef.current = interval;

    // Feature 005: No debounce in fixture mode - fetch immediately
    if (isFixtureMode()) {
      // Update refs
      currentSymbolRef.current = symbol;
      currentIntervalRef.current = interval;

      // Cancel existing poll timer
      if (pollTimerRef.current) {
        clearPollTimer(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      // Immediate fetch
      fetchCandles();
      return;
    }

    // T042: Debounce rapid symbol/interval changes
    // Wait 300ms after the last change before actually fetching
    // This prevents excessive API calls when user types rapidly or clicks multiple symbols
    debounceTimerRef.current = setTimeout(() => {
      const pendingSymbol = pendingSymbolRef.current;
      const pendingInterval = pendingIntervalRef.current;

      // Only proceed if values haven't changed again
      if (pendingSymbol === symbol && pendingInterval === interval) {
        // Update refs
        currentSymbolRef.current = pendingSymbol!;
        currentIntervalRef.current = pendingInterval!;

        // Cancel existing poll timer
        if (pollTimerRef.current) {
          clearPollTimer(pollTimerRef.current);
          pollTimerRef.current = null;
        }

        // Fetch candles
        fetchCandles();

        // Setup polling timer with market-aware interval (T073)
        const pollInterval = getAdjustedPollIntervalMs(pendingInterval!);
        pollTimerRef.current = createPollTimer(() => {
          fetchCandles(true); // Background refresh
        }, pollInterval);
      }
    }, 300); // 300ms debounce delay

    // Cleanup on unmount or symbol/interval change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
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
    dataVersion, // Version counter for tracking data updates (used to trigger indicator refetch)
  };
}
