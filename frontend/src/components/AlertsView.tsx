import AlertsList from './AlertsList'
import AlertForm from './AlertForm'
import type { Alert } from './AlertsList'

interface AlertsViewProps {
  alerts: Alert[]
  symbol: string
  onToggleMute: (id: string) => void
  onDelete: (id: string) => void
  onSelect: (symbol: string) => void
  onTriggerDemo?: (id: string) => void
  onAlertCreated: (alert: Alert) => void
}

const AlertsView = ({
  alerts,
  symbol,
  onToggleMute,
  onDelete,
  onSelect,
  onTriggerDemo,
  onAlertCreated,
}: AlertsViewProps) => {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 pr-1 flex flex-col">
        <AlertsList
          alerts={alerts}
          onToggleMute={onToggleMute}
          onDelete={onDelete}
          onSelect={onSelect}
          onTriggerDemo={onTriggerDemo}
        />
      </div>
      <div className="shrink-0 pt-4 mt-4 border-t border-slate-800">
        <AlertForm symbol={symbol} onAlertCreated={onAlertCreated} />
      </div>
    </div>
  )
}

export default AlertsView
