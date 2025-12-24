/**
 * WatchlistDataProvider Component
 *
 * Feature: 004-candle-data-refresh
 * Purpose: Wrapper component that uses useWatchlistData hook to provide polled watchlist data
 *
 * This component bridges the polling hook (useWatchlistData) with the Watchlist component.
 * It handles data fetching, polling refresh, and provides the data to children.
 */
import type { ReactNode } from 'react';
import { useWatchlistData } from '../hooks/useWatchlistData';
import type { WatchlistPollingState } from '../hooks/useWatchlistData';

export interface WatchlistDataProviderProps {
  symbols: string[];
  children: (state: WatchlistPollingState) => ReactNode;
}

/**
 * WatchlistDataProvider - uses useWatchlistData hook and passes state to children
 *
 * This allows Watchlist component to receive polled data without being tightly
 * coupled to the hook implementation.
 */
export function WatchlistDataProvider({ symbols, children }: WatchlistDataProviderProps) {
  const watchlistState = useWatchlistData(symbols);

  return <>{children(watchlistState)}</>;
}
