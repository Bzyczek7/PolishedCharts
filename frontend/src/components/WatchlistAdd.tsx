/**
 * WatchlistAdd component
 * Feature: 009-watchlist-search-add
 *
 * Button component for adding a selected symbol to the watchlist with loading state.
 * Shows loading spinner during the backfill operation (can take up to 60 seconds).
 */

import React, { useState, useCallback } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addToWatchlist, type WatchlistAddResponse } from '@/api/watchlist'
import {
  WatchlistSearch,
  WatchlistSearchButton,
  type SymbolAddResult,
} from './WatchlistSearch'

/**
 * Component props
 */
export interface WatchlistAddProps {
  /** Callback when a symbol is successfully added */
  onSymbolAdded?: (symbol: string, response: WatchlistAddResponse) => void
  /** Callback when add operation fails */
  onError?: (error: Error) => void
  /** Optional class name for styling */
  className?: string
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline'
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Watchlist add button component
 *
 * This component:
 * - Opens the search dialog on click
 * - Shows a loading state during backfill (up to 60 seconds)
 * - Handles success and error states
 * - Calls callbacks for parent component integration
 *
 * Usage:
 * 1. User clicks the "+" button
 * 2. Search dialog opens
 * 3. User selects a symbol (e.g., "AAPL")
 * 4. Loading state appears during backfill
 * 5. On success: onSymbolAdded is called
 * 6. On error: onError is called
 *
 * @example
 * <WatchlistAdd
 *   onSymbolAdded={(symbol, response) => {
 *     console.log(`Added ${symbol}: ${response.candles_backfilled} candles`)
 *   }}
 *   onError={(error) => {
 *     console.error('Failed to add:', error.message)
 *   }}
 * />
 */
export const WatchlistAdd: React.FC<WatchlistAddProps> = ({
  onSymbolAdded,
  onError,
  className,
  variant = 'ghost',
  size = 'icon',
}) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handle symbol selection from search
   * Triggers the add operation with backfill
   * CRITICAL: Never throw - always return { ok: true | false }
   */
  const handleSelectSymbol = useCallback(async (symbol: string): Promise<SymbolAddResult> => {
    setSelectedSymbol(symbol)
    setIsLoading(true)
    setError(null)

    try {
      const response = await addToWatchlist(symbol)

      // Handle already_present case
      if (response.status === 'already_present') {
        setError(`${symbol} is already in your watchlist`)
        onError?.(new Error(`${symbol} is already in your watchlist`))
        // Treat as success (user can still view the symbol)
        return { ok: true }
      }

      // Success - symbol added with backfill
      onSymbolAdded?.(symbol, response)
      return { ok: true }
    } catch (err) {
      // Parse error from Axios response
      const axiosError = err as { response?: { data?: { detail?: string } } }
      const errorDetail = axiosError.response?.data?.detail || ''

      // Backend error format: invalidticker, nodata, timeout, ratelimited
      if (errorDetail.startsWith('invalidticker')) {
        const msg = `${symbol} is not a valid ticker on Yahoo Finance`
        setError(msg)
        onError?.(new Error(msg))
        return { ok: false, detail: msg }
      } else if (errorDetail.startsWith('nodata')) {
        const msg = `No historical data available for ${symbol}`
        setError(msg)
        onError?.(new Error(msg))
        return { ok: false, detail: msg }
      } else if (errorDetail.startsWith('timeout')) {
        const msg = `Validation timed out. Yahoo Finance may be slow. Please try again.`
        setError(msg)
        onError?.(new Error(msg))
        return { ok: false, detail: msg }
      } else if (errorDetail.startsWith('ratelimited')) {
        const msg = `Rate limited by Yahoo Finance. Please wait a moment and try again.`
        setError(msg)
        onError?.(new Error(msg))
        return { ok: false, detail: msg }
      } else {
        const msg = errorDetail || `Failed to add ${symbol} to watchlist`
        setError(msg)
        onError?.(new Error(msg))
        return { ok: false, detail: msg }
      }
    } finally {
      setIsLoading(false)
      setSelectedSymbol(null)
    }
  }, [onSymbolAdded, onError])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <>
      {/* Add button with loading state */}
      {isLoading ? (
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled
          aria-label={`Adding ${selectedSymbol || 'symbol'}...`}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      ) : (
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={() => setSearchOpen(true)}
          aria-label="Add symbol to watchlist"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}

      {/* Search dialog */}
      <WatchlistSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectSymbol={handleSelectSymbol}
      />

      {/* Error display (optional - parent may want to handle this) */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-rose-500/10 border border-rose-500/50 text-rose-500 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-rose-500 hover:text-rose-400"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

/**
 * Standalone add button for use in other components
 *
 * Use this when you need more control over the layout or behavior.
 *
 * @example
 * const [loading, setLoading] = useState(false)
 * const handleAdd = async (symbol: string) => {
 *   setLoading(true)
 *   try {
 *     await addToWatchlist(symbol)
 *   } finally {
 *     setLoading(false)
 *   }
 * }
 *
 * <WatchlistAddButton
 *   loading={loading}
 *   onClick={() => {/* trigger add *\/}}
 * />
 */
export const WatchlistAddButton: React.FC<{
  loading?: boolean
  onClick?: () => void
  className?: string
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}> = ({
  loading = false,
  onClick,
  className,
  variant = 'ghost',
  size = 'icon',
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? 'Adding symbol...' : 'Add symbol to watchlist'}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
    </Button>
  )
}

export default WatchlistAdd
