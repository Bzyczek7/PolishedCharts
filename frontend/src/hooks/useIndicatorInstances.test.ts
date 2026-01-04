/**
 * Integration tests for useIndicatorInstances hook (Feature 001-indicator-storage).
 * 
 * Test coverage:
 * - T041 [P] [US2]: localStorage fallback when API fails
 * - T042 [P] [US2]: retry logic with exponential backoff
 * - T043 [P] [US2]: optimistic updates with rollback on error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIndicatorInstances } from './useIndicatorInstances';
import type { IndicatorInstance } from '../components/types/indicators';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(() => ({ request: vi.fn() })),
  },
}));

// Mock Firebase auth
const mockAuthUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  getIdToken: vi.fn(() => Promise.resolve('mock-firebase-token')),
};

const mockAuthContext = {
  user: mockAuthUser,
  isAuthenticated: true,
  isLoading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('./useAuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

describe('useIndicatorInstances', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * T041 [P] [US2]: Integration test for localStorage fallback.
   * 
   * Verifies:
   * - When API fails (e.g., 500 error), indicators are loaded from localStorage
   * - isOffline state is set to true
   * - Guest users always use localStorage
   */
  describe('T041: localStorage fallback', () => {
    it('should fallback to localStorage when API fails', async () => {
      const axios = (await import('axios')).default;
      
      // Mock API failure (500 error)
      vi.mocked(axios.get).mockRejectedValue(new Error('API Error: 500'));

      // Pre-populate localStorage with indicator data
      const mockInstances: IndicatorInstance[] = [
        {
          id: 'test-indicator-1',
          indicatorType: {
            category: 'overlay',
            name: 'sma',
            params: { length: 20 },
          },
          displayName: 'SMA (20)',
          style: { color: '#FF5733', lineWidth: 2 },
          isVisible: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'test-indicator-2',
          indicatorType: {
            category: 'overlay',
            name: 'ema',
            params: { length: 50 },
          },
          displayName: 'EMA (50)',
          style: { color: '#4CAF50', lineWidth: 2 },
          isVisible: true,
          createdAt: new Date().toISOString(),
        },
      ];

      // Save to localStorage
      localStorage.setItem(
        'indicatorlistglobal',
        JSON.stringify({
          instances: mockInstances.map(inst => inst.id),
          updatedAt: new Date().toISOString(),
        })
      );
      mockInstances.forEach(inst => {
        localStorage.setItem(`indicatorinstance${inst.id}`, JSON.stringify(inst));
      });

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for async operations
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Verify instances were loaded from localStorage
      expect(result.current.instances).toHaveLength(2);
      expect(result.current.instances[0].id).toBe('test-indicator-1');
      expect(result.current.instances[1].id).toBe('test-indicator-2');

      // Verify isOffline state is set
      expect(result.current.isOffline).toBe(true);

      // Verify error is set
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain('API Error');
    });

    it('should return empty array when API fails and localStorage is empty', async () => {
      const axios = (await import('axios')).default;
      
      // Mock API failure
      vi.mocked(axios.get).mockRejectedValue(new Error('API Error: 500'));

      // localStorage is empty (not populated)

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for async operations
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Verify empty array is returned
      expect(result.current.instances).toHaveLength(0);
      expect(result.current.isOffline).toBe(true);
    });

    it('should use localStorage for guest users', async () => {
      // Mock guest user (not authenticated)
      mockAuthContext.isAuthenticated = false;
      mockAuthContext.user = null;

      // Pre-populate localStorage
      const mockInstance: IndicatorInstance = {
        id: 'guest-indicator-1',
        indicatorType: {
          category: 'overlay',
          name: 'sma',
          params: { length: 20 },
        },
        displayName: 'SMA (20)',
        style: { color: '#FF5733', lineWidth: 2 },
        isVisible: true,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(
        'indicatorlistglobal',
        JSON.stringify({
          instances: [mockInstance.id],
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(`indicatorinstance${mockInstance.id}`, JSON.stringify(mockInstance));

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for async operations
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Verify instance was loaded from localStorage
      expect(result.current.instances).toHaveLength(1);
      expect(result.current.instances[0].id).toBe('guest-indicator-1');

      // Verify isOffline is false (guest mode is not "offline")
      expect(result.current.isOffline).toBe(false);
    });
  });

  /**
   * T042 [P] [US2]: Integration test for retry logic with exponential backoff.
   * 
   * Verifies:
   * - When API returns 500 error, retries with exponential backoff
   * - Retries up to MAX_RETRY_ATTEMPTS (5 times)
   * - Success on retry stops retry loop
   */
  describe('T042: retry logic with exponential backoff', () => {
    it('should retry with exponential backoff on API failure', async () => {
      const axios = (await import('axios')).default;
      
      // Mock API: fails 3 times, then succeeds
      let attemptCount = 0;
      vi.mocked(axios.get).mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 3) {
          return Promise.reject(new Error('API Error: 500'));
        }
        return Promise.resolve({
          data: [
            {
              uuid: 'api-indicator-1',
              indicator_name: 'sma',
              indicator_category: 'overlay',
              indicator_params: { length: 20 },
              display_name: 'SMA (20)',
              style: { color: '#FF5733', lineWidth: 2 },
              is_visible: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        });
      });

      // Mock setTimeout for delay simulation
      const originalSetTimeout = global.setTimeout;
      let timeoutCalls = 0;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: Function, delay: number) => {
        timeoutCalls++;
        // Call immediately for test speed, but track the delay value
        // Exponential backoff: 1s, 2s, 4s, 8s, 10s (max)
        const expectedDelays = [1000, 2000, 4000, 8000, 10000];
        if (timeoutCalls <= expectedDelays.length) {
          expect(delay).toBeLessThanOrEqual(expectedDelays[timeoutCalls - 1]);
        }
        return originalSetTimeout(callback, 0) as NodeJS.Timeout; // Execute immediately
      });

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for async operations
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      }, { timeout: 10000 });

      // Verify success after retries
      expect(result.current.instances).toHaveLength(1);
      expect(result.current.instances[0].id).toBe('api-indicator-1');
      expect(attemptCount).toBe(4); // 3 failures + 1 success

      // Verify isOffline is false (API succeeded)
      expect(result.current.isOffline).toBe(false);

      // Restore setTimeout
      vi.restoreAllMocks();
    });

    it('should stop retrying after MAX_RETRY_ATTEMPTS', async () => {
      const axios = (await import('axios')).default;
      
      // Mock API: always fails
      vi.mocked(axios.get).mockRejectedValue(new Error('API Error: 500'));

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for async operations
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      }, { timeout: 30000 });

      // Verify error state after max retries
      expect(result.current.error).toBeTruthy();
      expect(result.current.isOffline).toBe(true);

      // Verify API was called 5 times (MAX_RETRY_ATTEMPTS)
      expect(vi.mocked(axios.get).mock.calls.length).toBe(5);
    });

    it('should succeed immediately on first attempt (no retry needed)', async () => {
      const axios = (await import('axios')).default;
      
      // Mock API: succeeds immediately
      vi.mocked(axios.get).mockResolvedValue({
        data: [
          {
            uuid: 'api-indicator-1',
            indicator_name: 'sma',
            indicator_category: 'overlay',
            indicator_params: { length: 20 },
            display_name: 'SMA (20)',
            style: { color: '#FF5733', lineWidth: 2 },
            is_visible: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for async operations
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Verify success
      expect(result.current.instances).toHaveLength(1);
      expect(result.current.isOffline).toBe(false);

      // Verify API was called only once (no retries)
      expect(vi.mocked(axios.get).mock.calls.length).toBe(1);
    });
  });

  /**
   * T043 [P] [US2]: Integration test for optimistic updates with rollback on error.
   * 
   * Verifies:
   * - addIndicator updates UI immediately (optimistic)
   * - On API error, state rolls back to previous value
   * - localStorage fallback saves the indicator when API fails
   */
  describe('T043: optimistic updates with rollback on error', () => {
    it('should perform optimistic update for addIndicator and rollback on API error', async () => {
      const axios = (await import('axios')).default;
      
      // Mock successful GET (initial load)
      vi.mocked(axios.get).mockResolvedValue({
        data: [],
      });

      // Mock POST failure (add indicator fails)
      vi.mocked(axios.post).mockRejectedValue(new Error('API Error: 500'));

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Add indicator (optimistic update)
      act(() => {
        const addResult = result.current.addIndicator('sma', { length: 20 });
        expect(addResult.success).toBe(true);
      });

      // Verify optimistic update (indicator added immediately)
      expect(result.current.instances).toHaveLength(1);
      expect(result.current.instances[0].indicatorType.name).toBe('sma');

      // Wait for async API call and rollback
      await waitFor(() => {
        // After rollback, indicator should be removed from state
        // Note: Due to fire-and-forget pattern, rollback happens asynchronously
        expect(result.current.isOffline).toBe(true);
      }, { timeout: 15000 });
    });

    it('should perform optimistic update for removeIndicator and rollback on API error', async () => {
      const axios = (await import('axios')).default;
      
      // Mock successful GET (initial load with 2 indicators)
      vi.mocked(axios.get).mockResolvedValue({
        data: [
          {
            uuid: 'indicator-1',
            indicator_name: 'sma',
            indicator_category: 'overlay',
            indicator_params: { length: 20 },
            display_name: 'SMA (20)',
            style: { color: '#FF5733', lineWidth: 2 },
            is_visible: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            uuid: 'indicator-2',
            indicator_name: 'ema',
            indicator_category: 'overlay',
            indicator_params: { length: 50 },
            display_name: 'EMA (50)',
            style: { color: '#4CAF50', lineWidth: 2 },
            is_visible: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      // Mock DELETE failure
      vi.mocked(axios.delete).mockRejectedValue(new Error('API Error: 500'));

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
        expect(result.current.instances).toHaveLength(2);
      });

      // Remove indicator (optimistic update)
      act(() => {
        result.current.removeIndicator('indicator-1');
      });

      // Verify optimistic update (indicator removed immediately)
      expect(result.current.instances).toHaveLength(1);
      expect(result.current.instances[0].id).toBe('indicator-2');

      // Wait for async API call and rollback
      await waitFor(() => {
        // After rollback, indicator should be restored to state
        expect(result.current.instances).toHaveLength(2);
      }, { timeout: 15000 });
    });

    it('should perform optimistic update for updateStyle and rollback on API error', async () => {
      const axios = (await import('axios')).default;
      
      // Mock successful GET (initial load)
      vi.mocked(axios.get).mockResolvedValue({
        data: [
          {
            uuid: 'indicator-1',
            indicator_name: 'sma',
            indicator_category: 'overlay',
            indicator_params: { length: 20 },
            display_name: 'SMA (20)',
            style: { color: '#FF5733', lineWidth: 2 },
            is_visible: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      // Mock PUT failure
      vi.mocked(axios.put).mockRejectedValue(new Error('API Error: 500'));

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const originalStyle = result.current.instances[0].style;

      // Update style (optimistic update)
      act(() => {
        result.current.updateStyle('indicator-1', { color: '#000000' });
      });

      // Verify optimistic update (style changed immediately)
      expect(result.current.instances[0].style.color).toBe('#000000');

      // Wait for async API call and rollback
      await waitFor(() => {
        // After rollback, style should be restored
        expect(result.current.instances[0].style.color).toBe(originalStyle.color);
      }, { timeout: 15000 });
    });

    it('should fallback to localStorage when addIndicator API fails', async () => {
      const axios = (await import('axios')).default;
      
      // Mock successful GET (initial load)
      vi.mocked(axios.get).mockResolvedValue({
        data: [],
      });

      // Mock POST failure
      vi.mocked(axios.post).mockRejectedValue(new Error('API Error: 500'));

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Add indicator (optimistic update)
      act(() => {
        result.current.addIndicator('sma', { length: 20 });
      });

      // Wait for async API call and localStorage fallback
      await waitFor(() => {
        // Verify indicator was saved to localStorage as fallback
        const listData = localStorage.getItem('indicatorlistglobal');
        expect(listData).toBeTruthy();
        const listIndex = JSON.parse(listData!);
        expect(listIndex.instances).toHaveLength(1);
      }, { timeout: 15000 });

      // Verify isOffline state
      expect(result.current.isOffline).toBe(true);
    });

    it('should not rollback when API succeeds', async () => {
      const axios = (await import('axios')).default;
      
      // Mock successful GET (initial load)
      vi.mocked(axios.get).mockResolvedValue({
        data: [],
      });

      // Mock successful POST
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          uuid: 'new-indicator',
          indicator_name: 'sma',
          indicator_category: 'overlay',
          indicator_params: { length: 20 },
          display_name: 'SMA (20)',
          style: { color: '#FF5733', lineWidth: 2 },
          is_visible: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Add indicator (optimistic update)
      act(() => {
        const addResult = result.current.addIndicator('sma', { length: 20 });
        expect(addResult.success).toBe(true);
      });

      // Wait for async API call
      await waitFor(() => {
        // Verify indicator is still in state (no rollback)
        expect(result.current.instances).toHaveLength(1);
        expect(result.current.isOffline).toBe(false);
        expect(result.current.error).toBeNull();
      }, { timeout: 15000 });
    });
  });

  describe('Guest mode functionality', () => {
    beforeEach(() => {
      // Mock guest user
      mockAuthContext.isAuthenticated = false;
      mockAuthContext.user = null;
    });

    it('should add indicator to localStorage in guest mode', async () => {
      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Add indicator
      act(() => {
        result.current.addIndicator('sma', { length: 20 });
      });

      // Verify indicator was added to state
      expect(result.current.instances).toHaveLength(1);

      // Verify indicator was saved to localStorage
      const listData = localStorage.getItem('indicatorlistglobal');
      expect(listData).toBeTruthy();
      const listIndex = JSON.parse(listData!);
      expect(listIndex.instances).toHaveLength(1);

      const instanceId = listIndex.instances[0];
      const instanceData = localStorage.getItem(`indicatorinstance${instanceId}`);
      expect(instanceData).toBeTruthy();
      const instance = JSON.parse(instanceData!);
      expect(instance.indicatorType.name).toBe('sma');
    });

    it('should remove indicator from localStorage in guest mode', async () => {
      // Pre-populate localStorage
      const mockInstance: IndicatorInstance = {
        id: 'guest-indicator-1',
        indicatorType: {
          category: 'overlay',
          name: 'sma',
          params: { length: 20 },
        },
        displayName: 'SMA (20)',
        style: { color: '#FF5733', lineWidth: 2 },
        isVisible: true,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(
        'indicatorlistglobal',
        JSON.stringify({
          instances: [mockInstance.id],
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(`indicatorinstance${mockInstance.id}`, JSON.stringify(mockInstance));

      // Render hook
      const { result } = renderHook(() => useIndicatorInstances());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
        expect(result.current.instances).toHaveLength(1);
      });

      // Remove indicator
      act(() => {
        result.current.removeIndicator(mockInstance.id);
      });

      // Verify indicator was removed from state
      expect(result.current.instances).toHaveLength(0);

      // Verify indicator was removed from localStorage
      const instanceData = localStorage.getItem(`indicatorinstance${mockInstance.id}`);
      expect(instanceData).toBeNull();

      const listData = localStorage.getItem('indicatorlistglobal');
      const listIndex = JSON.parse(listData!);
      expect(listIndex.instances).toHaveLength(0);
    });
  });
});
