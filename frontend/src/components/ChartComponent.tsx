import { useEffect, useRef } from 'react'
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts'
import { getCandles } from '../api/candles'

interface ChartComponentProps {
  symbol: string
}

const ChartComponent = ({ symbol }: ChartComponentProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)

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

    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
    })
    
    seriesRef.current = candlestickSeries

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth })
    }

    window.addEventListener('resize', handleResize)

    const fetchData = async () => {
      try {
        const data = await getCandles(symbol)
        const formattedData = data.map(c => ({
          time: c.timestamp.split('T')[0], // Lightweight charts needs date string YYYY-MM-DD
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        candlestickSeries.setData(formattedData)
      } catch (error) {
        console.error('Error fetching chart data:', error)
      }
    }

    fetchData()

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [symbol])

  return (
    <div 
      ref={chartContainerRef} 
      data-testid="chart-container" 
      className="w-full h-full"
    />
  )
}

export default ChartComponent
