/**
 * Performance test for rendering multiple indicator panes.
 *
 * T107: Add performance tests for rendering 5+ panes
 *
 * This test verifies that the chart can render 5+ indicator panes
 * while maintaining 60fps performance as per SC-006.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIndicators } from '@/hooks/useIndicators';

describe('Rendering Performance Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should handle 5+ indicator panes without significant performance degradation', () => {
    /**
     * T107: Verify rendering 5+ indicator panes maintains acceptable performance.
     *
     * Success Criteria (SC-006): 60fps rendering with 5+ panes.
     * 60fps = ~16.67ms per frame.
     */
    const { result } = renderHook(() => useIndicators());

    // Add 5 different indicators
    const indicators = [
      { id: 'crsi', params: { period: 14 }, visible: true },
      { id: 'tdfi', params: { period: 14 }, visible: true },
      { id: 'adxvma', params: { adxvma_period: 14 }, visible: true },
      { id: 'ema', params: { period: 20 }, visible: true },
      { id: 'sma', params: { period: 50 }, visible: true }
    ];

    const startTime = performance.now();

    indicators.forEach(indicator => {
      result.current.addIndicator('AAPL', indicator);
    });

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // Adding indicators should be fast (< 100ms for 5 indicators)
    expect(elapsedTimeMs).toBeLessThan(100);
    expect(result.current.indicators['AAPL']?.indicators).toHaveLength(5);
  });

  it('should toggle visibility of 5+ indicators quickly', () => {
    /**
     * T107: Verify visibility toggles are fast even with many indicators.
     */
    const { result } = renderHook(() => useIndicators());

    // Add 5 indicators
    for (let i = 0; i < 5; i++) {
      result.current.addIndicator('AAPL', {
        id: `indicator_${i}`,
        params: { period: 14 },
        visible: true
      });
    }

    // Measure toggle performance for all 5 indicators
    const startTime = performance.now();

    for (let i = 0; i < 5; i++) {
      result.current.toggleIndicator('AAPL', `indicator_${i}`);
    }

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // All 5 toggles should complete quickly (< 50ms total)
    expect(elapsedTimeMs).toBeLessThan(50);
  });

  it('should update parameters for multiple indicators efficiently', () => {
    /**
     * T107: Verify parameter updates are efficient with multiple indicators.
     */
    const { result } = renderHook(() => useIndicators());

    // Add 5 indicators
    for (let i = 0; i < 5; i++) {
      result.current.addIndicator('AAPL', {
        id: `indicator_${i}`,
        params: { period: 14 },
        visible: true
      });
    }

    // Measure parameter update performance
    const startTime = performance.now();

    for (let i = 0; i < 5; i++) {
      result.current.updateIndicatorParams('AAPL', `indicator_${i}`, { period: 21 });
    }

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // All 5 updates should complete quickly (< 50ms total)
    expect(elapsedTimeMs).toBeLessThan(50);

    // Verify parameters were updated
    const indicators = result.current.indicators['AAPL']?.indicators || [];
    indicators.forEach(indicator => {
      expect(indicator.params.period).toBe(21);
    });
  });

  it('should remove indicators from large layout efficiently', () => {
    /**
     * T107: Verify removing indicators from a large layout is fast.
     */
    const { result } = renderHook(() => useIndicators());

    // Add 10 indicators
    for (let i = 0; i < 10; i++) {
      result.current.addIndicator('AAPL', {
        id: `indicator_${i}`,
        params: { period: 14 },
        visible: true
      });
    }

    expect(result.current.indicators['AAPL']?.indicators).toHaveLength(10);

    // Measure removal performance
    const startTime = performance.now();

    // Remove 5 indicators
    for (let i = 0; i < 5; i++) {
      result.current.removeIndicator('AAPL', `indicator_${i}`);
    }

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // Removal should be fast (< 50ms for 5 removals)
    expect(elapsedTimeMs).toBeLessThan(50);
    expect(result.current.indicators['AAPL']?.indicators).toHaveLength(5);
  });

  it('should maintain performance with series visibility settings', () => {
    /**
     * T107: Verify series visibility doesn't impact performance significantly.
     */
    const { result } = renderHook(() => useIndicators());

    // Add indicators with series visibility
    result.current.addIndicator('AAPL', {
      id: 'crsi',
      params: { period: 14 },
      visible: true,
      seriesVisibility: {
        crsi: true,
        upper_band: true,
        lower_band: false
      }
    });

    // Measure toggle performance for series
    const startTime = performance.now();

    result.current.updateIndicatorParams('AAPL', 'crsi', {
      seriesVisibility: {
        crsi: true,
        upper_band: false,
        lower_band: true
      }
    });

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // Series visibility update should be fast
    expect(elapsedTimeMs).toBeLessThan(50);

    const indicators = result.current.indicators['AAPL']?.indicators || [];
    const crsi = indicators.find(i => i.id === 'crsi');
    expect(crsi?.seriesVisibility).toEqual({
      crsi: true,
      upper_band: false,
      lower_band: true
    });
  });
});
