/**
 * TypeScript Types for Notification System

Provides type definitions matching the backend Pydantic schemas for:
- NotificationPreference: Global user notification settings
- AlertNotificationSettings: Per-alert notification overrides
- NotificationDelivery: History records of sent notifications
- Telegram credential validation and testing

All types align with backend schemas for type-safe API integration.
 */

// =============================================================================
// Notification Enums
// =============================================================================

export type NotificationType = "toast" | "sound" | "telegram";

export type DeliveryStatus = "sent" | "failed" | "pending";

export type SoundType = "bell" | "alert" | "chime";

// =============================================================================
// Notification Preference Types
// =============================================================================

export interface NotificationPreferenceBase {
  /** Enable toast notifications */
  toastEnabled: boolean;
  /** Enable sound notifications */
  soundEnabled: boolean;
  /** Sound type: bell, alert, chime */
  soundType: SoundType | null;
  /** Enable Telegram notifications */
  telegramEnabled: boolean;
}

export interface NotificationPreference
  extends NotificationPreferenceBase {
  /** Preference identifier */
  id: string;
  /** User identifier */
  userId: string;
  /** Encrypted Telegram bot token (masked in response: ****abcd) */
  telegramTokenEncrypted: string | null;
  /** Encrypted Telegram chat ID (masked in response: ****1234) */
  telegramChatIdEncrypted: string | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

export interface NotificationPreferenceUpdate {
  /** Enable toast notifications */
  toastEnabled?: boolean;
  /** Enable sound notifications */
  soundEnabled?: boolean;
  /** Sound type: bell, alert, chime */
  soundType?: SoundType | null;
  /** Enable Telegram notifications */
  telegramEnabled?: boolean;
  /** Plaintext Telegram bot token (will be encrypted before storage) */
  telegramToken?: string | null;
  /** Plaintext Telegram chat ID (will be encrypted before storage) */
  telegramChatId?: string | null;
}

export interface NotificationSettingsResponse {
  /** User's notification preferences */
  preference: NotificationPreference | null;
  /** True if Telegram is configured */
  hasTelegramConfigured: boolean;
}

// =============================================================================
// Alert Notification Settings Types (Per-Alert Overrides)
// =============================================================================

export interface AlertNotificationSettingsBase {
  /** Enable toast notifications for this alert (null = use global default) */
  toastEnabled: boolean | null;
  /** Enable sound notifications for this alert (null = use global default) */
  soundEnabled: boolean | null;
  /** Alert-specific sound type (null = use global) */
  soundType: SoundType | null;
  /** Enable Telegram notifications for this alert (null = use global default) */
  telegramEnabled: boolean | null;
}

export interface AlertNotificationSettings extends AlertNotificationSettingsBase {
  /** Settings identifier */
  id: string;
  /** Alert identifier */
  alertId: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

export interface AlertNotificationSettingsUpdate {
  /** Enable/disable toast notifications (null = use global default) */
  toastEnabled?: boolean | null;
  /** Enable/disable sound notifications (null = use global default) */
  soundEnabled?: boolean | null;
  /** Alert-specific sound type */
  soundType?: SoundType | null;
  /** Enable/disable Telegram notifications (null = use global default) */
  telegramEnabled?: boolean | null;
}

// =============================================================================
// Notification Delivery Types (History Records)
// =============================================================================

export interface NotificationDelivery {
  /** Delivery identifier */
  id: string;
  /** FK to AlertTrigger (Integer) */
  alertTriggerId: number;
  /** Denormalized alert ID for query efficiency */
  alertId: string;
  /** User who owns the alert */
  userId: number;
  /** Type of notification: toast, sound, telegram */
  notificationType: NotificationType;
  /** Delivery status: sent, failed, pending */
  status: DeliveryStatus;
  /** When alert triggered */
  triggeredAt: string;
  /** Content sent (for history display) */
  message: string | null;
  /** Error details if status is failed */
  errorMessage: string | null;
  /** Alert name for display */
  alertName?: string;
  /** Symbol for display */
  symbol?: string;
}

export interface NotificationDeliveryListResponse {
  /** List of notification deliveries */
  items: NotificationDelivery[];
  /** Total number of records */
  total: number;
  /** Records per page */
  limit: number;
  /** Offset for pagination */
  offset: number;
}

// =============================================================================
// Telegram Credential Validation Types
// =============================================================================

export interface TelegramCredentialsValidate {
  /** Telegram bot token */
  telegramToken: string;
  /** Telegram chat ID */
  telegramChatId: string;
}

export interface TelegramValidationResult {
  /** Whether credentials are valid */
  valid: boolean;
  /** Error message if invalid */
  errorMessage: string | null;
  /** Bot username if valid */
  botUsername: string | null;
}

export interface TelegramTestResult {
  /** Whether test succeeded */
  success: boolean;
  /** Message ID if successful */
  messageId: string | null;
  /** Error message if failed */
  errorMessage: string | null;
}

// =============================================================================
// Send Notification Types
// =============================================================================

export interface SendNotificationRequest {
  /** ID of the triggered alert (Integer) */
  alertTriggerId: number;
  /** Type of notification to send */
  notificationType: NotificationType;
  /** Notification message content */
  message: string;
}

export interface SendNotificationResponse {
  /** Whether sending succeeded */
  success: boolean;
  /** ID of NotificationDelivery record */
  notificationDeliveryId: string | null;
  /** Error message if failed */
  errorMessage: string | null;
}

// =============================================================================
// Frontend-Specific Types
// =============================================================================

/**
 * Notification preferences stored in localStorage for guests
 */
export interface GuestNotificationPreferences {
  toastEnabled: boolean;
  soundEnabled: boolean;
  soundType: SoundType;
}

/**
 * Toast notification display data
 */
export interface ToastNotificationData {
  /** Alert name */
  alertName: string;
  /** Symbol (e.g., AAPL) */
  symbol: string;
  /** Trigger condition message */
  message: string;
  /** When the alert triggered */
  triggeredAt: string;
  /** Notification type for logging */
  type: NotificationType;
}

/**
 * Notification permission state
 */
export type NotificationPermissionState = "granted" | "denied" | "prompt" | "unsupported";

/**
 * Browser notification permission status
 */
export interface NotificationPermissionStatus {
  /** Whether browser supports notifications */
  isSupported: boolean;
  /** Current permission state */
  state: NotificationPermissionState;
  /** Whether user has granted permission */
  isGranted: boolean;
  /** Whether user has denied permission */
  isDenied: boolean;
}
