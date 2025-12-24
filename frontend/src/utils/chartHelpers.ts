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
}

/**
 * Thresholds for splitSeriesByThresholds
 */
export interface Thresholds {
  high: number;
  low: number;
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

    // Handle both string timestamps and Unix timestamps
    const time = typeof ts === 'string'
      ? Math.floor(new Date(ts).getTime() / 1000)
      : typeof ts === 'number'
        ? ts
        : Math.floor(new Date(ts as any).getTime() / 1000);

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
