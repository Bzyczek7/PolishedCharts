/**
 * GenericIndicatorRenderer - Renders any indicator based on backend metadata
 * Feature: 003-advanced-indicators
 * Tasks: T026-T029 [US1]
 */

import React, { useRef, useEffect } from 'react';
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { LineWidth } from 'lightweight-charts';
import type { IndicatorOutput, IndicatorMetadata, SeriesMetadata } from '../types/indicators';

export interface GenericIndicatorRendererProps {
  data: IndicatorOutput;
  width?: number;
  height?: number;
  onChartReady?: (chart: any) => void;
}

/**
 * Convert line_style string to lightweight-charts line style
 */
function lineStyleToNumber(style: string): number {
  switch (style) {
    case 'dashed': return 2; // LineStyle.Dashed
    case 'dotted': return 3; // LineStyle.Dotted
    case 'dashdot': return 4; // LineStyle.Dashed2 with different dot pattern
    default: return 0; // LineStyle.Solid
  }
}

/**
 * GenericIndicatorRenderer - Renders indicators based purely on metadata
 *
 * T026 [US1] [P]: Create generic renderer component
 * T027 [US1]: Implement overlay rendering logic
 * T028 [US1]: Implement pane rendering logic
 * T029 [US1]: Add reference_levels rendering
 *
 * This component demonstrates the metadata-driven approach:
 * - No indicator-specific code in renderer
 * - All rendering logic driven by IndicatorMetadata
 * - Supports overlay (on price) and pane (separate) indicators
 * - Handles threshold-based coloring, trend-based coloring, and reference levels
 */
export function GenericIndicatorRenderer({
  data,
  width,
  height,
  onChartReady,
}: GenericIndicatorRendererProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRefs = useRef<Map<string, any>>(new Map());

  const { timestamps, data: seriesData, metadata } = data;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isOverlay = metadata.display_type === 'overlay';
    const chartHeight = height || (isOverlay ? 400 : 200);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      width: width || chartContainerRef.current.clientWidth,
      height: chartHeight,
      timeScale: {
        visible: isOverlay, // Hide time scale for panes (they sync via parent)
        borderColor: '#2a2e39',
      },
      rightPriceScale: {
        visible: true,
        borderColor: '#2a2e39',
        scaleMargins: isOverlay ? {
          top: 0.1,
          bottom: 0.2,
        } : undefined,
      },
    });

    chartRef.current = chart;

    // Set scale ranges if specified
    if (metadata.scale_ranges && metadata.scale_ranges.min !== undefined && metadata.scale_ranges.max !== undefined) {
      const priceScale = chart.priceScale('');
      priceScale.applyOptions({
        mode: 1, // PriceScaleMode.Logarithmic or 0 for Normal
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      } as any);
    }

    // T029 [US1]: Add reference levels
    if (metadata.reference_levels && metadata.reference_levels.length > 0) {
      // For reference levels, we create special price lines or use histogram series at zero width
      // This will be handled by creating a special "reference" series
    }

    // T027 [US1]: Implement overlay rendering logic
    // T028 [US1]: Implement pane rendering logic
    // Create series based on metadata
    metadata.series_metadata.forEach((seriesMeta: SeriesMetadata) => {
      const fieldData = seriesData[seriesMeta.field];
      if (!fieldData) return;

      // Format data for lightweight-charts
      const chartData = timestamps.map((ts, i) => {
        const value = fieldData[i];
        if (value === null || value === undefined) return null;
        return {
          time: ts as any,
          value: value as number,
        };
      }).filter((item): item is { time: any; value: number } => item !== null);

      // Determine color based on mode
      let color = seriesMeta.line_color;
      let dataWithColors: typeof chartData = chartData;

      // Threshold-based coloring
      if (metadata.color_mode === 'threshold' && metadata.thresholds) {
        const { high, low, zero } = metadata.thresholds;
        dataWithColors = chartData.map(item => {
          let itemColor = color;
          if (high !== undefined && item.value >= high) {
            itemColor = metadata.color_schemes.bullish || '#26a69a';
          } else if (low !== undefined && item.value <= low) {
            itemColor = metadata.color_schemes.bearish || '#ef5350';
          } else if (zero !== undefined && item.value > 0) {
            itemColor = metadata.color_schemes.positive || '#26a69a';
          } else if (zero !== undefined && item.value < 0) {
            itemColor = metadata.color_schemes.negative || '#ef5350';
          }
          return { ...item, color: itemColor };
        });
      }

      // Create line series
      const lineSeries = chart.addSeries(LineSeries, {
        color: color,
        lineWidth: seriesMeta.line_width as unknown as LineWidth,
        lineStyle: lineStyleToNumber(seriesMeta.line_style),
        lastValueVisible: true,
        priceLineVisible: false,
        priceScaleId: seriesMeta.price_scale || '',
      });

      lineSeries.setData(dataWithColors);
      seriesRefs.current.set(seriesMeta.field, lineSeries);
    });

    // T029 [US1]: Add reference levels as price lines on the first series
    if (metadata.reference_levels && metadata.reference_levels.length > 0) {
      const firstSeries = Array.from(seriesRefs.current.values())[0];
      if (firstSeries) {
        metadata.reference_levels.forEach((level) => {
          firstSeries.createPriceLine({
            price: level.value,
            color: level.line_color,
            lineWidth: 1,
            lineStyle: lineStyleToNumber(level.line_style),
            axisLabelVisible: true,
            title: level.line_label || `${level.value}`,
          });
        });
      }
    }

    if (onChartReady) {
      onChartReady(chart);
    }

    return () => {
      seriesRefs.current.forEach(series => chart.removeSeries(series));
      seriesRefs.current.clear();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, width, height]);

  useEffect(() => {
    if (chartRef.current && width && height) {
      chartRef.current.applyOptions({ width, height });
    }
  }, [width, height]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full"
      style={{ minHeight: height || (metadata.display_type === 'overlay' ? 400 : 200) }}
    />
  );
}

export default GenericIndicatorRenderer;
