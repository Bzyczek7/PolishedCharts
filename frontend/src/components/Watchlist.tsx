import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, GripVertical, Search, Bell, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WatchlistItemData {
  symbol: string
  price?: number
  change?: number
  changePercent?: number
  error?: string
}

// Mock details lookup
const getSymbolDetails = (symbol: string) => {
    const details: Record<string, { name: string, high: number, low: number, volume: string }> = {
        'IBM': { name: 'International Business Machines', high: 146.50, low: 144.20, volume: '3.2M' },
        'AAPL': { name: 'Apple Inc.', high: 182.10, low: 178.50, volume: '52.4M' },
        'MSFT': { name: 'Microsoft Corporation', high: 340.20, low: 335.80, volume: '21.1M' },
        'GOOGL': { name: 'Alphabet Inc.', high: 135.40, low: 132.10, volume: '18.5M' },
        'TSLA': { name: 'Tesla, Inc.', high: 250.30, low: 242.10, volume: '110.2M' },
    }
    return details[symbol] || { name: symbol, high: 0, low: 0, volume: '0' }
}

interface WatchlistProps {
  items: WatchlistItemData[]
  onAddClick: () => void
  onRemove: (symbols: string[]) => void
  onSelect: (symbol: string) => void
  onReorder: (items: WatchlistItemData[]) => void
  isRefreshing?: boolean
  lastUpdate?: Date | null
}

type SortField = 'symbol' | 'price' | 'changePercent'
type SortOrder = 'asc' | 'desc' | null

