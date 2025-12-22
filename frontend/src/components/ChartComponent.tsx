import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, CandlestickSeries } from 'lightweight-charts'
import type { Candle } from '../api/candles'

interface OverlayIndicator {
    data: { time: number; value: number }[]
    color: string
}

interface ChartComponentProps {
  symbol: string
  candles: Candle[]
  overlays?: OverlayIndicator[]
  width?: number
  height?: number
  onTimeScaleInit?: (timeScale: any) => void
}

const ChartComponent = ({ symbol, candles, overlays = [], width, height, onTimeScaleInit }: ChartComponentProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candlestickSeriesRef = useRef<any>(null)
  const overlaySeriesRef = useRef<Map<string, any>>(new Map())

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
      height: height || chartContainerRef.current.clientHeight || 400,
    })

    chartRef.current = chart
    
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
    })
    
    candlestickSeriesRef.current = candlestickSeries

    if (onTimeScaleInit) {
        onTimeScaleInit(chart.timeScale())
    }

    return () => {
      if (onTimeScaleInit) {
        onTimeScaleInit(null)
      }
      chart.remove()
      chartRef.current = null
      candlestickSeriesRef.current = null
      overlaySeriesRef.current.clear()
    }
  }, [symbol]) // Re-create only on symbol change

  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    if (candles.length > 0) {
        const formattedData = candles.map(c => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }));
        const sortedData = formattedData.sort((a, b) => a.time - b.time);
        const uniqueData = sortedData.filter((item, index, arr) => 
          index === 0 || item.time !== arr[index - 1].time
        );
        candlestickSeriesRef.current.setData(uniqueData);
    } else {
        candlestickSeriesRef.current.setData([]);
    }
  }, [candles])

  useEffect(() => {
    if (!chartRef.current) return

    // Clean up old overlays
    overlaySeriesRef.current.forEach(s => chartRef.current.removeSeries(s))
    overlaySeriesRef.current.clear()

    // Add new overlays
    overlays.forEach((overlay, idx) => {
        const lineSeries = chartRef.current.addSeries(LineSeries, {
            color: overlay.color,
            lineWidth: 2,
        })
        lineSeries.setData(overlay.data)
        overlaySeriesRef.current.set(`overlay-${idx}`, lineSeries)
    })
  }, [overlays])

  useEffect(() => {
    if (chartRef.current && width && height) {
        chartRef.current.applyOptions({ width, height })
    }
  }, [width, height])

  return (
    <div 
      ref={chartContainerRef} 
      data-testid="chart-container" 
      className="w-full h-full"
    />
  )
}

export default ChartComponent
