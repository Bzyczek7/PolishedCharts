/**
 * RectangleTool - Click-drag rectangle drawing tool
 * Feature: 002-supercharts-visuals
 *
 * Note: This component is a placeholder for future implementation.
 */

import React from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export interface RectangleToolProps {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
}

/**
 * RectangleTool component
 * Draws a rectangle on the chart
 *
 * @example
 * ```tsx
 * <RectangleTool chart={chart} series={series} />
 * ```
 */
export function RectangleTool({ chart, series }: RectangleToolProps) {
  // Placeholder - rectangle tool will be implemented here
  return null;
}

export default RectangleTool;
