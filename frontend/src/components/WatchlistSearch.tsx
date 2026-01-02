/**
 * WatchlistSearch component
 * Feature: 009-watchlist-search-add
 *
 * Search dropdown for finding stock tickers with 300ms debounce.
 * Uses shadcn/ui Command component for accessibility and keyboard navigation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Search } from 'lucide-react'
import { searchSymbols, type SymbolSearchResult } from '@/api/watchlist'
import { Button } from '@/components/ui/button'

/**
 * Result type for symbol selection - always returns, never throws
 */
export type SymbolAddResult = { ok: true } | { ok: false; detail: string }

/**
 * Component props
 */
export interface WatchlistSearchProps {
  /** Whether the search dialog is open */
  open: boolean
  /** Called when the dialog should open or close */
  onOpenChange: (open: boolean) => void
  /** Called when a symbol is selected. Returns a promise for loading/error UX. */
  onSelectSymbol: (symbol: string) => Promise<SymbolAddResult>
  /** Optional class name for styling */
  className?: string
}

/**
 * Watchlist search dialog component
 *
 * Features:
 * - 300ms debounce on search input
 * - Query validation (1-5 characters)
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Loading state during search
 * - Empty state when no results found
 *
 * @example
 * const [open, setOpen] = useState(false)
 * const handleSelect = (symbol: string) => {
 *   console.log('Selected:', symbol)
 *   setOpen(false)
 * }
 *
 * <WatchlistSearch
 *   open={open}
 *   onOpenChange={setOpen}
 *   onSelectSymbol={handleSelect}
 * />
 */
export const WatchlistSearch: React.FC<WatchlistSearchProps> = ({
  open,
  onOpenChange,
  onSelectSymbol,
  className,
}) => {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SymbolSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isManualAdding, setIsManualAdding] = useState(false)
  const [manualAddError, setManualAddError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  // Cleanup on component unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Clear manualAddError when query changes (prevents stale errors while typing)
  useEffect(() => {
    setManualAddError(null)
  }, [query])

  // 300ms debounce for search input (per AC-001)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Fetch results when debounced query changes
  useEffect(() => {
    const fetchResults = async () => {
      // Clear previous errors
      setError(null)

      // Validate query length (1-5 characters per AC-005)
      if (!debouncedQuery || debouncedQuery.length < 1) {
        setResults([])
        setIsSearching(false)
        return
      }

      if (debouncedQuery.length > 5) {
        // Don't call search API for long queries - show empty state with manual add instead
        // Important: Don't set error here, or empty-state button won't render (!error)
        setResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      try {
        const data = await searchSymbols(debouncedQuery)
        setResults(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed'
        setError(message)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }

    fetchResults()
  }, [debouncedQuery])

  /**
   * Handle symbol selection
   */
  const handleSelectSymbol = useCallback(async (symbol: string) => {
    const result = await onSelectSymbol(symbol)

    if (!isMountedRef.current) return

    if (result.ok) {
      // Only close and reset on success
      onOpenChange(false)
      setQuery('')
      setResults([])
      setError(null)
      setIsManualAdding(false)
      setManualAddError(null)
    } else {
      // Show error - keep dialog open
      setManualAddError(result.detail)
    }
  }, [onSelectSymbol, onOpenChange])

  /**
   * Handle dialog close
   */
  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen)
    if (!isOpen) {
      // Reset state when closing
      setQuery('')
      setResults([])
      setError(null)
      setIsManualAdding(false)
      setManualAddError(null)
    }
  }, [onOpenChange])

  /**
   * Handle manual ticker addition when search returns no results.
   * Awaits onSelectSymbol to ensure proper loading/error UX.
   * Explicitly resets state on both success and error (doesn't rely on handleOpenChange).
   */
  const handleManualAdd = useCallback(async (ticker: string) => {
    setIsManualAdding(true)
    setManualAddError(null)

    const normalizedTicker = ticker.trim().toUpperCase()

    try {
      const result = await onSelectSymbol(normalizedTicker)

      if (!isMountedRef.current) return

      if (result.ok) {
        // Success - reset all state and close
        setQuery('')
        setResults([])
        setError(null)
        setIsManualAdding(false)
        setManualAddError(null)
        onOpenChange(false)
      } else {
        // Show error from backend - keep dialog open for retry
        setManualAddError(result.detail)
      }
    } finally {
      if (isMountedRef.current) {
        setIsManualAdding(false)
      }
    }
  }, [onSelectSymbol, onOpenChange])

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <Command className={className}>
        <CommandInput
          placeholder="Search symbols (e.g., AAPL)..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {/* Validation error */}
          {error && (
            <div className="py-6 text-center text-sm text-rose-500">
              {error}
            </div>
          )}

          {/* Loading state */}
          {isSearching && !error && (
            <div className="py-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-transparent" />
              Searching...
            </div>
          )}

          {/* Empty state with manual add option */}
          {!isSearching && !error && debouncedQuery && results.length === 0 && (
            <CommandEmpty>
              {!isSearching && !error && debouncedQuery && (
                <>
                  {isManualAdding ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-500 border-t-transparent" />
                      <p className="text-sm text-slate-500">
                        Validating <span className="font-bold text-slate-200">{debouncedQuery}</span> with Yahoo Finance...
                      </p>
                    </div>
                  ) : manualAddError ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="text-sm text-rose-500">{manualAddError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setManualAddError(null)}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="text-sm text-slate-500">
                        No symbols found for <span className="font-bold text-slate-200">"{debouncedQuery}"</span>
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleManualAdd(debouncedQuery)}
                        className="gap-2"
                        disabled={isManualAdding}
                      >
                        Add {debouncedQuery.toUpperCase()} to watchlist
                      </Button>
                      <p className="text-xs text-slate-600 max-w-[250px]">
                        Ticker will be validated with Yahoo Finance and historical data will be backfilled
                      </p>
                    </div>
                  )}
                </>
              )}
            </CommandEmpty>
          )}

          {/* Search results */}
          {!isSearching && !error && results.length > 0 && (
            <CommandGroup heading="Results">
              {results.map((result) => (
                <CommandItem
                  key={result.symbol}
                  value={result.symbol}
                  onSelect={() => handleSelectSymbol(result.symbol)}
                  className="cursor-pointer"
                >
                  <span className="font-bold text-black">{result.symbol}</span>
                  <span className="ml-2 text-slate-500 truncate">
                    {result.display_name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Initial empty state */}
          {!isSearching && !error && !debouncedQuery && (
            <div className="py-6 text-center text-sm text-slate-500">
              Type to search for stock symbols
            </div>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

/**
 * Search button trigger component
 *
 * Use this to open the search dialog. It renders a button with a search icon.
 *
 * @example
 * const [open, setOpen] = useState(false)
 *
 * <WatchlistSearchButton onClick={() => setOpen(true)} />
 * <WatchlistSearch
 *   open={open}
 *   onOpenChange={setOpen}
 *   onSelectSymbol={(symbol) => console.log(symbol)}
 * />
 */
export const WatchlistSearchButton: React.FC<{
  onClick: () => void
  className?: string
}> = ({ onClick, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label="Search symbols"
    >
      <Search className="h-4 w-4" />
    </button>
  )
}

export default WatchlistSearch
