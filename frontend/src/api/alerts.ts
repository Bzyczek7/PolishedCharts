import client from './client'
import type { GuestAlert, AlertCondition as GuestAlertCondition } from '../types/auth'
import type { AlertNotificationSettingsUpdate } from '../types/notification'
import { createAuthenticatedAxios } from '@/services/authService'

export type AlertCondition =
  | 'above'
  | 'below'
  | 'crosses_up'
  | 'crosses_down'
  | 'indicator_above_upper'
  | 'indicator_below_lower'
  | 'indicator_crosses_upper'
  | 'indicator_crosses_lower'
  | 'indicator_turns_positive'
  | 'indicator_turns_negative'
  | 'indicator_slope_bullish'
  | 'indicator_slope_bearish'
  | 'indicator_signal_change'
  | 'crsi_band_extremes'

export type AlertTriggerMode =
  | 'once'
  | 'once_per_bar'
  | 'once_per_bar_close'

// =============================================================================
// Guest Alert Storage (localStorage)
// =============================================================================

/**
 * Convert AlertCreate to GuestAlert for localStorage storage.
 * Maps between API format and guest format.
 */
function toGuestAlert(alert: AlertCreate, symbol: string): GuestAlert {
  // Map API conditions to guest conditions
  const conditionMap: Record<string, GuestAlertCondition> = {
    'above': 'above',
    'below': 'below',
    'crosses_up': 'crosses-up',
    'crosses_down': 'crosses-down',
    // Indicator conditions map to 'above' for guest mode (simplified)
    'indicator_crosses_upper': 'above',
    'indicator_crosses_lower': 'below',
    'indicator_turns_positive': 'above',
    'indicator_turns_negative': 'below',
    'indicator_slope_bullish': 'above',
    'indicator_slope_bearish': 'below',
    'indicator_signal_change': 'above',
  }

  const now = new Date().toISOString()

  return {
    uuid: crypto.randomUUID(),
    symbol,
    condition: conditionMap[alert.condition] || 'above',
    target: alert.threshold ?? 0,
    enabled: alert.is_active ?? true,
    created_at: now,
    updated_at: now,
  }
}

/**
 * Save guest alert to localStorage.
 * Called when user is in guest mode (not authenticated).
 */
export function saveGuestAlert(alert: AlertCreate, symbol: string): GuestAlert {
  const STORAGE_KEY = 'polishedcharts_data'

  // Get existing localStorage data
  const raw = localStorage.getItem(STORAGE_KEY)
  let data: any = { schemaVersion: 1, alerts: [], watchlist: { uuid: '', symbols: [], sort_order: [], created_at: '', updated_at: '' }, layouts: [] }

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch (e) {
      console.error('Failed to parse localStorage:', e)
    }
  }

  // Ensure schema structure
  if (!data.alerts) data.alerts = []
  if (!data.schemaVersion) data.schemaVersion = 1

  // Create guest alert
  const guestAlert = toGuestAlert(alert, symbol)

  // Add to alerts array
  data.alerts.push(guestAlert)
  data.updated_at = new Date().toISOString()

  // Save back to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

  return guestAlert
}

/**
 * Get guest alerts from localStorage.
 */
export function getGuestAlerts(): GuestAlert[] {
  const STORAGE_KEY = 'polishedcharts_data'
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) return []

  try {
    const data = JSON.parse(raw)
    return data.alerts || []
  } catch (e) {
    console.error('Failed to parse guest alerts:', e)
    return []
  }
}

/**
 * Delete guest alert from localStorage by UUID.
 */
export function deleteGuestAlert(uuid: string): void {
  const STORAGE_KEY = 'polishedcharts_data'
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.alerts) {
      data.alerts = data.alerts.filter((a: GuestAlert) => a.uuid !== uuid)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (e) {
    console.error('Failed to delete guest alert:', e)
  }
}

/**
 * Alert with all backend fields including TradingView-style alert features
 */
export interface Alert {
  id: number
  symbol_id: number
  symbol_ticker?: string  // Added for frontend display
  symbol?: string  // Computed from symbol_ticker for frontend compatibility
  condition: string
  threshold: number | null
  is_active: boolean
  interval?: string  // Timeframe: '1d', '1h', '15m', etc.
  cooldown?: number
  created_at: string
  last_triggered_at?: string | null
  // Trigger mode: once, once_per_bar, once_per_bar_close
  trigger_mode?: AlertTriggerMode
  // Computed label (e.g., "cRSI(20) band cross")
  alert_label?: string
  // Indicator fields
  indicator_name?: string | null
  indicator_field?: string | null
  indicator_params?: Record<string, number | string> | null
  // Direction-specific trigger messages (legacy cRSI format)
  message_upper?: string
  message_lower?: string
  // Flexible messages map (new format)
  messages?: Record<string, string>
  // Enabled conditions (maps condition_type to enabled state)
  enabled_conditions?: Record<string, boolean>
}

/**
 * Alert trigger event with trigger_type and trigger_message
 */
export interface AlertTrigger {
  id: number
  alert_id: number
  triggered_at: string
  observed_price: number | null
  indicator_value?: number | null
  // Direction-specific tracking
  trigger_type?: 'upper' | 'lower'  // Which condition fired
  trigger_message?: string           // Message used for this trigger
  alert_label?: string               // Computed label for display
  delivery_status?: string
  retry_count?: number
  last_retry_at?: string
}

/**
 * Form data for creating a new indicator alert
 */
