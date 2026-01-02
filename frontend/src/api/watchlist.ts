/**
 * Watchlist API client
 * Feature: 009-watchlist-search-add
 * Feature: 011-firebase-auth (guest localStorage support)
 *
 * Provides methods for searching symbols and managing the user's personal watchlist.
 */

import client from './client'
import { createAuthenticatedAxios } from '@/services/authService'
import type { GuestWatchlist } from '../types/auth'

// =============================================================================
// Guest Watchlist Storage (localStorage)
// =============================================================================

const STORAGE_KEY = 'polishedcharts_data'

/**
 * Get the guest watchlist from localStorage.
 */
function getGuestWatchlistData(): any {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return {
      schemaVersion: 1,
      alerts: [],
      watchlist: {
        uuid: crypto.randomUUID(),
        symbols: [],
        sort_order: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      layouts: [],
    }
  }

  try {
    const data = JSON.parse(raw)
    // Ensure watchlist exists
    if (!data.watchlist) {
      data.watchlist = {
        uuid: crypto.randomUUID(),
        symbols: [],
        sort_order: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      data.schemaVersion = data.schemaVersion || 1
    }
    return data
  } catch (e) {
    console.error('Failed to parse localStorage:', e)
    return {
      schemaVersion: 1,
      alerts: [],
      watchlist: {
        uuid: crypto.randomUUID(),
        symbols: [],
        sort_order: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      layouts: [],
    }
  }
}

/**
 * Save guest watchlist data to localStorage.
 */
function saveGuestWatchlistData(data: any): void {
  data.watchlist.updated_at = new Date().toISOString()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Get guest watchlist from localStorage.
 * Returns the GuestWatchlist object.
 */
export function getGuestWatchlist(): GuestWatchlist {
  const data = getGuestWatchlistData()
  return data.watchlist
}

/**
 * Add a symbol to the guest watchlist in localStorage.
 */
export function addGuestSymbol(symbol: string): 'added' | 'already_present' {
  const normalizedSymbol = symbol.toUpperCase().trim()
  const data = getGuestWatchlistData()

  // Check if symbol already exists
  if (data.watchlist.symbols.includes(normalizedSymbol)) {
    return 'already_present'
  }

  // Add to symbols array
  data.watchlist.symbols.push(normalizedSymbol)

  // Add to sort_order if not already there
  if (!data.watchlist.sort_order.includes(normalizedSymbol)) {
    data.watchlist.sort_order.push(normalizedSymbol)
  }

  saveGuestWatchlistData(data)
  return 'added'
}

/**
 * Remove a symbol from the guest watchlist in localStorage.
 */
export function removeGuestSymbol(symbol: string): void {
  const normalizedSymbol = symbol.toUpperCase().trim()
  const data = getGuestWatchlistData()

  data.watchlist.symbols = data.watchlist.symbols.filter((s: string) => s !== normalizedSymbol)
  data.watchlist.sort_order = data.watchlist.sort_order.filter((s: string) => s !== normalizedSymbol)

  saveGuestWatchlistData(data)
}

/**
 * Update the order of symbols in the guest watchlist.
 */
export function updateGuestWatchlistOrder(orderedSymbols: string[]): void {
  const data = getGuestWatchlistData()

  // Only keep symbols that exist in the watchlist
  const validSymbols = orderedSymbols.filter((s: string) => data.watchlist.symbols.includes(s))

  // Update sort_order
  data.watchlist.sort_order = validSymbols

  saveGuestWatchlistData(data)
}

/**
 * Symbol search result
 */
export interface SymbolSearchResult {
  symbol: string
  display_name: string
}

/**
 * Watchlist entry
 */
export interface WatchlistEntry {
  id: number
  symbol: string
  added_at: string
  sort_order: number
}

/**
 * Watchlist add response
 */
export interface WatchlistAddResponse {
  status: 'added' | 'already_present'
  symbol: string
}

/**
 * Watchlist reorder request
 */
export interface WatchlistReorderRequest {
  ordered_symbols: string[]
}

/**
 * Watchlist reorder response
 */
export interface WatchlistReorderResponse {
  status: string
}

/**
 * Error response
 */
export interface WatchlistError {
  detail: string
}

/**
 * Search for ticker symbols in the ticker_universe table
 * GET /api/v1/symbols/search
 */
export const searchSymbols = async (
  query: string
): Promise<SymbolSearchResult[]> => {
  if (query.length < 1 || query.length > 5) {
    throw new Error('Query must be between 1 and 5 characters')
  }

  const response = await client.get<SymbolSearchResult[]>('/symbols/search', {
    params: { q: query }
  })
  return response.data
}

/**
 * List all watchlist entries for authenticated user
 * GET /api/v1/watchlist
 */
export const getWatchlist = async (): Promise<WatchlistEntry[]> => {
  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<WatchlistEntry[]>('/watchlist')
  return response.data
}

/**
 * Add a symbol to the watchlist
 * POST /api/v1/watchlist
 */
export const addToWatchlist = async (
  symbol: string
): Promise<WatchlistAddResponse> => {
  const normalizedSymbol = symbol.toUpperCase().trim()
  const authClient = await createAuthenticatedAxios()
  const response = await authClient.post<WatchlistAddResponse>('/watchlist', {
    symbol: normalizedSymbol
  })
  return response.data
}

/**
 * Remove a symbol from the watchlist
 * DELETE /api/v1/watchlist/{symbol}
 */
export const removeFromWatchlist = async (symbol: string): Promise<void> => {
  const normalizedSymbol = symbol.toUpperCase().trim()
  const authClient = await createAuthenticatedAxios()
  await authClient.delete(`/watchlist/${normalizedSymbol}`)
}

/**
 * Update the order of watchlist entries
 * PUT /api/v1/watchlist/order
 */
export const updateWatchlistOrder = async (
  orderedSymbols: string[]
): Promise<WatchlistReorderResponse> => {
  const authClient = await createAuthenticatedAxios()
  const response = await authClient.put<WatchlistReorderResponse>('/watchlist/order', {
    ordered_symbols: orderedSymbols
  })
  return response.data
}

// Legacy types for backward compatibility
export interface WatchlistItem {
  symbol: string
  price?: number
  change?: number
  changePercent?: number
  timestamp?: string
  error?: string
}

// Legacy function - now uses the candles/latest_prices endpoint
export const getLatestPrices = async (symbols: string[]): Promise<WatchlistItem[]> => {
  try {
    const symbolsParam = symbols.join(',')
    const response = await client.get<WatchlistItem[]>(`/candles/latest_prices/${symbolsParam}`)
    return response.data
  } catch (error) {
    console.error('Error fetching latest prices:', error)
    return symbols.map(symbol => ({
      symbol,
      error: 'Failed to fetch data'
    }))
  }
}
