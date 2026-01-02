/**
 * Notifications API

Provides API functions for notification endpoints.

Base URL: /api/v1/notifications
*/

import axios from "axios";
import type {
  NotificationSettingsResponse,
  NotificationPreferenceUpdate,
  NotificationDeliveryListResponse,
  TelegramCredentialsValidate,
  TelegramValidationResult,
  TelegramTestResult,
} from "@/types/notification";

const api = axios.create({
  baseURL: "/api/v1/notifications",
});

// ============================================================================
// Settings Endpoints
// ============================================================================

/**
 * Get user's notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettingsResponse> {
  const response = await api.get("/settings");
  return response.data;
}

/**
 * Update user's notification settings
 */
export async function updateNotificationSettings(
  data: NotificationPreferenceUpdate
): Promise<NotificationSettingsResponse> {
  const response = await api.patch("/settings", data);
  return response.data;
}

// ============================================================================
// Telegram Endpoints
// ============================================================================

/**
 * Validate Telegram credentials (without saving)
 */
export async function validateTelegramCredentials(
  data: TelegramCredentialsValidate
): Promise<TelegramValidationResult> {
  const response = await api.post("/telegram/validate", data);
  return response.data;
}

/**
 * Test Telegram configuration (send test message)
 */
export async function testTelegramConfig(): Promise<TelegramTestResult> {
  const response = await api.post("/telegram/test");
  return response.data;
}

// ============================================================================
// History Endpoints
// ============================================================================

/**
 * Get notification history
 */
export async function getNotificationHistory(
  limit: number = 50,
  offset: number = 0
): Promise<NotificationDeliveryListResponse> {
  const response = await api.get("/history", {
    params: { limit, offset },
  });
  return response.data;
}

// ============================================================================
// Internal/Trigger Endpoints
// ============================================================================

/**
 * Send a notification (called by backend alert engine internally)
 * Note: This is typically called by the backend, not the frontend directly
 */
export async function sendNotification(
  alertTriggerId: number,
  notificationType: "toast" | "sound" | "telegram",
  message: string
): Promise<{ success: boolean }> {
  const response = await api.post("/send", {
    alert_trigger_id: alertTriggerId,
    notification_type: notificationType,
    message,
  });
  return response.data;
}
