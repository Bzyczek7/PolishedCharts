import { useState, useCallback, useEffect } from 'react';
import AlertsList from './AlertsList';
import { LogTab } from './LogTab';
import type { Alert } from './AlertsList';
import { updateAlertNotificationSettings } from '@/api/alerts';
import type { AlertNotificationSettingsUpdate } from '@/types/notification';
import toast from 'react-hot-toast';

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
  alerts: propAlerts,
  symbol,
  onToggleMute,
  onDelete,
  onSelect,
  onTriggerDemo,
}: AlertsViewProps) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'log'>('alerts');
  const [alerts, setAlerts] = useState<Alert[]>(propAlerts);

  // Sync local state when prop alerts change
  useEffect(() => {
    setAlerts(propAlerts);
  }, [propAlerts]);

  // Toggle notification channel for an alert
  const handleToggleNotification = useCallback(async (
    alertId: string | number,
    channel: 'toast' | 'sound' | 'telegram'
  ) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    const settings = alert.notificationSettings;
    const currentValue = settings?.[channel === 'toast' ? 'toastEnabled' : channel === 'sound' ? 'soundEnabled' : 'telegramEnabled'] ?? false;

    // Toggle: true -> false, false -> true
    const newValue = !currentValue;

    const updates: AlertNotificationSettingsUpdate = {};
    if (channel === 'toast') updates.toastEnabled = newValue;
    else if (channel === 'sound') updates.soundEnabled = newValue;
    else if (channel === 'telegram') updates.telegramEnabled = newValue;

    // Optimistic update - update local state
    const updatedAlerts = alerts.map(a => {
      if (a.id === alertId) {
        return {
          ...a,
          notificationSettings: { ...a.notificationSettings, ...updates }
        };
      }
      return a;
    });
    setAlerts(updatedAlerts);

    try {
      await updateAlertNotificationSettings(String(alertId), updates);
      toast.success(`${channel} ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      // Revert on error
      setAlerts(alerts);
      console.error('Failed to update notification settings:', error);

      // Check for 401 Unauthorized
      if (error.response?.status === 401) {
        toast.error('Please log in to modify notification settings');
      } else {
        toast.error('Failed to update notification settings');
      }
    }
  }, [alerts]);

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
            onToggleNotification={handleToggleNotification}
          />
        ) : (
          <LogTab />
        )}
      </div>
    </div>
  )
}

export default AlertsView
