/**
 * Tests for chartHelpers utilities
 * Feature: 003-advanced-indicators
 * Phase 5: User Story 3 - Generic Frontend Rendering Helpers
 * Tasks: T053-T056
 */

import { describe, it, expect } from 'vitest';
import {
  formatDataForChart,
  splitSeriesByThresholds,
  splitSeriesByTrend,
  type DataPoint,
  type Thresholds,
} from '../../src/utils/chartHelpers';

describe('formatDataForChart', () => {
  // T053 [US3] [P]: Write tests for formatDataForChart
  it('should convert timestamps and values to DataPoint format', () => {
    const timestamps = ['2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z', '2023-01-03T00:00:00Z'];
    const values = [100, 101, 102];

    const result = formatDataForChart(timestamps, values);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ time: Math.floor(new Date('2023-01-01T00:00:00Z').getTime() / 1000), value: 100 });
    expect(result[1].value).toBe(101);
    expect(result[2].value).toBe(102);
  });

  it('should handle Unix timestamps', () => {
    const timestamps = [1672531200, 1672617600, 1672704000]; // 2023-01-01, 2023-01-02, 2023-01-03
    const values = [100, 101, 102];

    const result = formatDataForChart(timestamps, values);

    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(1672531200);
    expect(result[1].time).toBe(1672617600);
    expect(result[2].time).toBe(1672704000);
  });

  // T056 [US3]: Write tests for null value handling
  it('should handle null values', () => {
    const timestamps = ['2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z', '2023-01-03T00:00:00Z'];
    const values = [100, null, 102];

    const result = formatDataForChart(timestamps, values);

    // Null values should be filtered out
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(100);
    expect(result[1].value).toBe(102);
  });

  it('should return empty array for empty input', () => {
    expect(formatDataForChart([], [])).toEqual([]);
    expect(formatDataForChart(undefined, undefined)).toEqual([]);
  });

  it('should remove duplicate timestamps', () => {
    const timestamps = [1672531200, 1672531200, 1672617600];
    const values = [100, 101, 102];

    const result = formatDataForChart(timestamps, values);

    // First occurrence should be kept
    expect(result).toHaveLength(2);
    expect(result[0].time).toBe(1672531200);
    expect(result[0].value).toBe(100); // First value
  });

  it('should sort by timestamp', () => {
    const timestamps = [1672617600, 1672531200, 1672704000]; // Out of order
    const values = [101, 100, 102];

    const result = formatDataForChart(timestamps, values);

    expect(result[0].time).toBe(1672531200);
    expect(result[1].time).toBe(1672617600);
    expect(result[2].time).toBe(1672704000);
  });
});

describe('splitSeriesByThresholds', () => {
  // T054 [US3] [P]: Write tests for splitSeriesByThresholds
  it('should split data into above, neutral, and below segments', () => {
    const data: DataPoint[] = [
      { time: 1, value: 50 },
      { time: 2, value: 75 },  // Above threshold (70)
      { time: 3, value: 60 },
      { time: 4, value: 20 },  // Below threshold (30)
      { time: 5, value: 50 },
    ];
    const thresholds: Thresholds = { high: 70, low: 30 };

    const result = splitSeriesByThresholds(data, thresholds);

    expect(result.above).toHaveLength(2); // 75, 60 (transition point included)
    expect(result.neutral).toHaveLength(4); // 50, 75 (transition), 60, 20 (transition)
    expect(result.below).toHaveLength(3); // 20, 50 (transition)
  });

  it('should handle all values above threshold', () => {
    const data: DataPoint[] = [
      { time: 1, value: 80 },
      { time: 2, value: 90 },
      { time: 3, value: 85 },
    ];
    const thresholds: Thresholds = { high: 70, low: 30 };

    const result = splitSeriesByThresholds(data, thresholds);

    expect(result.above).toHaveLength(3);
    expect(result.neutral).toHaveLength(0);
    expect(result.below).toHaveLength(0);
  });

  it('should handle all values below threshold', () => {
    const data: DataPoint[] = [
      { time: 1, value: 20 },
      { time: 2, value: 10 },
      { time: 3, value: 25 },
    ];
    const thresholds: Thresholds = { high: 70, low: 30 };

    const result = splitSeriesByThresholds(data, thresholds);

    expect(result.above).toHaveLength(0);
    expect(result.neutral).toHaveLength(0);
    expect(result.below).toHaveLength(3);
  });

  it('should handle empty data', () => {
    const result = splitSeriesByThresholds([], { high: 70, low: 30 });

    expect(result.above).toEqual([]);
    expect(result.neutral).toEqual([]);
    expect(result.below).toEqual([]);
  });
});

describe('splitSeriesByTrend', () => {
  // T055 [US3] [P]: Write tests for splitSeriesByTrend
  it('should split data into up, down, and neutral segments', () => {
    const data: DataPoint[] = [
      { time: 1, value: 50 },
      { time: 2, value: 60 },  // Up
      { time: 3, value: 55 },  // Down
      { time: 4, value: 55 },  // Neutral (same value)
      { time: 5, value: 65 },  // Up
    ];

    const result = splitSeriesByTrend(data);

    expect(result.up).toBeTruthy();
    expect(result.down).toBeTruthy();
    expect(result.neutral).toBeTruthy();
  });

  it('should detect up trend', () => {
    const data: DataPoint[] = [
      { time: 1, value: 50 },
      { time: 2, value: 60 },
      { time: 3, value: 70 },
    ];

    const result = splitSeriesByTrend(data);

    expect(result.up).toHaveLength(3);
    expect(result.down).toHaveLength(0);
    expect(result.neutral).toHaveLength(0);
  });

  it('should detect down trend', () => {
    const data: DataPoint[] = [
      { time: 1, value: 70 },
      { time: 2, value: 60 },
      { time: 3, value: 50 },
    ];

    const result = splitSeriesByTrend(data);

    expect(result.up).toHaveLength(0);
    expect(result.down).toHaveLength(3);
    expect(result.neutral).toHaveLength(0);
  });

  it('should handle flat (neutral) trend', () => {
    const data: DataPoint[] = [
      { time: 1, value: 50 },
      { time: 2, value: 50 },
      { time: 3, value: 50 },
    ];

    const result = splitSeriesByTrend(data);

    // All neutral
    expect(result.neutral).toHaveLength(3);
  });

  it('should handle empty data', () => {
    const result = splitSeriesByTrend([]);

    expect(result.up).toEqual([]);
    expect(result.down).toEqual([]);
    expect(result.neutral).toEqual([]);
  });

  it('should include transition points in both segments', () => {
    const data: DataPoint[] = [
      { time: 1, value: 50 },
      { time: 2, value: 60 },  // Peak
      { time: 3, value: 50 },  // Valley
    ];

    const result = splitSeriesByTrend(data);

    // Up segment: 50, 60 (transition point included)
    expect(result.up).toHaveLength(2);
    // Down segment: 60 (transition point included), 50
    expect(result.down).toHaveLength(2);
  });
});
