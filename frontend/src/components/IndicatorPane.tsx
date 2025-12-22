import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, HistogramSeries, LineStyle } from 'lightweight-charts'

interface IndicatorSeries {
    id?: string
    data: any[]
    color: string
    displayType: 'line' | 'histogram'
    lineWidth?: number
    visible?: boolean
}

interface IndicatorPaneProps {
  name: string
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
  crosshairPosition?: number | null
}

const IndicatorPane = ({
  name,
  mainSeries,
  additionalSeries = [],
  candles = [],
  priceLines = [],
  height,
  width,
  scaleRanges,
  visible = true,
  onTimeScaleInit,
  crosshairPosition
}: IndicatorPaneProps) => {
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
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
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
      height: height || 150,
      timeScale: {
        visible: false,
        shiftVisibleRangeOnNewBar: false,
      },
      handleScroll: false,
      handleScale: false,
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
  }, [name])

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

    // Handle main series
    if (mainSeries) {
        const mainSeriesType = mainSeries.displayType === 'line' ? LineSeries : HistogramSeries
        if (!mainSeriesRef.current || mainSeriesRef.current.seriesType() !== (mainSeries.displayType === 'line' ? 'Line' : 'Histogram')) {
            if (mainSeriesRef.current) {
                chartRef.current.removeSeries(mainSeriesRef.current)
            }
            mainSeriesRef.current = chartRef.current.addSeries(
                mainSeriesType, 
                {
                    color: mainSeries.color,
                    lineWidth: mainSeries.lineWidth ?? 2,
                    visible: mainSeries.visible ?? true,
                    lastValueVisible: false,
                    priceLineVisible: false,
                }
            )
        } else {
            mainSeriesRef.current.applyOptions({
                color: mainSeries.color,
                lineWidth: mainSeries.lineWidth ?? 2,
                visible: mainSeries.visible ?? true,
                lastValueVisible: false,
                priceLineVisible: false,
            })
        }
        mainSeriesRef.current.setData(mainSeries.data)
    } else if (mainSeriesRef.current) {
        chartRef.current.removeSeries(mainSeriesRef.current)
        mainSeriesRef.current = null
    }

    // Handle additional series
    const currentAdditionalKeys = new Set(additionalSeries.map((s, i) => s.id || `extra-${i}`))
    
    additionalSeriesRefs.current.forEach((s, key) => {
        if (!currentAdditionalKeys.has(key)) {
            chartRef.current.removeSeries(s)
            additionalSeriesRefs.current.delete(key)
        }
    })

    additionalSeries.forEach((s, i) => {
        const key = s.id || `extra-${i}`
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

        priceLines.forEach(pl => {
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
  }, [mainSeries, additionalSeries, priceLines])

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
    if (chartRef.current && width && height) {
        chartRef.current.applyOptions({ width, height })
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