/**
 * TDD Test for useChartState hook
 * Feature: 002-supercharts-visuals
 *
 * This test is written BEFORE implementation.
 * It should FAIL until the hook is properly implemented.
 */

import { renderHook, act } from '@testing-library/react';
import { useChartStateContext } from '../../src/contexts/ChartStateContext';
import { ChartStateProvider } from '../../src/contexts/ChartStateContext';

// Wrapper to provide context
function createWrapper() {
  return function ChartStateWrapper({ children }: { children: React.ReactNode }) {
    return <ChartStateProvider>{children}</ChartStateProvider>;
  };
}

describe('useChartState (TDD - FAILING TEST)', () => {
  it('should initialize with default symbol and interval', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state.symbol).toBe('AAPL');
    expect(result.current.state.interval).toBe('1D');
  });

  it('should update symbol when setSymbol is called', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSymbol('TSLA');
    });

    expect(result.current.state.symbol).toBe('TSLA');
  });

  it('should update interval when setInterval is called', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setInterval('1h');
    });

    expect(result.current.state.interval).toBe('1h');
  });

  it('should update zoom level within limits', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    // Test zoom in
    act(() => {
      result.current.setZoom(5);
    });

    expect(result.current.state.zoom.level).toBe(5);

    // Test clamping to max
    act(() => {
      result.current.setZoom(20);
    });

    expect(result.current.state.zoom.level).toBe(10); // maxLevel

    // Test clamping to min
    act(() => {
      result.current.setZoom(0);
    });

    expect(result.current.state.zoom.level).toBe(1); // min level
  });

  it('should update scroll position', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setScroll(100, 50);
    });

    expect(result.current.state.scroll.position).toBe(100);
    expect(result.current.state.scroll.offset).toBe(50);
  });

  it('should update visible time range', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    const from = Date.now() - 86400000;
    const to = Date.now();

    act(() => {
      result.current.setVisibleTimeRange(from, to);
    });

    expect(result.current.state.visibleTimeRange?.from).toBe(from);
    expect(result.current.state.visibleTimeRange?.to).toBe(to);
  });

  it('should update active tool', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setActiveTool('trendline');
    });

    expect(result.current.state.activeTool).toBe('trendline');
  });

  it('should update focused pane', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setFocusedPane('indicator-1');
    });

    expect(result.current.state.focusedPaneId).toBe('indicator-1');
  });

  it('should update loading state', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state.loading).toBe(false);

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.state.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.state.loading).toBe(false);
  });

  it('should update error state', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state.error).toBeUndefined();

    act(() => {
      result.current.setError('Failed to fetch data');
    });

    expect(result.current.state.error).toBe('Failed to fetch data');

    act(() => {
      result.current.setError();
    });

    expect(result.current.state.error).toBeUndefined();
  });

  it('should update data available flag', () => {
    const { result } = renderHook(() => useChartStateContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state.dataAvailable).toBe(false);

    act(() => {
      result.current.setDataAvailable(true);
    });

    expect(result.current.state.dataAvailable).toBe(true);
  });
});
