import React, { useState } from "react"
import { Search, Bell, BellOff, ExternalLink, Zap, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

export interface Alert {
  id: string
  symbol: string
  condition: string
  threshold: number
  status: 'active' | 'triggered' | 'muted'
  createdAt: string
  history?: { timestamp: string; price: number }[]
  statistics?: {
    triggerCount24h: number
    lastTriggered?: string
  }
}

interface AlertsListProps {
  alerts: Alert[]
  onToggleMute: (id: string) => void
  onDelete: (id: string) => void
  onSelect: (symbol: string) => void
  onTriggerDemo?: (id: string) => void
}

const AlertsList = ({ alerts, onToggleMute, onDelete, onSelect, onTriggerDemo }: AlertsListProps) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'triggered'>('all')
  const [search, setSearch] = useState('')
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null)

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.status === filter
    const matchesSearch = alert.symbol.toLowerCase().includes(search.toLowerCase()) ||
                         alert.condition.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="flex flex-col h-full space-y-4" data-testid="alerts-list-container">
      {/* Header & Controls */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Filter alerts..." 
            className="pl-8 bg-slate-900 border-slate-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-1 p-1 bg-slate-900 rounded-md border border-slate-800">
          {(['all', 'active', 'triggered'] as const).map((f) => (
            <Button
              key={f}
              variant="ghost"
              size="sm"
              className={cn(
                "flex-1 text-xs capitalize h-7",
                filter === f ? "bg-slate-800 text-blue-400" : "text-slate-500"
              )}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto space-y-2 pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <BellOff className="h-8 w-8 text-slate-700 mx-auto" />
            <p className="text-sm text-slate-500">No alerts found</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <ContextMenu key={alert.id}>
              <ContextMenuTrigger asChild>
                <div 
                  tabIndex={0}
                  onClick={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}
                  onKeyDown={(e) => {
                    if (e.key.toLowerCase() === 'm') {
                        onToggleMute(alert.id)
                    }
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        onDelete(alert.id)
                    }
                    if (e.key === 'Enter') {
                        onSelect(alert.symbol)
                    }
                  }}
                  className={cn(
                    "bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3 group hover:border-slate-700 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer",
                    expandedAlertId === alert.id && "border-blue-500/50 bg-slate-900/80"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{alert.symbol}</span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase h-4 px-1",
                          alert.status === 'active' ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
                          alert.status === 'triggered' ? "text-amber-500 border-amber-500/20 bg-amber-500/5 animate-pulse" :
                          "text-slate-500 border-slate-500/20 bg-slate-500/5"
                        )}>
                          {alert.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {alert.condition.replace('_', ' ')} @ {alert.threshold}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(alert.symbol);
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleMute(alert.id);
                        }}
                      >
                        {alert.status === 'muted' ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  
                  {expandedAlertId === alert.id && (
                    <div className="pt-2 border-t border-slate-800/50 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      {alert.statistics && (
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800/50">
                            <p className="text-slate-500 uppercase font-semibold mb-0.5">Trigger count (24h)</p>
                            <p className="text-slate-300">{alert.statistics.triggerCount24h}</p>
                          </div>
                          <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800/50">
                            <p className="text-slate-500 uppercase font-semibold mb-0.5">Last triggered</p>
                            <p className="text-slate-300">
                              {alert.statistics.lastTriggered 
                                ? new Date(alert.statistics.lastTriggered).toLocaleTimeString() 
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {alert.history && alert.history.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">Trigger History</p>
                          <div className="space-y-1 max-h-24 overflow-auto pr-1">
                            {alert.history.map((h, i) => (
                              <div key={i} className="flex justify-between text-[10px] py-1 border-b border-slate-800/30 last:border-0">
                                <span className="text-slate-400">{new Date(h.timestamp).toLocaleString()}</span>
                                <span className="text-slate-200 font-mono">${h.price}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-600 flex justify-between items-center">
                    <span>Created {new Date(alert.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="bg-slate-900 border-slate-800 text-slate-300">
                <ContextMenuItem className="hover:bg-slate-800 cursor-pointer" onClick={() => onSelect(alert.symbol)}>
                  <ExternalLink className="mr-2 h-4 w-4" /> View on Chart
                </ContextMenuItem>
                <ContextMenuItem className="hover:bg-slate-800 cursor-pointer" onClick={() => onToggleMute(alert.id)}>
                  {alert.status === 'muted' ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
                  {alert.status === 'muted' ? 'Unmute' : 'Mute'}
                </ContextMenuItem>
                {onTriggerDemo && (
                    <ContextMenuItem className="hover:bg-slate-800 cursor-pointer text-amber-500 focus:text-amber-400" onClick={() => onTriggerDemo(alert.id)}>
                        <Zap className="mr-2 h-4 w-4" /> Trigger (Demo)
                    </ContextMenuItem>
                )}
                <ContextMenuItem 
                    className="hover:bg-slate-800 cursor-pointer text-rose-500 focus:text-rose-400"
                    onClick={() => onDelete(alert.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))
        )}
      </div>
    </div>
  )
}

export default AlertsList