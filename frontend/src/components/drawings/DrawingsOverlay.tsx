/**
 * DrawingsOverlay - SVG overlay for rendering drawings on the chart
 * Feature: 002-supercharts-visuals
 *
 * Note: This component is a placeholder for future drawing tool implementation.
 * The drawing tools are not yet fully integrated with the main chart.
 */

import React from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export interface DrawingsOverlayProps {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
}

/**
 * DrawingsOverlay component
 * Renders an SVG overlay on top of the chart for drawing tools
 *
 * @example
 * ```tsx
 * <DrawingsOverlay chart={chart} series={candlestickSeries} />
 * ```
 */
export function DrawingsOverlay({ chart, series }: DrawingsOverlayProps) {
  // Placeholder - drawing tools will be rendered here when fully implemented
  return null;
}

export default DrawingsOverlay;
