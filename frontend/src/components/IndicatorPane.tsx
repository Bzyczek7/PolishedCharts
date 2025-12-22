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
}

const IndicatorPane = ({ 
  name, 
  mainSeries,
  additionalSeries = [],
  priceLines = [],
  height,
  width,
  scaleRanges
}: IndicatorPaneProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

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
      },
    })

    chartRef.current = chart
    if (scaleRanges) {
        chart.priceScale('right').applyOptions({
            autoScale: false,
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        })
    }

    const series = chart.addSeries(
        mainSeries.displayType === 'line' ? LineSeries : HistogramSeries, 
        {
            color: mainSeries.color,
            lineWidth: mainSeries.lineWidth ?? 2,
        }
    )
    series.setData(mainSeries.data)

    // Add additional series (like bands)
    additionalSeries.forEach(s => {
        const addedSeries = chart.addSeries(
            s.displayType === 'line' ? LineSeries : HistogramSeries,
            {
                color: s.color,
                lineWidth: s.lineWidth ?? 1,
            }
        )
        addedSeries.setData(s.data)
    })

    // Add fixed price lines
    priceLines.forEach(pl => {
        series.createPriceLine({
            price: pl.value,
            color: pl.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: pl.label ?? '',
        })
    })

    return () => {
      chart.remove()
    }
  }, [name, mainSeries, additionalSeries, priceLines, scaleRanges])

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
