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
}

const ChartComponent = ({ symbol, candles, overlays = [] }: ChartComponentProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const seriesRef = useRef<any>(null)

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
      height: 400,
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
    })
    
    seriesRef.current = candlestickSeries

    // Render Overlays
    overlays.forEach(overlay => {
        const lineSeries = chart.addSeries(LineSeries, {
            color: overlay.color,
            lineWidth: 2,
        })
        lineSeries.setData(overlay.data)
    })

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth })
    }

    window.addEventListener('resize', handleResize)

    if (candles.length > 0) {
        const formattedData = candles.map(c => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        // Sort by time to be safe
        const sortedData = formattedData.sort((a, b) => a.time - b.time);
        
        // Filter out duplicates
        const uniqueData = sortedData.filter((item, index, arr) => 
          index === 0 || item.time !== arr[index - 1].time
        );
        
        candlestickSeries.setData(uniqueData);
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [symbol, candles, overlays])

  return (
    <div 
      ref={chartContainerRef} 
      data-testid="chart-container" 
      className="w-full h-full"
    />
  )
}

export default ChartComponent
