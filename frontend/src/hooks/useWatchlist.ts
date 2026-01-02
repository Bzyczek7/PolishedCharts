/**
 * useWatchlist hook
 * Feature: 009-watchlist-search-add
 * Feature: 011-firebase-auth (guest localStorage support)
 *
 * Custom hook for managing watchlist state with API integration.
 * Provides methods for listing, adding, and removing symbols from the watchlist.
 * Supports both guest mode (localStorage) and authenticated mode (API).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getWatchlist as apiGetWatchlist,
  addToWatchlist as apiAddToWatchlist,
  removeFromWatchlist as apiRemoveFromWatchlist,
  updateWatchlistOrder as apiUpdateWatchlistOrder,
  getGuestWatchlist,
  addGuestSymbol,
  removeGuestSymbol,
  updateGuestWatchlistOrder,
  type WatchlistEntry,
  type WatchlistAddResponse,
} from '@/api/watchlist'
import type { GuestWatchlist } from '../types/auth'

/**
 * Hook state and return type
 */
export interface UseWatchlistReturn {
  /** Current watchlist entries */
  entries: WatchlistEntry[]
  /** Array of symbol strings from the watchlist */
  symbols: string[]
  /** Loading state for watchlist operations */
  isLoading: boolean
  /** Error message if an operation failed */
  error: string | null
  /** Refresh the watchlist from the API or localStorage */
  refetch: () => Promise<void>
  /** Add a symbol to the watchlist (triggers backfill in authenticated mode) */
  addSymbol: (symbol: string) => Promise<WatchlistAddResponse | 'added' | 'already_present'>
  /** Remove a symbol from the watchlist */
  removeSymbol: (symbol: string) => Promise<void>
  /** Update the order of watchlist entries */
  updateOrder: (orderedSymbols: string[]) => Promise<void>
  /** Clear the error state */
  clearError: () => void
  /** Whether user is in guest mode */
  isGuest: boolean
}

/**
 * Convert GuestWatchlist to WatchlistEntry[] format for API compatibility.
 */
function guestWatchlistToEntries(guestWatchlist: GuestWatchlist): WatchlistEntry[] {
  return guestWatchlist.sort_order.map((symbol, index) => ({
    id: index, // Use index as fake ID for guest mode
    symbol,
    added_at: guestWatchlist.created_at,
    sort_order: index,
  }))
}

/**
 * Custom hook for managing the watchlist
 *
 * This hook:
 * - Fetches the watchlist from localStorage (guest) or API (authenticated) on mount
 * - Provides methods to add/remove symbols
 * - Manages loading and error states
 * - Returns both the full entries and just the symbol strings
 * - Automatically switches between guest and authenticated modes
 *
 * @param enabled - If false, will not fetch watchlist (useful when not authenticated)
 * @returns Watchlist state and operations
 *
 * @example
 * const { entries, symbols, addSymbol, removeSymbol, isLoading, error, isGuest } = useWatchlist()
 *
 * // Add a new symbol (with automatic backfill in authenticated mode)
 * await addSymbol('AAPL')
 *
 * // Remove a symbol
 * await removeSymbol('AAPL')
 *
 * // Display symbols
 * symbols.map(s => <div key={s}>{s}</div>)
 */
export const useWatchlist = (enabled: boolean = true): UseWatchlistReturn => {
  const { isAuthenticated, user } = useAuth()
  const isGuest = !isAuthenticated || !user

  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)  // Start as true to prevent race condition with symbol initialization
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch watchlist from API (authenticated) or localStorage (guest)
   */
  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (isGuest) {
        // Guest mode: fetch from localStorage
        const guestWatchlist = getGuestWatchlist()
        setEntries(guestWatchlistToEntries(guestWatchlist))
      } else {
        // Authenticated: fetch from API
        const data = await apiGetWatchlist()
        setEntries(data)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch watchlist'
      setError(message)
      console.error('Error fetching watchlist:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isGuest])

  /**
   * Add a symbol to the watchlist
   *
   * - Guest mode: Saves to localStorage
   * - Authenticated mode: Triggers the transactional backfill flow on the backend:
   *   1. Validate ticker exists in ticker_universe
   *   2. Get or create symbol entry
   *   3. Backfill full historical daily data (60s timeout)
   *   4. Create watchlist entry
   *
   * On success, the local watchlist is automatically refetched.
   */
  const addSymbol = useCallback(async (symbol: string): Promise<WatchlistAddResponse | 'added' | 'already_present'> => {
    setIsLoading(true)
    setError(null)
    try {
      if (isGuest) {
        // Guest mode: save to localStorage
        const result = addGuestSymbol(symbol)
        await refetch()
        return result
      } else {
        // Authenticated: send to API
        const result = await apiAddToWatchlist(symbol)

        // Only refetch if the symbol was actually added
        if (result.status === 'added' || result.status === 'already_present') {
          await refetch()
        }

        return result
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add symbol'
      setError(message)
      console.error('Error adding symbol:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [isGuest, refetch])

  /**
   * Remove a symbol from the watchlist
   *
   * - Guest mode: Removes from localStorage
   * - Authenticated mode: Deletes via backend API
   *
   * On success, the local watchlist is automatically refetched.
   */
  const removeSymbol = useCallback(async (symbol: string): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      if (isGuest) {
        // Guest mode: remove from localStorage
        removeGuestSymbol(symbol)
      } else {
        // Authenticated: delete via API
        await apiRemoveFromWatchlist(symbol)
      }
      await refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove symbol'
      setError(message)
      console.error('Error removing symbol:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [isGuest, refetch])

  /**
   * Update the order of watchlist entries
   *
   * - Guest mode: Updates localStorage
   * - Authenticated mode: Persists to backend so it survives page refreshes
   *
   * On success, the local watchlist is automatically refetched.
   */
  const updateOrder = useCallback(async (orderedSymbols: string[]): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      if (isGuest) {
        // Guest mode: update localStorage
        updateGuestWatchlistOrder(orderedSymbols)
      } else {
        // Authenticated: send to API
        await apiUpdateWatchlistOrder(orderedSymbols)
      }
      await refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update watchlist order'
      setError(message)
      console.error('Error updating watchlist order:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [isGuest, refetch])

  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Fetch watchlist on mount (only if enabled)
  useEffect(() => {
    if (enabled) {
      refetch()
    }
  }, [enabled, refetch])

  // Refetch when auth state changes (switch between guest/authenticated)
  useEffect(() => {
    if (enabled) {
      refetch()
    }
  }, [isGuest, enabled, refetch])

  // Memoize symbols array to prevent unnecessary re-renders
  const symbols = useMemo(() => entries.map((e) => e.symbol), [entries])

  return {
    entries,
    symbols,
    isLoading,
    error,
    refetch,
    addSymbol,
    removeSymbol,
    updateOrder,
    clearError,
    isGuest,
  }
}
