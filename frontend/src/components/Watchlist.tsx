import React from "react"
import { Plus, Trash2, GripVertical, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface WatchlistItem {
  symbol: string
  price: number
  change: number
  changePercent: number
}

interface WatchlistProps {
  items: WatchlistItem[]
  onAddClick: () => void
  onRemove: (symbol: string) => void
  onSelect: (symbol: string) => void
}

const Watchlist = ({ items, onAddClick, onRemove, onSelect }: WatchlistProps) => {
  return (
    <div className="flex flex-col h-full" data-testid="watchlist-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Watchlist
        </h2>
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={onAddClick}
            aria-label="Add Symbol"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-slate-800 rounded-lg p-8 text-center space-y-4">
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
        <div className="overflow-auto">
          <Table>
            <TableHeader className="hover:bg-transparent">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-[100px] text-xs font-medium text-slate-500">Symbol</TableHead>
                <TableHead className="text-right text-xs font-medium text-slate-500">Last</TableHead>
                <TableHead className="text-right text-xs font-medium text-slate-500">Chg%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow 
                    key={item.symbol} 
                    className="border-slate-800 hover:bg-slate-800/50 cursor-pointer group"
                    onClick={() => onSelect(item.symbol)}
                >
                  <TableCell className="font-bold text-slate-200 py-3">
                    {item.symbol}
                  </TableCell>
                  <TableCell className="text-right text-slate-300">
                    {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={item.change >= 0 ? "text-emerald-500" : "text-rose-500"}>
                      {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export default Watchlist
