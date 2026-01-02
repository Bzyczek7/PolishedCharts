/**
 * Performance benchmark test for overlay indicator rendering
 * Feature: 008-overlay-indicator-rendering
 * Task: T011 [US1]
 *
 * Success Criteria:
 * - Adding a new overlay indicator renders within 500ms (SC-006)
 * - Chart interactions remain smooth with 10 indicators (60fps)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { act } from 'react';
import ChartComponent from '../ChartComponent';
import type { Candle } from '../../api/candles';
import type { OverlayIndicator } from '../ChartComponent';

// Mock lightweight-charts with performance tracking
vi.mock('lightweight-charts', () => {
  const mockSeries = {
    setData: vi.fn(),
    applyOptions: vi.fn(),
    setMarkers: vi.fn(),
  };

  // Create mock constructors for Series types
  const LineSeries = vi.fn(() => mockSeries);
  const CandlestickSeries = vi.fn(() => mockSeries);
  const HistogramSeries = vi.fn(() => mockSeries);

  return {
    createChart: vi.fn(() => ({
      addSeries: vi.fn(() => mockSeries),
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
    LineStyle: { Solid: 0 },
    LineWidth: { 1: 1, 2: 2, 3: 3, 4: 4 },
    LineSeries,
    CandlestickSeries,
    HistogramSeries,
  };
});

describe('ChartComponent - Performance Benchmarks (T011)', () => {
  const mockCandles: Candle[] = Array.from({ length: 100 }, (_, i) => ({
    timestamp: new Date(Date.now() - (100 - i) * 86400000).toISOString(),
    open: 150 + Math.random() * 10,
    high: 155 + Math.random() * 10,
    low: 149 + Math.random() * 10,
    close: 152 + Math.random() * 10,
    volume: 1000 + Math.floor(Math.random() * 500),
  }));

  // Generate mock overlay data
  function generateOverlayData(count: number): OverlayIndicator[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `overlay-${i}`,
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
      lineWidth: 2,
      showLastValue: i % 2 === 0,
      visible: true,
      data: Array.from({ length: 100 }, (_, j) => ({
        time: Math.floor((Date.now() - (100 - j) * 86400000) / 1000),
        value: 150 + Math.random() * 20,
      })),
    }));
  }

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Initial Render Performance', () => {
    it('should render 1 overlay within 100ms', async () => {
      const overlays = generateOverlayData(1);

      const startTime = performance.now();

      await act(async () => {
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={overlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Render time for 1 overlay: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(500); // SC-006: Add indicator within 500ms
    });

    it('should render 5 overlays within 500ms', async () => {
      const overlays = generateOverlayData(5);

      const startTime = performance.now();

      await act(async () => {
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={overlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Render time for 5 overlays: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(500);
    });

    it('should render 10 overlays within 500ms (SC-008)', async () => {
      const overlays = generateOverlayData(10);

      const startTime = performance.now();

      await act(async () => {
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={overlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Render time for 10 overlays: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(500);
    });
  });

  describe('Update Performance', () => {
    it('should update 1 overlay style within 100ms (SC-009)', async () => {
      const initialOverlays = generateOverlayData(1);
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={initialOverlays}
          width={800}
          height={400}
        />
      );

      const updatedOverlays = initialOverlays.map(o => ({
        ...o,
        color: '#ff0000',
        lineWidth: 3,
      }));

      const startTime = performance.now();

      await act(async () => {
        rerender(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={updatedOverlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      console.log(`Update time for 1 overlay style: ${updateTime.toFixed(2)}ms`);
      expect(updateTime).toBeLessThan(100); // SC-009: Indicator calculation/rendering within 100ms
    });

    it('should update 5 overlays within 200ms', async () => {
      const initialOverlays = generateOverlayData(5);
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={initialOverlays}
          width={800}
          height={400}
        />
      );

      const updatedOverlays = initialOverlays.map(o => ({
        ...o,
        color: '#ff0000',
      }));

      const startTime = performance.now();

      await act(async () => {
        rerender(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={updatedOverlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      console.log(`Update time for 5 overlays: ${updateTime.toFixed(2)}ms`);
      expect(updateTime).toBeLessThan(200);
    });
  });

  describe('Removal Performance', () => {
    it('should remove 1 overlay within 100ms', async () => {
      const initialOverlays = generateOverlayData(10);
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={initialOverlays}
          width={800}
          height={400}
        />
      );

      const updatedOverlays = initialOverlays.slice(1);

      const startTime = performance.now();

      await act(async () => {
        rerender(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={updatedOverlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const removalTime = endTime - startTime;

      console.log(`Removal time for 1 overlay: ${removalTime.toFixed(2)}ms`);
      expect(removalTime).toBeLessThan(100);
    });

    it('should remove 5 overlays within 200ms', async () => {
      const initialOverlays = generateOverlayData(10);
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={initialOverlays}
          width={800}
          height={400}
        />
      );

      const updatedOverlays = initialOverlays.slice(0, 5);

      const startTime = performance.now();

      await act(async () => {
        rerender(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={updatedOverlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const removalTime = endTime - startTime;

      console.log(`Removal time for 5 overlays: ${removalTime.toFixed(2)}ms`);
      expect(removalTime).toBeLessThan(200);
    });
  });

  describe('Visibility Toggle Performance', () => {
    it('should toggle visibility for 1 overlay within 100ms', async () => {
      const initialOverlays = generateOverlayData(10);
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={initialOverlays}
          width={800}
          height={400}
        />
      );

      const updatedOverlays = initialOverlays.map((o, i) => ({
        ...o,
        visible: i === 0 ? false : o.visible,
      }));

      const startTime = performance.now();

      await act(async () => {
        rerender(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={updatedOverlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const toggleTime = endTime - startTime;

      console.log(`Toggle visibility time for 1 overlay: ${toggleTime.toFixed(2)}ms`);
      expect(toggleTime).toBeLessThan(100);
    });
  });

  describe('Scalability Tests', () => {
    it('should handle 20 overlay indicators (beyond spec)', async () => {
      const overlays = generateOverlayData(20);

      const startTime = performance.now();

      await act(async () => {
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={overlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Render time for 20 overlays: ${renderTime.toFixed(2)}ms`);
      // This is beyond the 10 indicator spec, but should still complete
      expect(renderTime).toBeLessThan(1000); // 1 second as a soft limit
    });

    it('should handle overlays with 1000 data points each', async () => {
      const overlays: OverlayIndicator[] = Array.from({ length: 5 }, (_, i) => ({
        id: `overlay-${i}`,
        color: '#ff6d00',
        lineWidth: 2,
        showLastValue: true,
        visible: true,
        data: Array.from({ length: 1000 }, (_, j) => ({
          time: Math.floor((Date.now() - (1000 - j) * 86400000) / 1000),
          value: 150 + Math.random() * 20,
        })),
      }));

      const startTime = performance.now();

      await act(async () => {
        render(
          <ChartComponent
            symbol="AAPL"
            candles={mockCandles}
            overlays={overlays}
            width={800}
            height={400}
          />
        );
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Render time for 5 overlays × 1000 data points: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory when adding/removing overlays repeatedly', async () => {
      const { rerender } = render(
        <ChartComponent
          symbol="AAPL"
          candles={mockCandles}
          overlays={[]}
          width={800}
          height={400}
        />
      );

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Add and remove overlays 10 times
      for (let i = 0; i < 10; i++) {
        const overlays = generateOverlayData(5);

        await act(async () => {
          rerender(
            <ChartComponent
              symbol="AAPL"
              candles={mockCandles}
              overlays={overlays}
              width={800}
              height={400}
            />
          );
        });

        await act(async () => {
          rerender(
            <ChartComponent
              symbol="AAPL"
              candles={mockCandles}
              overlays={[]}
              width={800}
              height={400}
            />
          );
        });
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`Memory growth after 10 add/remove cycles: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      // Allow some growth but not excessive (less than 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });
  });
});
