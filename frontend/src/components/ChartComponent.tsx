import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, LineSeries, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import type { Time, LogicalRange, IRange } from 'lightweight-charts'
import type { Candle } from '../api/candles'
import { performanceStore } from '../lib/performanceStore'
import type { PerformanceLog } from '../types/performance'

interface OverlayIndicator {
    id: string
    data: { time: number; value: number; color?: string }[]
    color: string
    lineWidth?: number
    showLastValue?: boolean;
    visible?: boolean; // Feature 008 - T013: Support visibility option
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
  // Default right offset - candles gap from right edge
  // Used as constant to ensure consistency across all offset calculations
  const BASE_RIGHT_OFFSET = 5
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candlestickSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const overlaySeriesRef = useRef<Map<string, any>>(new Map())
  const lastPriceLineRef = useRef<any>(null)
  const currentChartKeyRef = useRef<string>('')

  // Track actual data length (after deduplication) to avoid stale closures
  const actualDataLengthRef = useRef<number>(0)

  // Store handler ref for proper cleanup
  const handleVisibleLogicalRangeChangeRef = useRef<((range: any) => void) | null>(null)

  // Track if chart has data - used to guard against callbacks firing before initialization
  const hasDataRef = useRef<boolean>(candles.length > 0)

  // Reset to latest function ref - shared by fast-forward button and double-click
  const resetToLatestRef = useRef<(() => void) | null>(null)

  // Track if latest candle is visible (button only shows when scrolled back)
  const [isLatestVisible, setIsLatestVisible] = useState<boolean>(true)

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

  // Fast-forward handler - calls resetToLatest ref (defined in chart creation effect)
  const handleFastForward = () => resetToLatestRef.current?.()

  // Resubscribe to time range changes when handler changes (fixes stale closure issue)
  // NOTE: Only resubscribes if chart already has data (hasDataRef guard)
  useEffect(() => {
    if (!chartRef.current || !hasDataRef.current) return

    const timeScale = chartRef.current.timeScale()

    // Unsubscribe old handler if exists
    try {
      if (onVisibleTimeRangeChangeRef.current) {
        timeScale.unsubscribeVisibleTimeRangeChange(onVisibleTimeRangeChangeRef.current)
      }
    } catch (e) {
      // Ignore - may not have been subscribed yet
    }

    // Subscribe to new handler
    if (onVisibleTimeRangeChangeRef.current) {
      timeScale.subscribeVisibleTimeRangeChange(onVisibleTimeRangeChangeRef.current)
    }
  }, [onVisibleTimeRangeChange])

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chartKey = `${symbol}-${showLastPrice}`

    // Skip if chart is already created for this key
    if (currentChartKeyRef.current === chartKey && chartRef.current) {
      return
    }

    // Additional check: if container already has a canvas element (lightweight-charts), skip creation
    if (chartContainerRef.current.querySelector('canvas')) {
      return
    }

    // First, remove any existing chart properly
    if (chartRef.current) {
      try {
        chartRef.current.remove()
      } catch (e) {
        console.warn('ChartComponent: Error removing chart:', e)
      }
      chartRef.current = null
    }

