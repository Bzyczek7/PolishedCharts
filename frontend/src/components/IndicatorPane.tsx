import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, HistogramSeries, LineStyle } from 'lightweight-charts'

interface IndicatorSeries {
    data: any[]
    color: string
    displayType: 'line' | 'histogram'
    lineWidth?: number
}

interface IndicatorPaneProps {
  name: string
  mainSeries: IndicatorSeries
  additionalSeries?: IndicatorSeries[]
  candles?: any[]
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
  onTimeScaleInit
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
    
    // Add a hidden series to force the timescale to match candles
    const baseline = chart.addSeries(LineSeries, {
        visible: false,
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
  }, [name]) // Re-create only on name change

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
    if (!mainSeriesRef.current) {
        mainSeriesRef.current = chartRef.current.addSeries(
            mainSeries.displayType === 'line' ? LineSeries : HistogramSeries, 
            {
                color: mainSeries.color,
                lineWidth: mainSeries.lineWidth ?? 2,
            }
        )
    } else {
        mainSeriesRef.current.applyOptions({
            color: mainSeries.color,
            lineWidth: mainSeries.lineWidth ?? 2,
        })
    }
    mainSeriesRef.current.setData(mainSeries.data)

    // Handle additional series
    const currentAdditionalKeys = new Set(additionalSeries.map((_, i) => `extra-${i}`))
    
    // Cleanup old additional series
    additionalSeriesRefs.current.forEach((s, key) => {
        if (!currentAdditionalKeys.has(key)) {
            chartRef.current.removeSeries(s)
            additionalSeriesRefs.current.delete(key)
        }
    })

    // Update or add additional series
    additionalSeries.forEach((s, i) => {
        const key = `extra-${i}`
        let addedSeries = additionalSeriesRefs.current.get(key)
        
        if (!addedSeries) {
            addedSeries = chartRef.current.addSeries(
                s.displayType === 'line' ? LineSeries : HistogramSeries,
                {
                    color: s.color,
                    lineWidth: s.lineWidth ?? 1,
                }
            )
            additionalSeriesRefs.current.set(key, addedSeries)
        } else {
            addedSeries.applyOptions({
                color: s.color,
                lineWidth: s.lineWidth ?? 1,
            })
        }
        addedSeries.setData(s.data)
    })

    // Handle price lines (attached to mainSeries)
    priceLinesRef.current.forEach(pl => mainSeriesRef.current.removePriceLine(pl))
    priceLinesRef.current = []

    priceLines.forEach(pl => {
        const line = mainSeriesRef.current.createPriceLine({
            price: pl.value,
            color: pl.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: pl.label ?? '',
        })
        priceLinesRef.current.push(line)
    })
  }, [mainSeries, additionalSeries, priceLines])

  useEffect(() => {
    if (!chartRef.current || !scaleRanges) return

    chartRef.current.priceScale('right').applyOptions({
        autoScale: false,
        scaleMargins: {
            top: 0.1,
            bottom: 0.1,
        },
    })
    
    // Set price range
    if (mainSeriesRef.current) {
        mainSeriesRef.current.priceScale().applyOptions({
            autoScale: false,
        })
        // In v5, visiblePriceRange is not in applyOptions for series, but for priceScale?
        // Actually, it should be:
        chartRef.current.priceScale('right').applyOptions({
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

  return (
    <div className="mt-4 h-full">
      <div className="text-xs text-slate-500 mb-1">{name}</div>
      <div 
        ref={chartContainerRef} 
        data-testid={`indicator-pane-${name}`} 
        className="w-full h-[calc(100%-20px)]"
      />
    </div>
  )
}

export default IndicatorPane
