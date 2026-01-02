/**
 * Performance test for symbol switch restore time.
 *
 * T107a [P]: Add symbol switch restore performance test (<1s requirement, SC-003)
 *
 * This test verifies that switching between symbols and restoring indicator
 * preferences completes in under 1 second as per SC-003.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndicators } from '@/hooks/useIndicators';

describe('Symbol Switch Restore Performance', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should restore indicators for symbol in under 1 second (SC-003)', () => {
    /**
     * T107a: Verify indicator preferences restore in under 1 second when switching symbols.
     *
     * Success Criteria (SC-003): Symbol switch + indicator restore must complete in <1s.
     */
    const { result } = renderHook(() => useIndicators());

    // Setup: Save indicators for AAPL
    act(() => {
      result.current.addIndicator('AAPL', {
        id: 'crsi',
        params: { period: 14 },
        visible: true
      });
      result.current.addIndicator('AAPL', {
        id: 'tdfi',
        params: { period: 14 },
        visible: true
      });
    });

    // Verify AAPL has 2 indicators
    expect(result.current.indicators['AAPL']?.indicators).toHaveLength(2);

    // Measure time to switch symbols (which includes saving current + loading new)
    const startTime = performance.now();

    act(() => {
      // Load indicators for TSLA (should be empty initially)
      const tslaIndicators = result.current.loadIndicatorsForSymbol('TSLA');
      expect(tslaIndicators).toEqual([]);
    });

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // Verify under 1 second (1000ms)
    expect(elapsedTimeMs).toBeLessThan(1000);
  });

  it('should restore complex indicator layout in under 1 second', () => {
    /**
     * T107a: Verify complex layouts (multiple indicators with custom params) restore quickly.
     */
    const { result } = renderHook(() => useIndicators());

    // Setup: Create complex layout for SPY with multiple indicators
    act(() => {
      result.current.addIndicator('SPY', {
        id: 'crsi',
        params: { period: 14 },
        visible: true
      });
      result.current.addIndicator('SPY', {
        id: 'tdfi',
        params: { period: 21 },
        visible: true
      });
      result.current.addIndicator('SPY', {
        id: 'adxvma',
        params: { period: 14 },
        visible: false
      });
      result.current.addIndicator('SPY', {
        id: 'ema',
        params: { period: 20 },
        visible: true
      });
      result.current.addIndicator('SPY', {
        id: 'sma',
        params: { period: 50 },
        visible: true
      });
    });

    // Verify SPY has 5 indicators
    expect(result.current.indicators['SPY']?.indicators).toHaveLength(5);

    // Measure time to load SPY indicators
    const startTime = performance.now();

    act(() => {
      const spyIndicators = result.current.loadIndicatorsForSymbol('SPY');
      expect(spyIndicators).toHaveLength(5);
    });

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // Verify under 1 second
    expect(elapsedTimeMs).toBeLessThan(1000);
  });

  it('should handle rapid symbol switches without performance degradation', () => {
    /**
     * T107a: Verify rapid symbol switching doesn't cause performance issues.
     */
    const { result } = renderHook(() => useIndicators());

    // Setup indicators for multiple symbols
    const symbols = ['AAPL', 'TSLA', 'SPY', 'QQQ', 'IWM'];
    symbols.forEach(symbol => {
      act(() => {
        result.current.addIndicator(symbol, {
          id: 'crsi',
          params: { period: 14 },
          visible: true
        });
      });
    });

    // Measure time for multiple rapid switches
    const startTime = performance.now();

    symbols.forEach(symbol => {
      act(() => {
        const indicators = result.current.loadIndicatorsForSymbol(symbol);
        expect(indicators).toHaveLength(1);
      });
    });

    const endTime = performance.now();
    const totalTimeMs = endTime - startTime;
    const avgTimePerSwitchMs = totalTimeMs / symbols.length;

    // Each switch should still be under 1 second on average
    expect(avgTimePerSwitchMs).toBeLessThan(1000);
  });

  it('should restore indicators with custom parameters in under 1 second', () => {
    /**
     * T107a: Verify custom parameters don't significantly impact restore time.
     */
    const { result } = renderHook(() => useIndicators());

    // Setup: Create indicators with custom parameters
    act(() => {
      result.current.addIndicator('AAPL', {
        id: 'crsi',
        params: { period: 21, upper_band: 80, lower_band: 20 },
        visible: true
      });
      result.current.addIndicator('AAPL', {
        id: 'tdfi',
        params: { period: 14, smoothing: 3 },
        visible: true,
        seriesVisibility: {
          tdfi: true,
          signal: false
        }
      });
    });

    // Measure restore time
    const startTime = performance.now();

    act(() => {
      const indicators = result.current.loadIndicatorsForSymbol('AAPL');
      expect(indicators).toHaveLength(2);

      // Verify parameters are preserved
      const crsi = indicators.find(i => i.id === 'crsi');
      expect(crsi?.params).toEqual({ period: 21, upper_band: 80, lower_band: 20 });

      const tdfi = indicators.find(i => i.id === 'tdfi');
      expect(tdfi?.params).toEqual({ period: 14, smoothing: 3 });
      expect(tdfi?.seriesVisibility).toEqual({ tdfi: true, signal: false });
    });

    const endTime = performance.now();
    const elapsedTimeMs = endTime - startTime;

    // Verify under 1 second
    expect(elapsedTimeMs).toBeLessThan(1000);
  });
});
