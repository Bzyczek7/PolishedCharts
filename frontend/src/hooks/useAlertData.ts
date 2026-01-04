/**
 * Hook for managing alert data with guest/authenticated mode support.
 *
 * Feature: 011-firebase-auth
 * User Story 3: Guest Access with Optional Sign-In
 *
 * Provides a unified interface for creating and managing alerts that:
 * - Saves to localStorage when in guest mode
 * - Sends to backend API when authenticated
 * - Handles the merge transition from guest to authenticated
 */

import { useCallback } from 'react'
import { useAuth } from '../hooks/useAuthContext'
import {
  createAlert as apiCreateAlert,
  listAlerts,
  deleteAlert as apiDeleteAlert,
  type AlertCreate,
  type Alert,
} from '../api/alerts'
import {
  saveGuestAlert,
  getGuestAlerts,
  deleteGuestAlert,
} from '../api/alerts'
import type { GuestAlert } from '../types/auth'

// =============================================================================
// Types
// =============================================================================

interface UseAlertDataReturn {
  /** Create a new alert (saves to localStorage if guest, API if authenticated) */
  createAlert: (alert: AlertCreate, symbol: string) => Promise<Alert | GuestAlert>
  /** List alerts (from localStorage if guest, API if authenticated) */
  getAlerts: (symbol?: string) => Promise<Alert[] | GuestAlert[]>
  /** Delete an alert */
  deleteAlert: (alertId: number | string) => Promise<void>
  /** Whether user is in guest mode */
  isGuest: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing alert data with guest/authenticated mode support.
 *
 * @example
 * ```tsx
 * const { createAlert, getAlerts, isGuest } = useAlertData()
 *
 * // Creating an alert works the same regardless of auth state
 * await createAlert({ symbol: 'AAPL', condition: 'above', threshold: 150 }, 'AAPL')
 *
 * // Guest mode: saves to localStorage
 * // Authenticated: sends to backend API
 * ```
 */
export function useAlertData(): UseAlertDataReturn {
  const { isAuthenticated, user } = useAuth()

  const isGuest = !isAuthenticated || !user

  /**
   * Create a new alert.
   *
   * - Guest mode: Saves to localStorage
   * - Authenticated: Sends to backend API
   */
  const createAlert = useCallback(async (
    alert: AlertCreate,
    symbol: string
  ): Promise<Alert | GuestAlert> => {
    if (isGuest) {
      // Guest mode: save to localStorage
      const guestAlert = saveGuestAlert(alert, symbol)
      return guestAlert
    } else {
      // Authenticated: send to backend API
      const apiAlert = await apiCreateAlert(alert)
      return apiAlert
    }
  }, [isGuest])

  /**
   * List alerts.
   *
   * - Guest mode: Returns from localStorage
   * - Authenticated: Fetches from backend API
   */
  const getAlerts = useCallback(async (
    symbol?: string
  ): Promise<Alert[] | GuestAlert[]> => {
    if (isGuest) {
      // Guest mode: return from localStorage
      const guestAlerts = getGuestAlerts()
      if (symbol) {
        return guestAlerts.filter(a => a.symbol === symbol)
      }
      return guestAlerts
    } else {
      // Authenticated: fetch from backend API
      const apiAlerts = await listAlerts({ symbol })
      return apiAlerts
    }
  }, [isGuest])

  /**
   * Delete an alert.
   *
   * - Guest mode: Removes from localStorage
   * - Authenticated: Deletes via backend API
   */
  const deleteAlert = useCallback(async (
    alertId: number | string
  ): Promise<void> => {
    if (isGuest) {
      // Guest mode: delete from localStorage (alertId is UUID string)
      deleteGuestAlert(alertId as string)
    } else {
      // Authenticated: delete via backend API (alertId is number)
      await apiDeleteAlert(alertId as number)
    }
  }, [isGuest])

  return {
    createAlert,
    getAlerts,
    deleteAlert,
    isGuest,
    isAuthenticated,
  }
}

export default useAlertData
