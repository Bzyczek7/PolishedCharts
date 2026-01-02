/**
 * Unit tests for formatIndicatorData helper function
 * Feature: 008-overlay-indicator-rendering
 * Task: T009 [P] [US1]
 */

import { describe, it, expect } from 'vitest';
import { formatIndicatorData, detectOverlayField, type ChartDataPoint } from '../chartHelpers';
import type { IndicatorOutput } from '../../components/types/indicators';

describe('formatIndicatorData', () => {
  // Mock IndicatorOutput data
  const mockIndicatorOutput: IndicatorOutput = {
    symbol: 'AAPL',
    interval: '1d',
    timestamps: [1704067200, 1704153600, 1704240000, 1704326400, 1704412800],
    data: {
      sma: [150.5, 151.2, 150.8, 152.1, 151.9],
    },
    metadata: {
      display_type: 'overlay',
      color_mode: 'single',
      color_schemes: { main: '#ff6d00' },
      series_metadata: [
        {
          field: 'sma',
          role: 'main',
          label: 'SMA(20)',
          line_color: '#ff6d00',
          line_style: 'solid',
          line_width: 2,
        },
      ],
    },
    calculated_at: '2024-01-01T00:00:00.000Z',
    data_points: 5,
  };

  describe('basic functionality', () => {
    it('should format indicator data correctly', () => {
      const result = formatIndicatorData(mockIndicatorOutput, 'sma');

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        time: 1704067200,
        value: 150.5,
      });
      expect(result[4]).toEqual({
        time: 1704412800,
        value: 151.9,
      });
    });

    it('should return empty array for null input', () => {
      const result = formatIndicatorData(null, 'sma');
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const result = formatIndicatorData(undefined, 'sma');
      expect(result).toEqual([]);
    });
  });

  describe('field detection', () => {
    it('should use specified field name when provided', () => {
      const result = formatIndicatorData(mockIndicatorOutput, 'sma');
      expect(result).toHaveLength(5);
    });

    it('should auto-detect field when not specified', () => {
      const result = formatIndicatorData(mockIndicatorOutput);
      expect(result).toHaveLength(5);
    });

    it('should return empty array for non-existent field', () => {
      const result = formatIndicatorData(mockIndicatorOutput, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('should detect common overlay fields in priority order', () => {
      expect(detectOverlayField(mockIndicatorOutput)).toBe('sma');
    });
  });

  describe('null value handling', () => {
    it('should filter out null values from data series', () => {
      const dataWithNulls: IndicatorOutput = {
        ...mockIndicatorOutput,
        data: {
          sma: [150.5, null, 150.8, null, 151.9],
        },
      };

      const result = formatIndicatorData(dataWithNulls, 'sma');

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(150.5);
      expect(result[1].value).toBe(150.8);
      expect(result[2].value).toBe(151.9);
    });

    it('should filter out undefined values from data series', () => {
      const dataWithUndefined: IndicatorOutput = {
        ...mockIndicatorOutput,
        data: {
          sma: [150.5, undefined, 150.8, undefined, 151.9],
        },
      };

      const result = formatIndicatorData(dataWithUndefined, 'sma');

      expect(result).toHaveLength(3);
    });

    it('should return empty array if all values are null', () => {
      const allNull: IndicatorOutput = {
        ...mockIndicatorOutput,
        data: {
          sma: [null, null, null],
        },
      };

      const result = formatIndicatorData(allNull, 'sma');

      expect(result).toEqual([]);
    });
  });

  describe('timestamp validation', () => {
    it('should handle invalid timestamps', () => {
      const invalidTimestamps: IndicatorOutput = {
        ...mockIndicatorOutput,
        timestamps: [NaN, 1704153600, 1704240000],
        data: {
          sma: [150.5, 151.2, 150.8],
        },
      };

      const result = formatIndicatorData(invalidTimestamps, 'sma');

      expect(result).toHaveLength(2); // NaN timestamp filtered out
      expect(result[0].time).toBe(1704153600);
    });

    it('should preserve numeric timestamps as-is', () => {
      const result = formatIndicatorData(mockIndicatorOutput, 'sma');

      expect(result[0].time).toBe(1704067200);
      expect(result[4].time).toBe(1704412800);
    });
  });

  describe('value validation', () => {
    it('should filter out NaN values', () => {
      const nanValues: IndicatorOutput = {
        ...mockIndicatorOutput,
        data: {
          sma: [150.5, NaN, 150.8],
        },
      };

      const result = formatIndicatorData(nanValues, 'sma');

      expect(result).toHaveLength(2);
      expect(result.every(p => !isNaN(p.value))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty timestamps array', () => {
      const emptyData: IndicatorOutput = {
        ...mockIndicatorOutput,
        timestamps: [],
        data: { sma: [] },
      };

      const result = formatIndicatorData(emptyData, 'sma');

      expect(result).toEqual([]);
    });

    it('should handle missing timestamps field', () => {
      const noTimestamps: IndicatorOutput = {
        ...mockIndicatorOutput,
        timestamps: undefined as any,
        data: { sma: [150.5] },
      };

      const result = formatIndicatorData(noTimestamps, 'sma');

      expect(result).toEqual([]);
    });

    it('should handle missing data field', () => {
      const noData: IndicatorOutput = {
        ...mockIndicatorOutput,
        timestamps: [1704067200],
        data: undefined as any,
      };

      const result = formatIndicatorData(noData, 'sma');

      expect(result).toEqual([]);
    });

    it('should handle empty data object', () => {
      const emptyDataObj: IndicatorOutput = {
        ...mockIndicatorOutput,
        timestamps: [1704067200],
        data: {},
      };

      const result = formatIndicatorData(emptyDataObj);

      // Should try to use first field (which doesn't exist), return empty
      expect(result).toEqual([]);
    });
  });

  describe('multi-field indicators', () => {
    it('should auto-detect first available field', () => {
      const multiField: IndicatorOutput = {
        ...mockIndicatorOutput,
        data: {
          ema: [150.0, 150.5, 151.0, 151.5, 152.0],
          sma: [150.5, 151.2, 150.8, 152.1, 151.9],
        },
      };

      const result = formatIndicatorData(multiField);

      // Should detect 'ema' first (in priority order)
      expect(result).toHaveLength(5);
      expect(result[0].value).toBe(150.0); // ema value
    });

    it('should use specified field even with multiple fields', () => {
      const multiField: IndicatorOutput = {
        ...mockIndicatorOutput,
        data: {
          ema: [150.0, 150.5, 151.0, 151.5, 152.0],
          sma: [150.5, 151.2, 150.8, 152.1, 151.9],
        },
      };

      const result = formatIndicatorData(multiField, 'sma');

      expect(result).toHaveLength(5);
      expect(result[0].value).toBe(150.5); // sma value
    });
  });

  describe('return type', () => {
    it('should return ChartDataPoint[] with correct structure', () => {
      const result = formatIndicatorData(mockIndicatorOutput, 'sma');

      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('time');
        expect(result[0]).toHaveProperty('value');
        expect(typeof result[0].time).toBe('number');
        expect(typeof result[0].value).toBe('number');
      }
    });
  });
});

describe('detectOverlayField', () => {
  it('should detect sma field', () => {
    const result = detectOverlayField({
      ...mockIndicatorOutput,
      data: { sma: [150.5] },
    });
    expect(result).toBe('sma');
  });

  it('should detect ema field', () => {
    const result = detectOverlayField({
      ...mockIndicatorOutput,
      data: { ema: [150.5] },
    });
    expect(result).toBe('ema');
  });

  it('should detect adxvma field', () => {
    const result = detectOverlayField({
      ...mockIndicatorOutput,
      data: { adxvma: [150.5] },
    });
    expect(result).toBe('adxvma');
  });

  it('should detect value field as fallback', () => {
    const result = detectOverlayField({
      ...mockIndicatorOutput,
      data: { value: [150.5] },
    });
    expect(result).toBe('value');
  });

  it('should return undefined for null input', () => {
    const result = detectOverlayField(null);
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty data object', () => {
    const result = detectOverlayField({
      ...mockIndicatorOutput,
      data: {},
    });
    expect(result).toBeUndefined();
  });

  it('should use first available field as ultimate fallback', () => {
    const result = detectOverlayField({
      ...mockIndicatorOutput,
      data: { unknownfield: [150.5] },
    });
    expect(result).toBe('unknownfield');
  });
});
