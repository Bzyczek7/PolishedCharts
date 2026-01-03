import React, { useState, useEffect } from 'react'
import {
  createAlert,
  updateAlertNotificationSettings,
  type AlertCondition,
  type AlertTriggerMode,
  getIndicatorConditions,
  type IndicatorCondition,
  type AlertCreate
} from '../api/alerts'
import { listIndicatorsWithMetadata, type IndicatorInfo } from '../api/indicators'
import { getIndicatorTitle } from '@/utils/indicatorDisplay'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { SoundType } from '@/types/notification'

interface AlertFormProps {
  symbol: string
  symbolId?: number
  onAlertCreated?: (alert: any) => void
  editMode?: boolean
  alertId?: string
  initialData?: {
    alertType: 'price' | 'indicator'
    condition: AlertCondition
    threshold: string
    cooldown: string
    triggerMode: AlertTriggerMode
    selectedIndicator?: string
    selectedField?: string
    indicatorParams?: Record<string, string>
  }
  notificationSettings?: {
    toastEnabled: boolean | null
    soundEnabled: boolean | null
    soundType: SoundType | null
    telegramEnabled: boolean | null
  }
  onNotificationSettingsChange?: (settings: AlertFormProps['notificationSettings']) => void
}

const priceConditionLabels: Record<string, string> = {
  above: 'Price Above (triggers when current > threshold AND previous <= threshold)',
  below: 'Price Below (triggers when current < threshold AND previous >= threshold)',
  crosses_up: 'Crosses Up (triggers when previous < threshold AND current >= threshold)',
  crosses_down: 'Crosses Down (triggers when previous > threshold AND current <= threshold)',
}

