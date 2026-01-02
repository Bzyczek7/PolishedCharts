import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { createChart, ColorType, LineSeries, HistogramSeries, LineStyle } from 'lightweight-charts'
import type { IndicatorOutput, IndicatorStyle } from './types/indicators'
import { splitSeriesByTrend, type DataPoint } from '../utils/chartHelpers'
import { IndicatorHeader } from './IndicatorHeader'
import { IndicatorAlertModal } from './IndicatorAlertModal'
import type { IndicatorAlertFormData, Alert } from '../api/alerts'

interface IndicatorSeries {
    id: string
    data: any[]
    color: string
    displayType: 'line' | 'histogram'
    lineWidth?: number
    visible?: boolean
    field?: string  // Field name for seriesColors lookup
}

interface IndicatorPaneProps {
  name: string
  symbol: string
  interval: string
  mainSeries?: IndicatorSeries
  additionalSeries?: IndicatorSeries[]
  candles?: any[]
  visible?: boolean
  priceLines?: {
    value: number
    color: string
    label?: string
    lineStyle?: string  // Line style for price lines ('solid', 'dashed', 'dotted', 'dashdot')
  }[]
  height?: number
  width?: number
  scaleRanges?: {
    min: number
    max: number
  }
  onTimeScaleInit?: (timeScale: any) => void
  onChartInit?: (chart: any, syncSeries: any) => void
  // T031 [US1]: Support generic IndicatorOutput input
  indicatorData?: IndicatorOutput
  crosshairTime?: number | null
  showLastValue?: boolean
  // Phase 5: Oscillator context menu and styling support
  displayName?: string
  indicatorId?: string
  style?: IndicatorStyle
  onSettingsClick?: () => void
  onViewSource?: () => void
  // Feature 001: Alert creation support
  onAlertCreated?: () => void
  // TradingView-style header: Remove callback and params
  onRemove?: () => void
  params?: Record<string, number | string>
  // T057-T058 [US3]: Alerts list for edit detection
  alerts?: Alert[]
}

