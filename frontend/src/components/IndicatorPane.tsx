import { useEffect, useRef, useMemo } from 'react'
import { createChart, ColorType, LineSeries, HistogramSeries, LineStyle } from 'lightweight-charts'
import type { IndicatorOutput } from './types/indicators'

interface IndicatorSeries {
    id: string
    data: any[]
    color: string
    displayType: 'line' | 'histogram'
    lineWidth?: number
    visible?: boolean
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
  visible = true,
  onTimeScaleInit,
  onChartInit,
  indicatorData,
}: IndicatorPaneProps) => {
  // T031 [US1]: Convert IndicatorOutput to series format
  const derivedSeries = useMemo(() => {
    if (!indicatorData) return { mainSeries: undefined, additionalSeries: [], priceLines: [] };

    const { data, metadata } = indicatorData;

    // Get main series from metadata
    const mainMeta = metadata.series_metadata[0];
    if (!mainMeta) return { mainSeries: undefined, additionalSeries: [], priceLines: [] };

    const mainFieldData = data[mainMeta.field];
    if (!mainFieldData) return { mainSeries: undefined, additionalSeries: [], priceLines: [] };

    // Convert timestamps and data to lightweight-charts format
    const mainChartData = indicatorData.timestamps.map((ts, i) => {
      const value = mainFieldData[i];
      if (value === null || value === undefined) return null;
      return {
        time: ts as any,
        value: value as number,
      };
    }).filter((item): item is { time: any; value: number } => item !== null);

    // Convert additional series
    const additionalSeriesData = metadata.series_metadata.slice(1).map((meta) => {
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

      return {
        id: meta.field,
        data: chartData,
        color: meta.line_color,
        displayType: 'line',
        lineWidth: meta.line_width,
        visible: true,
      };
    }).filter((s) => s !== null) as IndicatorSeries[];

    // Convert reference levels to price lines
    const priceLinesData = (metadata.reference_levels || []).map(level => ({
      value: level.value,
      color: level.line_color,
      label: level.line_label || `${level.value}`,
    }));

    return {
      mainSeries: {
        data: mainChartData,
        color: mainMeta.line_color,
        displayType: 'line' as const,
        lineWidth: mainMeta.line_width,
        visible: true,
      },
      additionalSeries: additionalSeriesData,
      priceLines: priceLinesData,
    };
  }, [indicatorData]);

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
        mode: 1, // Normal crosshair mode
        horzLine: {
          visible: true,
          labelVisible: false,
        },
        vertLine: {
          visible: true,
          style: 0, // Solid line
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)', // Subtle color
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
        if (!mainSeriesRef.current || mainSeriesRef.current.seriesType() !== (effectiveMainSeries.displayType === 'line' ? 'Line' : 'Histogram')) {
            if (mainSeriesRef.current) {
                chartRef.current.removeSeries(mainSeriesRef.current)
            }
            mainSeriesRef.current = chartRef.current.addSeries(
                mainSeriesType,
                {
                    color: effectiveMainSeries.color,
                    lineWidth: effectiveMainSeries.lineWidth ?? 2,
                    visible: effectiveMainSeries.visible ?? true,
                    lastValueVisible: false,
                    priceLineVisible: false,
                }
            )
        } else {
            mainSeriesRef.current.applyOptions({
                color: effectiveMainSeries.color,
                lineWidth: effectiveMainSeries.lineWidth ?? 2,
                visible: effectiveMainSeries.visible ?? true,
                lastValueVisible: false,
                priceLineVisible: false,
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

        if (!addedSeries) {
            addedSeries = chartRef.current.addSeries(
                s.displayType === 'line' ? LineSeries : HistogramSeries,
                {
                    color: s.color,
                    lineWidth: s.lineWidth ?? 1,
                    visible: s.visible ?? true,
                    lastValueVisible: false,
                    priceLineVisible: false,
                }
            )
            additionalSeriesRefs.current.set(key, addedSeries)
        } else {
            addedSeries.applyOptions({
                color: s.color,
                lineWidth: s.lineWidth ?? 1,
                visible: s.visible ?? true,
                lastValueVisible: false,
                priceLineVisible: false,
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
            const line = targetSeries.createPriceLine({
                price: pl.value,
                color: pl.color,
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: pl.label ?? '',
            })
            priceLinesRef.current.push(line)
        })
    }
  }, [effectiveMainSeries, effectiveAdditionalSeries, effectivePriceLines])

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
    <div className="h-full relative">
      <div
        ref={chartContainerRef}
        data-testid={`indicator-pane-${name}`}
        className="w-full h-full"
      />
      <div className="absolute top-2 left-2 text-xs text-slate-400 z-10 pointer-events-none">
        {name}
      </div>
    </div>
  )
}

export default IndicatorPane