export interface IndicatorAlertFormData {
  symbol: string
  indicator_name: string
  indicator_field: string
  indicator_params: Record<string, number | string>
  // Flexible enabled conditions - maps condition_type to enabled state
  // e.g., { "indicator_crosses_upper": true, "indicator_crosses_lower": true }
  // or { "indicator_turns_positive": true, "indicator_turns_negative": false }
  enabled_conditions: Record<string, boolean>
  // Flexible messages - maps condition_type to message
  // e.g., { "indicator_crosses_upper": "Time to sell!", "indicator_crosses_lower": "Time to buy!" }
  messages: Record<string, string>
  // Cooldown in seconds (default: 60, minimum: 5)
  cooldown: number
}

export interface AlertCreate {
  symbol?: string           // Symbol ticker (e.g., "AAPL") - preferred, will be resolved by backend
  symbol_id?: number        // Numeric ID - alternative to symbol
  condition: AlertCondition | string
  threshold?: number
  is_active?: boolean
  interval?: string         // Timeframe: '1d', '1h', '15m', '5m', '1m', etc.
  cooldown?: number
  trigger_mode?: AlertTriggerMode  // Trigger mode: once, once_per_bar, once_per_bar_close
  // Indicator fields
  indicator_name?: string
  indicator_field?: string
  indicator_params?: Record<string, number | string>
  // Direction-specific trigger messages (legacy cRSI format)
  message_upper?: string
  message_lower?: string
  // Flexible messages map (new format - takes priority)
  messages?: Record<string, string>
  // Enabled conditions (maps condition_type to enabled state)
  enabled_conditions?: Record<string, boolean>
}

export interface AlertUpdate {
  condition?: AlertCondition | string
  threshold?: number
  is_active?: boolean
  cooldown?: number
  trigger_mode?: AlertTriggerMode
  indicator_name?: string
  indicator_field?: string
  indicator_params?: Record<string, number | string>
  message_upper?: string
  message_lower?: string
  messages?: Record<string, string>
  enabled_conditions?: Record<string, boolean>
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

/**
 * List alerts with optional symbol and active status filtering
 * @param symbol - Symbol string (e.g., "AAPL") - preferred over symbolId
 * @param symbolId - Symbol ID (numeric) - alternative to symbol
 * @param isActive - Filter by active status
 */
export const listAlerts = async (options?: {
  symbol?: string
  symbolId?: number
  isActive?: boolean
}): Promise<Alert[]> => {
  const params: Record<string, any> = {}
  if (options?.symbol !== undefined) params.symbol = options.symbol
  if (options?.symbolId !== undefined) params.symbol_id = options.symbolId
  if (options?.isActive !== undefined) params.is_active = options.isActive
  const response = await client.get<Alert[]>('/alerts/', { params })
  return response.data
}

// Alias for backward compatibility
export const getAlerts = listAlerts

export const getAlert = async (alertId: number): Promise<Alert> => {
  const response = await client.get<Alert>(`/alerts/${alertId}`)
  return response.data
}

export const updateAlert = async (alertId: number, updates: AlertUpdate): Promise<Alert> => {
  const response = await client.put<Alert>(`/alerts/${alertId}`, updates)
  return response.data
}

/**
 * Mute an alert (prevent it from creating trigger events)
 */
export const muteAlert = async (alertId: number): Promise<Alert> => {
  const response = await client.post<Alert>(`/alerts/${alertId}/mute`)
  return response.data
}

/**
 * Unmute an alert (allow it to create trigger events again)
 */
export const unmuteAlert = async (alertId: number): Promise<Alert> => {
  const response = await client.post<Alert>(`/alerts/${alertId}/unmute`)
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

/**
 * Get recent alert triggers for the global Log tab
 * @param options - Filtering options
 */
export const getRecentTriggers = async (options?: {
  symbol?: string
  symbolId?: number
  limit?: number
  offset?: number
}): Promise<AlertTrigger[]> => {
  const params: Record<string, any> = {
    limit: options?.limit ?? 500,
    offset: options?.offset ?? 0,
  }
  if (options?.symbol !== undefined) params.symbol = options.symbol
  else if (options?.symbolId !== undefined) params.symbol_id = options.symbolId
  const response = await client.get<AlertTrigger[]>('/alerts/triggers/recent', { params })
  return response.data
}

/**
 * Delete a specific alert trigger (log entry)
 * DELETE /api/v1/alerts/triggers/{trigger_id}
 */
export const deleteTrigger = async (triggerId: number): Promise<void> => {
  await client.delete(`/alerts/triggers/${triggerId}`)
}

/**
 * Get available alert conditions for a specific indicator
 * GET /api/v1/alerts/indicator-conditions?indicator_name=crsi
 */
export const getIndicatorConditions = async (indicatorName: string): Promise<IndicatorConditionResponse> => {
  const response = await client.get<IndicatorConditionResponse>('/alerts/indicator-conditions', {
    params: {
      indicator_name: indicatorName,
      _t: Date.now()  // Cache-busting timestamp
    }
  })
  return response.data
}

/**
 * Update notification settings for an alert
 * PATCH /api/v1/notifications/alert-settings/{alert_id}
 */
export const updateAlertNotificationSettings = async (
  alertId: string,
  settings: AlertNotificationSettingsUpdate
): Promise<void> => {
  const authClient = await createAuthenticatedAxios()
  await authClient.patch(`/notifications/alert-settings/${alertId}`, settings)
}

/**
 * Get notification settings for an alert
 * GET /api/v1/notifications/alert-settings/{alert_id}
 */
export const getAlertNotificationSettings = async (alertId: string): Promise<AlertNotificationSettingsUpdate> => {
  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get(`/notifications/alert-settings/${alertId}`)
  return response.data
}