const WatchlistItem = ({ 
    item, 
    onSelect, 
    onRemove, 
    isSelected, 
    onSelectChange,
    selectionMode 
}: { 
    item: WatchlistItemData, 
    onSelect: (s: string) => void, 
    onRemove: (s: string) => void,
    isSelected: boolean,
    onSelectChange: (symbol: string, checked: boolean) => void,
    selectionMode: boolean
}) => {
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const prevPriceRef = useRef(item.price)
  const details = getSymbolDetails(item.symbol)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.symbol })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1
  }

  useEffect(() => {
    if (item.price !== undefined && item.price !== prevPriceRef.current) {
      if (prevPriceRef.current !== undefined && item.price > prevPriceRef.current) {
        setFlash("up")
        const timer = setTimeout(() => setFlash(null), 1000)
        return () => clearTimeout(timer)
      } else if (prevPriceRef.current !== undefined && item.price < prevPriceRef.current) {
        setFlash("down")
        const timer = setTimeout(() => setFlash(null), 1000)
        return () => clearTimeout(timer)
      }
      prevPriceRef.current = item.price
    }
  }, [item.price])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow 
            ref={setNodeRef}
            style={style}
            tabIndex={0}
            className={cn(
                "border-slate-800 hover:bg-slate-800/50 cursor-pointer group transition-colors duration-500 focus:outline-none focus:bg-slate-800/70",
                isDragging && "bg-slate-800/80",
                isSelected && "bg-blue-500/10 hover:bg-blue-500/20"
            )}
            onClick={() => selectionMode ? onSelectChange(item.symbol, !isSelected) : onSelect(item.symbol)}
            onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    onRemove(item.symbol)
                }
                if (e.key === 'Enter' && !selectionMode) {
                    onSelect(item.symbol)
                }
            }}
        >
          <TableCell className="w-8 p-0 pl-2">
            <div className="flex items-center gap-2">
                <div 
                    {...attributes} 
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 text-slate-600 hover:text-slate-400"
                >
                    <GripVertical className="h-4 w-4" />
                </div>
                {selectionMode && (
                    <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={(checked) => onSelectChange(item.symbol, !!checked)}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>
          </TableCell>
          <TableCell className="font-bold text-slate-200 py-3">
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <span>{item.symbol}</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-slate-900 border-slate-800 p-3 w-64 shadow-xl">
                        <div className="space-y-2">
                            <div className="border-b border-slate-800 pb-1">
                                <p className="text-sm font-bold text-white">{details.name}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{item.symbol} • NYSE</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Day High</p>
                                    <p className="text-xs text-slate-300">${details.high.toFixed(2)}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Day Low</p>
                                    <p className="text-xs text-slate-300">${details.low.toFixed(2)}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Volume</p>
                                    <p className="text-xs text-slate-300">{details.volume}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Price Chg</p>
                                    <p className={cn("text-xs font-medium", (item.change ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {item.change !== undefined ? (item.change >= 0 ? "+" : "") + item.change.toFixed(2) : "--"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
          </TableCell>
          <TableCell
            className={cn(
                "text-right text-slate-300 transition-colors duration-300",
                flash === "up" && "bg-emerald-500/20 text-emerald-400",
                flash === "down" && "bg-rose-500/20 text-rose-400"
            )}
          >
            {item.error ? (
              <span className="text-slate-600 text-xs">{item.error}</span>
            ) : item.price !== undefined ? (
              item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ) : (
              <span className="text-slate-600 text-xs">--</span>
            )}
          </TableCell>
          <TableCell className="text-right">
            {item.error ? (
              <span className="text-slate-600 text-xs">--</span>
            ) : item.changePercent !== undefined ? (
              <span className={(item.change ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}>
                {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
              </span>
            ) : (
              <span className="text-slate-600 text-xs">--</span>
            )}
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-slate-900 border-slate-800 text-slate-300">
        <ContextMenuItem className="hover:bg-slate-800 cursor-pointer">
          <Bell className="mr-2 h-4 w-4" /> Set Alert
        </ContextMenuItem>
        <ContextMenuItem 
            className="hover:bg-slate-800 cursor-pointer text-rose-500 focus:text-rose-400"
            onClick={(e) => {
                e.stopPropagation();
                onRemove(item.symbol);
            }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

const Watchlist = ({ items, onAddClick, onRemove, onSelect, onReorder, isRefreshing, lastUpdate }: WatchlistProps) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }),
    useSensor(TouchSensor, {
        activationConstraint: {
            delay: 250,
            tolerance: 5,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.symbol === active.id)
      const newIndex = items.findIndex((i) => i.symbol === over.id)
      if (onReorder) {
        onReorder(arrayMove(items, oldIndex, newIndex))
      }
      setSortField(null)
      setSortOrder(null)
    }
  }

  const handleSelectChange = (symbol: string, checked: boolean) => {
    if (checked) {
        setSelectedSymbols(prev => [...prev, symbol])
    } else {
        setSelectedSymbols(prev => prev.filter(s => s !== symbol))
    }
  }

  const toggleSelectionMode = () => {
    if (selectionMode) {
        setSelectedSymbols([])
    }
    setSelectionMode(!selectionMode)
  }

  const handleBulkRemove = () => {
    onRemove(selectedSymbols)
    setSelectedSymbols([])
    setSelectionMode(false)
  }

  const toggleSort = (field: SortField) => {
    let newOrder: SortOrder = 'asc'
    if (sortField === field) {
        if (sortOrder === 'asc') newOrder = 'desc'
        else if (sortOrder === 'desc') newOrder = null
    }

    setSortField(newOrder ? field : null)
    setSortOrder(newOrder)

    if (newOrder) {
        const sorted = [...items].sort((a, b) => {
            const valA = a[field] ?? 0
            const valB = b[field] ?? 0
            if (valA < valB) return newOrder === 'asc' ? -1 : 1
            if (valA > valB) return newOrder === 'asc' ? 1 : -1
            return 0
        })
        onReorder(sorted)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50" />
    if (sortOrder === 'asc') return <ChevronUp className="ml-1 h-3 w-3 text-blue-400" />
    if (sortOrder === 'desc') return <ChevronDown className="ml-1 h-3 w-3 text-blue-400" />
    return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" data-testid="watchlist-container">
      <div className="flex items-center justify-between mb-4 px-1 shrink-0">
        <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Watchlist
            {/* T049: Visual refresh indicator during background updates */}
            {isRefreshing && (
                <span className="ml-2 flex items-center gap-1 text-xs text-slate-600">
                    <div className="animate-spin rounded-full h-2 w-2 border border-slate-500 border-t-transparent"></div>
                    Updating...
                </span>
            )}
            </h2>
            {items.length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-6 px-2 text-[10px] uppercase font-bold",
                        selectionMode ? "text-blue-400 bg-blue-500/10" : "text-slate-600 hover:text-slate-400"
                    )}
                    onClick={toggleSelectionMode}
                >
                    {selectionMode ? "Cancel" : "Edit"}
                </Button>
            )}
        </div>

        <div className="flex items-center gap-2">
            {/* T050: Last update timestamp display */}
            {lastUpdate && !isRefreshing && items.length > 0 && (
                <span className="text-[10px] text-slate-600">
                    {lastUpdate.toLocaleTimeString()}
                </span>
            )}
        {selectionMode ? (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                onClick={handleBulkRemove}
                disabled={selectedSymbols.length === 0}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        ) : (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={onAddClick}
                aria-label="Add Symbol"
            >
                <Plus className="h-4 w-4" />
            </Button>
        )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-slate-800 rounded-lg p-8 text-center space-y-4 mx-1">
          <div className="bg-slate-900 p-3 rounded-full">
            <Search className="h-6 w-6 text-slate-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-300">Add your first symbol</p>
            <p className="text-xs text-slate-500">Track your favorite stocks and crypto</p>
          </div>
          <Button size="sm" onClick={onAddClick} className="mt-2">
            Add Symbol
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-1">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader className="hover:bg-transparent">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className={cn("w-8", selectionMode && "w-16")}></TableHead>
                  <TableHead 
                    className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 group transition-colors"
                    onClick={() => toggleSort('symbol')}
                  >
                    <div className="flex items-center">
                        Symbol <SortIcon field="symbol" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 group transition-colors"
                    onClick={() => toggleSort('price')}
                  >
                    <div className="flex items-center justify-end">
                        Last <SortIcon field="price" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 group transition-colors"
                    onClick={() => toggleSort('changePercent')}
                  >
                    <div className="flex items-center justify-end">
                        Chg% <SortIcon field="changePercent" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext 
                  items={items.map(i => i.symbol)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item) => (
                    <WatchlistItem 
                        key={item.symbol} 
                        item={item} 
                        onSelect={onSelect} 
                        onRemove={(s) => onRemove([s])}
                        isSelected={selectedSymbols.includes(item.symbol)}
                        onSelectChange={handleSelectChange}
                        selectionMode={selectionMode}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      )}
    </div>
  )
}

export default Watchlist
