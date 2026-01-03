/**
 * useWatchlistData Hook - Manages watchlist price fetching with polling
 *
 * Feature: 004-candle-data-refresh
 * User Story 3 - Watchlist Price Updates
 *
 * Provides polling-based watchlist price refresh for the watchlist component.
 * Automatically fetches prices on mount and refreshes every 60 seconds.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getLatestPrices, type WatchlistItem } from '../api/watchlist';
import { createPollTimer, clearPollTimer, type PollTimer } from '../lib/pollingScheduler';

/**
 * State managed by useWatchlistData hook
 */
export interface WatchlistPollingState {
  entries: WatchlistItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  errors: Map<string, string>; // symbol -> error message
  lastUpdate: Date | null;
}

const WATCHLIST_POLL_INTERVAL_MS = 1800000; // 30 minutes - daily candles don't change more frequently

export function useWatchlistData(symbols: string[]) {
  const [state, setState] = useState<WatchlistPollingState>({
    entries: [],
    isLoading: false,
    isRefreshing: false,
    errors: new Map(),
    lastUpdate: null,
  });

  // Refs to track current symbols and avoid stale closures
  const pollTimerRef = useRef<PollTimer | null>(null);
  const currentSymbolsRef = useRef<string[]>(symbols);

  /**
   * Fetch latest prices from API
   *
   * @param isRefresh - True if this is a background refresh (shows isRefreshing state)
   */
  const fetchPrices = useCallback(async (isRefresh = false) => {
    // Don't fetch if no symbols
    if (symbols.length === 0) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        entries: [],
        errors: new Map(),
      }));
      return;
    }

    // Cancel if symbols changed (avoid race conditions)
    if (JSON.stringify(symbols) !== JSON.stringify(currentSymbolsRef.current)) {
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
      errors: new Map(), // Clear previous errors
    }));

    try {
      const prices = await getLatestPrices(symbols);

      // Create a map of symbol -> price data for easy lookup
      const priceMap = new Map<string, WatchlistItem>();
      const errorMap = new Map<string, string>();

      for (const item of prices) {
        if (item.error) {
          errorMap.set(item.symbol, item.error);
        }
        // Store all items with prices (even if price is null/undefined)
        priceMap.set(item.symbol, item);
      }

      // Create entries for ALL symbols, even those without price data
      // This ensures the watchlist always shows all symbols, making them all interactive
      const allEntries: WatchlistItem[] = symbols.map(symbol => {
        const priceData = priceMap.get(symbol);
        return priceData || { symbol, price: undefined, changePercent: undefined };
      });

      setState(prev => ({
        ...prev,
        entries: allEntries,
        isLoading: false,
        isRefreshing: false,
        errors: errorMap,
        lastUpdate: new Date(),
      }));
    } catch (err) {
      // On error, still return all symbols without price data
      const allEntries: WatchlistItem[] = symbols.map(symbol => ({
        symbol,
        price: undefined,
        changePercent: undefined,
      }));

      setState(prev => ({
        ...prev,
        entries: allEntries,
        isLoading: false,
        isRefreshing: false,
        errors: new Map(symbols.map(s => [s, err instanceof Error ? err.message : 'Failed to fetch prices'])),
        lastUpdate: new Date(),
      }));
    }
  }, [symbols]);

  /**
   * Manual refresh function - allows user to trigger refresh on demand
   */
  const refresh = useCallback(() => {
    fetchPrices(false);
  }, [fetchPrices]);

  /**
   * Setup polling on mount and when symbols change
   */
  useEffect(() => {
    // Update refs
    currentSymbolsRef.current = [...symbols];

    // Cancel existing timer if any
    if (pollTimerRef.current) {
      clearPollTimer(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // Don't start polling if no symbols
    if (symbols.length === 0) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        entries: [],
        errors: new Map(),
        lastUpdate: null,
      }));
      return;
    }

    // Initial fetch
    fetchPrices();

    // Setup polling timer (60 seconds per spec)
    pollTimerRef.current = createPollTimer(() => {
      fetchPrices(true); // Background refresh
    }, WATCHLIST_POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (pollTimerRef.current) {
        clearPollTimer(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [symbols, fetchPrices]);

  return {
    ...state,
    refresh,
  };
}
