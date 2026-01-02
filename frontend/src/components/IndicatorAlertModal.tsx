/**
 * IndicatorAlertModal component - Create/Edit indicator-based alerts
 * Feature: 001-indicator-alerts
 * Phase 3: User Story 1 - Create Indicator Alert from Indicator UI (Priority: P1)
 *
 * DYNAMIC modal that adapts to any indicator's alert templates.
 * Fetches indicator-specific conditions and builds UI dynamically.
 *
 * Modal for configuring TradingView-style alerts with:
 * - Settings tab: Enabled conditions and cooldown
 * - Message tab: Trigger-specific messages
 * - Notifications tab: Placeholder for future notification delivery
 */

import * as React from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  createAlert,
  updateAlert,
  getIndicatorConditions,
  type IndicatorAlertFormData,
  type Alert,
  type IndicatorCondition,
  type AlertTriggerMode,
} from '../api/alerts';

/**
 * Props for IndicatorAlertModal component
 */
export interface IndicatorAlertModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback: Modal closed */
  onClose: () => void;
  /** Callback: Alert created successfully */
  onAlertCreated?: (alert: Alert) => void;
  /** Symbol for the alert (e.g., "AAPL") - backend will resolve to symbolId */
  symbol: string;
  /** Current chart interval (e.g., '1d', '1h', '15m') */
  interval: string;
  /** Indicator information */
  indicator: {
    name: string;           // e.g., 'crsi', 'tdfi', 'adxvma'
    field: string;          // e.g., 'crsi', 'tdfi_signal'
    params: Record<string, number | string>;
    displayName: string;    // e.g., 'cRSI(20)'
  };
  /** Edit mode: existing alert to edit (optional) */
  existingAlert?: Alert | null;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Tab type for the modal
 */
type Tab = 'settings' | 'message' | 'notifications';

/**
 * Condition-specific state (thresholds, messages, etc.)
 */
interface ConditionState {
  enabled: boolean;
  message: string;
  threshold?: number;  // For conditions that require threshold
}

/**
 * IndicatorAlertModal component
 * Dynamic TradingView-style alert creation modal with tabbed interface
 */
