import client from './client'

export type AlertCondition =
  | 'above'
  | 'below'
  | 'crosses_up'
  | 'crosses_down'
  | 'indicator_crosses_upper'
  | 'indicator_crosses_lower'
  | 'indicator_turns_positive'
  | 'indicator_turns_negative'
  | 'indicator_slope_bullish'
  | 'indicator_slope_bearish'
  | 'indicator_signal_change'

export interface Alert {
  id: number
  symbol_id: number
  condition: string
  threshold: number | null
  is_active: boolean
  cooldown?: number
  created_at: string
  // Indicator fields
  indicator_name?: string | null
  indicator_field?: string | null
  indicator_params?: Record<string, number | string> | null
}

export interface AlertTrigger {
  id: number
  alert_id: number
  triggered_at: string
  observed_price: number | null
  indicator_value?: number | null
  delivery_status?: string
  retry_count?: number
  last_retry_at?: string
}

export interface AlertCreate {
  symbol_id: number
  condition: AlertCondition | string
  threshold?: number
  is_active?: boolean
  cooldown?: number
  // Indicator fields
  indicator_name?: string
  indicator_field?: string
  indicator_params?: Record<string, number | string>
}

export interface AlertUpdate {
  condition?: AlertCondition | string
  threshold?: number
  is_active?: boolean
  cooldown?: number
  indicator_name?: string
  indicator_field?: string
  indicator_params?: Record<string, number | string>
}

/**
 * Response from GET /api/v1/alerts/indicator-conditions
 */
export interface IndicatorConditionResponse {
  indicator_name: string
  conditions: IndicatorCondition[]
}

/**
 * Single indicator condition template
 */
export interface IndicatorCondition {
  condition_type: string
  label: string
  description: string
  requires_threshold: boolean
  applicable_fields: string[]
}

export const createAlert = async (alert: AlertCreate): Promise<Alert> => {
  const response = await client.post<Alert>('/alerts/', alert)
  return response.data
}

export const getAlerts = async (symbolId?: number, isActive?: boolean): Promise<Alert[]> => {
  const params: Record<string, any> = {}
  if (symbolId !== undefined) params.symbol_id = symbolId
  if (isActive !== undefined) params.is_active = isActive
  const response = await client.get<Alert[]>('/alerts/', { params })
  return response.data
}

export const getAlert = async (alertId: number): Promise<Alert> => {
  const response = await client.get<Alert>(`/alerts/${alertId}`)
  return response.data
}

export const updateAlert = async (alertId: number, updates: AlertUpdate): Promise<Alert> => {
  const response = await client.put<Alert>(`/alerts/${alertId}`, updates)
  return response.data
}

export const deleteAlert = async (alertId: number): Promise<void> => {
  await client.delete(`/alerts/${alertId}`)
}

export const getAlertTriggers = async (alertId: number, limit: number = 100): Promise<AlertTrigger[]> => {
  const response = await client.get<AlertTrigger[]>(`/alerts/${alertId}/triggers`, {
    params: { limit }
  })
  return response.data
}

export const getRecentTriggers = async (symbolId?: number, limit: number = 100): Promise<AlertTrigger[]> => {
  const params: Record<string, any> = { limit }
  if (symbolId !== undefined) params.symbol_id = symbolId
  const response = await client.get<AlertTrigger[]>('/alerts/triggers/recent', { params })
  return response.data
}

/**
 * Get available alert conditions for a specific indicator
 * GET /api/v1/alerts/indicator-conditions?indicator_name=crsi
 */
export const getIndicatorConditions = async (indicatorName: string): Promise<IndicatorConditionResponse> => {
  const response = await client.get<IndicatorConditionResponse>('/alerts/indicator-conditions', {
    params: { indicator_name: indicatorName }
  })
  return response.data
}
