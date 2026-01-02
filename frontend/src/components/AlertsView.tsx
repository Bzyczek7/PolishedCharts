import { useState } from 'react';
import AlertsList from './AlertsList';
import { LogTab } from './LogTab';
import type { Alert } from './AlertsList';

interface AlertsViewProps {
  alerts: Alert[]
  symbol: string
  onToggleMute: (id: string) => void
  onDelete: (id: string) => void
  onSelect: (symbol: string) => void
  onTriggerDemo?: (id: string) => void
}

/**
 * AlertsView component - Monitoring panel alert management view
 * Feature: 001-indicator-alerts
 * Phase 3: User Story 1 - Remove alert creation UI from Monitoring (T028)
 * Phase 6: User Story 4 - Add Log tab to Monitoring panel (T066)
 *
 * This component now displays tabs for both Alerts List and Log.
 * Alerts are created from the indicator context menu instead.
 */
const AlertsView = ({
  alerts,
  symbol,
  onToggleMute,
  onDelete,
  onSelect,
  onTriggerDemo,
}: AlertsViewProps) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'log'>('alerts');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab navigation */}
      <div className="flex border-b border-slate-800">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'alerts'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('alerts')}
        >
          Alerts List
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'log'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('log')}
        >
          Log
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 pr-1 flex flex-col">
        {activeTab === 'alerts' ? (
          <AlertsList
            alerts={alerts}
            onToggleMute={onToggleMute}
            onDelete={onDelete}
            onSelect={onSelect}
            onTriggerDemo={onTriggerDemo}
          />
        ) : (
          <LogTab symbol={symbol} />
        )}
      </div>
    </div>
  )
}

export default AlertsView
