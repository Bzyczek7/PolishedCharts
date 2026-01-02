/**
 * Chart Helpers - Generic frontend rendering utilities for indicators
 * Feature: 003-advanced-indicators
 * Phase 5: User Story 3 - Generic Frontend Rendering Helpers
 * Tasks: T047-T052
 */

/**
 * Data point for chart rendering
 */
export interface DataPoint {
  time: number;
  value: number;
  color?: string;
}

/**
 * Thresholds for splitSeriesByThresholds
 */
export interface Thresholds {
  high: number;
  low: number;
}

/**
 * Convert timestamp to Unix seconds (lightweight-charts format).
 * Handles milliseconds, seconds, ISO strings, and date objects.
 *
 * @param ts - Timestamp (number, string, or Date)
 * @returns Unix seconds
 */
export function toUnixSeconds(ts: string | number | Date): number {
  // Handle Date objects
  if (ts instanceof Date) {
    return Math.floor(ts.getTime() / 1000);
  }

  // Handle strings - could be ISO string OR numeric string
  if (typeof ts === 'string') {
    const n = Number(ts);
    // If the string converts to a valid number, use it
    if (!isNaN(n)) {
      // It's a numeric string - could be seconds or milliseconds
      return n > 1e12 ? Math.floor(n / 1000) : n;
    }
    // It's an ISO string - parse it
    return Math.floor(new Date(ts).getTime() / 1000);
  }

  // Handle numbers
  const n = Number(ts);
  if (isNaN(n)) return 0; // Invalid timestamp
  // If it's larger than 1e12, it's milliseconds - convert to seconds
  // Otherwise assume it's already seconds
  return n > 1e12 ? Math.floor(n / 1000) : n;
}

/**
 * T047 [US3] [P]: Create formatDataForChart helper
 * T050 [US3]: Add null value handling to formatDataForChart
 *
 * Converts indicator output to lightweight-charts format.
 * Handles null values by filtering them out.
 *
 * @param timestamps - Array of timestamps (strings or Unix seconds)
 * @param values - Array of values (can contain null)
 * @returns Array of DataPoint formatted for lightweight-charts
 */
export function formatDataForChart(
  timestamps: (string | number)[] | undefined,
  values: (number | null)[] | undefined
): DataPoint[] {
  if (!timestamps || !values || timestamps.length === 0) {
    return [];
  }

  const formatted = values.map((v, i) => {
    // Null value handling (T050)
    if (v === null || v === undefined) return null;
    const ts = timestamps[i];
    if (!ts) return null;

    // Use robust timestamp converter
    const time = toUnixSeconds(ts);

    if (isNaN(time)) return null;

    return {
      time,
      value: v,
    };
  }).filter((item): item is DataPoint => item !== null);

  // Sort by time and remove duplicates
  const sorted = formatted.sort((a, b) => a.time - b.time);
  return sorted.filter(
    (item, index, arr) => index === 0 || item.time !== arr[index - 1].time
  );
}

/**
 * Finalizes a series by filtering invalid values and sorting by time.
 */
function finalize(arr: DataPoint[]): DataPoint[] {
  if (arr.length === 0) return [];

  return [...arr]
    .filter((p) => p.value !== undefined && p.value !== null && !isNaN(p.value))
    .sort((a, b) => a.time - b.time);
}

/**
 * T048 [US3] [P]: Create splitSeriesByThresholds helper
 * T051 [US3]: Add color state detection to splitSeriesByThresholds
 *
 * Splits a data series based on thresholds into sparse segments.
 * Returns three series: above (above high threshold), neutral (between), below (below low threshold).
 *
 * @param data - Array of DataPoint
 * @param thresholds - High and low threshold values
 * @returns Object with above, neutral, and below DataPoint arrays
 */
