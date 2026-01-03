/**
 * LogTab component - Global trigger log view for User Story 4
 * Feature: 001-indicator-alerts
 * Phase 6: User Story 4 - View Global Trigger Log (Priority: P3)
 *
 * T063-T068: Create and implement global trigger log view
 *
 * Displays all trigger events from all alerts in reverse chronological order (newest first).
 * Shows columns: timestamp, symbol, alert_label, trigger_type, trigger_message, price, indicator_value.
 */

import * as React from 'react';
import { Clock, TrendingUp, TrendingDown, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { getRecentTriggers, deleteTrigger, type AlertTrigger } from '../api/alerts';

/**
 * Props for LogTab component
 */
export interface LogTabProps {
  /** Symbol filter (optional) */
  symbol?: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Format price for display
 */
function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '-';
  return `$${price.toFixed(2)}`;
}

/**
 * Format indicator value for display
 */
function formatIndicatorValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toFixed(2);
}

/**
 * LogTab component
 *
 * Displays a global log of all trigger events across all alerts.
 * Supports symbol filtering and auto-refresh.
 */
export function LogTab({ symbol, className }: LogTabProps) {
  const [triggers, setTriggers] = React.useState<AlertTrigger[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingIds, setDeletingIds] = React.useState<Set<number>>(new Set());

  // T065-T068: Load triggers and auto-refresh
  const loadTriggers = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRecentTriggers({
        symbol,
        limit: 500,
      });
      setTriggers(data);
    } catch (err) {
      console.error('Failed to load trigger log:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trigger log');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Handle delete trigger
  const handleDeleteTrigger = React.useCallback(async (triggerId: number) => {
    setDeletingIds(prev => new Set([...prev, triggerId]));
    try {
      await deleteTrigger(triggerId);
      setTriggers(prev => prev.filter(t => t.id !== triggerId));
    } catch (err) {
      console.error('Failed to delete trigger:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete trigger');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(triggerId);
        return next;
      });
    }
  }, []);

  // Initial load and refresh every 30 seconds
  React.useEffect(() => {
    loadTriggers();
    const interval = setInterval(loadTriggers, 30000);
    return () => clearInterval(interval);
  }, [loadTriggers]);

  return (
    <div className={cn('flex flex-col flex-1 min-h-0', className)}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300">Trigger Log</h2>
          <span className="text-xs text-slate-500">(All Symbols)</span>
        </div>
        <button
          onClick={loadTriggers}
          disabled={loading}
          className={cn(
            'p-1.5 rounded transition-colors',
            'hover:bg-slate-800 text-slate-400 hover:text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Refresh log"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Triggers table */}
      <div className="flex-1 overflow-auto min-h-0">
        {triggers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Clock className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No trigger events yet</p>
            <p className="text-xs">Alerts will appear here when they trigger</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {triggers.map((trigger) => (
                <tr
                  key={trigger.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group"
                >
                  <td className="p-2">
                    <div className="space-y-0.5">
                      {/* Line 1: Symbol, Alert, Type, Delete */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                            {trigger.alert_label?.split(' ')[0] || 'N/A'}
                          </span>
                          <span className="text-xs text-slate-400 truncate" title={trigger.alert_label || 'Unknown Alert'}>
                            {trigger.alert_label || 'Unknown Alert'}
                          </span>
                          {trigger.trigger_type === 'upper' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium whitespace-nowrap">
                              <TrendingUp className="h-3 w-3" />
                              Sell
                            </span>
                          ) : trigger.trigger_type === 'lower' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium whitespace-nowrap">
                              <TrendingDown className="h-3 w-3" />
                              Buy
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 text-xs whitespace-nowrap">
                              {trigger.trigger_type || 'Unknown'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteTrigger(trigger.id)}
                          disabled={deletingIds.has(trigger.id)}
                          className={cn(
                            'p-1 rounded transition-colors flex-shrink-0',
                            'text-slate-500 hover:bg-red-500/20 hover:text-red-400',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                          title="Delete trigger"
                        >
                          <Trash2 className={cn('h-3.5 w-3.5', deletingIds.has(trigger.id) && 'animate-pulse')} />
                        </button>
                      </div>
                      {/* Line 2: Time, Price */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500 whitespace-nowrap">
                          {formatTimestamp(trigger.triggered_at)}
                        </span>
                        <span className="font-mono whitespace-nowrap text-slate-200">
                          {formatPrice(trigger.observed_price)}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with count */}
      {triggers.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-500">
          Showing {triggers.length} most recent triggers
        </div>
      )}
    </div>
  );
}

export default LogTab;
