import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
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
  showVolume?: boolean // TradingView Supercharts: show volume histogram
  volumeColorUp?: string // Color for up volume bars (default: #26a69a)
  volumeColorDown?: string // Color for down volume bars (default: #ef5350)
  volumeHeightPercent?: number // Volume pane height as percentage (default: 15%)
  showLastPrice?: boolean // TradingView Supercharts: show last price label and line
  lastPriceUpColor?: string // Color for last price when up (default: #26a69a)
  lastPriceDownColor?: string // Color for last price when down (default: #ef5350)
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
    showVolume = false,
    volumeColorUp = '#26a69a',
    volumeColorDown = '#ef5350',
    volumeHeightPercent = 15,
    showLastPrice = true,
    lastPriceUpColor = '#26a69a',
    lastPriceDownColor = '#ef5350',
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
  const volumeSeriesRef = useRef<any>(null)
  const overlaySeriesRef = useRef<Map<string, any>>(new Map())
  const lastPriceLineRef = useRef<any>(null)

  // Use refs for callbacks to prevent chart recreation when callbacks change
  const onTimeScaleInitRef = useRef(onTimeScaleInit)
  const onCrosshairMoveRef = useRef(onCrosshairMove)
  const onVisibleTimeRangeChangeRef = useRef(onVisibleTimeRangeChange)
  const onVisibleLogicalRangeChangeRef = useRef(onVisibleLogicalRangeChange)

  // Update refs when props change
  useEffect(() => { onTimeScaleInitRef.current = onTimeScaleInit }, [onTimeScaleInit])
  useEffect(() => { onCrosshairMoveRef.current = onCrosshairMove }, [onCrosshairMove])
  useEffect(() => { onVisibleTimeRangeChangeRef.current = onVisibleTimeRangeChange }, [onVisibleTimeRangeChange])
  useEffect(() => { onVisibleLogicalRangeChangeRef.current = onVisibleLogicalRangeChange }, [onVisibleLogicalRangeChange])

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
      upColor: '#26a69a', // TradingView Supercharts up candle color
      downColor: '#ef5350', // TradingView Supercharts down candle color
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      lastValueVisible: showLastPrice, // Show last price label on price scale
      priceLineVisible: showLastPrice, // Show last price horizontal line
    })
    candlestickSeriesRef.current = candlestickSeries

    // Add volume histogram series if enabled (TradingView Supercharts feature)
    // Volume appears at bottom of pane with 10-20% height
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // Set to an empty string to create a new price scale for volume
        lastValueVisible: false,
        priceLineVisible: false,
      })
      volumeSeriesRef.current = volumeSeries

      // Set up volume price scale at bottom of chart
      // Use scaleMargins to position volume at bottom (10-20% of pane height)
      const topMargin = 100 - volumeHeightPercent
      chart.priceScale('').applyOptions({
        scaleMargins: {
          top: topMargin / 100,  // Volume starts at 85% (for 15% height)
          bottom: 0.05,          // Small margin from bottom
        },
      })
    }

    onTimeScaleInitRef.current?.(chart.timeScale())

    if (onVisibleTimeRangeChangeRef.current) {
        chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleTimeRangeChangeRef.current);
    }

    if (onVisibleLogicalRangeChangeRef.current) {
        chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChangeRef.current);
    }

    if (onCrosshairMoveRef.current) {
      chart.subscribeCrosshairMove(onCrosshairMoveRef.current)
    }

    // Notify when chart is ready
    if (onChartReady) {
        const syncSeries = [candlestickSeries, ...Array.from(overlaySeriesRef.current.values())];
        onChartReady(chart, syncSeries);
    }

    // Add double-click handler to reset zoom (T046)
    const handleDoubleClick = () => {
      // Reset to show approximately 150 candles
      chart.timeScale().fitContent()
    }

    chartContainerRef.current.addEventListener('dblclick', handleDoubleClick)

    return () => {
      if (chartContainerRef.current) {
        chartContainerRef.current.removeEventListener('dblclick', handleDoubleClick)
      }
      if (onCrosshairMoveRef.current) chart.unsubscribeCrosshairMove(onCrosshairMoveRef.current)
      if (onVisibleTimeRangeChangeRef.current) chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleTimeRangeChangeRef.current)
      if (onVisibleLogicalRangeChangeRef.current) chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChangeRef.current)
      onTimeScaleInitRef.current?.(null)
      chart.remove()
      chartRef.current = null
      candlestickSeriesRef.current = null
      volumeSeriesRef.current = null
      lastPriceLineRef.current = null
      overlaySeriesRef.current.clear()
    }
  }, [symbol, showLastPrice])

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

  // Update volume data when candles change
  useEffect(() => {
    if (!volumeSeriesRef.current || !showVolume) return

    if (candles.length > 0) {
        // Create volume data with colors matching candle direction
        const volumeData = candles.map(c => {
          const isUp = c.close >= c.open
          return {
            time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
            value: c.volume || 0,
            color: isUp ? volumeColorUp : volumeColorDown,
          }
        })
        const sortedVolumeData = volumeData.sort((a, b) => a.time - b.time)
        const uniqueVolumeData = sortedVolumeData.filter((item, index, arr) =>
          index === 0 || item.time !== arr[index - 1].time
        )
        volumeSeriesRef.current.setData(uniqueVolumeData)
    } else {
        volumeSeriesRef.current.setData([])
    }
  }, [candles, showVolume, volumeColorUp, volumeColorDown])

  // Update last price line color based on last candle direction
  useEffect(() => {
    if (!candlestickSeriesRef.current || !showLastPrice || candles.length === 0) return

    const lastCandle = candles[candles.length - 1]
    const isUp = lastCandle.close >= lastCandle.open
    const lastPriceColor = isUp ? lastPriceUpColor : lastPriceDownColor

    // Update the price line color
    candlestickSeriesRef.current.applyOptions({
      lastPriceColor: lastPriceColor,
    })
  }, [candles, showLastPrice, lastPriceUpColor, lastPriceDownColor])

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
