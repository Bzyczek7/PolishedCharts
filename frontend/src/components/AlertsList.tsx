import { useState } from "react"
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
  id: string | number
  symbol: string
  symbol_ticker?: string  // Backend uses symbol_ticker
  condition: string
  threshold: number | null
  status?: 'active' | 'triggered' | 'muted'  // Optional for backend compatibility
  createdAt?: string  // Optional for backend compatibility
  created_at?: string  // Backend uses created_at
  is_active?: boolean  // Backend uses is_active
  interval?: string  // Timeframe: '1d', '1h', '15m', etc.
  // Indicator fields
  indicator_name?: string | null
  indicator_field?: string | null
  indicator_params?: Record<string, number | string> | null
  // Flexible enabled conditions (maps condition_type to enabled state)
  enabled_conditions?: Record<string, boolean>
  // Flexible messages (maps condition_type to message)
  messages?: Record<string, string>
  // Optional history and statistics
  history?: { timestamp: string; price?: number; indicator_value?: number }[]
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
    const symbolStr = alert.symbol || ''
    const conditionStr = alert.condition || ''
    const matchesSearch = symbolStr.toLowerCase().includes(search.toLowerCase()) ||
                         conditionStr.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full" data-testid="alerts-list-container">
        <div className="sticky top-0 z-10 bg-slate-900 flex items-center justify-between px-1 shrink-0 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Monitoring
            </h2>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={onTriggerDemo ? () => onTriggerDemo('new') : undefined}
                title="Add Alert"
            >
                <Zap className="h-4 w-4" />
            </Button>
        </div>

        <div className="space-y-4 shrink-0 mb-4">
            {/* search and filter buttons unchanged */}
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

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
            {filteredAlerts.length === 0 ? (
            <div className="py-2 text-center space-y-2">
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
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-200">{alert.symbol}</span>
                            {alert.interval && (
                            <Badge variant="outline" className="text-[10px] uppercase h-4 px-1 text-slate-400 border-slate-600 bg-slate-800">
                                {alert.interval}
                            </Badge>
                            )}
                            {alert.indicator_name && (
                            <Badge variant="outline" className="text-[10px] uppercase h-4 px-1 text-blue-400 border-blue-500/20 bg-blue-500/5">
                                {alert.indicator_name.toUpperCase()}
                            </Badge>
                            )}
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
                            {alert.indicator_name
                            ? (() => {
                                const indicatorLabel = `${alert.indicator_name.toUpperCase()}${alert.indicator_field ? `.${alert.indicator_field}` : ''}`;
                                // Format enabled conditions based on enabled_conditions
                                if (alert.enabled_conditions) {
                                  const enabledKeys = Object.entries(alert.enabled_conditions)
                                    .filter(([, enabled]) => enabled)
                                    .map(([key]) => key);
                                  if (enabledKeys.length > 0) {
                                    const conditionText = enabledKeys
                                      .map(k => k.replace('indicator_', '').replace(/_/g, ' '))
                                      .join(', ');
                                    return `${indicatorLabel} - ${conditionText}`;
                                  }
                                }
                                // Fallback to single condition
                                return `${indicatorLabel} - ${alert.condition.replace('indicator_', '').replace('_', ' ')}`;
                              })()
                            : alert.condition.replace('_', ' ')
                            }
                            {alert.threshold !== null && alert.threshold !== undefined && ` @ ${alert.threshold}`}
                        </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-white"
                            title={`View ${alert.symbol} on chart`}
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
                            title={`${alert.status === 'muted' ? 'Unmute' : 'Mute'} alert for ${alert.symbol}`}
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
                                    <div className="flex gap-2">
                                    {h.price !== undefined && h.price !== null && (
                                        <span className="text-slate-200 font-mono">${h.price}</span>
                                    )}
                                    {h.indicator_value !== undefined && h.indicator_value !== null && (
                                        <span className="text-blue-400 font-mono">{h.indicator_value.toFixed(2)}</span>
                                    )}
                                    </div>
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