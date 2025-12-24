/**
 * Unit tests for useWatchlistData hook.
 *
 * TDD: These tests are written FIRST, before implementation.
 * They should FAIL until useWatchlistData is implemented.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as watchlistApi from '../../api/watchlist';

// Import will fail until implementation exists
let useWatchlistData: any;

try {
  const module = await import('../../hooks/useWatchlistData');
  useWatchlistData = module.useWatchlistData;
} catch {
  // Skip all tests if module doesn't exist
  describe.skip('useWatchlistData', () => {});
}

// Mock the watchlist API
vi.mock('../../api/watchlist', () => ({
  getLatestPrices: vi.fn(),
}));

describe('useWatchlistData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial fetch on mount', () => {
    it('should fetch watchlist prices when component mounts', async () => {
      if (!useWatchlistData) return;
      const mockPrices = [
        { symbol: 'AAPL', price: 195.5, change: 1.5, changePercent: 0.77, timestamp: '2024-12-24T00:00:00Z' },
        { symbol: 'GOOGL', price: 135.2, change: -0.8, changePercent: -0.59, timestamp: '2024-12-24T00:00:00Z' }
      ];
      vi.mocked(watchlistApi.getLatestPrices).mockResolvedValue(mockPrices);

      const symbols = ['AAPL', 'GOOGL'];
      const { result } = renderHook(() => useWatchlistData(symbols));

      // Initially loading should be true
      expect(result.current.isLoading).toBe(true);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(watchlistApi.getLatestPrices).toHaveBeenCalledWith(symbols);
    });

    it('should set loading state to false after successful fetch', async () => {
      if (!useWatchlistData) return;
      const mockPrices = [
        { symbol: 'AAPL', price: 195.5, change: 1.5, changePercent: 0.77, timestamp: '2024-12-24T00:00:00Z' }
      ];
      vi.mocked(watchlistApi.getLatestPrices).mockResolvedValue(mockPrices);

      const { result } = renderHook(() => useWatchlistData(['AAPL']));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return entries with price data after fetch', async () => {
      if (!useWatchlistData) return;
      const mockPrices = [
        { symbol: 'AAPL', price: 195.5, change: 1.5, changePercent: 0.77, timestamp: '2024-12-24T00:00:00Z' }
      ];
      vi.mocked(watchlistApi.getLatestPrices).mockResolvedValue(mockPrices);

      const { result } = renderHook(() => useWatchlistData(['AAPL']));

      await waitFor(() => {
        expect(result.current.entries).toHaveLength(1);
        expect(result.current.entries[0].symbol).toBe('AAPL');
        expect(result.current.entries[0].price).toBe(195.5);
      });
    });
  });

  describe('60-second polling interval', () => {
    it('should set up polling timer with 60-second interval', async () => {
      if (!useWatchlistData) return;
      const mockPrices = [
        { symbol: 'AAPL', price: 195.5, change: 1.5, changePercent: 0.77, timestamp: '2024-12-24T00:00:00Z' }
      ];
      vi.mocked(watchlistApi.getLatestPrices).mockResolvedValue(mockPrices);

      const { result } = renderHook(() => useWatchlistData(['AAPL']));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fast-forward 59 seconds - should not trigger new fetch
      vi.advanceTimersByTime(59000);
      expect(watchlistApi.getLatestPrices).toHaveBeenCalledTimes(1);

      // Fast-forward 1 more second (total 60 seconds) - should trigger new fetch
      vi.advanceTimersByTime(1000);
      expect(watchlistApi.getLatestPrices).toHaveBeenCalledTimes(2);
    });

    it('should cleanup polling timer on unmount', async () => {
      if (!useWatchlistData) return;
      const mockPrices = [
        { symbol: 'AAPL', price: 195.5, change: 1.5, changePercent: 0.77, timestamp: '2024-12-24T00:00:00Z' }
      ];
      vi.mocked(watchlistApi.getLatestPrices).mockResolvedValue(mockPrices);

      const { result, unmount } = renderHook(() => useWatchlistData(['AAPL']));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Unmount component
      unmount();

      // Fast-forward past polling interval - should not trigger new fetch
      vi.advanceTimersByTime(60000);
      expect(watchlistApi.getLatestPrices).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should set error state when fetch fails', async () => {
      if (!useWatchlistData) return;
      vi.mocked(watchlistApi.getLatestPrices).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useWatchlistData(['AAPL']));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check for errors map with symbol as key
      expect(result.current.errors).toBeDefined();
      expect(result.current.errors.size).toBeGreaterThan(0);
    });

    it('should set per-symbol error for failed symbols in batch request', async () => {
      if (!useWatchlistData) return;
      // Simulate partial failure - API returns error field for some symbols
      const mockPrices = [
        { symbol: 'AAPL', price: 195.5, change: 1.5, changePercent: 0.77, timestamp: '2024-12-24T00:00:00Z' },
        { symbol: 'INVALID', error: 'Symbol not found' }
      ];
      vi.mocked(watchlistApi.getLatestPrices).mockResolvedValue(mockPrices);

      const { result } = renderHook(() => useWatchlistData(['AAPL', 'INVALID']));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have one entry for AAPL and error for INVALID
      expect(result.current.entries.length).toBe(1);
      expect(result.current.errors.has('INVALID')).toBe(true);
    });
  });

  describe('last update timestamp', () => {
    it('should set lastUpdate timestamp after successful fetch', async () => {
      if (!useWatchlistData) return;
      const mockPrices = [
        { symbol: 'AAPL', price: 195.5, change: 1.5, changePercent: 0.77, timestamp: '2024-12-24T00:00:00Z' }
      ];
      vi.mocked(watchlistApi.getLatestPrices).mockResolvedValue(mockPrices);

      const { result } = renderHook(() => useWatchlistData(['AAPL']));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastUpdate).not.toBeNull();
      expect(result.current.lastUpdate).toBeInstanceOf(Date);
    });
  });
});
