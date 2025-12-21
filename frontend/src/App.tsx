import { useState, useEffect } from 'react'
import './App.css'
import Layout from './components/Layout'
import Toolbar from './components/Toolbar'
import SymbolSearch from './components/SymbolSearch'
import IndicatorSearch from './components/IndicatorSearch'
import Watchlist from './components/Watchlist'
import ChartComponent from './components/ChartComponent'
import AlertForm from './components/AlertForm'
import LayoutManager from './components/LayoutManager'
import type { Layout as LayoutType } from './components/LayoutManager'
import IndicatorPane from './components/IndicatorPane'
import { Button } from './components/ui/button'
import { loadLayouts, saveLayouts } from './services/layoutService'
import { getCandles } from './api/candles'
import type { Candle } from './api/candles'
import { getTDFI, getcRSI, getADXVMA } from './api/indicators'
import type { TDFIOutput, cRSIOutput, ADXVMAOutput } from './api/indicators'

function App() {
  const [symbol, setSymbol] = useState('IBM')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false)
  const [watchlist, setWatchlist] = useState([
    { symbol: 'IBM', price: 145.20, change: 1.50, changePercent: 1.04 }
  ])
  const [layouts, setLayouts] = useState<LayoutType[]>([])
  const [activeLayout, setActiveLayout] = useState<LayoutType | null>(null)
  
  const [candles, setCandles] = useState<Candle[]>([])
  const [tdfiData, setTdfiData] = useState<TDFIOutput | null>(null)
  const [crsiData, setCrsiData] = useState<cRSIOutput | null>(null)
  const [adxvmaData, setAdxvmaData] = useState<ADXVMAOutput | null>(null)

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
                getCandles(symbol).catch(err => {
                    console.warn(`Failed to fetch candles for ${symbol}:`, err.message);
                    return [];
                }),
                getTDFI(symbol).catch(err => {
                    console.warn(`Failed to fetch TDFI for ${symbol}:`, err.message);
                    return null;
                }),
                getcRSI(symbol).catch(err => {
                    console.warn(`Failed to fetch cRSI for ${symbol}:`, err.message);
                    return null;
                }),
                getADXVMA(symbol).catch(err => {
                    console.warn(`Failed to fetch ADXVMA for ${symbol}:`, err.message);
                    return null;
                })
            ])
            setCandles(candleData)
            setTdfiData(tdfi)
            setCrsiData(crsi)
            setAdxvmaData(adxvma)
        } catch (e) {
            console.error('Unexpected error in fetchData', e)
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

  const formatDataForChart = (timestamps: string[], values: (number | null)[]) => {
    const formatted = values.map((v, i) => ({
        time: Math.floor(new Date(timestamps[i]).getTime() / 1000) as any,
        value: v ?? 0
    }))
    
    const sorted = formatted.sort((a, b) => a.time - b.time)
    return sorted.filter((item, index, arr) => 
        index === 0 || item.time !== arr[index - 1].time
    )
  }

  return (
    <Layout
        watchlistContent={
            <Watchlist 
                items={watchlist}
                onAddClick={() => setIsSearchOpen(true)}
                onRemove={(s) => setWatchlist(prev => prev.filter(item => item.symbol !== s))}
                onSelect={setSymbol}
            />
        }
        alertsContent={
            <div className="space-y-8">
                <LayoutManager 
                    activeLayout={activeLayout}
                    onLayoutSelect={setActiveLayout}
                    onLayoutSave={handleLayoutSave}
                    savedLayouts={layouts}
                />
                <AlertForm symbolId={1} />
            </div>
        }
    >
      <div className="flex flex-col h-full w-full p-4 space-y-4">
        <Toolbar 
            symbol={symbol}
            onSymbolClick={() => setIsSearchOpen(true)}
            onIndicatorsClick={() => setIsIndicatorsOpen(true)}
            onFullscreenToggle={() => console.log('Fullscreen')}
        />

        <SymbolSearch 
            open={isSearchOpen} 
            onOpenChange={setIsSearchOpen} 
            onSelect={setSymbol} 
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
                overlays={activeLayout?.activeIndicators.includes('adxvma') && adxvmaData ? [
                    { data: formatDataForChart(adxvmaData.timestamps, adxvmaData.adxvma), color: adxvmaData.metadata.color_schemes.line }
                ] : []}
            />
          </div>
          
          <div className="flex flex-col gap-4 overflow-auto pb-4 max-h-[40%] shrink-0">
            {activeLayout?.activeIndicators.includes('tdfi') && tdfiData && (
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                    <IndicatorPane 
                        name="TDFI" 
                        data={formatDataForChart(tdfiData.timestamps, tdfiData.tdfi)}
                        displayType="line"
                        color={tdfiData.metadata.color_schemes.line}
                        scaleRanges={tdfiData.metadata.scale_ranges}
                    />
                </div>
            )}

            {activeLayout?.activeIndicators.includes('crsi') && crsiData && (
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                    <IndicatorPane 
                        name="cRSI" 
                        data={formatDataForChart(crsiData.timestamps, crsiData.crsi)}
                        displayType="line"
                        color={crsiData.metadata.color_schemes.line}
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
