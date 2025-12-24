import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import Layout from './components/Layout'
import Toolbar from './components/Toolbar'
import Watchlist from './components/Watchlist'
import AlertsView from './components/AlertsView'
import ChartComponent from './components/ChartComponent'
import { OHLCDisplayWithTime } from './components/chart/OHLCDisplay'
import type { Alert } from './components/AlertsList'
import type { Layout as LayoutType } from './components/Toolbar'
import IndicatorPane from './components/IndicatorPane'
import { loadLayouts, saveLayouts, loadWatchlist, saveWatchlist, loadAlerts, saveAlerts } from './services/layoutService'
import { getCandles } from './api/candles'
import type { Candle } from './api/candles'
import { TooltipProvider } from '@/components/ui/tooltip'
import { formatDataForChart } from './lib/chartUtils'
import { IndicatorProvider, useIndicatorContext } from './contexts/IndicatorContext'
import { IndicatorDialog } from './components/indicators/IndicatorDialog'
import { useIndicatorData } from './hooks/useIndicatorData'
import type { IndicatorOutput } from './components/types/indicators'
import type { Time, IRange } from 'lightweight-charts'
import { getLatestPrices } from './api/watchlist'
import { useWebSocket } from './hooks/useWebSocket';

interface AppContentProps {
  symbol: string
  setSymbol: (symbol: string) => void
}

