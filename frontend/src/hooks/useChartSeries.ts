/**
 * useChartSeries hook - Manages Lightweight Charts series lifecycle for overlay indicators
 * Feature: 008-overlay-indicator-rendering
 * Phase 2: Foundational (T006)
 *
 * Provides series management capabilities:
 * - Create line series for overlay indicators
 * - Update series options (color, lineWidth, visibility)
 * - Trend-based per-point coloring for indicators with signal fields
 * - Clean up series on unmount
 * - Prevent memory leaks
 */

import { useEffect, useRef, useCallback } from 'react';
import type { IndicatorInstance, IndicatorStyle } from '../components/types/indicators';
import type { IndicatorOutput } from '../components/types/indicators';
import {
  type IChartApi,
  type IPriceLine,
  ColorType,
  LineStyle,
  type LineWidth,
  type PriceLineOptions,
  type SeriesMarker,
  type Time,
  LineSeries,
} from 'lightweight-charts';

// Infer the SeriesApi type from addSeries return type
type LineSeriesApi = ReturnType<IChartApi['addSeries']> extends infer T ? T : never;

/**
 * Series entry combining the series API with its associated instance
 */
interface SeriesEntry {
  instanceId: string;
  series: LineSeriesApi;
  lastValueLine?: IPriceLine;
  /** Track if this series uses per-point coloring (for trend mode) */
  usesPerPointColor: boolean;
  /** Track additional series for multi-series indicators (e.g., BBANDS upper/middle/lower) */
  additionalSeries?: Map<string, LineSeriesApi>;
}

/**
 * Configuration for creating a series
 */
interface CreateSeriesOptions {
  chart: IChartApi;
  instance: IndicatorInstance;
  data: IndicatorOutput;
}

/**
 * Trend color configuration for per-point coloring
 */
interface TrendColors {
  bullish: string;
  neutral: string;
  bearish: string;
}

/**
 * Get trend colors from instance style or metadata
 * Priority: instance.style.seriesColors > metadata.color_schemes > defaults
 */
function getTrendColors(instance: IndicatorInstance, metadata: IndicatorOutput['metadata']): TrendColors {
  // Check instance.style.seriesColors first (user-configured colors)
  if (instance.style.seriesColors) {
    const { bullish, neutral, bearish } = instance.style.seriesColors;
    if (bullish && neutral && bearish) {
      return { bullish, neutral, bearish };
    }
  }

  // Fall back to metadata color_schemes
  if (metadata?.color_schemes) {
    return {
      bullish: metadata.color_schemes.bullish || '#26a69a',
      neutral: metadata.color_schemes.neutral || '#787b86',
      bearish: metadata.color_schemes.bearish || '#ef5350',
    };
  }

  // Final defaults
  return {
    bullish: '#26a69a',
    neutral: '#787b86',
    bearish: '#ef5350',
  };
}

/**
 * Find the signal field in indicator metadata
 * Looks for a series with role='signal' or field name containing 'signal'
 */
function findSignalField(metadata: IndicatorOutput['metadata']): string | null {
  if (!metadata?.series_metadata) return null;

  // First try to find by role
  const signalMeta = metadata.series_metadata.find((m: any) => m.role === 'signal');
  if (signalMeta) return signalMeta.field;

  // Fall back to field name pattern matching
  const signalByName = metadata.series_metadata.find((m: any) =>
    m.field.toLowerCase().includes('signal')
  );
  return signalByName?.field || null;
}

/**
 * Format indicator data with per-point colors for trend mode
 * Each point gets a color based on the signal value: 1=bullish, 0=neutral, -1=bearish
 */
function formatIndicatorDataWithColors(
  data: IndicatorOutput,
  valueField: string,
  signalField: string,
  colors: TrendColors
): Array<{ time: Time; value: number; color: ColorType }> {
  const values = data.data[valueField];
  const signals = data.data[signalField];

  if (!values || !signals) return [];

  return data.timestamps.map((timestamp: any, index: number) => {
    const value = values[index];
    const signal = signals[index];

    if (value === null || value === undefined) return null;

    // Determine color based on signal value
    let color = colors.neutral;
    if (signal === 1) color = colors.bullish;
    else if (signal === -1) color = colors.bearish;

    return {
      time: timestamp as Time,
      value: value as number,
      color: color as ColorType,
    };
  }).filter((item: any): item is { time: Time; value: number; color: ColorType } => item !== null);
}

