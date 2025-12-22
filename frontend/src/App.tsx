import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import Layout from './components/Layout'
import Toolbar from './components/Toolbar'
import SymbolSearch from './components/SymbolSearch'
import IndicatorSearch from './components/IndicatorSearch'
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
  const [tdfiData, setTdfiData] = useState<TDFIOutput | null>(null)
  const [crsiData, setCrsiData] = useState<cRSIOutput | null>(null)
  const [adxvmaData, setAdxvmaData] = useState<ADXVMAOutput | null>(null)

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
    const fetchData = async () => {
        try {
            const [candleData, tdfi, crsi, adxvma] = await Promise.all([
                getCandles(symbol, interval).catch(() => []),
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
  const indicatorHeight = Math.max((dimensions.height - mainHeight - 100) / Math.max(activeLayout?.activeIndicators.filter((i: string) => ['tdfi', 'crsi'].includes(i)).length || 1, 1), 100)

  const adxvmaOverlay = useMemo(() => {
    if (!activeLayout?.activeIndicators?.includes('adxvma') || !adxvmaData) return []
    return [
        { data: formatDataForChart(adxvmaData.timestamps, adxvmaData.adxvma), color: adxvmaData.metadata.color_schemes.line }
    ]
  }, [activeLayout?.activeIndicators, adxvmaData])

  const tdfiPaneProps = useMemo(() => {
    if (!activeLayout?.activeIndicators?.includes('tdfi') || !tdfiData) return null
    
    const rawData = formatDataForChart(tdfiData.timestamps, tdfiData.tdfi);
    
    if (tdfiData.metadata.color_mode === 'threshold' && tdfiData.metadata.thresholds) {
        const { above, neutral, below } = splitSeriesByThresholds(rawData, {
            high: tdfiData.metadata.thresholds.high,
            low: tdfiData.metadata.thresholds.low
        });

        return {
            mainSeries: {
                data: neutral,
                displayType: 'line' as const,
                color: tdfiData.metadata.color_schemes.neutral || "#94a3b8"
            },
            additionalSeries: [
                {
                    data: above,
                    displayType: 'line' as const,
                    color: tdfiData.metadata.color_schemes.above || "#22c55e",
                    lineWidth: 2
                },
                {
                    data: below,
                    displayType: 'line' as const,
                    color: tdfiData.metadata.color_schemes.below || "#ef4444",
                    lineWidth: 2
                },
                ...(tdfiData.metadata.series_metadata?.filter(s => s.field !== 'tdfi').map(s => ({
                    data: formatDataForChart(tdfiData.timestamps, (tdfiData as any)[s.field]),
                    displayType: (s.display_type as any) || "line",
                    color: s.line_color,
                    lineWidth: s.line_width
                })) || [])
            ],
            priceLines: tdfiData.metadata.reference_levels?.map(rl => ({
                value: rl.value,
                color: rl.line_color,
                label: rl.line_label
            })),
            scaleRanges: tdfiData.metadata.scale_ranges
        }
    }

    return {
        mainSeries: {
            data: rawData,
            displayType: tdfiData.metadata.series_metadata?.find(s => s.field === 'tdfi')?.display_type || "histogram" as const,
            color: tdfiData.metadata.series_metadata?.find(s => s.field === 'tdfi')?.line_color || tdfiData.metadata.color_schemes.line
        },
        additionalSeries: tdfiData.metadata.series_metadata?.filter(s => s.field !== 'tdfi').map(s => ({
            data: formatDataForChart(tdfiData.timestamps, (tdfiData as any)[s.field]),
            displayType: (s.display_type as any) || "line",
            color: s.line_color,
            lineWidth: s.line_width
        })),
        priceLines: tdfiData.metadata.reference_levels?.map(rl => ({
            value: rl.value,
            color: rl.line_color,
            label: rl.line_label
        })),
        scaleRanges: tdfiData.metadata.scale_ranges
    }
  }, [activeLayout?.activeIndicators, tdfiData])

  const crsiPaneProps = useMemo(() => {
    if (!activeLayout?.activeIndicators?.includes('crsi') || !crsiData) return null
    
    const rawData = formatDataForChart(crsiData.timestamps, crsiData.crsi);

    if (crsiData.metadata.color_mode === 'threshold' && crsiData.metadata.thresholds) {
        const { above, neutral, below } = splitSeriesByThresholds(rawData, {
            high: crsiData.metadata.thresholds.high,
            low: crsiData.metadata.thresholds.low
        });

        return {
            mainSeries: {
                data: neutral,
                displayType: 'line' as const,
                color: crsiData.metadata.color_schemes.neutral || "#4CAF50"
            },
            additionalSeries: [
                {
                    data: above,
                    displayType: 'line' as const,
                    color: crsiData.metadata.color_schemes.above || "#ef4444",
                    lineWidth: 2
                },
                {
                    data: below,
                    displayType: 'line' as const,
                    color: crsiData.metadata.color_schemes.below || "#22c55e",
                    lineWidth: 2
                },
                ...(crsiData.metadata.series_metadata?.filter(s => s.field !== 'crsi').map(s => ({
                    data: formatDataForChart(crsiData.timestamps, (crsiData as any)[s.field]),
                    displayType: (s.display_type as any) || "line",
                    color: s.line_color,
                    lineWidth: s.line_width
                })) || [])
            ],
            priceLines: crsiData.metadata.reference_levels?.map(rl => ({
                value: rl.value,
                color: rl.line_color,
                label: rl.line_label
            })),
            scaleRanges: crsiData.metadata.scale_ranges
        }
    }

    return {
        mainSeries: {
            data: rawData,
            displayType: crsiData.metadata.series_metadata?.find(s => s.field === 'crsi')?.display_type || "line" as const,
            color: crsiData.metadata.series_metadata?.find(s => s.field === 'crsi')?.line_color || crsiData.metadata.color_schemes.line
        },
        additionalSeries: crsiData.metadata.series_metadata?.filter(s => s.field !== 'crsi').map(s => ({
            data: formatDataForChart(crsiData.timestamps, (crsiData as any)[s.field]),
            displayType: (s.display_type as any) || "line",
            color: s.line_color,
            lineWidth: s.line_width
        })),
        priceLines: crsiData.metadata.reference_levels?.map(rl => ({
            value: rl.value,
            color: rl.line_color,
            label: rl.line_label
        })),
        scaleRanges: crsiData.metadata.scale_ranges
    }
  }, [activeLayout?.activeIndicators, crsiData])

  const handleIntervalSelect = useCallback((newInterval: string) => {
    setInterval(newInterval)
  }, [])

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
            <div ref={mainViewportRef} data-testid="main-viewport" className="flex flex-col h-full w-full p-4 space-y-4">
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
                />

                <SymbolSearch 
                    open={isSearchOpen} 
                    onOpenChange={setIsSearchOpen} 
                    onSelect={handleSymbolSelect} 
                />

                <IndicatorSearch 
                    open={isIndicatorsOpen} 
                    onOpenChange={setIsIndicatorsOpen} 
                    onSelect={toggleIndicator} 
                />

                {dimensions.width > 0 && dimensions.height > 0 ? (
                    <div className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
                        <div style={{ height: mainHeight }} className="shrink-0 bg-slate-900 rounded-lg border border-slate-800 relative min-h-0 overflow-hidden">
                            <ChartComponent 
                                symbol={symbol} 
                                candles={candles}
                                width={dimensions.width}
                                height={mainHeight}
                                onTimeScaleInit={setMainTimeScale}
                                overlays={adxvmaOverlay}
                            />
                        </div>
                        
                        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
                            {tdfiPaneProps && (
                                <div style={{ height: indicatorHeight }} className="shrink-0 bg-slate-900 rounded-lg p-4 border border-slate-800 min-h-0 overflow-hidden">
                                    <IndicatorPane 
                                        name="TDFI" 
                                        width={dimensions.width}
                                        height={indicatorHeight - 40}
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
                                        candles={candles}
                                        {...tdfiPaneProps}
                                    />
                                </div>
                            )}

                            {crsiPaneProps && (
                                <div style={{ height: indicatorHeight }} className="shrink-0 bg-slate-900 rounded-lg p-4 border border-slate-800 min-h-0 overflow-hidden">
                                    <IndicatorPane 
                                        name="cRSI" 
                                        width={dimensions.width}
                                        height={indicatorHeight - 40}
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
