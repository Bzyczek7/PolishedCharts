import { useState, useEffect } from 'react'
import './App.css'
import Layout from './components/Layout'
import Toolbar from './components/Toolbar'
import SymbolSearch from './components/SymbolSearch'
import IndicatorSearch from './components/IndicatorSearch'
import Watchlist from './components/Watchlist'
import AlertsList from './components/AlertsList'
import type { Alert } from './components/AlertsList'
import AlertsView from './components/AlertsView'
import ChartComponent from './components/ChartComponent'
import type { Layout as LayoutType } from './components/Toolbar'
import IndicatorPane from './components/IndicatorPane'
import { loadLayouts, saveLayouts, loadWatchlist, saveWatchlist, loadAlerts, saveAlerts } from './services/layoutService'
import { getCandles } from './api/candles'
import type { Candle } from './api/candles'
import { getTDFI, getcRSI, getADXVMA } from './api/indicators'
import type { TDFIOutput, cRSIOutput, ADXVMAOutput } from './api/indicators'

function App() {
  const [symbol, setSymbol] = useState('IBM')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false)
  const [watchlist, setWatchlist] = useState(() => {
    const symbols = loadWatchlist()
    return symbols.map(s => {
        // Deterministic-ish random values based on symbol string for initial load
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

  const handleSymbolSelect = (newSymbol: string) => {
    setSymbol(newSymbol)
    setWatchlist(prev => {
        if (prev.some(item => item.symbol === newSymbol)) return prev
        // Add new mock item for the watchlist
        return [...prev, {
            symbol: newSymbol,
            price: 150.00 + (Math.random() * 50),
            change: (Math.random() * 4) - 2,
            changePercent: (Math.random() * 2) - 1
        }]
    })
  }
  
  const [candles, setCandles] = useState<Candle[]>([])
  const [tdfiData, setTdfiData] = useState<TDFIOutput | null>(null)
  const [crsiData, setCrsiData] = useState<cRSIOutput | null>(null)
  const [adxvmaData, setAdxvmaData] = useState<ADXVMAOutput | null>(null)

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
                getCandles(symbol).catch(() => []),
                getTDFI(symbol).catch(() => null),
                getcRSI(symbol).catch(() => null),
                getADXVMA(symbol).catch(() => null)
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
  }, [symbol])

  const handleLayoutSave = (name: string) => {
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
  }

  const toggleIndicator = (indicator: string) => {
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
            ? currentLayout.activeIndicators.filter(i => i !== indicator)
            : [...currentLayout.activeIndicators, indicator]
    }
    
    setActiveLayout(updated)
    
    if (updated.id !== 'default') {
        const updatedLayouts = layouts.map(l => l.id === updated.id ? updated : l)
        setLayouts(updatedLayouts)
        saveLayouts(updatedLayouts)
    }
  }

  const formatDataForChart = (timestamps: string[] | undefined, values: (number | null)[] | undefined) => {
    if (!timestamps || !values || timestamps.length === 0) return []
    
    const formatted = values.map((v, i) => {
        if (v === null || v === undefined) return null;
        const ts = timestamps[i];
        if (!ts) return null;
        const time = Math.floor(new Date(ts).getTime() / 1000);
        if (isNaN(time)) return null;
        return {
            time: time as any,
            value: v
        };
    }).filter((item): item is { time: any; value: number } => item !== null);
    
    const sorted = formatted.sort((a, b) => a.time - b.time)
    return sorted.filter((item, index, arr) => 
        index === 0 || item.time !== arr[index - 1].time
    )
  }

  const triggeredCount = alerts.filter(a => a.status === 'triggered').length

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  }

  return (
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
      <div className="flex flex-col h-full w-full p-4 space-y-4">
        <Toolbar 
            symbol={symbol}
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

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          <div className="flex-1 bg-slate-900 rounded-lg border border-slate-800 relative min-h-0">
            <ChartComponent 
                symbol={symbol} 
                candles={candles}
                overlays={activeLayout?.activeIndicators?.includes('adxvma') && adxvmaData ? [
                    { data: formatDataForChart(adxvmaData.timestamps, adxvmaData.adxvma), color: adxvmaData.metadata.color_schemes.line }
                ] : []}
            />
          </div>
          
          <div className="flex flex-col gap-4 overflow-auto pb-4 max-h-[40%] shrink-0">
            {activeLayout?.activeIndicators?.includes('tdfi') && tdfiData && (
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                    <IndicatorPane 
                        name="TDFI" 
                        mainSeries={{
                            data: formatDataForChart(tdfiData.timestamps, tdfiData.tdfi),
                            displayType: "histogram",
                            color: tdfiData.metadata.color_schemes.line
                        }}
                        additionalSeries={[
                            {
                                data: formatDataForChart(tdfiData.timestamps, tdfiData.tdfi_signal),
                                displayType: "line",
                                color: "#f1f5f9", // Neutral signal color
                                lineWidth: 1
                            }
                        ]}
                        priceLines={[
                            { value: 0.05, color: "#ef4444", label: "Upper" },
                            { value: -0.05, color: "#22c55e", label: "Lower" }
                        ]}
                        scaleRanges={tdfiData.metadata.scale_ranges}
                    />
                </div>
            )}

            {activeLayout?.activeIndicators?.includes('crsi') && crsiData && (
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                    <IndicatorPane 
                        name="cRSI" 
                        mainSeries={{
                            data: formatDataForChart(crsiData.timestamps, crsiData.crsi),
                            displayType: "line",
                            color: crsiData.metadata.color_schemes.line
                        }}
                        additionalSeries={[
                            {
                                data: formatDataForChart(crsiData.timestamps, crsiData.upper_band),
                                displayType: "line",
                                color: "#ef4444",
                                lineWidth: 1
                            },
                            {
                                data: formatDataForChart(crsiData.timestamps, crsiData.lower_band),
                                displayType: "line",
                                color: "#22c55e",
                                lineWidth: 1
                            }
                        ]}
                        priceLines={[
                            { value: 70, color: "#475569", label: "70" },
                            { value: 30, color: "#475569", label: "30" }
                        ]}
                        scaleRanges={crsiData.metadata.scale_ranges}
                    />
                </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default App