    chartContainerRef.current.innerHTML = ''

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
        mode: 1, // Normal mode for main price chart
        horzLine: { visible: true, labelVisible: true },
        vertLine: {
          visible: true,
          style: 0,
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          labelVisible: true,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: BASE_RIGHT_OFFSET, // Use constant instead of hardcoded 5
        minBarSpacing: 3, // Allow tighter packing of candles
        fixLeftEdge: false, // Allow scrolling beyond loaded data for infinite backfill
        fixRightEdge: false, // Allow free positioning - last candle can be anywhere on screen
      },
      width: width || chartContainerRef.current.clientWidth,
      height: height || chartContainerRef.current.clientHeight || 400,
    })

    // Reset handler ref when chart is created/recreated
    handleVisibleLogicalRangeChangeRef.current = null  // Reset before subscribing

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

    // NOTE: onVisibleTimeRangeChange subscription is deferred until after data is set
    // (see useEffect for candles at line 336-342) to prevent lightweight-charts
    // from calling getVisibleRange() during initialization, which causes "Value is null" error

    // Define named handler for free positioning
    // Lightweight Charts handles free positioning natively when fixRightEdge: false
    // We only need to propagate the range change to the parent for scroll-backfill detection
    const handleVisibleLogicalRangeChange = (range: any) => {
      // Guard: only process range changes after chart has data
      if (!hasDataRef.current) return
      if (!range || typeof range.from !== 'number' || typeof range.to !== 'number') {
        // Guard against null/invalid ranges during chart initialization
        return
      }

      // Wrap in try-catch to handle cases where chart isn't fully initialized
      try {
        // Check if latest candle is visible (for fast-forward button)
        // range.to is the logical index of the rightmost visible candle
        const latestIndex = actualDataLengthRef.current - 1
        const isLatestVisible = range.to >= latestIndex
        setIsLatestVisible(isLatestVisible)

        // Always propagate to external callback for scroll-backfill detection
        // The parent component needs range changes for detecting when to fetch historical data
        if (onVisibleLogicalRangeChangeRef.current) {
          onVisibleLogicalRangeChangeRef.current(range)
        }
      } catch (e) {
        // Silently ignore errors during chart initialization
      }

      // That's it! No manual rightOffset management.
      // Lightweight Charts handles free positioning natively when fixRightEdge: false
    }

    // Store the handler ref for cleanup
    handleVisibleLogicalRangeChangeRef.current = handleVisibleLogicalRangeChange

    // Subscribe to visible range changes ONLY after chart has data
    // This prevents the race condition where the callback fires before chart initialization
    if (hasDataRef.current) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange)
    }

    if (onCrosshairMoveRef.current) {
      chart.subscribeCrosshairMove(onCrosshairMoveRef.current)
    }

    // Notify when chart is ready
    if (onChartReady) {
        const syncSeries = [candlestickSeries, ...Array.from(overlaySeriesRef.current.values())];
        onChartReady(chart, syncSeries);
    }

    // Shared reset-to-latest function (used by fast-forward button and double-click)
    const resetToLatest = () => {
      chart.timeScale().applyOptions({ rightOffset: BASE_RIGHT_OFFSET })
      chart.timeScale().fitContent()
    }

    // Store in ref for button access
    resetToLatestRef.current = resetToLatest

    // Add double-click handler to reset zoom (T046) - now uses shared reset function
    const handleDoubleClick = () => resetToLatest()

    const container = chartContainerRef.current
    if (container) {
      container.addEventListener('dblclick', handleDoubleClick)
    }

    // Store the chart key after successful creation
    currentChartKeyRef.current = chartKey

    return () => {
      // Clear the chart key on cleanup
      currentChartKeyRef.current = ''
      // Clear reset ref to prevent calls into removed chart instance
      resetToLatestRef.current = null

      if (container) {
        container.removeEventListener('dblclick', handleDoubleClick)
      }
      if (onCrosshairMoveRef.current) chart.unsubscribeCrosshairMove(onCrosshairMoveRef.current)
      // Safe unsubscribe - checks if subscription exists (may not be subscribed yet due to deferral)
      if (onVisibleTimeRangeChangeRef.current) {
        try {
          chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleTimeRangeChangeRef.current)
        } catch (e) {
          // Ignore - may not have been subscribed yet
        }
      }
      // Unsubscribe wrapper handler (replaces external handler subscription)
      if (handleVisibleLogicalRangeChangeRef.current) {
        try {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChangeRef.current)
        } catch (e) {
          // Ignore - may not have been subscribed yet
        }
      }
      onTimeScaleInitRef.current?.(null)
      chart.remove()
      // Extra safety: clear any remaining DOM elements
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = ''
      }
      chartRef.current = null
      candlestickSeriesRef.current = null
      volumeSeriesRef.current = null
      lastPriceLineRef.current = null
      overlaySeriesRef.current.clear()
    }
  }, [symbol, showLastPrice])

  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    // CRITICAL: Unsubscribe from range changes BEFORE setting new data
    // This prevents lightweight-charts from calling getVisibleRange() during
    // the data update transition, which causes "Value is null" errors
    if (chartRef.current) {
      if (handleVisibleLogicalRangeChangeRef.current) {
        try {
          chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChangeRef.current)
        } catch (e) {
          // Ignore - may not have been subscribed yet
        }
      }
      if (onVisibleTimeRangeChangeRef.current) {
        try {
          chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleTimeRangeChangeRef.current)
        } catch (e) {
          // Ignore - may not have been subscribed yet
        }
      }
      // Mark that we don't have stable data during the transition
      hasDataRef.current = false
    }

    // T017: Instrument chart rendering with performance logging
    const renderStart = performance.now()

    if (candles.length > 0) {
        const formattedData = candles.map(c => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }));
        const sortedData = formattedData.sort((a, b) => a.time - b.time);

        // Check for duplicates
        const duplicates = sortedData.filter((item, index, arr) =>
          index > 0 && item.time === arr[index - 1].time
        );
        if (duplicates.length > 0) {
          console.warn('ChartComponent: Found', duplicates.length, 'duplicate candles in input data');
        }

        // Create a map to store unique candles by time, keeping the last one for each time
        const uniqueMap = new Map();
        sortedData.forEach(item => {
          uniqueMap.set(item.time, item);
        });

        const uniqueData = Array.from(uniqueMap.values());

        // Track actual data length after deduplication for offset calculations
        actualDataLengthRef.current = uniqueData.length

        candlestickSeriesRef.current.setData(uniqueData);

        // Subscribe to range changes now that we have data
        // Use requestAnimationFrame to ensure the chart has fully processed
        // the new data before we attach callbacks that query its state
        requestAnimationFrame(() => {
          if (chartRef.current) {
            if (handleVisibleLogicalRangeChangeRef.current) {
              chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(
                handleVisibleLogicalRangeChangeRef.current
              )
            }
            if (onVisibleTimeRangeChangeRef.current) {
              chartRef.current.timeScale().subscribeVisibleTimeRangeChange(
                onVisibleTimeRangeChangeRef.current
              )
            }
            // Signal that we now have stable data AFTER subscriptions are set up
            // This prevents the useEffect on lines 90-108 from subscribing too early
            hasDataRef.current = true
          }
        })
    } else {
        candlestickSeriesRef.current.setData([]);
        // Still need to mark as having data (even if empty) to allow re-subscription
        requestAnimationFrame(() => {
          hasDataRef.current = true
        })
    }

    // T017: Log chart render performance
    const renderDuration = performance.now() - renderStart
    performanceStore.record({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      category: 'rendering',
      operation: 'render_chart',
      duration_ms: renderDuration,
      context: {
        symbol,
        candle_count: candles.length,
        overlay_count: overlays.length,
      },
    });
  }, [candles, symbol, overlays])

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
        const seriesOptions = {
            color: overlay.color,
            lineWidth: overlay.lineWidth ?? 2,
            lastValueVisible: overlay.showLastValue ?? true,
            priceLineVisible: false, // Disable horizontal price line
            visible: overlay.visible ?? true, // Feature 008 - T013: Support visibility option
        }

        if (!lineSeries) {
            lineSeries = chartRef.current.addSeries(LineSeries, seriesOptions)
            overlaySeriesRef.current.set(overlay.id, lineSeries)
        } else {
            lineSeries.applyOptions(seriesOptions)
        }

        // Set overlay data directly
        // Timestamps should already be normalized to Unix seconds in App.tsx
        lineSeries.setData(overlay.data)
    })
  }, [overlays])

  useEffect(() => {
    if (chartRef.current && width && height) {
      chartRef.current.applyOptions({ width, height })
    }
  }, [width, height])

  return (
    <div className="relative w-full h-full">
      <div
        ref={chartContainerRef}
        data-testid="chart-container"
        className="w-full h-full"
      />
      {/* Fast-forward button - only shows when scrolled back (latest candle off-screen) */}
      {!isLatestVisible && (
        <div className="absolute bottom-24 left-[90%] z-10 text-2xl pointer-events-none">
          <button
            onClick={handleFastForward}
            className="pointer-events-auto cursor-pointer bg-transparent hover:bg-transparent border-0 p-0"
            style={{ color: '#d1d4dc' }}
            title="Return to latest"
          >
            &gt;&gt;
          </button>
        </div>
      )}
    </div>
  )
}

export default ChartComponent