export function splitSeriesByThresholds(
  data: DataPoint[],
  thresholds: Thresholds
): { above: DataPoint[]; neutral: DataPoint[]; below: DataPoint[] } {
  if (data.length === 0) {
    return { above: [], neutral: [], below: [] };
  }

  const above: DataPoint[] = [];
  const neutral: DataPoint[] = [];
  const below: DataPoint[] = [];

  const getRegime = (val: number): 'above' | 'neutral' | 'below' => {
    if (val > thresholds.high) return 'above';
    if (val < thresholds.low) return 'below';
    return 'neutral';
  };

  let currentRegime = getRegime(data[0].value);
  let currentSegment: DataPoint[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const curr = data[i];
    const newRegime = getRegime(curr.value);

    if (newRegime === currentRegime) {
      currentSegment.push(curr);
    } else {
      // Regime changed - finalize current segment by including transition point
      currentSegment.push(curr);
      const target = currentRegime === 'above' ? above : currentRegime === 'below' ? below : neutral;
      target.push(...currentSegment);

      // Start new segment
      currentSegment = [curr];
      currentRegime = newRegime;
    }
  }

  if (currentSegment.length > 0) {
    const target = currentRegime === 'above' ? above : currentRegime === 'below' ? below : neutral;
    target.push(...currentSegment);
  }

  return {
    above: finalize(above),
    neutral: finalize(neutral),
    below: finalize(below),
  };
}

/**
 * T049 [US3] [P]: Create splitSeriesByTrend helper
 * T052 [US3]: Add slope calculation to splitSeriesByTrend
 *
 * Splits a series based on trend (up/down/neutral) into sparse segments.
 * Detects trend changes based on slope (comparison with previous value).
 *
 * @param data - Array of DataPoint
 * @returns Object with up, down, and neutral DataPoint arrays
 */
export function splitSeriesByTrend(
  data: DataPoint[]
): { up: DataPoint[]; down: DataPoint[]; neutral: DataPoint[] } {
  if (data.length === 0) {
    return { up: [], down: [], neutral: [] };
  }

  const up: DataPoint[] = [];
  const down: DataPoint[] = [];
  const neutral: DataPoint[] = [];

  let currentTrend: 'up' | 'down' | 'neutral' = 'neutral';
  let currentSegment: DataPoint[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    // Slope calculation (T052)
    let newTrend: 'up' | 'down' | 'neutral';
    if (curr.value > prev.value) newTrend = 'up';
    else if (curr.value < prev.value) newTrend = 'down';
    else newTrend = 'neutral';

    // Initialize trend from first comparison
    if (i === 1) currentTrend = newTrend;

    if (newTrend === currentTrend) {
      currentSegment.push(curr);
    } else {
      // Trend changed - finalize current segment by including transition point
      currentSegment.push(curr);
      const target = currentTrend === 'up' ? up : currentTrend === 'down' ? down : neutral;
      target.push(...currentSegment);

      // Start new segment
      currentSegment = [curr];
      currentTrend = newTrend;
    }
  }

  if (currentSegment.length > 0) {
    const target = currentTrend === 'up' ? up : currentTrend === 'down' ? down : neutral;
    target.push(...currentSegment);
  }

  return {
    up: finalize(up),
    down: finalize(down),
    neutral: finalize(neutral),
  };
}

/**
 * Re-exports from existing modules for backward compatibility
 * T057 [US3]: Update GenericIndicatorRenderer to use chartHelpers
 * T058 [US3]: Update IndicatorPane to use chartHelpers
 */
export * from '../lib/chartUtils';
export * from '../lib/indicatorTransform';

// ============================================================================
// Feature 008: Overlay Indicator Rendering & Configuration UI
// Formatting helpers for overlay indicator data
// ============================================================================

import type { IndicatorOutput } from '../components/types/indicators';
import type { Time } from 'lightweight-charts';

/**
 * Formatted data point for Lightweight Charts
 * Feature 008 - T012: formatIndicatorData helper function
 */
export interface ChartDataPoint {
  time: Time;
  value: number;
}