function AppContent({ symbol, setSymbol }: AppContentProps) {
  const [chartInterval, setChartInterval] = useState('1d')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false)
  const mainViewportRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [mainTimeScale, setMainTimeScale] = useState<any>(null)
  const indicatorTimeScalesRef = useRef<Map<string, any>>(new Map())
  const { connect, disconnect, lastMessage } = useWebSocket();

  const [watchlist, setWatchlist] = useState(() => {
    const symbols = loadWatchlist()
    return symbols.map(s => {
        const charSum = s.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const basePrice = 100 + (charSum % 200);
        const change = (charSum % 10) - 5;
        const changePercent = (change / basePrice) * 100;
        
        return {
            symbol: s,
            price: basePrice,
            change: change,
            changePercent: changePercent
        }
    })
  })
  const [alerts, setAlerts] = useState<Alert[]>(() => loadAlerts())
  const [layouts, setLayouts] = useState<LayoutType[]>([])
  const [activeLayout, setActiveLayout] = useState<LayoutType | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const lastFetchedToDateRef = useRef<string | null>(null)
  const [visibleRange, setVisibleRange] = useState<IRange<Time> | null>(null)
  const [crosshairTime, setCrosshairTime] = useState<number | null>(null)
  const [crosshairCandle, setCrosshairCandle] = useState<Candle | null>(null)
  const [indicatorSettings, setIndicatorSettings] = useState<Record<string, { visible: boolean; series: Record<string, boolean>; showLevels: boolean }>>({})
  const [isInitialLoading, setIsInitialLoading] = useState(true) // T101: Initial loading state
  const [error, setError] = useState<string | null>(null) // T102: Error state
  const mainChartRef = useRef<any>(null)
  const indicatorChartsRef = useRef<Map<string, { chart: any; series: any }>>(new Map())

  // Use the new indicator system
  const { indicators, addIndicator } = useIndicatorContext()
  const indicatorDataMap = useIndicatorData(indicators, symbol, chartInterval)

  // Effect to automatically add new indicators to the active layout
  useEffect(() => {
    if (indicators.length > 0 && activeLayout) {
      // Get all indicator names from the context
      const contextIndicatorNames = indicators.map(ind => ind.indicatorType.name.toLowerCase());

      // Find indicators that are in the context but not in the active layout
      const missingFromActiveLayout = contextIndicatorNames.filter(name =>
        !activeLayout.activeIndicators.includes(name)
      );

      // Add missing indicators to the active layout
      if (missingFromActiveLayout.length > 0) {
        const updated: LayoutType = {
          ...activeLayout,
          activeIndicators: [...activeLayout.activeIndicators, ...missingFromActiveLayout]
        };

        setActiveLayout(updated);

        if (activeLayout.id !== 'default') {
          const updatedLayouts = layouts.map(l => l.id === updated.id ? updated : l);
          setLayouts(updatedLayouts);
          saveLayouts(updatedLayouts);
        }
      }
    }
  }, [indicators, activeLayout, layouts]);

  const toggleIndicatorVisibility = useCallback((indicatorId: string) => {
    setIndicatorSettings(prev => ({
        ...prev,
        [indicatorId]: {
            ...prev[indicatorId],
            visible: prev[indicatorId]?.visible === false ? true : false
        }
    }))
  }, [])

  const toggleSeriesVisibility = useCallback((indicatorId: string, seriesId: string) => {
    setIndicatorSettings(prev => ({
        ...prev,
        [indicatorId]: {
            ...prev[indicatorId],
            series: {
                ...prev[indicatorId]?.series,
                [seriesId]: prev[indicatorId]?.series?.[seriesId] === false ? true : false
            }
        }
    }))
  }, [])

  const toggleLevelsVisibility = useCallback((indicatorId: string) => {
    setIndicatorSettings(prev => ({
        ...prev,
        [indicatorId]: {
            ...prev[indicatorId],
            showLevels: prev[indicatorId]?.showLevels === false ? true : false
        }
    }))
  }, [])

  useEffect(() => {
    if (!mainViewportRef.current) return

    const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
            const { width, height } = entries[0].contentRect
            setDimensions({ width, height })
        }
    })

    observer.observe(mainViewportRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!mainTimeScale) return

    const handleRangeChange = (range: any) => {
        if (!range) return
        indicatorTimeScalesRef.current.forEach((ts) => {
            ts.setVisibleLogicalRange(range)
        })
    }

    mainTimeScale.subscribeVisibleLogicalRangeChange(handleRangeChange)
    
    const currentRange = mainTimeScale.getVisibleLogicalRange()
    if (currentRange) {
        indicatorTimeScalesRef.current.forEach((ts) => {
            ts.setVisibleLogicalRange(currentRange)
        })
    }

    return () => {
        mainTimeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange)
    }
  }, [mainTimeScale, activeLayout?.activeIndicators, candles])

  useEffect(() => {
    saveWatchlist(watchlist.map(item => item.symbol))
  }, [watchlist])

  useEffect(() => {
    saveAlerts(alerts)
  }, [alerts])

  // Periodically update watchlist with real-time data
  useEffect(() => {
    if (watchlist.length === 0) return; // Don't start timer if no symbols

    const updateWatchlistPrices = async () => {
      try {
        const symbols = watchlist.map(item => item.symbol);
        const latestPrices = await getLatestPrices(symbols);

        setWatchlist(prevWatchlist => {
          const updatedWatchlist = [...prevWatchlist];

          for (const priceData of latestPrices) {
            const index = updatedWatchlist.findIndex(item => item.symbol === priceData.symbol);
            if (index !== -1 && !priceData.error) {
              updatedWatchlist[index] = {
                symbol: priceData.symbol,
                price: priceData.price,
                change: priceData.change,
                changePercent: priceData.changePercent
              };
            }
          }

          return updatedWatchlist;
        });
      } catch (error) {
        console.error('Error updating watchlist prices:', error);
      }
    };

    // Update watchlist every 30 seconds
    const intervalId = setInterval(updateWatchlistPrices, 30000);

    // Initial update
    updateWatchlistPrices();

    return () => clearInterval(intervalId);
  }, [watchlist])

  useEffect(() => {
    // Connect to websocket for real-time updates
    if (symbol && chartInterval) {
        const wsUrl = `ws://localhost:8000/api/v1/candles/ws/${symbol}?interval=${chartInterval}`;
        connect(wsUrl);
    }
    return () => {
        disconnect();
    };
  }, [symbol, chartInterval, connect, disconnect]);

  useEffect(() => {
    if (lastMessage) {
      const newCandle = JSON.parse(lastMessage.data);
      setCandles(prevCandles => {
        // Create a new array with the updated candle
        const updatedCandles = [...prevCandles];
        const existingCandleIndex = updatedCandles.findIndex(c => c.timestamp === newCandle.timestamp);

        if (existingCandleIndex !== -1) {
          // Update existing candle
          updatedCandles[existingCandleIndex] = newCandle;
        } else {
          // Add new candle
          updatedCandles.push(newCandle);
        }

        // Sort candles by timestamp to ensure they are in order
        return updatedCandles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });
    }
  }, [lastMessage]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K: Open search
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
      // Cmd/Ctrl+I: Open indicators
      if (e.key === "i" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsIndicatorsOpen((open) => !open)
      }
      // T095, T096: Plus/Equals key to zoom in, Minus to zoom out
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        // Zoom in by reducing visible range
        if (mainTimeScale) {
          const currentRange = mainTimeScale.getVisibleLogicalRange()
          if (currentRange) {
            const rangeWidth = currentRange.to - currentRange.from
            const newRangeWidth = rangeWidth * 0.8 // Zoom in by 20%
            const center = (currentRange.from + currentRange.to) / 2
            mainTimeScale.setVisibleLogicalRange({
              from: center - newRangeWidth / 2,
              to: center + newRangeWidth / 2
            })
          }
        }
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        // Zoom out by increasing visible range
        if (mainTimeScale) {
          const currentRange = mainTimeScale.getVisibleLogicalRange()
          if (currentRange) {
            const rangeWidth = currentRange.to - currentRange.from
            const newRangeWidth = rangeWidth * 1.2 // Zoom out by 20%
            const center = (currentRange.from + currentRange.to) / 2
            mainTimeScale.setVisibleLogicalRange({
              from: center - newRangeWidth / 2,
              to: center + newRangeWidth / 2
            })
          }
        }
      }
      // T097: R or 0 to reset zoom
      if (e.key === "r" || e.key === "R" || (e.key === "0" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
        if (mainTimeScale) {
          mainTimeScale.fitContent()
        }
      }
      // T098: Escape to exit drawing mode (if implemented)
      if (e.key === "Escape") {
        // This will be used when drawing tools are implemented
        // For now, just ensure no modal is open
        if (isSearchOpen) setIsSearchOpen(false)
        if (isIndicatorsOpen) setIsIndicatorsOpen(false)
      }
      // T099: C to toggle crosshair (handled by lightweight-charts natively)
      // The crosshair visibility is managed by lightweight-charts internal state
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [mainTimeScale, isSearchOpen, isIndicatorsOpen])

  useEffect(() => {
    const saved = loadLayouts()
    setLayouts(saved)
    if (saved.length > 0) {
        setActiveLayout(saved[0])
    } else {
        const defaultLayout: LayoutType = {
            id: 'default',
            name: 'Default Layout',
            activeIndicators: [],
            indicatorParams: {}
        }
        setActiveLayout(defaultLayout)
    }
  }, [])

  useEffect(() => {
    // Reset pagination state when symbol or interval changes
    setHasMoreHistory(true)
    lastFetchedToDateRef.current = null
    setIsInitialLoading(true) // T101: Set loading state
    setError(null) // T102: Clear error state

    const fetchData = async () => {
        try {
            const to = new Date().toISOString()
            const fromDate = new Date()
            // Set lookback based on interval: 2 years for daily, 4 years for weekly
            const daysBack = chartInterval === '1d' ? 730 : chartInterval === '1wk' ? 1460 : 365
            fromDate.setDate(fromDate.getDate() - daysBack)
            const from = fromDate.toISOString()

            // Only fetch candles - indicator data is fetched by useIndicatorData hook
            const candleData = await getCandles(symbol, chartInterval, from, to).catch(() => [])
            setCandles(candleData)

            // T102: Check if we got valid data
            if (candleData.length === 0) {
                setError(`No data available for ${symbol}`)
            }
        } catch (e) {
            console.error('Failed to fetch data', e)
            // T102: Set error state
            setError(`Failed to load data for ${symbol}. Please try again.`)
        } finally {
            setIsInitialLoading(false) // T101: Clear loading state
        }
    }
    fetchData()
  }, [symbol, chartInterval])

  const handleSymbolSelect = useCallback((newSymbol: string) => {
    setSymbol(newSymbol)
    setWatchlist(prev => {
        if (prev.some(item => item.symbol === newSymbol)) return prev
        return [...prev, {
            symbol: newSymbol,
            price: 150.00 + (Math.random() * 50),
            change: (Math.random() * 4) - 2,
            changePercent: (Math.random() * 2) - 1
        }]
    })
  }, [])

  const handleLayoutSave = useCallback((name: string) => {
    const newLayout: LayoutType = {
        id: Date.now().toString(),
        name,
        activeIndicators: activeLayout?.activeIndicators || [],
        indicatorParams: activeLayout?.indicatorParams || {}
    }
    const updated = [...layouts, newLayout]
    setLayouts(updated)
    saveLayouts(updated)
    setActiveLayout(newLayout)
  }, [activeLayout, layouts])

  const toggleIndicator = useCallback((indicator: string) => {
    const currentLayout = activeLayout || {
        id: 'default',
        name: 'Default Layout',
        activeIndicators: [],
        indicatorParams: {}
    }
    
    const active = currentLayout.activeIndicators.includes(indicator)
    const updated: LayoutType = {
        ...currentLayout,
        activeIndicators: active 
            ? currentLayout.activeIndicators.filter((i: string) => i !== indicator)
            : [...currentLayout.activeIndicators, indicator]
    }
    
    setActiveLayout(updated)
    
    if (updated.id !== 'default') {
        const updatedLayouts = layouts.map(l => l.id === updated.id ? updated : l)
        setLayouts(updatedLayouts)
        saveLayouts(updatedLayouts)
    }
  }, [activeLayout, layouts])

  const triggeredCount = alerts.filter(a => a.status === 'triggered').length

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  }, [])

  // Separate overlay indicators from pane indicators
  const overlayIndicators = useMemo(() => {
    return indicators.filter(ind => ind.indicatorType.category === 'overlay')
  }, [indicators])

  const paneIndicators = useMemo(() => {
    return indicators.filter(ind => ind.indicatorType.category === 'oscillator')
  }, [indicators])

  // Calculate chart height: expand to fill space when no oscillator panes, otherwise use 60%
  const visiblePaneCount = paneIndicators.filter(ind => {
    const data = indicatorDataMap[ind.id]
    return data && ind.displaySettings.visible && indicatorSettings[ind.id]?.visible !== false
  }).length

  const mainHeight = visiblePaneCount === 0
    ? Math.max(dimensions.height - 40, 300)  // Full height minus padding, minimum 300px
    : Math.max(dimensions.height * 0.6, 300)

  // Format overlay indicators for ChartComponent
  const overlays = useMemo(() => {
    return overlayIndicators
      .filter(ind => indicatorSettings[ind.id]?.visible !== false)
      .map(ind => {
        const data = indicatorDataMap[ind.id]
        if (!data) {
          // Indicator data is not yet available, return null for now
          // The indicator will appear once data is loaded
          return null;
        }

        // Get the first series from the indicator data
        const firstSeries = data.metadata.series_metadata[0]
        if (!firstSeries) return null

        const seriesData = data.data[firstSeries.field]
        if (!seriesData) return null

        // Format data for ChartComponent - convert timestamps to strings
        const timestampStrings = data.timestamps.map(t => String(t))
        const formattedData = formatDataForChart(timestampStrings, seriesData)

        return {
          id: ind.id,
          data: formattedData,
          color: firstSeries.line_color,
          lineWidth: firstSeries.line_width,
        }
      })
      .filter(Boolean) as Array<{ id: string; data: { time: number; value: number }[]; color: string; lineWidth: number }>
  }, [overlayIndicators, indicatorDataMap, indicatorSettings])

  // Main crosshair move handler
  const handleMainCrosshairMove = useCallback((param: any) => {
    // ignore non-pointer / programmatic moves to avoid jitter during scroll
    if (!param?.sourceEvent) return

    const t = param?.time
    if (!t) {
      indicatorChartsRef.current.forEach(({ chart }) => {
        try {
          chart.clearCrosshairPosition?.()
        } catch(e) {}
      })
      setCrosshairCandle(null)
      return
    }

    setCrosshairTime(t)

    // Find the candle at the crosshair time for OHLCDisplay
    const matchedCandle = candles.find(c => {
      const candleTime = Math.floor(new Date(c.timestamp).getTime() / 1000)
      return candleTime === t
    })
    setCrosshairCandle(matchedCandle || null)

    // Sync crosshair to all dynamic indicator panes
    paneIndicators.forEach(ind => {
      const entry = indicatorChartsRef.current.get(ind.id)
      if (!entry) return

      const data = indicatorDataMap[ind.id]
      if (!data) return

      // Find the value at the crosshair time
      const firstSeries = data.metadata.series_metadata[0]
      if (!firstSeries) return

      const seriesData = data.data[firstSeries.field]
      if (!seriesData) return

      // Find the value at the timestamp
      const timestampIndex = data.timestamps.indexOf(t as unknown as number)
      if (timestampIndex === -1) return

      const v = seriesData[timestampIndex]
      if (v !== null && v !== undefined) {
        entry.chart.setCrosshairPosition(v, t, entry.series)
      } else {
        entry.chart.clearCrosshairPosition?.()
      }
    })
  }, [paneIndicators, indicatorDataMap, candles])

  const handleIntervalSelect = useCallback((newInterval: string) => {
    setChartInterval(newInterval.toLowerCase())
  }, [])

  // Ref to avoid circular dependency in handleVisibleTimeRangeChange
  const fetchMoreHistoryRef = useRef<any>(null)

  const fetchMoreHistory = useCallback(async () => {
    if (isLoading || !hasMoreHistory || candles.length === 0) return
    
    const earliestDateStr = candles[0].timestamp
    if (lastFetchedToDateRef.current === earliestDateStr) return
    lastFetchedToDateRef.current = earliestDateStr

    setIsLoading(true)
    try {
        const earliestDate = new Date(earliestDateStr)
        const to = earliestDate.toISOString()
        
        const fromDate = new Date(earliestDate)
        // Set chunk size based on interval: 2 years for daily, 4 years for weekly
        const daysBack = chartInterval === '1d' ? 730 : chartInterval === '1wk' ? 1460 : 365
        fromDate.setDate(fromDate.getDate() - daysBack)
        const from = fromDate.toISOString()
        
        console.log(`Fetching more history for ${symbol}: ${from} to ${to}`)
        const moreCandles = await getCandles(symbol, chartInterval, from, to)

        if (moreCandles.length > 0) {
            setCandles(prev => {
                const combined = [...moreCandles, ...prev]
                const unique = combined.filter((c, index, self) =>
                    index === self.findIndex((t) => t.timestamp === c.timestamp)
                )
                return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            })
            // Note: Indicators are automatically refreshed by useIndicatorData when symbol/interval changes
        } else {
            console.log(`No more history found for ${symbol} before ${to}`)
            setHasMoreHistory(false)
        }
    } catch (e) {
        console.error('Failed to fetch more history', e)
    } finally {
        setIsLoading(false)
    }
  }, [isLoading, hasMoreHistory, candles, symbol, chartInterval])

  // Keep ref updated
  useEffect(() => {
    fetchMoreHistoryRef.current = fetchMoreHistory
  }, [fetchMoreHistory])

  const handleVisibleTimeRangeChange = useCallback((range: IRange<Time> | null) => {
    if (!range) return
    setVisibleRange(range)
    
    if (candles.length > 0 && !isLoading && hasMoreHistory) {
        const earliestLoaded = Math.floor(new Date(candles[0].timestamp).getTime() / 1000)
        // Trigger when within 20% of the currently loaded data's start
        const latestLoaded = Math.floor(new Date(candles[candles.length-1].timestamp).getTime() / 1000)
        const loadedDuration = latestLoaded - earliestLoaded
        const threshold = earliestLoaded + (loadedDuration * 0.2)
        
        if (Number(range.from) <= threshold) {
            fetchMoreHistoryRef.current?.()
        }
    }
  }, [candles, isLoading, hasMoreHistory])

  return (
    <>
      <TooltipProvider>
          <Layout
            alertsBadgeCount={triggeredCount}
            watchlistContent={
                <Watchlist 
                    items={watchlist}
                    onAddClick={() => setIsSearchOpen(true)}
                    onRemove={(symbols) => setWatchlist(prev => prev.filter(item => !symbols.includes(item.symbol)))}
                    onSelect={setSymbol}
                    onReorder={setWatchlist}
                />
            }
            alertsContent={
                <AlertsView
                    alerts={alerts}
                    symbol={symbol}
                    onToggleMute={(id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'muted' ? 'active' : 'muted' } : a))}
                    onDelete={(id) => setAlerts(prev => prev.filter(a => a.id !== id))}
                    onSelect={setSymbol}
                    onTriggerDemo={(id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'triggered' } : a))}
                    onAlertCreated={(newAlert) => setAlerts(prev => [...prev, newAlert])}
                />
            }
        >
            <div ref={mainViewportRef} data-testid="main-viewport" className="flex flex-col h-full w-full p-0 space-y-0">

                <Toolbar
                    symbol={symbol}
                    interval={chartInterval}
                    onIntervalSelect={handleIntervalSelect}
                    onSymbolClick={() => setIsSearchOpen(true)}
                    onIndicatorsClick={() => setIsIndicatorsOpen(true)}
                    onFullscreenToggle={toggleFullscreen}
                    activeLayout={activeLayout}
                    savedLayouts={layouts}
                    onLayoutSelect={setActiveLayout}
                    onLayoutSave={handleLayoutSave}
                    indicatorSettings={indicatorSettings}
                    onToggleIndicatorVisibility={toggleIndicatorVisibility}
                    onToggleSeriesVisibility={toggleSeriesVisibility}
                    onToggleLevelsVisibility={toggleLevelsVisibility}
                />

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="bg-[#131722] px-2 py-1 flex items-center justify-between">
                            <OHLCDisplayWithTime candle={crosshairCandle} interval={chartInterval} />
                        </div>
                        <div style={{ height: mainHeight }} className="shrink-0 bg-slate-900 border-b-0 border-slate-800 relative min-h-0 overflow-hidden w-full">
                            {/* T101: Loading state - spinner while fetching initial data */}
                            {isInitialLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                                        <span className="text-slate-400 text-sm">Loading chart data...</span>
                                    </div>
                                </div>
                            )}
                            {/* T102: Error state - show error message */}
                            {error && !isInitialLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                    <div className="flex flex-col items-center gap-3 text-center px-4">
                                        <div className="text-red-400 text-sm font-medium">{error}</div>
                                        <button
                                            onClick={() => {
                                                setError(null)
                                                // Trigger refetch by changing symbol then changing back
                                                const currentSymbol = symbol
                                                setSymbol('')
                                                setTimeout(() => setSymbol(currentSymbol), 0)
                                            }}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            )}
                            <ChartComponent
                                key={`${symbol}-${chartInterval}`}
                                symbol={symbol}
                                candles={candles}
                                width={dimensions.width}
                                height={mainHeight}
                                onTimeScaleInit={setMainTimeScale}
                                onCrosshairMove={handleMainCrosshairMove}
                                overlays={overlays}
                                onVisibleTimeRangeChange={handleVisibleTimeRangeChange}
                                showVolume={true}
                                showLastPrice={true}
                            />
                        </div>

                        {/* Dynamically render indicator panes */}
                        {paneIndicators.length > 0 && (
                            <div className="flex flex-col gap-0 flex-1 min-h-0 w-full">
                                {paneIndicators.map((ind, index) => {
                                    const data = indicatorDataMap[ind.id]
                                    const isVisible = ind.displaySettings.visible && indicatorSettings[ind.id]?.visible !== false
                                    const isLast = index === paneIndicators.length - 1

                                    if (!isVisible) return null
                                    // Don't filter out indicators that don't have data yet - they might be loading

                                    return (
                                        <div
                                            key={ind.id}
                                            className="flex-1 bg-slate-900 p-1 border border-t-0 border-slate-800 w-full"
                                            style={{ borderRadius: isLast ? '0 0 0.5rem 0.5rem' : '0' }}
                                        >
                                            <IndicatorPane
                                                name={ind.name}
                                                symbol={symbol}
                                                interval={chartInterval}
                                                width={dimensions.width}
                                                height={undefined}
                                                onTimeScaleInit={(ts) => {
                                                    if (ts) {
                                                        indicatorTimeScalesRef.current.set(ind.id, ts)
                                                        if (mainTimeScale) {
                                                            const range = mainTimeScale.getVisibleLogicalRange()
                                                            if (range) ts.setVisibleLogicalRange(range)
                                                        }
                                                    } else {
                                                        indicatorTimeScalesRef.current.delete(ind.id)
                                                    }
                                                }}
                                                onChartInit={(chart, series) => {
                                                    indicatorChartsRef.current.set(ind.id, { chart, series });
                                                }}
                                                candles={candles}
                                                indicatorData={data}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
            </div>
        </Layout>

        <IndicatorDialog
          open={isIndicatorsOpen}
          onOpenChange={setIsIndicatorsOpen}
        />
      </TooltipProvider>
    </>
  )
}

// Main App component - manages symbol state and wraps with IndicatorProvider
function App() {
  const [symbol, setSymbol] = useState('IBM')

  return (
    <IndicatorProvider symbol={symbol}>
      <AppContent symbol={symbol} setSymbol={setSymbol} />
    </IndicatorProvider>
  )
}

export default App