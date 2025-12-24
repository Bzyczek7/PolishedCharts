/**
 * useChartState hook
 * Feature: 002-supercharts-visuals
 *
 * Convenience hook for accessing chart state from context.
 * All state management is handled by ChartStateContext.
 */

import { useChartStateContext } from '../contexts/ChartStateContext';

/**
 * Hook to access and manipulate chart state
 *
 * @example
 * ```tsx
 * const { state, setSymbol, setInterval } = useChartState();
 * ```
 *
 * Provides access to:
 * - state: Current chart state (symbol, interval, zoom, scroll, etc.)
 * - setSymbol: Update the trading symbol
 * - setInterval: Update the chart interval
 * - setZoom: Update zoom level (clamped to min/max)
 * - setScroll: Update scroll position
 * - setVisibleTimeRange: Update the visible time range
 * - setActiveTool: Update the active drawing tool
 * - setFocusedPane: Update the focused pane
 * - setTheme: Update theme settings (handled by ThemeSettingsProvider)
 * - setDataAvailable: Update data availability flag
 * - setLoading: Update loading state
 * - setError: Update error state
 */
export function useChartState() {
  const context = useChartStateContext();
  return context;
}