/**
 * useChartSeries hook
 * T006: Implement useChartSeries hook for Lightweight Charts lifecycle
 *
 * Manages overlay indicator series with proper lifecycle:
 * - Create series when instance/data becomes available
 * - Update series when style changes
 * - Show/hide series when visibility changes
 * - Clean up series when instance is removed
 * - Support trend-based per-point coloring for indicators with signal fields
 */
export function useChartSeries(
  chart: IChartApi | null,
  instances: IndicatorInstance[],
  dataMap: Record<string, IndicatorOutput | null>
) {
  // Track active series by instance ID
  const seriesRef = useRef<Map<string, SeriesEntry>>(new Map());

  // Track pending updates to avoid redundant applyOptions calls
  const pendingStyleUpdatesRef = useRef<Map<string, Partial<IndicatorStyle>>>(new Map());

  /**
   * Clean up all series (call on unmount or chart change)
   */
  const cleanupAllSeries = useCallback(() => {
    if (!chart) return;

    for (const [instanceId, entry] of seriesRef.current) {
      try {
        chart.removeSeries(entry.series);
      } catch (error) {
        console.error(`[useChartSeries] Failed to remove series for ${instanceId}:`, error);
      }
    }

    seriesRef.current.clear();
  }, [chart]);

  /**
   * Clean up series for removed instances
   */
  const cleanupRemovedSeries = useCallback((activeInstanceIds: Set<string>) => {
    if (!chart) return;

    const removedIds: string[] = [];

    for (const instanceId of seriesRef.current.keys()) {
      if (!activeInstanceIds.has(instanceId)) {
        removedIds.push(instanceId);
      }
    }

    for (const instanceId of removedIds) {
      const entry = seriesRef.current.get(instanceId);
      if (entry) {
        try {
          // Remove main series
          chart.removeSeries(entry.series);

          // Remove additional series (e.g., BBANDS middle/lower bands)
          if (entry.additionalSeries) {
            for (const [field, series] of entry.additionalSeries) {
              try {
                chart.removeSeries(series);
              } catch (err) {
                console.error(`[useChartSeries] Failed to remove additional series ${field} for ${instanceId}:`, err);
              }
            }
          }
        } catch (error) {
          console.error(`[useChartSeries] Failed to remove series for ${instanceId}:`, error);
        }
        seriesRef.current.delete(instanceId);
      }
    }
  }, [chart]);

  /**
   * Create a new series for an indicator instance
   */
  const createSeries = useCallback(({ chart, instance, data }: CreateSeriesOptions): LineSeriesApi | null => {
    if (!chart || !data) return null;

    try {
      // Check if this indicator uses trend-based coloring
      const isTrendMode = data.metadata?.color_mode === 'trend';
      const signalField = isTrendMode ? findSignalField(data.metadata) : null;
      const usesPerPointColor = isTrendMode && signalField !== null;

      // Create main line series
      const series = chart.addSeries(LineSeries, {
        color: instance.style.color as ColorType,
        lineWidth: instance.style.lineWidth as LineWidth,
        lineStyle: LineStyle.Solid, // MVP: solid only (dashed/dotted deferred)
        lineVisible: true,
        pointMarkersVisible: false,
        title: instance.displayName,
        lastValueVisible: instance.style.showLastValue,
        priceLineVisible: false,
      });

      // Create additional series for multi-series overlay indicators (e.g., BBANDS)
      const additionalSeriesMap = new Map<string, LineSeriesApi>();
      if (data.metadata?.series_metadata && data.metadata.series_metadata.length > 1) {
        // For overlay indicators with multiple series, create additional series
        // Skip the first series as it's the main series already created above
        const additionalSeriesMeta = data.metadata.series_metadata.slice(1);

        for (const meta of additionalSeriesMeta) {
          // Check if this series field has data
          if (!data.data[meta.field]) continue;

          try {
            const additionalSeries = chart.addSeries(LineSeries, {
              color: meta.line_color as ColorType,
              lineWidth: (meta.line_width || 1) as LineWidth,
              lineStyle: meta.line_style === 'dashed' ? LineStyle.Dashed : LineStyle.Solid,
              lineVisible: true,
              pointMarkersVisible: false,
              title: `${instance.displayName} - ${meta.label}`,
              lastValueVisible: false,  // Hide last value for additional series to reduce clutter
              priceLineVisible: false,
            });

            additionalSeriesMap.set(meta.field, additionalSeries);
          } catch (err) {
            console.error(`[useChartSeries] Failed to create additional series for ${meta.field}:`, err);
          }
        }
      }

      seriesRef.current.set(instance.id, {
        instanceId: instance.id,
        series,
        usesPerPointColor,
        additionalSeries: additionalSeriesMap.size > 0 ? additionalSeriesMap : undefined,
      });

      return series;
    } catch (error) {
      console.error(`[useChartSeries] Failed to create series for ${instance.id}:`, error);
      return null;
    }
  }, []);

  /**
   * Format indicator data for Lightweight Charts
   * Converts IndicatorOutput to appropriate data format based on color mode
   */
  const formatIndicatorData = useCallback((
    instance: IndicatorInstance,
    data: IndicatorOutput
  ): Array<{ time: Time; value: number } | { time: Time; value: number; color: ColorType }> => {
    if (!data.timestamps || !data.data) return [];

    // Check if this indicator uses trend-based coloring
    const isTrendMode = data.metadata?.color_mode === 'trend';
    const signalField = isTrendMode ? findSignalField(data.metadata) : null;

    // Determine which field to use
    let valueField: string | undefined;
    const possibleFields = ['sma', 'ema', 'adxvma', 'value', 'close', 'upper', 'middle', 'lower'];  // Added pandas-ta overlay fields
    valueField = possibleFields.find(field => data.data[field]);

    // Special handling for multi-series overlay indicators (e.g., BBANDS)
    // If indicator has multiple series in metadata, use the first one from series_metadata
    if (!valueField && data.metadata?.series_metadata && data.metadata.series_metadata.length > 0) {
      // For overlay indicators, prefer the 'main' or 'band' role series
      const mainSeries = data.metadata.series_metadata.find((s: any) => s.role === 'main' || s.role === 'band');
      if (mainSeries && data.data[mainSeries.field]) {
        valueField = mainSeries.field;
      }
    }

    // Final fallback: use first field that's not the signal field
    if (!valueField && Object.keys(data.data).length > 0) {
      valueField = Object.keys(data.data).find(k => k !== signalField);
    }

    if (!valueField || !data.data[valueField]) return [];

    // If trend mode with signal field, use per-point coloring
    if (isTrendMode && signalField) {
      const colors = getTrendColors(instance, data.metadata);
      return formatIndicatorDataWithColors(data, valueField, signalField, colors);
    }

    // Single color mode - standard format
    const values = data.data[valueField];
    if (!values) return [];

    return data.timestamps.map((timestamp: any, index: number) => {
      const value = values[index];
      if (value === null || value === undefined) return null;

      return {
        time: timestamp as Time,
        value: value as number,
      };
    }).filter((item: any): item is { time: Time; value: number } => item !== null);
  }, []);

  /**
   * Update series with new data
   */
  const updateSeriesData = useCallback((
    instanceId: string,
    instance: IndicatorInstance,
    data: IndicatorOutput
  ) => {
    const entry = seriesRef.current.get(instanceId);
    if (!entry) return;

    try {
      // Update main series
      const formattedData = formatIndicatorData(instance, data);
      if (formattedData.length === 0) {
        console.warn(`[useChartSeries] No valid data for ${instanceId}`);
        return;
      }

      entry.series.setData(formattedData as any); // TypeScript: color property is valid

      // Update additional series (e.g., BBANDS middle/lower bands)
      if (entry.additionalSeries && entry.additionalSeries.size > 0 && data.metadata?.series_metadata) {
        // Start from index 1 (skip main series which was already updated)
        for (let i = 1; i < data.metadata.series_metadata.length; i++) {
          const meta = data.metadata.series_metadata[i];
          const additionalSeries = entry.additionalSeries.get(meta.field);

          if (additionalSeries && data.data[meta.field]) {
            // Format data for this additional series
            const fieldData = data.data[meta.field];
            const seriesData = data.timestamps.map((timestamp: any, index: number) => {
              const value = fieldData[index];
              if (value === null || value === undefined) return null;
              return {
                time: timestamp as Time,
                value: value as number,
              };
            }).filter((item: any): item is { time: Time; value: number } => item !== null);

            additionalSeries.setData(seriesData);
          }
        }
      }
    } catch (error) {
      console.error(`[useChartSeries] Failed to update data for ${instanceId}:`, error);
    }
  }, [formatIndicatorData]);

  /**
   * Update series style options
   * T023: Connect style changes to chart series updates via useChartSeries
   * Supports updating trend colors via seriesColors.bullish/neutral/bearish
   */
  const updateSeriesStyle = useCallback((
    instanceId: string,
    instance: IndicatorInstance,
    data: IndicatorOutput | null,
    style: Partial<IndicatorInstance['style']>
  ) => {
    const entry = seriesRef.current.get(instanceId);
    if (!entry) return;

    try {
      // Use type assertion to set line series options
      const options: Record<string, any> = {};

      if (style.color !== undefined) {
        options.color = style.color as ColorType;
      }
      if (style.lineWidth !== undefined) {
        options.lineWidth = style.lineWidth as LineWidth;
      }
      if (style.showLastValue !== undefined) {
        options.lastValueVisible = style.showLastValue;
      }

      entry.series.applyOptions(options as any);

      // If using per-point colors and data is available, refresh data to apply new colors
      if (entry.usesPerPointColor && data) {
        updateSeriesData(instanceId, instance, data);
      }
    } catch (error) {
      console.error(`[useChartSeries] Failed to update style for ${instanceId}:`, error);
    }
  }, [updateSeriesData]);

  /**
   * Update series visibility
   * T034: Connect visibility state to chart series visible option
   */
  const updateSeriesVisibility = useCallback((
    instanceId: string,
    visible: boolean
  ) => {
    const entry = seriesRef.current.get(instanceId);
    if (!entry) return;

    try {
      entry.series.applyOptions({
        visible: visible,
      });
    } catch (error) {
      console.error(`[useChartSeries] Failed to update visibility for ${instanceId}:`, error);
    }
  }, []);

  /**
   * Get series for an instance
   */
  const getSeries = useCallback((instanceId: string): LineSeriesApi | null => {
    const entry = seriesRef.current.get(instanceId);
    return entry?.series || null;
  }, []);

  // Effect: Sync series with instances and data
  useEffect(() => {
    if (!chart || !instances.length) {
      cleanupAllSeries();
      return;
    }

    const activeInstanceIds = new Set(instances.map(inst => inst.id));

    // Clean up removed instances
    cleanupRemovedSeries(activeInstanceIds);

    // Create or update series for each instance
    for (const instance of instances) {
      const data = dataMap[instance.id];

      if (!instance.isVisible) {
        // Hidden instances: keep series but don't update data
        continue;
      }

      if (!data) {
        // No data yet, skip
        continue;
      }

      const existingEntry = seriesRef.current.get(instance.id);

      if (!existingEntry) {
        // Create new series
        const series = createSeries({ chart, instance, data });
        if (series && data) {
          // Set initial data
          try {
            const formattedData = formatIndicatorData(instance, data);
            if (formattedData.length > 0) {
              series.setData(formattedData as any); // TypeScript: color property is valid
            }
          } catch (error) {
            console.error(`[useChartSeries] Failed to set initial data for ${instance.id}:`, error);
          }
        }
      } else {
        // Update existing series data
        updateSeriesData(instance.id, instance, data);
      }
    }
  }, [chart, instances, dataMap, createSeries, updateSeriesData, cleanupAllSeries, cleanupRemovedSeries, formatIndicatorData]);

  // Effect: Apply pending style updates
  useEffect(() => {
    if (pendingStyleUpdatesRef.current.size === 0) return;

    for (const [instanceId, style] of pendingStyleUpdatesRef.current) {
      const instance = instances.find(i => i.id === instanceId);
      const data = instance ? dataMap[instance.id] : null;
      if (instance) {
        updateSeriesStyle(instanceId, instance, data, style);
      }
    }

    pendingStyleUpdatesRef.current.clear();
  }, [updateSeriesStyle, instances, dataMap]);

  // Clean up all series on unmount
  useEffect(() => {
    return () => {
      cleanupAllSeries();
    };
  }, [cleanupAllSeries]);

  return {
    createSeries,
    updateSeriesData: (instanceId: string, instance: IndicatorInstance, data: IndicatorOutput) =>
      updateSeriesData(instanceId, instance, data),
    updateSeriesStyle: (instanceId: string, instance: IndicatorInstance, style: Partial<IndicatorStyle>) => {
      const data = dataMap[instanceId];
      updateSeriesStyle(instanceId, instance, data, style);
    },
    updateSeriesVisibility,
    getSeries,
    formatIndicatorData,
  };
}
