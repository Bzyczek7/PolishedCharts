/**
 * TDD Test for useCrosshair hook
 * Feature: 002-supercharts-visuals
 *
 * This test is written BEFORE implementation.
 * It should FAIL until the hook is properly implemented.
 */

import { renderHook, act } from '@testing-library/react';
import { useCrosshairContext } from '../../src/contexts/CrosshairContext';
import { CrosshairProvider } from '../../src/contexts/CrosshairContext';

// Wrapper to provide context
function createWrapper() {
  return function CrosshairContextWrapper({ children }: { children: React.ReactNode }) {
    return <CrosshairProvider>{children}</CrosshairProvider>;
  };
}

describe('useCrosshair (TDD - FAILING TEST)', () => {
  it('should initialize with hidden crosshair', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state.visible).toBe(false);
  });

  it('should show crosshair with time index', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.showCrosshair(100);
    });

    expect(result.current.state.visible).toBe(true);
    expect(result.current.state.timeIndex).toBe(100);
  });

  it('should show crosshair with time index and price', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.showCrosshair(50, 150.25);
    });

    expect(result.current.state.visible).toBe(true);
    expect(result.current.state.timeIndex).toBe(50);
    expect(result.current.state.price).toBe(150.25);
  });

  it('should show crosshair with source pane ID', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.showCrosshair(75, 200.50, 'indicator-rsi');
    });

    expect(result.current.state.visible).toBe(true);
    expect(result.current.state.sourcePaneId).toBe('indicator-rsi');
  });

  it('should hide crosshair when hideCrosshair is called', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    // First show it
    act(() => {
      result.current.showCrosshair(100, 150.0);
    });

    expect(result.current.state.visible).toBe(true);

    // Then hide it
    act(() => {
      result.current.hideCrosshair();
    });

    expect(result.current.state.visible).toBe(false);
  });

  it('should toggle visibility with setCrosshairVisible', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state.visible).toBe(false);

    // Show it
    act(() => {
      result.current.setCrosshairVisible(true);
    });

    expect(result.current.state.visible).toBe(true);

    // Hide it
    act(() => {
      result.current.setCrosshairVisible(false);
    });

    expect(result.current.state.visible).toBe(false);
  });

  it('should preserve time index when toggling visibility', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    // Set up crosshair
    act(() => {
      result.current.showCrosshair(42, 175.50, 'main');
    });

    const timeIndex = result.current.state.timeIndex;
    const price = result.current.state.price;
    const sourcePaneId = result.current.state.sourcePaneId;

    // Hide without clearing data
    act(() => {
      result.current.setCrosshairVisible(false);
    });

    expect(result.current.state.visible).toBe(false);
    expect(result.current.state.timeIndex).toBe(timeIndex);
    expect(result.current.state.price).toBe(price);
    expect(result.current.state.sourcePaneId).toBe(sourcePaneId);

    // Show again - data should be preserved
    act(() => {
      result.current.setCrosshairVisible(true);
    });

    expect(result.current.state.visible).toBe(true);
    expect(result.current.state.timeIndex).toBe(timeIndex);
    expect(result.current.state.price).toBe(price);
    expect(result.current.state.sourcePaneId).toBe(sourcePaneId);
  });

  it('should support pane synchronization by tracking source pane', () => {
    const { result } = renderHook(() => useCrosshairContext(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.showCrosshair(10, 100.0, 'main');
    });

    expect(result.current.state.sourcePaneId).toBe('main');

    // Update from different pane (simulating sync)
    act(() => {
      result.current.showCrosshair(10, 70.5, 'indicator-rsi');
    });

    expect(result.current.state.sourcePaneId).toBe('indicator-rsi');
    expect(result.current.state.price).toBe(70.5);
  });
});