const AlertForm = ({
  symbol,
  symbolId = 1,
  onAlertCreated,
  editMode = false,
  alertId,
  initialData,
  notificationSettings,
  onNotificationSettingsChange
}: AlertFormProps) => {
  // Form state
  const [alertType, setAlertType] = useState<'price' | 'indicator'>(initialData?.alertType || 'price')
  const [condition, setCondition] = useState<AlertCondition>(initialData?.condition || 'above')
  const [threshold, setThreshold] = useState(initialData?.threshold || '')
  const [cooldown, setCooldown] = useState(initialData?.cooldown || '1')
  const [triggerMode, setTriggerMode] = useState<AlertTriggerMode>(initialData?.triggerMode || 'once_per_bar_close')

  // Indicator alert state
  const [indicators, setIndicators] = useState<IndicatorInfo[]>([])
  const [selectedIndicator, setSelectedIndicator] = useState(initialData?.selectedIndicator || '')
  const [indicatorConditions, setIndicatorConditions] = useState<IndicatorCondition[]>([])
  const [selectedField, setSelectedField] = useState(initialData?.selectedField || '')
  const [indicatorParams, setIndicatorParams] = useState<Record<string, string>>(initialData?.indicatorParams || {})

  // Notification settings state
  const [notifToastEnabled, setNotifToastEnabled] = useState(notificationSettings?.toastEnabled ?? null)
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(notificationSettings?.soundEnabled ?? null)
  const [notifSoundType, setNotifSoundType] = useState<SoundType>(notificationSettings?.soundType || 'bell')
  const [notifTelegramEnabled, setNotifTelegramEnabled] = useState(notificationSettings?.telegramEnabled ?? null)
  const [showNotificationSettings, setShowNotificationSettings] = useState(false)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoadingIndicators, setIsLoadingIndicators] = useState(false)
  const [isLoadingConditions, setIsLoadingConditions] = useState(false)

  // Load available indicators on mount (with metadata for display names)
  useEffect(() => {
    const loadIndicators = async () => {
      setIsLoadingIndicators(true)
      try {
        // Use listIndicatorsWithMetadata to get series_metadata for clean display names
        const data = await listIndicatorsWithMetadata()
        setIndicators(data)
      } catch (error) {
        console.error('Error loading indicators:', error)
        setMessage('Failed to load available indicators.')
      } finally {
        setIsLoadingIndicators(false)
      }
    }
    loadIndicators()
  }, [])

  // Load indicator conditions when indicator is selected
  useEffect(() => {
    const loadIndicatorConditions = async () => {
      if (!selectedIndicator) {
        setIndicatorConditions([])
        return
      }

      setIsLoadingConditions(true)
      try {
        const data = await getIndicatorConditions(selectedIndicator)
        setIndicatorConditions(data.conditions)

        // Auto-select first condition and field if available
        if (data.conditions.length > 0) {
          setCondition(data.conditions[0].condition_type as AlertCondition)
          if (data.conditions[0].applicable_fields.length > 0) {
            setSelectedField(data.conditions[0].applicable_fields[0])
          }
        }
      } catch (error) {
        console.error('Error loading indicator conditions:', error)
        setMessage('Failed to load indicator conditions.')
      } finally {
        setIsLoadingConditions(false)
      }
    }
    loadIndicatorConditions()
  }, [selectedIndicator])

  // Get current condition description
  const selectedConditionTemplate = indicatorConditions.find(c => c.condition_type === condition)
  const requiresThreshold = selectedConditionTemplate?.requires_threshold ?? true

  // Get available fields for selected condition
  const availableFields = selectedConditionTemplate?.applicable_fields || []

  // Update field when condition changes
  useEffect(() => {
    if (alertType === 'indicator' && availableFields.length > 0 && !availableFields.includes(selectedField)) {
      setSelectedField(availableFields[0])
    }
  }, [condition, availableFields, selectedField, alertType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    const cooldownVal = cooldown ? parseInt(cooldown) : undefined

    // Validation
    if (alertType === 'price') {
      const thresholdVal = parseFloat(threshold)
      if (isNaN(thresholdVal) || thresholdVal <= 0) {
        setMessage('Threshold must be a positive number.')
        setIsSubmitting(false)
        return
      }

      try {
        const alertData: AlertCreate = {
          symbol_id: symbolId,
          condition,
          threshold: thresholdVal,
          cooldown: cooldownVal,
          trigger_mode: triggerMode,
          is_active: true
        }

        const result = await createAlert(alertData)
        setMessage('Alert created successfully!')
        setThreshold('')
        setCooldown('1')

        // Save notification settings if any are set
        if (notifToastEnabled !== null || notifSoundEnabled !== null || notifTelegramEnabled !== null) {
          await updateAlertNotificationSettings(String(result.id), {
            toastEnabled: notifToastEnabled,
            soundEnabled: notifSoundEnabled,
            soundType: notifSoundType,
            telegramEnabled: notifTelegramEnabled,
          });
        }

        if (onAlertCreated) onAlertCreated(result)
      } catch (error) {
        console.error('Error creating alert:', error)
        setMessage('Failed to create alert.')
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Indicator alert validation
      if (!selectedIndicator) {
        setMessage('Please select an indicator.')
        setIsSubmitting(false)
        return
      }
      if (!selectedField) {
        setMessage('Please select an indicator field.')
        setIsSubmitting(false)
        return
      }
      if (requiresThreshold && (!threshold || isNaN(parseFloat(threshold)))) {
        setMessage('This condition requires a threshold value.')
        setIsSubmitting(false)
        return
      }

      try {
        const alertData: AlertCreate = {
          symbol_id: symbolId,
          condition,
          threshold: requiresThreshold ? parseFloat(threshold) : undefined,
          cooldown: cooldownVal,
          trigger_mode: triggerMode,
          is_active: true,
          indicator_name: selectedIndicator,
          indicator_field: selectedField,
          indicator_params: Object.keys(indicatorParams).length > 0 ? indicatorParams : undefined
        }

        const result = await createAlert(alertData)
        setMessage('Alert created successfully!')
        setThreshold('')
        setCooldown('1')
        setIndicatorParams({})

        // Save notification settings if any are set
        if (notifToastEnabled !== null || notifSoundEnabled !== null || notifTelegramEnabled !== null) {
          await updateAlertNotificationSettings(String(result.id), {
            toastEnabled: notifToastEnabled,
            soundEnabled: notifSoundEnabled,
            soundType: notifSoundType,
            telegramEnabled: notifTelegramEnabled,
          });
        }

        if (onAlertCreated) onAlertCreated(result)
      } catch (error) {
        console.error('Error creating alert:', error)
        setMessage('Failed to create alert.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const conditionLabels = alertType === 'price'
    ? priceConditionLabels
    : Object.fromEntries(
        indicatorConditions.map(c => [c.condition_type, `${c.label} - ${c.description}`])
      )

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
      <h3 className="text-xl font-semibold mb-4 text-white">Set Alert</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Alert Type Selector */}
        <div>
          <label htmlFor="alertType" className="block text-sm font-medium text-slate-400 mb-1">
            Alert Type
          </label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="alertType"
                value="price"
                checked={alertType === 'price'}
                onChange={(e) => {
                  setAlertType(e.target.value as 'price' | 'indicator')
                  setCondition('above')
                }}
                className="form-radio text-blue-600 h-4 w-4"
              />
              <span className="ml-2 text-white">Price Alert</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="alertType"
                value="indicator"
                checked={alertType === 'indicator'}
                onChange={(e) => {
                  setAlertType(e.target.value as 'price' | 'indicator')
                  if (indicators.length > 0) {
                    setSelectedIndicator(indicators[0].name)
                  }
                }}
                className="form-radio text-blue-600 h-4 w-4"
              />
              <span className="ml-2 text-white">Indicator Alert</span>
            </label>
          </div>
        </div>

        {alertType === 'indicator' && (
          <>
            {/* Indicator Selector */}
            <div>
              <label htmlFor="indicator" className="block text-sm font-medium text-slate-400 mb-1">
                Indicator
              </label>
              <select
                id="indicator"
                value={selectedIndicator}
                onChange={(e) => setSelectedIndicator(e.target.value)}
                disabled={isLoadingIndicators}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select an indicator...</option>
                {indicators.map((ind) => (
                  <option key={ind.name} value={ind.name}>
                    {getIndicatorTitle(ind)} - {ind.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Indicator Field Selector */}
            {availableFields.length > 0 && (
              <div>
                <label htmlFor="field" className="block text-sm font-medium text-slate-400 mb-1">
                  Indicator Field
                </label>
                <select
                  id="field"
                  value={selectedField}
                  onChange={(e) => setSelectedField(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* Condition Selector */}
        <div>
          <label htmlFor="condition" className="block text-sm font-medium text-slate-400 mb-1">
            Condition
          </label>
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as AlertCondition)}
            disabled={alertType === 'indicator' && isLoadingConditions}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {alertType === 'price' ? (
              (Object.keys(conditionLabels) as AlertCondition[]).map((cond) => (
                <option key={cond} value={cond}>
                  {conditionLabels[cond]}
                </option>
              ))
            ) : indicatorConditions.length > 0 ? (
              indicatorConditions.map((cond) => (
                <option key={cond.condition_type} value={cond.condition_type}>
                  {cond.label} - {cond.description}
                </option>
              ))
            ) : (
              <option value="">Select an indicator first...</option>
            )}
          </select>
        </div>

        {/* Threshold (conditional) */}
        {requiresThreshold && (
          <div>
            <label htmlFor="threshold" className="block text-sm font-medium text-slate-400 mb-1">
              Threshold {alertType === 'price' ? 'Price' : 'Value'}
            </label>
            <input
              id="threshold"
              type="number"
              step="0.01"
              min="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required={requiresThreshold}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 150.00"
            />
          </div>
        )}

        {/* Cooldown */}
        <div>
          <label htmlFor="cooldown" className="block text-sm font-medium text-slate-400 mb-1">
            Cooldown (optional, minutes)
          </label>
          <input
            id="cooldown"
            type="number"
            min="1"
            max="1440"
            step="1"
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 5 (5 minutes)"
          />
          <p className="text-xs text-slate-500 mt-1">Minimum 1 minute between alert triggers</p>
        </div>

        {/* Trigger Mode */}
        <div>
          <label htmlFor="triggerMode" className="block text-sm font-medium text-slate-400 mb-1">
            Trigger Mode
          </label>
          <select
            id="triggerMode"
            value={triggerMode}
            onChange={(e) => setTriggerMode(e.target.value as AlertTriggerMode)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="once">Once (fire once and disable)</option>
            <option value="once_per_bar">Once per bar update</option>
            <option value="once_per_bar_close">Once per bar close</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {triggerMode === 'once' && 'Alert will fire once and then be automatically disabled'}
            {triggerMode === 'once_per_bar' && 'Alert will fire at most once per bar update'}
            {triggerMode === 'once_per_bar_close' && 'Alert will fire at most once per bar close (respects bar timestamps)'}
          </p>
        </div>

        {/* Notification Settings Toggle */}
        <button
          type="button"
          onClick={() => setShowNotificationSettings(!showNotificationSettings)}
          className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
        >
          <span>{showNotificationSettings ? '▼' : '▶'}</span>
          Notification Settings {editMode && '(Optional override)'}
        </button>

        {/* Notification Settings */}
        {showNotificationSettings && (
          <div className="p-4 bg-slate-700/50 rounded-lg space-y-4 border border-slate-600">
            {/* Toast */}
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-toast" className="text-white">
                Toast Notification
              </Label>
              <Switch
                id="notif-toast"
                checked={notifToastEnabled ?? true}
                onCheckedChange={(checked) => {
                  setNotifToastEnabled(checked ? true : null)
                  onNotificationSettingsChange?.({
                    toastEnabled: checked ? true : null,
                    soundEnabled: notifSoundEnabled,
                    soundType: notifSoundType,
                    telegramEnabled: notifTelegramEnabled
                  })
                }}
              />
            </div>

            {/* Sound */}
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-sound" className="text-white">
                Sound Notification
              </Label>
              <Switch
                id="notif-sound"
                checked={notifSoundEnabled ?? false}
                onCheckedChange={(checked) => {
                  setNotifSoundEnabled(checked ? true : null)
                  onNotificationSettingsChange?.({
                    toastEnabled: notifToastEnabled,
                    soundEnabled: checked ? true : null,
                    soundType: notifSoundType,
                    telegramEnabled: notifTelegramEnabled
                  })
                }}
              />
            </div>

            {/* Sound Type (if sound enabled) */}
            {notifSoundEnabled && (
              <div className="grid grid-cols-3 gap-2">
                {(['bell', 'alert', 'chime'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setNotifSoundType(type)
                      onNotificationSettingsChange?.({
                        toastEnabled: notifToastEnabled,
                        soundEnabled: notifSoundEnabled,
                        soundType: type,
                        telegramEnabled: notifTelegramEnabled
                      })
                    }}
                    className={`p-2 rounded text-sm border ${
                      notifSoundType === type
                        ? 'border-[#26a69a] bg-[#26a69a]/20 text-white'
                        : 'border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Telegram */}
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-telegram" className="text-white">
                Telegram
              </Label>
              <Switch
                id="notif-telegram"
                checked={notifTelegramEnabled ?? false}
                onCheckedChange={(checked) => {
                  setNotifTelegramEnabled(checked ? true : null)
                  onNotificationSettingsChange?.({
                    toastEnabled: notifToastEnabled,
                    soundEnabled: notifSoundEnabled,
                    soundType: notifSoundType,
                    telegramEnabled: checked ? true : null
                  })
                }}
              />
            </div>

            <p className="text-xs text-slate-500">
              Set to "Use global" (default) to inherit settings from your notification preferences.
              Override by changing individual settings above.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || (alertType === 'indicator' && (!selectedIndicator || isLoadingConditions))}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded transition duration-200"
        >
          {isSubmitting ? (editMode ? 'Saving...' : 'Creating...') : (editMode ? 'Save Alert' : 'Create Alert')}
        </button>

        {/* Message */}
        {message && (
          <p className={`text-sm ${message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  )
}

export default AlertForm
