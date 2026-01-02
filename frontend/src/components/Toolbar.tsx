import { Search, Settings, Maximize2, TrendingUp, BarChart3, Waves, LayoutGrid, Save, Radio, RefreshCw, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { useSymbolInfo } from "@/hooks/useSymbolInfo"

export type DataMode = 'websocket' | 'polling'

export interface Layout {
  id: string
  name: string
  activeIndicators: string[]
  indicatorParams: Record<string, any>
}

interface ToolbarProps {
  symbol: string
  interval: string
  onIntervalSelect: (interval: string) => void
  onSymbolClick: () => void
  onIndicatorsClick: () => void
  onFullscreenToggle: () => void
  onNotificationSettingsClick?: () => void
  activeLayout: Layout | null
  savedLayouts: Layout[]
  onLayoutSelect: (layout: Layout) => void
  onLayoutSave: (name: string) => void
  onLayoutUpdate: () => void  // NEW: Update existing layout
  indicatorSettings: Record<string, { visible: boolean; series: Record<string, boolean>; showLevels: boolean; showLastValue: boolean }>
  indicators?: any[]
  onToggleIndicatorVisibility: (indicator: string) => void
  onToggleSeriesVisibility: (indicator: string, series: string) => void
  onToggleLevelsVisibility: (indicator: string) => void
  onToggleLastValueVisibility: (indicator: string) => void
  onRemoveIndicator: (indicatorId: string) => void
  dataMode: DataMode
  onDataModeToggle: () => void
  onManualRefresh?: () => void
}

const Toolbar = ({
  symbol,
  interval,
  onIntervalSelect,
  onSymbolClick,
  onIndicatorsClick,
  onFullscreenToggle,
  onNotificationSettingsClick,
  activeLayout,
  savedLayouts,
  onLayoutSelect,
  onLayoutSave,
  onLayoutUpdate,
  indicatorSettings,
  indicators,
  onToggleIndicatorVisibility,
  onToggleSeriesVisibility,
  onToggleLevelsVisibility,
  onToggleLastValueVisibility,
  onRemoveIndicator,
  dataMode,
  onDataModeToggle,
  onManualRefresh
}: ToolbarProps) => {
  const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W']
  const [newLayoutName, setNewLayoutName] = useState('')
  const newLayoutInputRef = useRef<HTMLInputElement>(null)

  // Fetch symbol info (display name, exchange)
  const { data: symbolInfo } = useSymbolInfo(symbol)

  return (
    <div 
        data-testid="top-toolbar"
        className="flex items-center gap-1 bg-slate-900 border border-slate-800 border-b-0 p-1 w-full h-12"
    >
      <div className="flex items-center px-3 mr-2">
        <span className="text-sm font-bold tracking-tighter text-blue-500">TradingAlert</span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Symbol Search Trigger - Displays: Full Name · Timeframe · Exchange */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSymbolClick}
        className="font-bold text-slate-200 hover:bg-slate-800 px-3 flex gap-2"
      >
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="truncate max-w-[600px]">
          {symbolInfo?.display_name || symbol} · {interval}
          {symbolInfo?.exchange ? ` · ${symbolInfo.exchange}` : ''}
        </span>
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Timeframe Selector */}
      <div className="flex gap-0.5 overflow-hidden">
        {timeframes.map((tf) => (
          <Button 
            key={tf}
            variant="ghost" 
            size="sm" 
            onClick={() => onIntervalSelect(tf)}
            className={`text-xs text-slate-400 hover:text-white hover:bg-slate-800 px-2 h-8 ${interval.toLowerCase() === tf.toLowerCase() ? 'bg-slate-700 text-white' : ''}`}
          >
            {tf}
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Chart Style Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            data-testid="chart-style-selector"
          >
            <TrendingUp className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-slate-900 border-slate-800 text-slate-300">
          <DropdownMenuItem className="hover:bg-slate-800" data-testid="chart-style-item-candles">
            <TrendingUp className="mr-2 h-4 w-4" /> Candlesticks
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:bg-slate-800" data-testid="chart-style-item-line">
            <BarChart3 className="mr-2 h-4 w-4" /> Line
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:bg-slate-800" data-testid="chart-style-item-heikin">
            <Waves className="mr-2 h-4 w-4" /> Heikin-Ashi
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Indicators Trigger */}
      <div className="flex gap-0.5">
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={onIndicatorsClick}
            className="text-slate-400 hover:text-white hover:bg-slate-800 px-3 h-8"
        >
            Indicators
        </Button>
        
        {activeLayout && activeLayout.activeIndicators.length > 0 && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-4 text-slate-500 hover:text-white p-0">
                        <Settings className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 bg-slate-900 border-slate-800 text-slate-300">
                    <DropdownMenuLabel className="text-slate-500 text-xs">Indicator Visibility</DropdownMenuLabel>
                    {indicators?.filter(ind => activeLayout?.activeIndicators.includes(ind.indicatorType.name.toLowerCase())).map(ind => {
                        const id = ind.indicatorType.name.toLowerCase();
                        return (
                            <div key={ind.id} className="p-2 space-y-1 border-b border-slate-800 last:border-0">
                                <div className="flex items-center justify-between text-sm px-2 font-bold text-blue-400">
                                    <span className="capitalize">{id}</span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={() => onToggleIndicatorVisibility(ind.id)}
                                        >
                                            {indicatorSettings[ind.id]?.visible !== false ? "Hide All" : "Show All"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                                            onClick={() => onRemoveIndicator(ind.id)}
                                            title="Remove indicator"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-3 w-3"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </Button>
                                    </div>
                                </div>

                                <div className="ml-2 space-y-1">
                                    {/* Horizontal Thresholds Toggle */}
                                    <div className="flex items-center justify-between text-xs px-2 text-slate-400">
                                        <span>Threshold Levels</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-[10px] p-0"
                                            onClick={() => onToggleLevelsVisibility(ind.id)}
                                        >
                                            {indicatorSettings[ind.id]?.showLevels !== false ? "Hide" : "Show"}
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between text-xs px-2 text-slate-400">
                                        <span>Last Value on Scale</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-[10px] p-0"
                                            onClick={() => onToggleLastValueVisibility(ind.id)}
                                        >
                                            {indicatorSettings[ind.id]?.showLastValue ? "Hide" : "Show"}
                                        </Button>
                                    </div>

                                    {id === 'crsi' && (
                                        <>
                                            <div className="flex items-center justify-between text-xs px-2 text-slate-400">
                                                <span>RSI Line</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 text-[10px] p-0"
                                                    onClick={() => onToggleSeriesVisibility(ind.id, 'crsi')}
                                                >
                                                    {indicatorSettings[ind.id]?.series?.['crsi'] !== false ? "Hide" : "Show"}
                                                </Button>
                                            </div>
                                            <div className="flex items-center justify-between text-xs px-2 text-slate-400">
                                                <span>Bands</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 text-[10px] p-0"
                                                    onClick={() => {
                                                        onToggleSeriesVisibility(ind.id, 'upper_band');
                                                        onToggleSeriesVisibility(ind.id, 'lower_band');
                                                    }}
                                                >
                                                    {indicatorSettings[ind.id]?.series?.['upper_band'] !== false ? "Hide" : "Show"}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Layouts Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-slate-800 px-3 h-8 flex gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            {activeLayout?.name || 'Layouts'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-slate-900 border-slate-800 text-slate-300">

          {/* Save Section */}
          <DropdownMenuLabel className="text-slate-500">Save</DropdownMenuLabel>
          {activeLayout?.id && activeLayout.id !== 'default' ? (
            <DropdownMenuItem
              onClick={onLayoutUpdate}
              className="hover:bg-slate-800 cursor-pointer"
            >
              <Save className="h-3 w-3 mr-2" />
              Save
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="text-slate-600 italic text-xs">
              Save (select a layout first)
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="bg-slate-800" />

          {/* Manage Section */}
          <DropdownMenuLabel className="text-slate-500">Manage</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => newLayoutInputRef.current?.focus()}
            className="hover:bg-slate-800 cursor-pointer"
          >
            <Save className="h-3 w-3 mr-2" />
            Save as new...
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-slate-800" />

          {/* Saved Layouts List */}
          <DropdownMenuLabel className="text-slate-500">Saved Layouts</DropdownMenuLabel>
          {savedLayouts.map(layout => (
            <DropdownMenuItem
              key={layout.id}
              onClick={() => onLayoutSelect(layout)}
              className={`hover:bg-slate-800 cursor-pointer ${activeLayout?.id === layout.id ? 'text-blue-400' : ''}`}
            >
              {layout.name}
            </DropdownMenuItem>
          ))}
          {savedLayouts.length === 0 && (
            <DropdownMenuItem disabled className="text-slate-600 italic">No saved layouts</DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="bg-slate-800" />

          {/* Create New Section */}
          <div className="p-2 space-y-2">
            <Input
              ref={newLayoutInputRef}
              placeholder="New layout name"
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              className="h-8 text-xs bg-slate-950 border-slate-800"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLayoutName.trim()) {
                  onLayoutSave(newLayoutName.trim())
                  setNewLayoutName('')
                }
              }}
            />
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (newLayoutName.trim()) {
                  onLayoutSave(newLayoutName.trim())
                  setNewLayoutName('')
                }
              }}
            >
              <Save className="h-3 w-3 mr-2" />
              Save as new
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Utilities */}
      <div className="ml-auto flex gap-1">
        {/* Data Mode Toggle */}
        <Button
            variant="ghost"
            size="sm"
            onClick={onDataModeToggle}
            className={`h-8 px-2 text-xs ${dataMode === 'polling' ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title={`Current: ${dataMode === 'websocket' ? 'WebSocket (real-time)' : 'Polling (periodic refresh)'}`}
        >
            <Radio className="h-3 w-3 mr-1" />
            {dataMode === 'websocket' ? 'WS' : 'Poll'}
        </Button>
        {/* Manual Refresh Button - only show in polling mode */}
        {dataMode === 'polling' && onManualRefresh && (
            <Button
                variant="ghost"
                size="icon"
                onClick={onManualRefresh}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                title="Refresh candle data"
            >
                <RefreshCw className="h-4 w-4" />
            </Button>
        )}
        <Button
            variant="ghost"
            size="icon"
            onClick={onFullscreenToggle}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
        >
            <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon"
            onClick={onNotificationSettingsClick}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Notification Settings"
        >
            <Bell className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default Toolbar
