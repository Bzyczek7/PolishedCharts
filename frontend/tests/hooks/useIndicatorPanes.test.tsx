/**
 * TDD Test for useIndicatorPanes hook
 * Feature: 002-supercharts-visuals
 *
 * This test is written BEFORE implementation.
 * It should FAIL until the hook is properly implemented.
 */

import { renderHook, act } from '@testing-library/react';
import { IndicatorType } from '../../src/components/types/indicators';
import { useIndicatorPaneContext } from '../../src/contexts/IndicatorPaneContext';
import { IndicatorPaneProvider } from '../../src/contexts/IndicatorPaneContext';

// Wrapper to provide context
function createWrapper() {
  return function IndicatorPaneWrapper({ children }: { children: React.ReactNode }) {
    return <IndicatorPaneProvider>{children}</IndicatorPaneProvider>;
  };
}

describe('useIndicatorPanes (TDD - FAILING TEST)', () => {
  describe('Pane management', () => {
    it('should initialize with empty panes array', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.panes).toEqual([]);
      expect(result.current.focusedPaneId).toBeNull();
    });

    it('should add a new pane', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      expect(result.current.panes).toHaveLength(1);
      expect(result.current.panes[0].indicatorType.name).toBe('RSI');
      expect(result.current.panes[0].displaySettings.visible).toBe(true);
      expect(result.current.panes[0].displaySettings.height).toBe(25);
    });

    it('should auto-focus newly added pane', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'oscillator',
        name: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      const paneId = result.current.panes[0].id;
      expect(result.current.focusedPaneId).toBe(paneId);
    });

    it('should add pane at specific position', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      const macdType: IndicatorType = {
        category: 'oscillator',
        name: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      };

      // Add first pane
      act(() => {
        result.current.addPane(rsiType);
      });

      expect(result.current.panes[0].displaySettings.position).toBe(1);

      // Add second pane at position 1 (should shift first to position 2)
      act(() => {
        result.current.addPane(macdType, 1);
      });

      expect(result.current.panes).toHaveLength(2);
      expect(result.current.panes[0].indicatorType.name).toBe('MACD');
      expect(result.current.panes[0].displaySettings.position).toBe(1);
      expect(result.current.panes[1].indicatorType.name).toBe('RSI');
      expect(result.current.panes[1].displaySettings.position).toBe(2);
    });

    it('should remove a pane', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(rsiType);
      });

      const paneId = result.current.panes[0].id;

      act(() => {
        result.current.removePane(paneId);
      });

      expect(result.current.panes).toEqual([]);
    });

    it('should shift panes up after removing a pane', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      const macdType: IndicatorType = {
        category: 'oscillator',
        name: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      };

      act(() => {
        result.current.addPane(rsiType);
        result.current.addPane(macdType);
      });

      const firstPaneId = result.current.panes[0].id;

      // Remove first pane
      act(() => {
        result.current.removePane(firstPaneId);
      });

      expect(result.current.panes).toHaveLength(1);
      expect(result.current.panes[0].displaySettings.position).toBe(1);
    });

    it('should clear all panes', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(rsiType);
        result.current.addPane(rsiType);
      });

      act(() => {
        result.current.clearAllPanes();
      });

      expect(result.current.panes).toEqual([]);
      expect(result.current.focusedPaneId).toBeNull();
    });
  });

  describe('Pane properties', () => {
    it('should set pane height', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      const paneId = result.current.panes[0].id;

      act(() => {
        result.current.setPaneHeight(paneId, 40);
      });

      expect(result.current.panes[0].displaySettings.height).toBe(40);
    });

    it('should set pane visibility', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      const paneId = result.current.panes[0].id;

      expect(result.current.panes[0].displaySettings.visible).toBe(true);

      act(() => {
        result.current.setPaneVisibility(paneId, false);
      });

      expect(result.current.panes[0].displaySettings.visible).toBe(false);
    });

    it('should set pane position', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      const macdType: IndicatorType = {
        category: 'oscillator',
        name: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      };

      const stochType: IndicatorType = {
        category: 'oscillator',
        name: 'Stochastic',
        params: { kPeriod: 14, dPeriod: 3 },
      };

      act(() => {
        result.current.addPane(rsiType);
        result.current.addPane(macdType);
        result.current.addPane(stochType);
      });

      const lastPaneId = result.current.panes[2].id;

      // Move last pane to first position
      act(() => {
        result.current.setPanePosition(lastPaneId, 1);
      });

      expect(result.current.panes[0].id).toBe(lastPaneId);
      expect(result.current.panes[0].displaySettings.position).toBe(1);
      expect(result.current.panes[1].displaySettings.position).toBe(2);
      expect(result.current.panes[2].displaySettings.position).toBe(3);
    });
  });

  describe('Focus state', () => {
    it('should set focused pane', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      const macdType: IndicatorType = {
        category: 'oscillator',
        name: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      };

      act(() => {
        result.current.addPane(rsiType);
        result.current.addPane(macdType);
      });

      const firstPaneId = result.current.panes[0].id;

      act(() => {
        result.current.setFocusedPane(firstPaneId);
      });

      expect(result.current.focusedPaneId).toBe(firstPaneId);
      expect(result.current.panes[0].focusState).toBe('focused');
      expect(result.current.panes[1].focusState).toBe('inactive');
    });

    it('should clear focus when set to null', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(rsiType);
      });

      const paneId = result.current.panes[0].id;

      act(() => {
        result.current.setFocusedPane(paneId);
      });

      expect(result.current.panes[0].focusState).toBe('focused');

      act(() => {
        result.current.setFocusedPane(null);
      });

      expect(result.current.focusedPaneId).toBeNull();
      expect(result.current.panes[0].focusState).toBe('active');
    });
  });

  describe('Panes reordering', () => {
    it('should reorder panes by new order array', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      const macdType: IndicatorType = {
        category: 'oscillator',
        name: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      };

      const stochType: IndicatorType = {
        category: 'oscillator',
        name: 'Stochastic',
        params: { kPeriod: 14, dPeriod: 3 },
      };

      act(() => {
        result.current.addPane(rsiType);
        result.current.addPane(macdType);
        result.current.addPane(stochType);
      });

      const ids = result.current.panes.map(p => p.id);
      const [first, second, third] = ids;

      // Reverse order
      act(() => {
        result.current.reorderPanes([third, second, first]);
      });

      expect(result.current.panes[0].id).toBe(third);
      expect(result.current.panes[1].id).toBe(second);
      expect(result.current.panes[2].id).toBe(first);
    });
  });

  describe('Get pane by ID', () => {
    it('should return pane by ID', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const rsiType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(rsiType);
      });

      const paneId = result.current.panes[0].id;
      const pane = result.current.getPaneById(paneId);

      expect(pane).toBeDefined();
      expect(pane?.id).toBe(paneId);
    });

    it('should return undefined for non-existent pane', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const pane = result.current.getPaneById('non-existent');

      expect(pane).toBeUndefined();
    });
  });

  describe('Indicator display names', () => {
    it('should create display name for indicator with params', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      expect(result.current.panes[0].name).toBe('RSI (period=14)');
    });

    it('should create display name for indicator with multiple params', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'oscillator',
        name: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      expect(result.current.panes[0].name).toContain('MACD');
      expect(result.current.panes[0].name).toContain('fastPeriod=12');
    });

    it('should set oscillator scale range', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'oscillator',
        name: 'RSI',
        params: { period: 14 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      expect(result.current.panes[0].scaleRange).toEqual({
        min: 0,
        max: 100,
        auto: false,
      });
    });

    it('should not set scale range for overlay indicators', () => {
      const { result } = renderHook(() => useIndicatorPaneContext(), {
        wrapper: createWrapper(),
      });

      const indicatorType: IndicatorType = {
        category: 'overlay',
        name: 'SMA',
        params: { period: 20 },
      };

      act(() => {
        result.current.addPane(indicatorType);
      });

      expect(result.current.panes[0].scaleRange).toBeUndefined();
    });
  });
});