const IndicatorPane = ({
  name,
  symbol,
  interval,
  mainSeries,
  additionalSeries = [],
  candles = [],
  priceLines = [],
  height,
  width,
  scaleRanges,
  visible: propVisible = true,
  onTimeScaleInit,
  onChartInit,
  indicatorData,
  crosshairTime,
  showLastValue = true,
  // Phase 5: Oscillator context menu and styling support
  displayName,
  indicatorId,
  style,
  onSettingsClick,
  onViewSource,
  // Feature 001: Alert creation support
  onAlertCreated,
  // TradingView-style header: Remove callback and params
  onRemove,
  params,
  // T057-T058 [US3]: Alerts list for edit detection
  alerts = [],
}: IndicatorPaneProps) => {
  // TradingView-style header: Local visibility state for Eye icon toggle
  const [visible, setVisible] = useState(propVisible);

  // Feature 001: Alert modal state
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  // T031 [US1]: Convert IndicatorOutput to series format
  // Feature 005: Implement threshold-based coloring for indicators
  const derivedSeries = useMemo(() => {
    if (!indicatorData) return { mainSeries: undefined, additionalSeries: [], priceLines: [] };

    const { data, metadata } = indicatorData;

    // Get main series from metadata
    const mainMeta = metadata.series_metadata[0];
    if (!mainMeta) return { mainSeries: undefined, additionalSeries: [], priceLines: [] };

    const mainFieldData = data[mainMeta.field];
    if (!mainFieldData) return { mainSeries: undefined, additionalSeries: [], priceLines: [] };

    // Build base chart data for the main series
    const baseChartData: DataPoint[] = indicatorData.timestamps.map((ts, i) => {
      const value = mainFieldData[i];
      if (value === null || value === undefined) return null;
      return { time: ts as any, value: value as number };
    }).filter((item): item is DataPoint => item !== null);

    // Feature 005: Apply threshold-based coloring when color_mode is 'threshold'
    let mainSeriesData: any;
    let thresholdAdditionalSeries: IndicatorSeries[] = [];

    if (metadata.color_mode === 'threshold') {
      const signalMeta = metadata.series_metadata.find(m => m.role === 'signal')
      const signalFieldData = signalMeta ? data[signalMeta.field] : null

      const bullish = metadata.color_schemes?.bullish || '#26a69a'
      const bearish = metadata.color_schemes?.bearish || '#ef5350'
      const neutral = metadata.color_schemes?.neutral || '#787b86'

      // Support both naming styles (some code uses upper/lower, some uses high/low)
      const upper =
        (metadata.thresholds as any)?.upper ?? (metadata.thresholds as any)?.high ?? 70
      const lower =
        (metadata.thresholds as any)?.lower ?? (metadata.thresholds as any)?.low ?? 30

      const coloredData = indicatorData.timestamps
        .map((ts, i) => {
          const v = mainFieldData[i]
          if (v === null || v === undefined) return null

          // Prefer explicit signal if available: 1 / 0 / -1
          const sig = signalFieldData ? signalFieldData[i] : null

          const color =
            sig === 1 ? bullish :
            sig === 0 ? neutral :
            sig === -1 ? bearish :
            (v > upper ? bullish : v < lower ? bearish : neutral)

          return { time: ts as any, value: v as number, color }
        })
        .filter((p): p is { time: any; value: number; color: string } => p !== null)

      // One series only (no thresholdAdditionalSeries)
      mainSeriesData = {
        data: coloredData,
        color: neutral,               // default; per-point color overrides
        displayType: 'line' as const,
        lineWidth: mainMeta.line_width,
        visible: true,
      }

      thresholdAdditionalSeries = [] // important: prevents extra lines
    } else if (metadata.color_mode === 'trend') {
      // Feature 005: Apply trend-based coloring when color_mode is 'trend'
      // Split the main series into up/down/neutral segments based on slope direction
      const segments = splitSeriesByTrend(baseChartData);

      // Map segment names to color schemes
      const trendColorMap: Record<string, string> = {
        up: metadata.color_schemes.bullish || '#2962ff',
        neutral: metadata.color_schemes.neutral || '#9e9e9e',
        down: metadata.color_schemes.bearish || '#ef5350',
      };

      // Create the main series (we'll use 'up' as the primary, others as additional)
      mainSeriesData = {
        data: segments.up,
        color: trendColorMap.up,
        displayType: 'line' as const,
        lineWidth: mainMeta.line_width,
        visible: true,
      };

      // Add neutral and down segments as additional series
      if (segments.neutral.length > 0) {
        thresholdAdditionalSeries.push({
          id: `${mainMeta.field}_neutral`,
          data: segments.neutral,
          color: trendColorMap.neutral,
          displayType: 'line',
          lineWidth: mainMeta.line_width,
          visible: true,
        });
      }

      if (segments.down.length > 0) {
        thresholdAdditionalSeries.push({
          id: `${mainMeta.field}_down`,
          data: segments.down,
          color: trendColorMap.down,
          displayType: 'line',
          lineWidth: mainMeta.line_width,
          visible: true,
        });
      }
    } else {
      // Single color mode - use the base data directly
      mainSeriesData = {
        data: baseChartData,
        color: mainMeta.line_color,
        displayType: 'line' as const,
        lineWidth: mainMeta.line_width,
        visible: true,
        field: mainMeta.field,
      };
    }

    // Convert additional series (bands, signals, etc.)
    // For trend/threshold modes, filter out signal series (used for coloring, not display)
    // For single-color mode (e.g., MACD), signal series ARE displayed as separate lines
    const additionalSeriesData = metadata.series_metadata
      .slice(1)
      .filter(meta => {
        // Filter out signal series only when using trend/threshold coloring modes
        // For single-color mode (MACD), signal line should be displayed
        if (meta.role === 'signal') {
          return metadata.color_mode === 'single';
        }
        return true;
      })
      .map((meta) => {
        const fieldData = data[meta.field];
        if (!fieldData) return null;

        const chartData = indicatorData.timestamps.map((ts, i) => {
          const value = fieldData[i];
          if (value === null || value === undefined) return null;
          return {
            time: ts as any,
            value: value as number,
          };
        }).filter((item): item is { time: any; value: number } => item !== null);

        // Determine display type from metadata
        let displayType: 'line' | 'histogram' = 'line';
        if (meta.display_type === 'histogram') {
          displayType = 'histogram';
        }

        return {
          id: meta.field,
          data: chartData,
          color: meta.line_color,
          displayType: displayType,
          lineWidth: meta.line_width,
          visible: true,
          field: meta.field,
        };
      }).filter((s) => s !== null) as IndicatorSeries[];

    // Combine threshold/trend segments with other additional series
    const allAdditionalSeries = [...thresholdAdditionalSeries, ...additionalSeriesData];

    // Convert reference levels to price lines (or use thresholds if no reference_levels)
    // Include line_style from metadata for proper dash/dot rendering
    const priceLinesData = (metadata.reference_levels || []).map(level => ({
      value: level.value,
      color: level.line_color,
      label: level.line_label || `${level.value}`,
      lineStyle: level.line_style || 'solid',
    }));

    // Fallback to thresholds as price lines if no reference_levels specified
    if (priceLinesData.length === 0 && metadata.thresholds) {
      const high = metadata.thresholds.high ?? 70;
      const low = metadata.thresholds.low ?? 30;
      priceLinesData.push(
        { value: high, color: '#ef5350', label: '', lineStyle: 'dashed' as const },
        { value: low, color: '#26a69a', label: '', lineStyle: 'dashed' as const }
      );
    }

    return {
      mainSeries: mainSeriesData,
      additionalSeries: allAdditionalSeries,
      priceLines: priceLinesData,
    };
  }, [indicatorData]);

  // Compute legend items for top-left display (follows crosshair or shows latest values)
  const legend = useMemo(() => {
    if (!indicatorData || indicatorData.timestamps.length === 0) return null;

    const { timestamps, data, metadata } = indicatorData;

    const lastIdx = timestamps.length - 1;
    const t = (crosshairTime ?? timestamps[lastIdx]) as number;

    let idx = timestamps.indexOf(t);
    if (idx === -1) idx = lastIdx;

    const items = metadata.series_metadata
      .filter(m => m.role !== 'signal')
      .map(m => {
        const v = data[m.field]?.[idx];
        if (v === null || v === undefined) return null;

        // Use style.color for main series, style.seriesColors[field] for others, otherwise metadata default
        let color = m.line_color;
        if (style) {
          if (m.role === 'main') {
            color = style.color || color;
          } else {
            color = style.seriesColors?.[m.field] || color;
          }
        }

        return { key: m.field, color, value: Number(v) };
      })
      .filter(Boolean) as Array<{ key: string; color: string; value: number }>;

    return { items };
  }, [indicatorData, crosshairTime, style]);

  // Use derived series if provided, otherwise use props
  const effectiveMainSeries = derivedSeries.mainSeries ?? mainSeries;
  const effectiveAdditionalSeries = derivedSeries.additionalSeries.length > 0 ? derivedSeries.additionalSeries : additionalSeries;
  const effectivePriceLines = derivedSeries.priceLines.length > 0 ? derivedSeries.priceLines : priceLines;

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const mainSeriesRef = useRef<any>(null)
  const baselineSeriesRef = useRef<any>(null)
  const additionalSeriesRefs = useRef<Map<string, any>>(new Map())
  const priceLinesRef = useRef<any[]>([])

  // Build indicator info for alert modal
  const indicatorInfo = useMemo(() => {
    if (!indicatorData) return null;
    const metadata = indicatorData.metadata;
    // Get the base indicator name (e.g., 'crsi' from 'cRSI(20)' display name or from params)
    const baseName = name.toLowerCase(); // e.g., 'crsi', 'tdfi', 'adxvma', 'ema'
    const mainSeries = metadata.series_metadata.find(s => s.role === 'main') || metadata.series_metadata[0];
    return {
      name: baseName,
      field: mainSeries?.field || name,
      params: params || {},
      displayName: displayName || name,
    };
  }, [indicatorData, name, displayName, params]);

  // Find existing alert for this indicator
  const existingAlert = useMemo(() => {
    if (!alerts || alerts.length === 0) return null;
    return alerts.find(alert => {
      // Match by indicator name and params (and symbol_id via alert's symbol)
      const paramMatch = JSON.stringify(alert.indicator_params || {}) === JSON.stringify(params || {});
      return alert.indicator_name === name && paramMatch;
    });
  }, [alerts, name, params]);

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' }, // TradingView Supercharts dark theme
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: 0, // Disabled - magnet mode with no visible lines
        horzLine: {
          visible: false,
          labelVisible: false,
        },
        vertLine: {
          visible: false,
          labelVisible: false,
        },
      },
      width: width || chartContainerRef.current.clientWidth,
      height: height || chartContainerRef.current.clientHeight || 100,
      timeScale: {
        visible: false,
        shiftVisibleRangeOnNewBar: false,
      },
      handleScroll: false,
      handleScale: false,
      // Ensure the grid settings match the main chart for alignment
    })

    chartRef.current = chart
    
    const baseline = chart.addSeries(LineSeries, {
        visible: false,
        lastValueVisible: false,
        priceLineVisible: false,
    })
    baselineSeriesRef.current = baseline

    if (onTimeScaleInit) {
        onTimeScaleInit(chart.timeScale())
    }

    // Notify when chart is ready
    baselineSeriesRef.current = baseline
    onChartInit?.(chart, baseline)

    return () => {
      if (onTimeScaleInit) {
        onTimeScaleInit(null)
      }
      chart.remove()
      chartRef.current = null
      mainSeriesRef.current = null
      baselineSeriesRef.current = null
      additionalSeriesRefs.current.clear()
      priceLinesRef.current = []
    }
  }, [name, symbol, interval])

  useEffect(() => {
    if (!baselineSeriesRef.current || candles.length === 0) return

    const baselineData = candles.map(c => ({
        time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
        value: 0
    })).sort((a, b) => a.time - b.time)
    
    const uniqueBaseline = baselineData.filter((item, index, arr) => 
        index === 0 || item.time !== arr[index - 1].time
    )
    
    baselineSeriesRef.current.setData(uniqueBaseline)
  }, [candles])

  useEffect(() => {
    if (!chartRef.current) return

    // Handle main series (use effectiveMainSeries which includes derived data from IndicatorOutput)
    if (effectiveMainSeries) {
        const mainSeriesType = effectiveMainSeries.displayType === 'line' ? LineSeries : HistogramSeries

        // Use seriesColors override if available for the main field, otherwise use style.color or default
        const mainField = (effectiveMainSeries as any).field || ''
        const mainSeriesColor = style?.seriesColors?.[mainField] || style?.color || effectiveMainSeries.color

        if (!mainSeriesRef.current || mainSeriesRef.current.seriesType() !== (effectiveMainSeries.displayType === 'line' ? 'Line' : 'Histogram')) {
            if (mainSeriesRef.current) {
                chartRef.current.removeSeries(mainSeriesRef.current)
            }
            mainSeriesRef.current = chartRef.current.addSeries(
                mainSeriesType,
                {
                    // Phase 5: Use style prop if provided, otherwise use series defaults
                    color: mainSeriesColor,
                    lineWidth: style?.lineWidth ?? effectiveMainSeries.lineWidth ?? 2,
                    visible: effectiveMainSeries.visible ?? true,
                    lastValueVisible: style?.showLastValue ?? showLastValue,
                    priceLineVisible: false, // Disable horizontal price line
                }
            )
        } else {
            mainSeriesRef.current.applyOptions({
                // Phase 5: Use style prop if provided, otherwise use series defaults
                color: mainSeriesColor,
                lineWidth: style?.lineWidth ?? effectiveMainSeries.lineWidth ?? 2,
                visible: effectiveMainSeries.visible ?? true,
                lastValueVisible: style?.showLastValue ?? showLastValue,
                priceLineVisible: false, // Disable horizontal price line
            })
        }
        mainSeriesRef.current.setData(effectiveMainSeries.data)
    } else if (mainSeriesRef.current) {
        chartRef.current.removeSeries(mainSeriesRef.current)
        mainSeriesRef.current = null
    }

    // Handle additional series
    const currentAdditionalKeys = new Set(effectiveAdditionalSeries.map((s) => s.id))

    additionalSeriesRefs.current.forEach((s, key) => {
        if (!currentAdditionalKeys.has(key)) {
            chartRef.current.removeSeries(s)
            additionalSeriesRefs.current.delete(key)
        }
    })

    effectiveAdditionalSeries.forEach((s) => {
        const key = s.id
        let addedSeries = additionalSeriesRefs.current.get(key)

        // Use seriesColors override if available, otherwise use metadata default color
        const seriesColor = style?.seriesColors?.[s.field || ''] || s.color

        if (!addedSeries) {
            addedSeries = chartRef.current.addSeries(
                s.displayType === 'line' ? LineSeries : HistogramSeries,
                {
                    color: seriesColor,
                    lineWidth: s.lineWidth ?? 1,
                    visible: s.visible ?? true,
                    lastValueVisible: showLastValue,
                    priceLineVisible: false, // Disable horizontal price line
                }
            )
            additionalSeriesRefs.current.set(key, addedSeries)
        } else {
            addedSeries.applyOptions({
                color: seriesColor,
                lineWidth: s.lineWidth ?? 1,
                visible: s.visible ?? true,
                lastValueVisible: showLastValue,
                priceLineVisible: false, // Disable horizontal price line
            })
        }
        addedSeries.setData(s.data)
    })

    // Handle price lines (Thresholds)
    // Attach to main series if it exists, otherwise to the first additional series
    const targetSeries = mainSeriesRef.current || (additionalSeriesRefs.current.size > 0 ? additionalSeriesRefs.current.values().next().value : null)

    if (targetSeries) {
        priceLinesRef.current.forEach(pl => {
            try { targetSeries.removePriceLine(pl) } catch(e) {}
        })
        priceLinesRef.current = []

        effectivePriceLines.forEach(pl => {
            // Convert string line_style to lightweight-charts LineStyle number
            const lineStyleNum = pl.lineStyle === 'dashed' ? 2 : pl.lineStyle === 'dotted' ? 3 : pl.lineStyle === 'dashdot' ? 4 : 0

            const line = targetSeries.createPriceLine({
                price: pl.value,
                color: pl.color,
                lineWidth: 1,
                lineStyle: lineStyleNum,
                axisLabelVisible: false, // Hide axis labels to prevent stacked labels
                title: '',               // Avoid title+price stacking
            })
            priceLinesRef.current.push(line)
        })
    }
  }, [effectiveMainSeries, effectiveAdditionalSeries, effectivePriceLines, showLastValue, style])

  useEffect(() => {
    if (!chartRef.current) return

    chartRef.current.priceScale('right').applyOptions({
        autoScale: true,
        scaleMargins: {
            top: 0.1,
            bottom: 0.1,
        },
    })
    
    if (scaleRanges) {
        chartRef.current.priceScale('right').applyOptions({
            autoScale: false,
            visiblePriceRange: {
                from: scaleRanges.min,
                to: scaleRanges.max,
            }
        })
    }
  }, [scaleRanges])


  useEffect(() => {
    if (chartRef.current) {
      const options: any = {}
      if (width) options.width = width
      if (height) options.height = height
      chartRef.current.applyOptions(options)
    }
  }, [width, height])

  if (!visible) return null;

  return (
    <div className="relative w-full h-full">
      <div
        ref={chartContainerRef}
        data-testid={`indicator-pane-${name}`}
        className="w-full h-full"
      />

      {/* TradingView-style compact indicator header */}
      <div className="group absolute left-2 right-2 top-1 z-10 flex items-center gap-2 text-xs overflow-visible">
        <IndicatorHeader
          name={displayName || name}
          isVisible={visible}
          onToggleVisibility={() => setVisible(!visible)}
          onRemove={onRemove || (() => {})}
          onSettings={onSettingsClick}
          onAlert={() => setIsAlertModalOpen(true)}
          moreActions={[
            ...(onViewSource ? [{ label: 'View Source', action: onViewSource }] : []),
            // T057: Add "Edit alert..." action if an alert exists for this indicator
            ...(existingAlert ? [{
              label: 'Edit alert on ' + (displayName || name) + '...',
              action: () => setIsAlertModalOpen(true)
            }] : [])
          ]}
          legendItems={legend?.items}
        />
      </div>

      {/* Feature 001: Alert modal */}
      {isAlertModalOpen && indicatorInfo && (
        <IndicatorAlertModal
          open={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          onAlertCreated={() => {
            onAlertCreated?.();
            setIsAlertModalOpen(false);
          }}
          symbol={symbol}
          interval={interval}
          indicator={indicatorInfo}
          // T057-T058 [US3]: Use the existing alert found via useMemo
          existingAlert={existingAlert}
        />
      )}
    </div>
  )
}

export default IndicatorPane