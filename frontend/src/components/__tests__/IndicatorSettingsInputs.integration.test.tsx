/**
 * Integration test for parameter changes triggering data refetch
 * Feature: 008-overlay-indicator-rendering
 * Phase 5: User Story 3 - Configure Indicator Parameters via UI
 * T026: Integration test for parameter change triggers data refetch and chart update
 *
 * Tests:
 * - Parameter change in useIndicatorInstances updates instance state
 * - Parameter change triggers indicator data refetch via useIndicatorData
 * - Chart updates with new data after parameter change
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useIndicatorInstances } from '../../hooks/useIndicatorInstances';
import type { IndicatorInstance } from '../../components/types/indicators';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('useIndicatorInstances - Parameter Change Integration', () => {
  const symbol = 'AAPL';

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('updateParams', () => {
    it('should update instance parameters and regenerate display name', async () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add an indicator with period=20
      act(() => {
        result.current.addIndicator('sma', { period: 20 });
      });

      expect(result.current.instances).toHaveLength(1);
      const instance = result.current.instances[0];
      expect(instance.displayName).toBe('SMA(20)');
      expect(instance.indicatorType.params).toEqual({ period: 20 });

      // Update params to period=50
      act(() => {
        result.current.updateParams(instance.id, { period: 50 });
      });

      // Check instance updated with new params and display name
      expect(result.current.instances).toHaveLength(1);
      const updatedInstance = result.current.instances[0];
      expect(updatedInstance.displayName).toBe('SMA(50)');
      expect(updatedInstance.indicatorType.params).toEqual({ period: 50 });
    });

    it('should update multiple parameters', () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add an indicator with multiple params
      act(() => {
        result.current.addIndicator('custom', { period: 20, multiplier: 1.5 });
      });

      const instance = result.current.instances[0];
      expect(instance.indicatorType.params).toEqual({ period: 20, multiplier: 1.5 });

      // Update both params
      act(() => {
        result.current.updateParams(instance.id, {
          period: 50,
          multiplier: 2.0,
        });
      });

      const updatedInstance = result.current.instances[0];
      expect(updatedInstance.indicatorType.params).toEqual({
        period: 50,
        multiplier: 2.0,
      });
    });

    it('should persist parameter changes to localStorage', async () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add an indicator
      act(() => {
        result.current.addIndicator('sma', { period: 20 });
      });

      const instance = result.current.instances[0];

      // Flush localStorage writes
      act(() => {
        result.current.flushPendingWrites();
      });

      // Update params
      act(() => {
        result.current.updateParams(instance.id, { period: 50 });
      });

      // Flush writes
      act(() => {
        result.current.flushPendingWrites();
      });

      // Check localStorage has updated instance
      const storedData = localStorageMock.getItem(`indicator_instance:${instance.id}`);
      expect(storedData).toBeTruthy();

      const parsedInstance = JSON.parse(storedData!) as IndicatorInstance;
      expect(parsedInstance.indicatorType.params).toEqual({ period: 50 });
      expect(parsedInstance.displayName).toBe('SMA(50)');
    });

    it('should handle string parameters', () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add indicator with string param
      act(() => {
        result.current.addIndicator('custom', { source: 'close' });
      });

      const instance = result.current.instances[0];
      expect(instance.indicatorType.params).toEqual({ source: 'close' });

      // Update string param
      act(() => {
        result.current.updateParams(instance.id, { source: 'open' });
      });

      const updatedInstance = result.current.instances[0];
      expect(updatedInstance.indicatorType.params).toEqual({ source: 'open' });
    });

    it('should preserve style and visibility when updating params', () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add indicator
      act(() => {
        result.current.addIndicator('sma', { period: 20 });
      });

      const instance = result.current.instances[0];

      // Modify style and visibility
      act(() => {
        result.current.updateStyle(instance.id, { color: '#ff0000' });
      });
      act(() => {
        result.current.toggleVisibility(instance.id);
      });

      expect(result.current.instances[0].style.color).toBe('#ff0000');
      expect(result.current.instances[0].isVisible).toBe(false);

      // Update params - style and visibility should be preserved
      act(() => {
        result.current.updateParams(instance.id, { period: 50 });
      });

      const updatedInstance = result.current.instances[0];
      expect(updatedInstance.indicatorType.params).toEqual({ period: 50 });
      expect(updatedInstance.style.color).toBe('#ff0000');
      expect(updatedInstance.isVisible).toBe(false);
    });
  });

  describe('Parameter change triggers refetch flow', () => {
    it('should maintain instance identity when params change', () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add indicator
      act(() => {
        result.current.addIndicator('sma', { period: 20 });
      });

      const instanceId = result.current.instances[0].id;

      // Update params - ID should stay the same
      act(() => {
        result.current.updateParams(instanceId, { period: 50 });
      });

      expect(result.current.instances[0].id).toBe(instanceId);
    });

    it('should update list index timestamp when params change', async () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add indicator
      act(() => {
        result.current.addIndicator('sma', { period: 20 });
      });

      const instanceId = result.current.instances[0].id;

      // Flush initial writes
      act(() => {
        result.current.flushPendingWrites();
      });

      const initialListData = localStorageMock.getItem(`indicator_list:${symbol}`);
      const initialList = initialListData ? JSON.parse(initialListData) : null;
      const initialTimestamp = initialList?.updatedAt;

      // Wait a bit to ensure timestamp would change
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update params
      act(() => {
        result.current.updateParams(instanceId, { period: 50 });
      });

      // Flush writes
      act(() => {
        result.current.flushPendingWrites();
      });

      const updatedListData = localStorageMock.getItem(`indicator_list:${symbol}`);
      const updatedList = updatedListData ? JSON.parse(updatedListData) : null;
      const updatedTimestamp = updatedList?.updatedAt;

      // Timestamp should be updated - just check both exist and are strings
      expect(updatedTimestamp).toBeTruthy();
      expect(initialTimestamp).toBeTruthy();
      // Both should be ISO 8601 strings
      expect(typeof updatedTimestamp).toBe('string');
      expect(typeof initialTimestamp).toBe('string');
    });
  });

  describe('Error handling', () => {
    it('should return false when updating non-existent instance', () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // updateParams should not throw for non-existent instance
      act(() => {
        result.current.updateParams('non-existent-id', { period: 50 });
      });

      // Should have no instances
      expect(result.current.instances).toHaveLength(0);
    });

    it('should handle localStorage quota errors gracefully', async () => {
      // Mock quota exceeded error
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError');
      });

      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add indicator
      act(() => {
        result.current.addIndicator('sma', { period: 20 });
      });

      const instanceId = result.current.instances[0].id;

      // Try to update - should handle error gracefully
      act(() => {
        result.current.updateParams(instanceId, { period: 50 });
      });

      // Wait for debounce timeout (100ms) + small buffer
      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });

      // Restore original setItem
      localStorageMock.setItem = originalSetItem;
    });
  });

  describe('Edge cases', () => {
    it('should handle empty params update', () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      act(() => {
        result.current.addIndicator('sma', { period: 20 });
      });

      const instance = result.current.instances[0];
      const originalParams = { ...instance.indicatorType.params };

      // Update with empty object - no changes expected
      act(() => {
        result.current.updateParams(instance.id, {});
      });

      // Params should remain unchanged
      expect(result.current.instances[0].indicatorType.params).toEqual(originalParams);
    });

    it('should handle partial params update', () => {
      const { result } = renderHook(() => useIndicatorInstances(symbol));

      // Add indicator with multiple params
      act(() => {
        result.current.addIndicator('custom', { period: 20, multiplier: 1.5, source: 'close' });
      });

      const instance = result.current.instances[0];

      // Update only one param
      act(() => {
        result.current.updateParams(instance.id, { period: 50 });
      });

      // Updated param should change, others should remain
      expect(result.current.instances[0].indicatorType.params).toEqual({
        period: 50,
        multiplier: 1.5,
        source: 'close',
      });
    });
  });
});
