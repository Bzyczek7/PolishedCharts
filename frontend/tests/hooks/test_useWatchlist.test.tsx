/**
 * T019 [US1] Frontend unit test for useWatchlist hook
 *
 * Tests the watchlist hook state management and API integration:
 * - Fetches watchlist on mount
 * - Provides addSymbol and removeSymbol methods
 * - Manages loading and error states
 * - Returns entries and symbols arrays
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWatchlist } from '@/hooks/useWatchlist'

// Mock the watchlist API
vi.mock('@/api/watchlist', () => ({
  getWatchlist: vi.fn(),
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
}))

describe('useWatchlist Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Fetch on Mount', () => {
    it('should fetch watchlist on mount', async () => {
      const { getWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      mockGet.mockResolvedValue([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
        { id: 2, symbol: 'MSFT', added_at: '2025-01-02T00:00:00Z' },
      ])

      const { result } = renderHook(() => useWatchlist())

      // Initially should be loading
      expect(result.current.isLoading).toBe(true)

      // After fetch completes
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.symbols).toEqual(['AAPL', 'MSFT'])
    })

    it('should handle empty watchlist', async () => {
      const { getWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      mockGet.mockResolvedValue([])

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.entries).toEqual([])
      expect(result.current.symbols).toEqual([])
    })

    it('should set error state on fetch failure', async () => {
      const { getWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      mockGet.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.entries).toEqual([])
    })
  })

  describe('addSymbol Method', () => {
    it('should add symbol and refetch watchlist', async () => {
      const { getWatchlist, addToWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      const mockAdd = vi.mocked(addToWatchlist)

      // Initial watchlist
      mockGet.mockResolvedValueOnce([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
      ])

      // After add - updated watchlist
      mockGet.mockResolvedValueOnce([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
        { id: 2, symbol: 'TSLA', added_at: '2025-01-02T00:00:00Z' },
      ])

      // Add response
      mockAdd.mockResolvedValue({
        status: 'added',
        symbol: 'TSLA',
        candles_backfilled: 1253,
      })

      const { result } = renderHook(() => useWatchlist())

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Add symbol
      await act(async () => {
        const response = await result.current.addSymbol('TSLA')
        expect(response).toEqual({
          status: 'added',
          symbol: 'TSLA',
          candles_backfilled: 1253,
        })
      })

      // Should have called add API and refetched
      expect(mockAdd).toHaveBeenCalledWith('TSLA')
      expect(mockGet).toHaveBeenCalledTimes(2)

      // Entries should be updated
      await waitFor(() => {
        expect(result.current.entries).toHaveLength(2)
        expect(result.current.symbols).toContain('TSLA')
      })
    })

    it('should handle already_present status', async () => {
      const { getWatchlist, addToWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      const mockAdd = vi.mocked(addToWatchlist)

      mockGet.mockResolvedValue([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
      ])

      mockAdd.mockResolvedValue({
        status: 'already_present',
        symbol: 'AAPL',
      })

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Try to add duplicate
      await act(async () => {
        const response = await result.current.addSymbol('AAPL')
        expect(response.status).toBe('already_present')
      })

      // Should NOT refetch (already present means no change)
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('should set error state on add failure', async () => {
      const { getWatchlist, addToWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      const mockAdd = vi.mocked(addToWatchlist)

      mockGet.mockResolvedValue([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
      ])

      mockAdd.mockRejectedValue(new Error('Add failed'))

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Try to add and expect error
      await expect(async () => {
        await act(async () => {
          await result.current.addSymbol('TSLA')
        })
      }).rejects.toThrow('Add failed')

      expect(result.current.error).toBe('Add failed')
    })
  })

  describe('removeSymbol Method', () => {
    it('should remove symbol and refetch watchlist', async () => {
      const { getWatchlist, removeFromWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      const mockRemove = vi.mocked(removeFromWatchlist)

      // Initial watchlist
      mockGet.mockResolvedValueOnce([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
        { id: 2, symbol: 'TSLA', added_at: '2025-01-02T00:00:00Z' },
      ])

      // After remove - updated watchlist
      mockGet.mockResolvedValueOnce([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
      ])

      mockRemove.mockResolvedValue(undefined)

      const { result } = renderHook(() => useWatchlist())

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.symbols).toHaveLength(2)

      // Remove symbol
      await act(async () => {
        await result.current.removeSymbol('TSLA')
      })

      // Should have called remove API and refetched
      expect(mockRemove).toHaveBeenCalledWith('TSLA')
      expect(mockGet).toHaveBeenCalledTimes(2)

      // Entries should be updated
      await waitFor(() => {
        expect(result.current.symbols).not.toContain('TSLA')
        expect(result.current.symbols).toHaveLength(1)
      })
    })

    it('should set error state on remove failure', async () => {
      const { getWatchlist, removeFromWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)
      const mockRemove = vi.mocked(removeFromWatchlist)

      mockGet.mockResolvedValue([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
      ])

      mockRemove.mockRejectedValue(new Error('Remove failed'))

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Try to remove and expect error
      await expect(async () => {
        await act(async () => {
          await result.current.removeSymbol('AAPL')
        })
      }).rejects.toThrow('Remove failed')

      expect(result.current.error).toBe('Remove failed')
    })
  })

  describe('refetch Method', () => {
    it('should manually refetch watchlist', async () => {
      const { getWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)

      mockGet.mockResolvedValue([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
      ])

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockGet).toHaveBeenCalledTimes(1)

      // Manual refetch
      await act(async () => {
        await result.current.refetch()
      })

      expect(mockGet).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearError Method', () => {
    it('should clear error state', async () => {
      const { getWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)

      mockGet.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })

      // Clear error
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('Return Values', () => {
    it('should return entries with full data', async () => {
      const { getWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)

      mockGet.mockResolvedValue([
        {
          id: 1,
          symbol: 'AAPL',
          added_at: '2025-01-01T00:00:00Z',
        },
      ])

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.entries).toEqual([
        {
          id: 1,
          symbol: 'AAPL',
          added_at: '2025-01-01T00:00:00Z',
        },
      ])
    })

    it('should return symbols array with just symbol strings', async () => {
      const { getWatchlist } = await import('@/api/watchlist')
      const mockGet = vi.mocked(getWatchlist)

      mockGet.mockResolvedValue([
        { id: 1, symbol: 'AAPL', added_at: '2025-01-01T00:00:00Z' },
        { id: 2, symbol: 'MSFT', added_at: '2025-01-02T00:00:00Z' },
        { id: 3, symbol: 'TSLA', added_at: '2025-01-03T00:00:00Z' },
      ])

      const { result } = renderHook(() => useWatchlist())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.symbols).toEqual(['AAPL', 'MSFT', 'TSLA'])
    })
  })
})
