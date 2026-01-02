/**
 * Integration test for overlay indicator rendering in ChartComponent
 * Feature: 008-overlay-indicator-rendering
 * Task: T010 [P] [US1]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ChartComponent from '../ChartComponent';
import type { Candle } from '../../api/candles';
import type { OverlayIndicator } from '../ChartComponent';

// Mock lightweight-charts
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      applyOptions: vi.fn(),
      setMarkers: vi.fn(),
      priceScale: vi.fn(() => ({
        applyOptions: vi.fn(),
      })),
    })),
    removeSeries: vi.fn(),
    timeScale: vi.fn(() => ({
      subscribeVisibleLogicalRangeChange: vi.fn(),
      subscribeVisibleTimeRangeChange: vi.fn(),
      getVisibleLogicalRange: vi.fn(),
      setVisibleLogicalRange: vi.fn(),
      fitContent: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  })),
  ColorType: { Solid: 'solid' },
  LineStyle: { Solid: 0, Dotted: 2, Dashed: 1 },
  LineWidth: { 1: 1, 2: 2, 3: 3, 4: 4 },
  CandlestickSeries: {},
  HistogramSeries: {},
}));

describe('ChartComponent - Overlay Indicators Integration', () => {
  const mockCandles: Candle[] = [
    {
      timestamp: '2024-01-01T00:00:00Z',
      open: 150,
      high: 155,
      low: 149,
      close: 152,
      volume: 1000,
    },
    {
      timestamp: '2024-01-02T00:00:00Z',
      open: 152,
      high: 157,
      low: 151,
      close: 154,
      volume: 1200,
    },
    {
      timestamp: '2024-01-03T00:00:00Z',
      open: 154,
      high: 159,
      low: 153,
      close: 156,
      volume: 1100,
    },
  ];

  const mockOverlays: OverlayIndicator[] = [
    {
      id: 'overlay-1',
      color: '#ff6d00',
      lineWidth: 2,
      showLastValue: true,
      visible: true,
      data: [
        { time: 1704067200, value: 150.5 },
        { time: 1704153600, value: 151.2 },
        { time: 1704240000, value: 150.8 },
      ],
    },
    {
      id: 'overlay-2',
      color: '#2962ff',
      lineWidth: 3,
      showLastValue: false,
      visible: true,
      data: [
        { time: 1704067200, value: 149.8 },
        { time: 1704153600, value: 150.2 },
        { time: 1704240000, value: 149.5 },
      ],
    },
  ];

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('basic overlay rendering', () => {
    it('should render without errors when overlays are provided', () => {
      const { container } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={mockOverlays}
          width={800}
          height={400}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should render without errors when overlays array is empty', () => {
      const { container } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={[]}
          width={800}
          height={400}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should render without errors when overlays prop is undefined', () => {
      const { container } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          width={800}
          height={400}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('overlay data structure', () => {
    it('should accept overlays with correct structure', () => {
      const validOverlay: OverlayIndicator = {
        id: 'test-1',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: [
          { time: 1704067200, value: 150.5 },
          { time: 1704153600, value: 151.2 },
        ],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[validOverlay]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should accept overlays with optional color data points', () => {
      const overlayWithColors: OverlayIndicator = {
        id: 'test-colors',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: [
          { time: 1704067200, value: 150.5, color: '#00ff00' },
          { time: 1704153600, value: 151.2, color: '#ff0000' },
          { time: 1704240000, value: 150.8 },
        ],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[overlayWithColors]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });
  });

  describe('visibility option (T013)', () => {
    it('should accept overlays with visible: true', () => {
      const visibleOverlay: OverlayIndicator = {
        id: 'visible-test',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: [{ time: 1704067200, value: 150.5 }],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[visibleOverlay]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should accept overlays with visible: false', () => {
      const hiddenOverlay: OverlayIndicator = {
        id: 'hidden-test',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: false,
        data: [{ time: 1704067200, value: 150.5 }],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[hiddenOverlay]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should accept overlays without visible property (defaults to true)', () => {
      const overlayWithoutVisible: OverlayIndicator = {
        id: 'no-visible-prop',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        data: [{ time: 1704067200, value: 150.5 }],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[overlayWithoutVisible]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });
  });

  describe('multiple overlays', () => {
    it('should render multiple overlays with different IDs', () => {
      const multipleOverlays: OverlayIndicator[] = [
        {
          id: 'overlay-a',
          color: '#ff6d00',
          lineWidth: 2,
          showLastValue: true,
          visible: true,
          data: [{ time: 1704067200, value: 150.5 }],
        },
        {
          id: 'overlay-b',
          color: '#2962ff',
          lineWidth: 2,
          showLastValue: true,
          visible: true,
          data: [{ time: 1704067200, value: 149.5 }],
        },
        {
          id: 'overlay-c',
          color: '#00bcd4',
          lineWidth: 2,
          showLastValue: true,
          visible: true,
          data: [{ time: 1704067200, value: 151.5 }],
        },
      ];

      const { container } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={multipleOverlays}
          width={800}
          height={400}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('overlay styling options', () => {
    it('should accept different line widths', () => {
      const thinLine: OverlayIndicator = {
        id: 'thin',
        color: '#ff6d00',
        lineWidth: 1,
        showLastValue: true,
        visible: true,
        data: [{ time: 1704067200, value: 150.5 }],
      };

      const thickLine: OverlayIndicator = {
        id: 'thick',
        color: '#2962ff',
        lineWidth: 4,
        showLastValue: true,
        visible: true,
        data: [{ time: 1704067200, value: 150.5 }],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[thinLine, thickLine]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should accept different colors (hex format)', () => {
      const overlaysWithColors: OverlayIndicator[] = [
        {
          id: 'red',
          color: '#ef5350',
          lineWidth: 2,
          showLastValue: true,
          visible: true,
          data: [{ time: 1704067200, value: 150.5 }],
        },
        {
          id: 'green',
          color: '#26a69a',
          lineWidth: 2,
          showLastValue: true,
          visible: true,
          data: [{ time: 1704067200, value: 150.5 }],
        },
        {
          id: 'blue',
          color: '#2962ff',
          lineWidth: 2,
          showLastValue: true,
          visible: true,
          data: [{ time: 1704067200, value: 150.5 }],
        },
      ];

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={overlaysWithColors}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should accept overlays with showLastValue: false', () => {
      const noLastValue: OverlayIndicator = {
        id: 'no-last-value',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: false,
        visible: true,
        data: [{ time: 1704067200, value: 150.5 }],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[noLastValue]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });
  });

  describe('overlay data format', () => {
    it('should accept data with numeric timestamps (Unix seconds)', () => {
      const unixSecondsData: OverlayIndicator = {
        id: 'unix-seconds',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: [
          { time: 1704067200, value: 150.5 },
          { time: 1704153600, value: 151.2 },
        ],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[unixSecondsData]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should accept data with varying point counts', () => {
      const singlePoint: OverlayIndicator = {
        id: 'single-point',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: [{ time: 1704067200, value: 150.5 }],
      };

      const manyPoints: OverlayIndicator = {
        id: 'many-points',
        color: '#2962ff',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: Array.from({ length: 1000 }, (_, i) => ({
          time: 1704067200 + i * 86400,
          value: 150 + Math.random() * 10,
        })),
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[singlePoint, manyPoints]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });
  });

  describe('overlay removal handling (T017)', () => {
    it('should handle overlay removal when overlay ID no longer exists', () => {
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={mockOverlays}
          width={800}
          height={400}
        />
      );

      // Remove one overlay
      const updatedOverlays = mockOverlays.filter(o => o.id !== 'overlay-1');

      expect(() =>
        rerender(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={updatedOverlays}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should handle removal of all overlays', () => {
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={mockOverlays}
          width={800}
          height={400}
        />
      );

      expect(() =>
        rerender(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle overlay with empty data array', () => {
      const emptyDataOverlay: OverlayIndicator = {
        id: 'empty-data',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: [],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[emptyDataOverlay]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });

    it('should handle overlay with null/undefined values in data', () => {
      const dataWithNulls: OverlayIndicator = {
        id: 'with-nulls',
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: [
          { time: 1704067200, value: 150.5 },
          { time: 1704153600, value: null as any },
          { time: 1704240000, value: undefined as any },
        ],
      };

      expect(() =>
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={[dataWithNulls]}
            width={800}
            height={400}
          />
        )
      ).not.toThrow();
    });
  });
});
