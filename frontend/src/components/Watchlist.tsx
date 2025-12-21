import React, { useState, useEffect, useRef } from "react"
import { Plus, Trash2, GripVertical, Search, Bell, Check } from "lucide-react"
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
  DragEndEvent
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

interface WatchlistItemData {
  symbol: string
  price: number
  change: number
  changePercent: number
}

interface WatchlistProps {
  items: WatchlistItemData[]
  onAddClick: () => void
  onRemove: (symbols: string[]) => void
  onSelect: (symbol: string) => void
  onReorder: (items: WatchlistItemData[]) => void
}

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
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1
  }

  useEffect(() => {
    if (item.price > prevPriceRef.current) {
      setFlash("up")
      const timer = setTimeout(() => setFlash(null), 1000)
      return () => clearTimeout(timer)
    } else if (item.price < prevPriceRef.current) {
      setFlash("down")
      const timer = setTimeout(() => setFlash(null), 1000)
      return () => clearTimeout(timer)
    }
    prevPriceRef.current = item.price
  }, [item.price])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow 
            ref={setNodeRef}
            style={style}
            className={cn(
                "border-slate-800 hover:bg-slate-800/50 cursor-pointer group transition-colors duration-500",
                isDragging && "bg-slate-800/80",
                isSelected && "bg-blue-500/10 hover:bg-blue-500/20"
            )}
            onClick={() => selectionMode ? onSelectChange(item.symbol, !isSelected) : onSelect(item.symbol)}
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
            {item.symbol}
          </TableCell>
          <TableCell 
            className={cn(
                "text-right text-slate-300 transition-colors duration-300",
                flash === "up" && "bg-emerald-500/20 text-emerald-400",
                flash === "down" && "bg-rose-500/20 text-rose-400"
            )}
          >
            {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </TableCell>
          <TableCell className="text-right">
            <span className={item.change >= 0 ? "text-emerald-500" : "text-rose-500"}>
              {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
            </span>
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

const Watchlist = ({ items, onAddClick, onRemove, onSelect, onReorder }: WatchlistProps) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
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
      onReorder(arrayMove(items, oldIndex, newIndex))
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

  return (
    <div className="flex flex-col h-full" data-testid="watchlist-container">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Watchlist
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
        <div className="overflow-auto px-1">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader className="hover:bg-transparent">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className={cn("w-8", selectionMode && "w-16")}></TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Symbol</TableHead>
                  <TableHead className="text-right text-xs font-medium text-slate-500">Last</TableHead>
                  <TableHead className="text-right text-xs font-medium text-slate-500">Chg%</TableHead>
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
