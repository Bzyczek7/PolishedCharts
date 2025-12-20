import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, HistogramSeries, ISeriesApi } from 'lightweight-charts'

interface IndicatorPaneProps {
  name: string
  data: any[]
  displayType: 'line' | 'histogram'
  color: string
  height?: number
  scaleRanges?: {
    min: number
    max: number
  }
}

const IndicatorPane = ({ 
  name, 
  data, 
  displayType, 
  color, 
  height = 150,
  scaleRanges
}: IndicatorPaneProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const seriesRef = useRef<ISeriesApi<any> | null>(null)

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
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        visible: false, // Hide time scale as it's synced with the main chart (or would be)
      },
    })

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
        displayType === 'line' ? LineSeries : HistogramSeries, 
        {
            color: color,
            lineWidth: 2,
        }
    )
    
    seriesRef.current = series
    series.setData(data)

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [name, data, displayType, color, height, scaleRanges])

  return (
    <div className="mt-4">
      <div className="text-xs text-slate-500 mb-1">{name}</div>
      <div 
        ref={chartContainerRef} 
        data-testid={`indicator-pane-${name}`} 
        className="w-full"
        style={{ height }}
      />
    </div>
  )
}

export default IndicatorPane
