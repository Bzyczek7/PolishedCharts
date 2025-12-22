import { Search, Settings, Maximize2, TrendingUp, BarChart3, Waves, LayoutGrid, Save } from "lucide-react"
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
import { useState } from "react"
import { Input } from "@/components/ui/input"

export interface Layout {
  id: string
  name: string
  activeIndicators: string[]
  indicatorParams: Record<string, any>
}

interface ToolbarProps {
  symbol: string
  onSymbolClick: () => void
  onIndicatorsClick: () => void
  onFullscreenToggle: () => void
  activeLayout: Layout | null
  savedLayouts: Layout[]
  onLayoutSelect: (layout: Layout) => void
  onLayoutSave: (name: string) => void
}

const Toolbar = ({ 
  symbol, 
  onSymbolClick, 
  onIndicatorsClick, 
  onFullscreenToggle,
  activeLayout,
  savedLayouts,
  onLayoutSelect,
  onLayoutSave
}: ToolbarProps) => {
  const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W']
  const [newLayoutName, setNewLayoutName] = useState('')

  return (
    <div 
        data-testid="top-toolbar"
        className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg w-full h-12"
    >
      <div className="flex items-center px-3 mr-2">
        <span className="text-sm font-bold tracking-tighter text-blue-500">TradingAlert</span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Symbol Search Trigger */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onSymbolClick}
        className="font-bold text-slate-200 hover:bg-slate-800 px-3 flex gap-2"
      >
        <Search className="h-4 w-4 text-slate-400" />
        {symbol}
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Timeframe Selector */}
      <div className="flex gap-0.5 overflow-hidden">
        {timeframes.map((tf) => (
          <Button 
            key={tf}
            variant="ghost" 
            size="sm" 
            className="text-xs text-slate-400 hover:text-white hover:bg-slate-800 px-2 h-8"
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

      {/* Indicators Trigger */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onIndicatorsClick}
        className="text-slate-400 hover:text-white hover:bg-slate-800 px-3 h-8"
      >
        Indicators
      </Button>

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
          <div className="p-2 space-y-2">
            <Input 
                placeholder="New layout name" 
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                className="h-8 text-xs bg-slate-950 border-slate-800"
            />
            <Button 
                size="sm" 
                className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                    if (newLayoutName.trim()) {
                        onLayoutSave(newLayoutName)
                        setNewLayoutName('')
                    }
                }}
            >
                <Save className="h-3 w-3 mr-2" /> Save Layout
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

      {/* Utilities */}
      <div className="ml-auto flex gap-1">
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
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
        >
            <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default Toolbar
