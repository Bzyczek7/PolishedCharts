/**
 * HorizontalLineTool - Single-click horizontal line drawing tool
 * Feature: 002-supercharts-visuals
 *
 * Note: This component is a placeholder for future implementation.
 */

import React from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export interface HorizontalLineToolProps {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
}

/**
 * HorizontalLineTool component
 * Draws a horizontal line at a specific price level
 *
 * @example
 * ```tsx
 * <HorizontalLineTool chart={chart} series={series} />
 * ```
 */
export function HorizontalLineTool({ chart, series }: HorizontalLineToolProps) {
  // Placeholder - horizontal line tool will be implemented here
  return null;
}

export default HorizontalLineTool;
