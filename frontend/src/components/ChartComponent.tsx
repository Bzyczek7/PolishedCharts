import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, CandlestickSeries } from 'lightweight-charts'
import type { Time, LogicalRange, IRange } from 'lightweight-charts'
import type { Candle } from '../api/candles'

interface OverlayIndicator {
    id: string
    data: { time: number; value: number; color?: string }[]
    color: string
    lineWidth?: number
}

interface ChartComponentProps {
  symbol: string
  candles: Candle[]
  overlays?: OverlayIndicator[]
  width?: number
  height?: number
  onTimeScaleInit?: (timeScale: any) => void
  onCrosshairMove?: (param: any) => void
  onChartReady?: (chart: any, syncSeries: any[]) => void
  onVisibleTimeRangeChange?: (range: IRange<Time> | null) => void
  onVisibleLogicalRangeChange?: (range: LogicalRange | null) => void
}

const ChartComponent = ({
    symbol,
    candles,
    overlays = [],
    width,
    height,
    onTimeScaleInit,
    onCrosshairMove,
    onChartReady,
    onVisibleTimeRangeChange,
    onVisibleLogicalRangeChange
}: ChartComponentProps) => {
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
      crosshair: {
        mode: 1,
        horzLine: { visible: true, labelVisible: true },
        vertLine: {
          visible: true,
          style: 0,
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          labelVisible: true,
        },
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
      lastValueVisible: false,
      priceLineVisible: false,
    })
    candlestickSeriesRef.current = candlestickSeries

    onTimeScaleInit?.(chart.timeScale())

    if (onVisibleTimeRangeChange) {
        chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleTimeRangeChange);
    }
    
    if (onVisibleLogicalRangeChange) {
        chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange);
    }

    if (onCrosshairMove) {
      chart.subscribeCrosshairMove(onCrosshairMove)
    }

    // Notify when chart is ready
    if (onChartReady) {
        const syncSeries = [candlestickSeries, ...Array.from(overlaySeriesRef.current.values())];
        onChartReady(chart, syncSeries);
    }

    return () => {
      if (onCrosshairMove) chart.unsubscribeCrosshairMove(onCrosshairMove)
      if (onVisibleTimeRangeChange) chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleTimeRangeChange)
      if (onVisibleLogicalRangeChange) chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange)
      onTimeScaleInit?.(null)
      chart.remove()
      chartRef.current = null
      candlestickSeriesRef.current = null
      overlaySeriesRef.current.clear()
    }
  }, [symbol, width, height, onTimeScaleInit, onCrosshairMove])

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

    const currentOverlayIds = new Set(overlays.map(o => o.id))

    // Clean up old overlays
    overlaySeriesRef.current.forEach((s, id) => {
        if (!currentOverlayIds.has(id)) {
            chartRef.current.removeSeries(s)
            overlaySeriesRef.current.delete(id)
        }
    })

    // Add or update overlays
    overlays.forEach((overlay) => {
        let lineSeries = overlaySeriesRef.current.get(overlay.id)
        if (!lineSeries) {
            lineSeries = chartRef.current.addSeries(LineSeries, {
                color: overlay.color,
                lineWidth: overlay.lineWidth ?? 2,
                lastValueVisible: false,
                priceLineVisible: false,
            })
            overlaySeriesRef.current.set(overlay.id, lineSeries)
        } else {
            lineSeries.applyOptions({
                color: overlay.color,
                lineWidth: overlay.lineWidth ?? 2,
                lastValueVisible: false,
                priceLineVisible: false,
            })
        }
        // For line series, if data points have individual colors, lightweight-charts will use them
        // Otherwise it will use the series color
        lineSeries.setData(overlay.data)
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