export function IndicatorAlertModal({
  open,
  onClose,
  onAlertCreated,
  symbol,
  interval,
  indicator,
  existingAlert,
  className,
}: IndicatorAlertModalProps) {
  // Active tab state
  const [activeTab, setActiveTab] = React.useState<Tab>('settings');

  // Dynamic conditions loaded from backend
  const [conditions, setConditions] = React.useState<IndicatorCondition[]>([]);
  const [conditionsLoading, setConditionsLoading] = React.useState(false);
  const [conditionsError, setConditionsError] = React.useState<string | null>(null);

  // Form state - dynamic map of condition_type to state
  const [conditionStates, setConditionStates] = React.useState<Record<string, ConditionState>>({});
  const [cooldown, setCooldown] = React.useState(1);  // Default: 1 minute
  const [triggerMode, setTriggerMode] = React.useState<AlertTriggerMode>('once_per_bar_close');  // Default
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch indicator conditions when modal opens
  React.useEffect(() => {
    if (open && indicator.name) {
      setConditionsLoading(true);
      setConditionsError(null);

      getIndicatorConditions(indicator.name)
        .then((response) => {
          setConditions(response.conditions);

          // Initialize condition states from existing alert or defaults
          const defaultStates: Record<string, ConditionState> = {};
          response.conditions.forEach((cond) => {
            // Check if this condition has existing data
            const isEnabled = existingAlert?.enabled_conditions?.[cond.condition_type] ?? true;
            const existingMessage = existingAlert?.messages?.[cond.condition_type];

            defaultStates[cond.condition_type] = {
              enabled: isEnabled,
              message: existingMessage || getDefaultMessage(cond.condition_type, cond.label),
              threshold: 0,
            };
          });
          setConditionStates(defaultStates);

          // Set cooldown from existing alert or default (cooldown is now in minutes)
          if (existingAlert?.cooldown !== undefined) {
            setCooldown(existingAlert.cooldown);
          }

          // Set trigger mode from existing alert or default
          if (existingAlert?.trigger_mode) {
            setTriggerMode(existingAlert.trigger_mode);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch indicator conditions:', err);
          setConditionsError(err instanceof Error ? err.message : 'Failed to load alert conditions');
        })
        .finally(() => {
          setConditionsLoading(false);
        });
    }
  }, [open, indicator.name, existingAlert]);

  // Reset form when opening/closing or when indicator changes
  React.useEffect(() => {
    if (open && !existingAlert) {
      setCooldown(1);  // 1 minute default
      setTriggerMode('once_per_bar_close');
      setError(null);
      setActiveTab('settings');
    }
  }, [open, indicator, existingAlert]);

  // Don't render if closed
  if (!open) return null;

  // Get default message based on condition type
  function getDefaultMessage(conditionType: string, label: string): string {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('upper') || lowerLabel.includes('above') || lowerLabel.includes('positive') || lowerLabel.includes('bullish')) {
      return "It's time to sell!";
    }
    if (lowerLabel.includes('lower') || lowerLabel.includes('below') || lowerLabel.includes('negative') || lowerLabel.includes('bearish')) {
      return "It's time to buy!";
    }
    return `Alert: ${label}`;
  }

  // Form validation
  const isValid = () => {
    const enabledConditions = Object.values(conditionStates).filter((s) => s.enabled);
    if (enabledConditions.length === 0) {
      setError('At least one condition must be enabled');
      return false;
    }
    for (const state of enabledConditions) {
      if (!state.message.trim()) {
        setError('All enabled conditions must have a message');
        return false;
      }
    }
    if (cooldown < 1) {
      setError('Cooldown must be at least 1 minute');
      return false;
    }
    if (cooldown > 1440) {
      setError('Cooldown cannot exceed 24 hours (1440 minutes)');
      return false;
    }
    return true;
  };

  // Handle save
  const handleSave = async () => {
    if (!isValid()) return;

    // Don't allow save if conditions are still loading
    if (conditionsLoading || conditions.length === 0) {
      setError('Alert conditions are still loading. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Build enabled_conditions map and messages map
      const enabledConditionsMap: Record<string, boolean> = {};
      const messagesMap: Record<string, string> = {};

      for (const [conditionType, state] of Object.entries(conditionStates)) {
        if (state.enabled) {
          enabledConditionsMap[conditionType] = true;
          messagesMap[conditionType] = state.message.trim();
        }
      }

      const alertData = {
        symbol,
        interval,  // Timeframe for the alert
        indicator_name: indicator.name,
        indicator_field: indicator.field,
        indicator_params: indicator.params,
        enabled_conditions: enabledConditionsMap,
        messages: messagesMap,
        cooldown,
        trigger_mode: triggerMode,
        condition: 'indicator_above_upper' as const, // Will be evaluated based on enabled_conditions
        threshold: 0, // Not used for indicator alerts
        is_active: true,
      };

      let alert: Alert;
      if (existingAlert) {
        // Update existing alert
        alert = await updateAlert(existingAlert.id, {
          enabled_conditions: enabledConditionsMap,
          messages: messagesMap,
          cooldown,
          trigger_mode: triggerMode,
        });
        toast.success('Alert updated successfully');
      } else {
        // Create new alert
        alert = await createAlert(alertData);
        toast.success('Alert created successfully');
      }

      onAlertCreated?.(alert);
      onClose();
    } catch (err: any) {
      console.error('Failed to save alert:', err);
      // Try to extract detail from axios error response
      let errorMsg = err instanceof Error ? err.message : 'Failed to save alert';
      if (err.response?.data?.detail) {
        errorMsg = typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail);
      }
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update condition state
  const updateConditionState = (conditionType: string, updates: Partial<ConditionState>) => {
    setConditionStates((prev) => ({
      ...prev,
      [conditionType]: { ...prev[conditionType], ...updates },
    }));
  };

  // Handle keyboard escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, isSubmitting]);

  // Loading state
  if (conditionsLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className={cn(
            'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-800 shadow-xl p-8',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-300">Loading alert conditions...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (conditionsError) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className={cn(
            'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-800 shadow-xl p-6',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <p className="font-semibold">Failed to load alert conditions</p>
            <p className="mt-1">{conditionsError}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-800 shadow-xl',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="text-lg font-semibold text-white">
            {existingAlert ? 'Edit Alert' : `Create Alert on ${indicator.displayName}`}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'settings'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('message')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'message'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Message
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'notifications'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Notifications
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Settings Tab - Dynamic conditions */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Trigger Conditions
                </label>
                <div className="space-y-2">
                  {conditions.map((condition) => {
                    const state = conditionStates[condition.condition_type];
                    if (!state) return null;

                    return (
                      <div key={condition.condition_type} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={state.enabled}
                            onChange={(e) => updateConditionState(condition.condition_type, { enabled: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                          />
                          <span>{condition.label}</span>
                        </label>
                        <p className="ml-6 text-xs text-slate-400">{condition.description}</p>

                        {/* Threshold input for conditions that require it */}
                        {condition.requires_threshold && state.enabled && (
                          <div className="ml-6 mt-1">
                            <label className="block text-xs text-slate-400 mb-1">
                              Threshold value:
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={state.threshold ?? 0}
                              onChange={(e) => updateConditionState(condition.condition_type, { threshold: parseFloat(e.target.value) || 0 })}
                              className="w-32 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="cooldown" className="block text-sm font-medium text-slate-300 mb-2">
                  Cooldown (minutes)
                </label>
                <input
                  id="cooldown"
                  type="number"
                  min="1"
                  max="1440"
                  value={cooldown}
                  onChange={(e) => setCooldown(parseInt(e.target.value) || 1)}
                  className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="1"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Minimum 1 minute. Alert will not trigger again during this period after firing.
                </p>
              </div>

              <div>
                <label htmlFor="triggerMode" className="block text-sm font-medium text-slate-300 mb-2">
                  Trigger Mode
                </label>
                <select
                  id="triggerMode"
                  value={triggerMode}
                  onChange={(e) => setTriggerMode(e.target.value as AlertTriggerMode)}
                  className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="once">Once (fire once and disable)</option>
                  <option value="once_per_bar">Once per bar update</option>
                  <option value="once_per_bar_close">Once per bar close</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  {triggerMode === 'once' && 'Alert will fire once and then be automatically disabled'}
                  {triggerMode === 'once_per_bar' && 'Alert will fire at most once per bar update'}
                  {triggerMode === 'once_per_bar_close' && 'Alert will fire at most once per bar close (respects bar timestamps)'}
                </p>
              </div>
            </div>
          )}

          {/* Message Tab - Dynamic message inputs */}
          {activeTab === 'message' && (
            <div className="space-y-4">
              {conditions.map((condition) => {
                const state = conditionStates[condition.condition_type];
                if (!state) return null;

                return (
                  <div key={condition.condition_type}>
                    <label
                      htmlFor={`msg-${condition.condition_type}`}
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      {condition.label} Message
                    </label>
                    <input
                      id={`msg-${condition.condition_type}`}
                      type="text"
                      value={state.message}
                      onChange={(e) => updateConditionState(condition.condition_type, { message: e.target.value })}
                      disabled={!state.enabled}
                      className={cn(
                        'w-full rounded border bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                        !state.enabled && 'opacity-50'
                      )}
                      placeholder={getDefaultMessage(condition.condition_type, condition.label)}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Message shown when: {condition.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notifications Tab - Placeholder */}
          {activeTab === 'notifications' && (
            <div className="flex h-48 items-center justify-center rounded border border-dashed border-slate-600 bg-slate-700/50">
              <div className="text-center">
                <p className="text-sm text-slate-400">
                  Notification delivery options coming soon!
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Configure email, webhook, push notifications, and sound alerts here.
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-700 p-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting || conditionsLoading || conditions.length === 0}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : conditionsLoading ? 'Loading...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IndicatorAlertModal;