/**
 * Format indicator output data for Lightweight Charts overlay rendering
 * Feature 008 - T012 [P] [US1]: Create formatIndicatorData helper function
 *
 * Converts IndicatorOutput to ChartDataPoint[] format for line series.
 * Handles null values, timestamp conversion, and trend-based per-point coloring.
 *
 * @param data - IndicatorOutput from API or fixture
 * @param fieldName - Optional specific field name (e.g., 'sma', 'ema'). If not provided, auto-detects.
 * @param seriesColors - Optional per-series color overrides from instance.style.seriesColors
 *                      For trend indicators, supports 'bullish', 'neutral', 'bearish' keys
 * @returns Array of formatted data points for Lightweight Charts
 *
 * @example
 * ```ts
 * const indicatorData: IndicatorOutput = { ... };
 * const chartData = formatIndicatorData(indicatorData, 'sma');
 * // chartData = [{ time: 1704067200, value: 150.25 }, ...]
 *
 * // With user-configured trend colors
 * const chartData = formatIndicatorData(indicatorData, 'adxvma', {
 *   bullish: '#00FF00',
 *   neutral: '#FFFF00',
 *   bearish: '#ef5350',
 * });
 * ```
 */
export function formatIndicatorData(
  data: IndicatorOutput | null,
  fieldName?: string,
  seriesColors?: Record<string, string>
): DataPoint[] {
  if (!data || !data.timestamps || !data.data) {
    return [];
  }

  // Determine which field to use for overlay indicators
  // For overlays, look for common field names or use the first numeric field
  let valueField = fieldName;
  if (!valueField) {
    const possibleFields = ['sma', 'ema', 'adxvma', 'value', 'close'];
    valueField = possibleFields.find(field => data.data[field]);

    // If no common field found, use the first available field
    if (!valueField && Object.keys(data.data).length > 0) {
      valueField = Object.keys(data.data)[0];
    }
  }

  if (!valueField || !data.data[valueField]) {
    console.warn(`[formatIndicatorData] No valid data field found (tried: ${fieldName || 'auto-detect'})`);
    return [];
  }

  const values = data.data[valueField];
  if (!values || !Array.isArray(values)) {
    return [];
  }

  // Check for signal field for trend-based coloring (e.g., ADXVMA_Signal)
  const signalSeries = data.metadata?.series_metadata?.find(s => s.role === 'signal');
  const signalField = signalSeries?.field;
  const signalData = signalField ? data.data[signalField] : null;

  // Get trend colors with priority: seriesColors > metadata.color_schemes > defaults
  const colorSchemes = data.metadata?.color_schemes || {};
  const bullishColor = seriesColors?.bullish || colorSchemes.bullish || '#00FF00';  // Lime
  const neutralColor = seriesColors?.neutral || colorSchemes.neutral || '#FFFF00';  // Yellow
  const bearishColor = seriesColors?.bearish || colorSchemes.bearish || '#ef5350';  // Red

  // Use DataPoint (with optional color) instead of ChartDataPoint
  const result: DataPoint[] = [];

  for (let i = 0; i < data.timestamps.length; i++) {
    const timestamp = data.timestamps[i];
    const value = values[i];

    // Skip null/undefined values
    if (value === null || value === undefined) {
      continue;
    }

    // Validate timestamp
    if (typeof timestamp !== 'number' || isNaN(timestamp)) {
      continue;
    }

    // Validate value
    if (typeof value !== 'number' || isNaN(value)) {
      continue;
    }

    // Determine color based on signal if available
    let color: string | undefined;
    if (signalData && signalData[i] !== null && signalData[i] !== undefined) {
      const signal = signalData[i];
      if (signal === 1) color = bullishColor;
      else if (signal === 0) color = neutralColor;
      else if (signal === -1) color = bearishColor;
    }

    result.push({
      time: timestamp as number,
      value: value,
      color,
    });
  }

  return result;
}

/**
 * Auto-detect the primary value field for an overlay indicator
 * Feature 008 - Helper for formatIndicatorData
 *
 * @param data - IndicatorOutput from API or fixture
 * @returns Field name (e.g., 'sma', 'ema') or undefined if not found
 */
export function detectOverlayField(data: IndicatorOutput | null): string | undefined {
  if (!data || !data.data) {
    return undefined;
  }

  // Priority order for common overlay indicator field names
  const overlayFields = ['sma', 'ema', 'adxvma', 'value', 'close'];

  for (const field of overlayFields) {
    if (data.data[field] && Array.isArray(data.data[field])) {
      return field;
    }
  }

  // Fallback to first available field
  const firstField = Object.keys(data.data)[0];
  if (firstField && Array.isArray(data.data[firstField])) {
    return firstField;
  }

  return undefined;
}
