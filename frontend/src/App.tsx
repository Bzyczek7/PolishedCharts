import { useState, useEffect } from 'react'
import './App.css'
import ChartComponent from './components/ChartComponent'
import AlertForm from './components/AlertForm'
import LayoutManager, { Layout } from './components/LayoutManager'
import IndicatorPane from './components/IndicatorPane'
import { loadLayouts, saveLayouts } from './services/layoutService'
import { getTDFI, getcRSI, getADXVMA, TDFIOutput, cRSIOutput, ADXVMAOutput } from './api/indicators'

function App() {
  const [symbol] = useState('IBM')
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [activeLayout, setActiveLayout] = useState<Layout | null>(null)
  
  const [tdfiData, setTdfiData] = useState<TDFIOutput | null>(null)
  const [crsiData, setCrsiData] = useState<cRSIOutput | null>(null)
  const [adxvmaData, setAdxvmaData] = useState<ADXVMAOutput | null>(null)

  useEffect(() => {
    const saved = loadLayouts()
    setLayouts(saved)
    if (saved.length > 0) {
        setActiveLayout(saved[0])
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [tdfi, crsi, adxvma] = await Promise.all([
                getTDFI(symbol),
                getcRSI(symbol),
                getADXVMA(symbol)
            ])
            setTdfiData(tdfi)
            setCrsiData(crsi)
            setAdxvmaData(adxvma)
        } catch (e) {
            console.error('Failed to fetch indicator data', e)
        }
    }
    fetchData()
  }, [symbol])

  const handleLayoutSave = (name: string) => {
    const newLayout: Layout = {
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
    if (!activeLayout) return
    const active = activeLayout.activeIndicators.includes(indicator)
    const updated: Layout = {
        ...activeLayout,
        activeIndicators: active 
            ? activeLayout.activeIndicators.filter(i => i !== indicator)
            : [...activeLayout.activeIndicators, indicator]
    }
    setActiveLayout(updated)
    const updatedLayouts = layouts.map(l => l.id === updated.id ? updated : l)
    setLayouts(updatedLayouts)
    saveLayouts(updatedLayouts)
  }

  const formatDataForChart = (values: (number | null)[]) => {
    // This is a simplification, ideally we need timestamps matched with candles
    // For now, let's assume indices match if the backend returns same length
    return values.map((v, i) => ({
        time: new Date(Date.now() - (values.length - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: v ?? 0
    }))
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">TradingAlert</h1>
            <p className="text-slate-400">Your personalized trading dashboard</p>
        </div>
        <div className="flex gap-4">
            {['tdfi', 'crsi', 'adxvma'].map(indicator => (
                <button
                    key={indicator}
                    onClick={() => toggleIndicator(indicator)}
                    className={`px-3 py-1 rounded text-sm font-medium transition ${
                        activeLayout?.activeIndicators.includes(indicator)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                >
                    {indicator.toUpperCase()}
                </button>
            ))}
        </div>
      </header>
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800 rounded-lg p-6 h-[500px] border border-slate-700">
            <ChartComponent 
                symbol={symbol} 
                overlays={activeLayout?.activeIndicators.includes('adxvma') && adxvmaData ? [
                    { data: formatDataForChart(adxvmaData.adxvma), color: adxvmaData.metadata.color_schemes.line }
                ] : []}
            />
          </div>
          
          {activeLayout?.activeIndicators.includes('tdfi') && tdfiData && (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <IndicatorPane 
                    name="TDFI" 
                    data={formatDataForChart(tdfiData.tdfi)}
                    displayType="line"
                    color={tdfiData.metadata.color_schemes.line}
                    scaleRanges={tdfiData.metadata.scale_ranges}
                  />
              </div>
          )}

          {activeLayout?.activeIndicators.includes('crsi') && crsiData && (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <IndicatorPane 
                    name="cRSI" 
                    data={formatDataForChart(crsiData.crsi)}
                    displayType="line"
                    color={crsiData.metadata.color_schemes.line}
                    scaleRanges={crsiData.metadata.scale_ranges}
                  />
              </div>
          )}
        </div>
        <div className="space-y-8">
          <LayoutManager 
            activeLayout={activeLayout}
            onLayoutSelect={setActiveLayout}
            onLayoutSave={handleLayoutSave}
            savedLayouts={layouts}
          />
          <AlertForm symbolId={1} />
        </div>
      </main>
    </div>
  )
}

export default App