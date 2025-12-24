import React, { useState, useEffect } from 'react'
import {
  createAlert,
  type AlertCondition,
  getIndicatorConditions,
  type IndicatorCondition,
  type AlertCreate
} from '../api/alerts'
import { listIndicators, type IndicatorInfo } from '../api/indicators'

interface AlertFormProps {
  symbol: string
  symbolId?: number
  onAlertCreated?: (alert: any) => void
}

const priceConditionLabels: Record<string, string> = {
  above: 'Price Above (triggers when current > threshold AND previous <= threshold)',
  below: 'Price Below (triggers when current < threshold AND previous >= threshold)',
  crosses_up: 'Crosses Up (triggers when previous < threshold AND current >= threshold)',
  crosses_down: 'Crosses Down (triggers when previous > threshold AND current <= threshold)',
}

const AlertForm = ({ symbol, symbolId = 1, onAlertCreated }: AlertFormProps) => {
  // Form state
  const [alertType, setAlertType] = useState<'price' | 'indicator'>('price')
  const [condition, setCondition] = useState<AlertCondition>('above')
  const [threshold, setThreshold] = useState('')
  const [cooldown, setCooldown] = useState('')

  // Indicator alert state
  const [indicators, setIndicators] = useState<IndicatorInfo[]>([])
  const [selectedIndicator, setSelectedIndicator] = useState<string>('')
  const [indicatorConditions, setIndicatorConditions] = useState<IndicatorCondition[]>([])
  const [selectedField, setSelectedField] = useState<string>('')
  const [indicatorParams, setIndicatorParams] = useState<Record<string, string>>({})

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoadingIndicators, setIsLoadingIndicators] = useState(false)
  const [isLoadingConditions, setIsLoadingConditions] = useState(false)

  // Load available indicators on mount
  useEffect(() => {
    const loadIndicators = async () => {
      setIsLoadingIndicators(true)
      try {
        const data = await listIndicators()
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
          is_active: true
        }

        const result = await createAlert(alertData)
        setMessage('Alert created successfully!')
        setThreshold('')
        setCooldown('')
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
          is_active: true,
          indicator_name: selectedIndicator,
          indicator_field: selectedField,
          indicator_params: Object.keys(indicatorParams).length > 0 ? indicatorParams : undefined
        }

        const result = await createAlert(alertData)
        setMessage('Alert created successfully!')
        setThreshold('')
        setCooldown('')
        setIndicatorParams({})
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
                    {ind.name.toUpperCase()} - {ind.description}
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
            Cooldown (optional, seconds)
          </label>
          <input
            id="cooldown"
            type="number"
            min="0"
            step="1"
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 300 (5 minutes)"
          />
          <p className="text-xs text-slate-500 mt-1">Minimum time between alert triggers</p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || (alertType === 'indicator' && (!selectedIndicator || isLoadingConditions))}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded transition duration-200"
        >
          {isSubmitting ? 'Creating...' : 'Create Alert'}
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
