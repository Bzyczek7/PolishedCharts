/**
 * TrendlineTool - Two-click line drawing tool
 * Feature: 002-supercharts-visuals
 *
 * Note: This component is a placeholder for future implementation.
 */

import React from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export interface TrendlineToolProps {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
}

/**
 * TrendlineTool component
 * Draws a trendline between two points
 *
 * @example
 * ```tsx
 * <TrendlineTool chart={chart} series={series} />
 * ```
 */
export function TrendlineTool({ chart, series }: TrendlineToolProps) {
  // Placeholder - trendline tool will be implemented here
  return null;
}

export default TrendlineTool;
