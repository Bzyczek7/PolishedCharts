import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import Layout from './components/Layout'
import Toolbar from './components/Toolbar'
import Watchlist from './components/Watchlist'
import AlertsView from './components/AlertsView'
import ChartComponent from './components/ChartComponent'
import type { Alert } from './components/AlertsList'
import type { Layout as LayoutType } from './components/Toolbar'
import IndicatorPane from './components/IndicatorPane'
import { loadLayouts, saveLayouts, loadWatchlist, saveWatchlist, loadAlerts, saveAlerts } from './services/layoutService'
import { getCandles } from './api/candles'
import type { Candle } from './api/candles'
import { getTDFI, getcRSI, getADXVMA } from './api/indicators'
import type { ADXVMAOutput, cRSIOutput, TDFIOutput } from './api/indicators'
import { TooltipProvider } from '@/components/ui/tooltip'
import { formatDataForChart } from './lib/chartUtils'
import { splitSeriesByThresholds } from './lib/indicatorTransform'
import type { Time, IRange } from 'lightweight-charts'

function App() {
  const [symbol, setSymbol] = useState('IBM')
  const [interval, setInterval] = useState('1d')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false)
  const mainViewportRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [mainTimeScale, setMainTimeScale] = useState<any>(null)
  const indicatorTimeScalesRef = useRef<Map<string, any>>(new Map())

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
  const [tdfiData, setTdfiData] = useState<TDFIOutput | null>(null)
  const [crsiData, setCrsiData] = useState<cRSIOutput | null>(null)
  const [adxvmaData, setAdxvmaData] = useState<ADXVMAOutput | null>(null)
  const [crosshairTime, setCrosshairTime] = useState<number | null>(null)
  const [indicatorSettings, setIndicatorSettings] = useState<Record<string, { visible: boolean; series: Record<string, boolean>; showLevels: boolean }>>({})
  const mainChartRef = useRef<any>(null)
  const indicatorChartsRef = useRef<Map<string, { chart: any; series: any }>>(new Map())

  // Main crosshair move handler
  const handleMainCrosshairMove = useCallback((param: any) => {
    // ignore non-pointer / programmatic moves to avoid jitter during scroll
    if (!param?.sourceEvent) return

    const t = param?.time
    if (!t) {
      indicatorChartsRef.current.forEach(({ chart }) => {
        try {
          if (chart.clearCrosshairPosition) {
            chart.clearCrosshairPosition();
          } else {
            chart.clearCrosshair && chart.clearCrosshair();
          }
        } catch(e) {}
      })
      return
    }

    setCrosshairTime(t)

    // tdfi
    const tdfiEntry = indicatorChartsRef.current.get('tdfi')
    if (tdfiEntry) {
      try {
        if (tdfiEntry.chart.setCrosshairPosition) {
          tdfiEntry.chart.setCrosshairPosition(0, t); // Using 0 as y-value placeholder
        }
      } catch(e) {}
    }

    // crsi
    const crsiEntry = indicatorChartsRef.current.get('crsi')
    if (crsiEntry) {
      try {
        if (crsiEntry.chart.setCrosshairPosition) {
          crsiEntry.chart.setCrosshairPosition(0, t); // Using 0 as y-value placeholder
        }
      } catch(e) {}
    }
  }, [])

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

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
      if (e.key === "i" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsIndicatorsOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])

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
    
    const fetchData = async () => {
        try {
            const to = new Date().toISOString()
            const fromDate = new Date()
            fromDate.setDate(fromDate.getDate() - 30) // 30 days default
            const from = fromDate.toISOString()

            const [candleData, tdfi, crsi, adxvma] = await Promise.all([
                getCandles(symbol, interval, from, to).catch(() => []),
                getTDFI(symbol, interval).catch(() => null),
                getcRSI(symbol, interval).catch(() => null),
                getADXVMA(symbol, interval).catch(() => null)
            ])
            setCandles(candleData)
            setTdfiData(tdfi)
            setCrsiData(crsi)
            setAdxvmaData(adxvma)
        } catch (e) {
            console.error('Failed to fetch data', e)
        }
    }
    fetchData()
  }, [symbol, interval])

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

  const mainHeight = Math.max(dimensions.height * 0.6, 300)
  // Calculate indicator height to use all remaining space
  const remainingHeight = Math.max(dimensions.height - mainHeight, 120)
  const indicatorHeight = Math.max(remainingHeight / Math.max(activeLayout?.activeIndicators.filter((i: string) => ['tdfi', 'crsi'].includes(i)).length || 1, 1), 120)


  const adxvmaOverlay = useMemo(() => {
    if (!activeLayout?.activeIndicators?.includes('adxvma') || !adxvmaData) return []

    if (indicatorSettings['adxvma']?.visible === false) return [];

    // Use formatDataForChart to get properly formatted data points
    const formattedData = formatDataForChart(adxvmaData.timestamps, adxvmaData.adxvma);

    // Create points with trend-based colors
    const coloredData = [];
    for (let i = 0; i < formattedData.length; i++) {
      // Determine trend based on comparison with previous value
      let trend = 'neutral';
      if (i > 0) {
        if (formattedData[i].value > formattedData[i - 1].value) {
          trend = 'up';
        } else if (formattedData[i].value < formattedData[i - 1].value) {
          trend = 'down';
        }
      }

      // Determine color based on trend
      let color;
      switch (trend) {
        case 'up': color = '#00ff00'; break; // Green for up trend
        case 'down': color = '#ef4444'; break; // Red for down trend
        case 'neutral': color = '#eab308'; break; // Yellow for neutral
      }

      coloredData.push({
        time: formattedData[i].time, // Unix timestamp
        value: formattedData[i].value,
        color: color
      });
    }

    return [
      {
        id: 'adxvma',
        data: coloredData,
        color: "#eab308", // Default color
        lineWidth: 3
      }
    ];
  }, [activeLayout?.activeIndicators, adxvmaData, indicatorSettings])

  const tdfiPaneProps = useMemo(() => {
    if (!activeLayout?.activeIndicators?.includes('tdfi') || !tdfiData) return null

    const isVisible = indicatorSettings['tdfi']?.visible !== false;
    const rawData = formatDataForChart(tdfiData.timestamps, tdfiData.tdfi);

    if (tdfiData.metadata.color_mode === 'threshold' && tdfiData.metadata.thresholds) {
        const { above, neutral, below } = splitSeriesByThresholds(rawData, {
            high: tdfiData.metadata.thresholds.high,
            low: tdfiData.metadata.thresholds.low
        });

        // 3-series ONLY - no mainSeries, no extra metadata series
        return {
            visible: isVisible,
            additionalSeries: [
                {
                    id: 'tdfi-neutral',
                    data: neutral,
                    displayType: 'line' as const,
                    color: tdfiData.metadata.color_schemes.neutral || "#64748b",
                    lineWidth: 2,
                    visible: indicatorSettings['tdfi']?.series?.['tdfi'] !== false
                },
                {
                    id: 'tdfi-above',
                    data: above,
                    displayType: 'line' as const,
                    color: tdfiData.metadata.color_schemes.above || "#00ff00",
                    lineWidth: 2,
                    visible: indicatorSettings['tdfi']?.series?.['tdfi'] !== false
                },
                {
                    id: 'tdfi-below',
                    data: below,
                    displayType: 'line' as const,
                    color: tdfiData.metadata.color_schemes.below || "#ff0000",
                    lineWidth: 2,
                    visible: indicatorSettings['tdfi']?.series?.['tdfi'] !== false
                }
            ],
            priceLines: indicatorSettings['tdfi']?.showLevels !== false
                ? tdfiData.metadata.reference_levels?.map(rl => ({
                    value: rl.value,
                    color: rl.line_color,
                    label: rl.line_label
                }))
                : [],
            scaleRanges: tdfiData.metadata.scale_ranges
        }
    }

    // FALLBACK: single series only
    return {
        visible: isVisible,
        mainSeries: {
            data: rawData,
            displayType: tdfiData.metadata.series_metadata?.find(s => s.field === 'tdfi')?.display_type || "histogram" as const,
            color: tdfiData.metadata.series_metadata?.find(s => s.field === 'tdfi')?.line_color || tdfiData.metadata.color_schemes.neutral || "#64748b",
            visible: indicatorSettings['tdfi']?.series?.['tdfi'] !== false
        },
        priceLines: indicatorSettings['tdfi']?.showLevels !== false
            ? tdfiData.metadata.reference_levels?.map(rl => ({
                value: rl.value,
                color: rl.line_color,
                label: rl.line_label
            }))
            : [],
        scaleRanges: tdfiData.metadata.scale_ranges
    }
  }, [activeLayout?.activeIndicators, tdfiData, indicatorSettings])

  const crsiPaneProps = useMemo(() => {
    if (!activeLayout?.activeIndicators?.includes('crsi') || !crsiData) return null

    const isVisible = indicatorSettings['crsi']?.visible !== false;
    const rawData = formatDataForChart(crsiData.timestamps, crsiData.crsi);

    if (crsiData.metadata.color_mode === 'threshold' && crsiData.metadata.thresholds) {
        const { above, neutral, below } = splitSeriesByThresholds(rawData, {
            high: crsiData.metadata.thresholds.high,
            low: crsiData.metadata.thresholds.low
        });

        return {
            visible: isVisible,
            additionalSeries: [
                {
                    id: 'crsi-neutral',
                    data: neutral,
                    displayType: 'line' as const,
                    color: crsiData.metadata.color_schemes.neutral || "#4CAF50",
                    lineWidth: 2,
                    visible: indicatorSettings['crsi']?.series?.['crsi'] !== false
                },
                {
                    id: 'crsi-above',
                    data: above,
                    displayType: 'line' as const,
                    color: crsiData.metadata.color_schemes.above || "#ef4444",
                    lineWidth: 2,
                    visible: indicatorSettings['crsi']?.series?.['crsi'] !== false
                },
                {
                    id: 'crsi-below',
                    data: below,
                    displayType: 'line' as const,
                    color: crsiData.metadata.color_schemes.below || "#22c55e",
                    lineWidth: 2,
                    visible: indicatorSettings['crsi']?.series?.['crsi'] !== false
                }
            ],
            priceLines: indicatorSettings['crsi']?.showLevels !== false
                ? crsiData.metadata.reference_levels?.map(rl => ({
                    value: rl.value,
                    color: rl.line_color,
                    label: rl.line_label
                }))
                : [],
            scaleRanges: crsiData.metadata.scale_ranges
        }
    }

    return {
        visible: isVisible,
        mainSeries: {
            data: rawData,
            displayType: crsiData.metadata.series_metadata?.find(s => s.field === 'crsi')?.display_type || "line" as const,
            color: crsiData.metadata.series_metadata?.find(s => s.field === 'crsi')?.line_color || crsiData.metadata.color_schemes.neutral || "#4CAF50",
            visible: indicatorSettings['crsi']?.series?.['crsi'] !== false
        },
        additionalSeries: crsiData.metadata.series_metadata?.filter(s => s.field !== 'crsi').map(s => ({
            id: s.field,
            data: formatDataForChart(crsiData.timestamps, (crsiData as any)[s.field]),
            displayType: (s.display_type as any) || "line",
            color: s.line_color,
            lineWidth: s.line_width,
            visible: indicatorSettings['crsi']?.series?.[s.field] !== false
        })),
        priceLines: indicatorSettings['crsi']?.showLevels !== false
            ? crsiData.metadata.reference_levels?.map(rl => ({
                value: rl.value,
                color: rl.line_color,
                label: rl.line_label
            }))
            : [],
        scaleRanges: crsiData.metadata.scale_ranges
    }
  }, [activeLayout?.activeIndicators, crsiData, indicatorSettings])

  const handleIntervalSelect = useCallback((newInterval: string) => {
    setInterval(newInterval.toLowerCase())
  }, [])

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
        fromDate.setDate(fromDate.getDate() - 30) 
        const from = fromDate.toISOString()
        
        console.log(`Fetching more history for ${symbol}: ${from} to ${to}`)
        const moreCandles = await getCandles(symbol, interval, from, to)
        
        if (moreCandles.length > 0) {
            setCandles(prev => {
                const combined = [...moreCandles, ...prev]
                const unique = combined.filter((c, index, self) =>
                    index === self.findIndex((t) => t.timestamp === c.timestamp)
                )
                return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            })
        } else {
            console.log(`No more history found for ${symbol} before ${to}`)
            setHasMoreHistory(false)
        }
    } catch (e) {
        console.error('Failed to fetch more history', e)
    } finally {
        setIsLoading(false)
    }
  }, [isLoading, hasMoreHistory, candles, symbol, interval])

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
            fetchMoreHistory()
        }
    }
  }, [candles, isLoading, hasMoreHistory, fetchMoreHistory])

  return (
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
                    interval={interval}
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

                {dimensions.width > 0 && dimensions.height > 0 ? (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div style={{ height: mainHeight }} className="shrink-0 bg-slate-900 border-b-0 border-slate-800 relative min-h-0 overflow-hidden">
                            <ChartComponent
                                key={`${symbol}-${interval}`}
                                symbol={symbol}
                                candles={candles}
                                width={dimensions.width}
                                height={mainHeight}
                                onTimeScaleInit={setMainTimeScale}
                                onCrosshairMove={handleMainCrosshairMove}
                                overlays={adxvmaOverlay}
                                onVisibleTimeRangeChange={handleVisibleTimeRangeChange}
                            />
                        </div>

                        <div className="flex flex-col gap-0 flex-1 min-h-0">
                            {tdfiPaneProps && !crsiPaneProps && (  // Only TDFI active
                                <div className="flex-1 bg-slate-900 rounded-b-lg p-1 border border-t-0 border-slate-800">
                                    <IndicatorPane
                                        name="TDFI"
                                        symbol={symbol}
                                        interval={interval}
                                        width={dimensions.width}
                                        height={undefined} // Let the container determine the height
                                        onTimeScaleInit={(ts) => {
                                            if (ts) {
                                                indicatorTimeScalesRef.current.set('tdfi', ts)
                                                if (mainTimeScale) {
                                                    const range = mainTimeScale.getVisibleLogicalRange()
                                                    if (range) ts.setVisibleLogicalRange(range)
                                                }
                                            } else {
                                                indicatorTimeScalesRef.current.delete('tdfi')
                                            }
                                        }}
                                        onChartInit={(chart, series) => {
                                            indicatorChartsRef.current.set('tdfi', { chart, series });
                                        }}
                                        candles={candles}
                                        {...tdfiPaneProps}
                                    />
                                </div>
                            )}
                            {tdfiPaneProps && crsiPaneProps && (  // Both TDFI and cRSI active - TDFI doesn't have rounded corners
                                <div className="flex-1 bg-slate-900 p-1 border border-t-0 border-slate-800">
                                    <IndicatorPane
                                        name="TDFI"
                                        symbol={symbol}
                                        interval={interval}
                                        width={dimensions.width}
                                        height={undefined} // Let the container determine the height
                                        onTimeScaleInit={(ts) => {
                                            if (ts) {
                                                indicatorTimeScalesRef.current.set('tdfi', ts)
                                                if (mainTimeScale) {
                                                    const range = mainTimeScale.getVisibleLogicalRange()
                                                    if (range) ts.setVisibleLogicalRange(range)
                                                }
                                            } else {
                                                indicatorTimeScalesRef.current.delete('tdfi')
                                            }
                                        }}
                                        onChartInit={(chart, series) => {
                                            indicatorChartsRef.current.set('tdfi', { chart, series });
                                        }}
                                        candles={candles}
                                        {...tdfiPaneProps}
                                    />
                                </div>
                            )}

                            {crsiPaneProps && (
                                <div className="flex-1 bg-slate-900 rounded-b-lg p-1 border border-t-0 border-slate-800">
                                    <IndicatorPane
                                        name="cRSI"
                                        symbol={symbol}
                                        interval={interval}
                                        width={dimensions.width}
                                        height={undefined} // Let the container determine the height
                                        onTimeScaleInit={(ts) => {
                                            if (ts) {
                                                indicatorTimeScalesRef.current.set('crsi', ts)
                                                if (mainTimeScale) {
                                                    const range = mainTimeScale.getVisibleLogicalRange()
                                                    if (range) ts.setVisibleLogicalRange(range)
                                                }
                                            } else {
                                                indicatorTimeScalesRef.current.delete('crsi')
                                            }
                                        }}
                                        onChartInit={(chart, series) => {
                                            indicatorChartsRef.current.set('crsi', { chart, series });
                                        }}
                                        candles={candles}
                                        {...crsiPaneProps}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        Initializing viewport...
                    </div>
                )}
            </div>
        </Layout>
    </TooltipProvider>
  )
}

export default App