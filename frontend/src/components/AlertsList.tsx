import React, { useState } from "react"
import { Search, Bell, BellOff, CheckCircle2, AlertTriangle, MoreVertical, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface Alert {
  id: string
  symbol: string
  condition: string
  threshold: number
  status: 'active' | 'triggered' | 'muted'
  createdAt: string
}

interface AlertsListProps {
  alerts: Alert[]
  onToggleMute: (id: string) => void
  onDelete: (id: string) => void
  onSelect: (symbol: string) => void
}

const AlertsList = ({ alerts, onToggleMute, onDelete, onSelect }: AlertsListProps) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'triggered'>('all')
  const [search, setSearch] = useState('')

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
            <div 
              key={alert.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3 group hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{alert.symbol}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase h-4 px-1",
                      alert.status === 'active' ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
                      alert.status === 'triggered' ? "text-amber-500 border-amber-500/20 bg-amber-500/5" :
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
                    onClick={() => onSelect(alert.symbol)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-slate-400 hover:text-white"
                    onClick={() => onToggleMute(alert.id)}
                  >
                    {alert.status === 'muted' ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="text-[10px] text-slate-600 flex justify-between items-center">
                <span>Created {new Date(alert.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default AlertsList
