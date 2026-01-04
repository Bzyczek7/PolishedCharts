/**
 * useNotifications Hook

Orchestrates all notification channels:
- Toast notifications (react-hot-toast + Browser Notification API)
- Sound notifications (HTML5 Audio)
- Telegram notifications (via backend API)

Handles:
- Hybrid toast logic (active tab vs background tab)
- Global vs per-alert settings override
- Guest preferences in localStorage
- Notification delivery logging

Usage:
    const { showNotification, preferences } = useNotifications();
    showNotification({ alertName, symbol, message, type: 'toast' });
*/

import { useCallback, useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import type { ToastNotificationData, NotificationType, SoundType, AlertNotificationSettingsUpdate } from "@/types/notification";
import { toastManager, setupToastKeyboardHandler } from "@/lib/toastManager";
import { soundManager } from "@/lib/soundManager";
import { useSystemNotificationAvailability } from "@/hooks/useNotificationPermission";
import { useAuth } from "@/hooks/useAuthContext";
import { sendNotification } from "@/api/notifications";

/**
 * Merge global preferences with per-alert settings.
 * Per-alert settings override global where not null.
 */
function resolveEffectivePreferences(
  globalPrefs: NotificationPreferences,
  alertSettings: AlertNotificationSettingsUpdate | null
): NotificationPreferences {
  return {
    toastEnabled: alertSettings?.toastEnabled ?? globalPrefs.toastEnabled,
    soundEnabled: alertSettings?.soundEnabled ?? globalPrefs.soundEnabled,
    soundType: alertSettings?.soundType ?? globalPrefs.soundType,
    telegramEnabled: alertSettings?.telegramEnabled ?? globalPrefs.telegramEnabled,
  };
}

// Default preferences for guests
const DEFAULT_GUEST_PREFERENCES = {
  toastEnabled: true,
  soundEnabled: false,
  soundType: "bell" as SoundType,
  telegramEnabled: false,
};

const LOCALSTORAGE_GUEST_PREFS = "guest_notification_prefs";

interface NotificationPreferences {
  toastEnabled: boolean;
  soundEnabled: boolean;
  soundType: SoundType;
  telegramEnabled: boolean;
}

interface UseNotificationsReturn {
  // Show a notification
  showNotification: (data: ToastNotificationData) => void;
  showToast: (data: ToastNotificationData) => void;
  playSound: (soundType?: SoundType) => void;
  sendTelegram: (data: ToastNotificationData) => Promise<boolean>;

  // Preferences
  preferences: NotificationPreferences;
  updatePreferences: (updates: Partial<NotificationPreferences>) => void;
  loadPreferences: () => void;

  // Per-alert settings
  setAlertSettings: (alertId: string, settings: AlertNotificationSettingsUpdate | null) => void;

  // Permission status
  canShowSystemNotifications: boolean;
  soundEnabled: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const { isAuthenticated, user } = useAuth();
  const { canShowSystemNotifications } = useSystemNotificationAvailability();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_GUEST_PREFERENCES);
  // Per-alert settings cache: alertId -> settings (null = use global)
  const alertSettingsRef = useRef<Map<string, AlertNotificationSettingsUpdate | null>>(new Map());

  // Load preferences on mount and auth change
  useEffect(() => {
    loadPreferences();
  }, [isAuthenticated, user]);

  // Set up keyboard handler for toast dismissal
  useEffect(() => {
    const cleanup = setupToastKeyboardHandler();
    return cleanup;
  }, []);

  /**
   * Load preferences from storage
   */
  const loadPreferences = useCallback(() => {
    if (isAuthenticated && user) {
      // For authenticated users, fetch from backend
      // This would call the settings API endpoint
      // For now, we'll use localStorage as fallback
      const stored = localStorage.getItem(`notification_prefs_${user.uid}`);
      if (stored) {
        try {
          setPreferences(JSON.parse(stored));
        } catch (e) {
          console.error("[useNotifications] Failed to parse preferences:", e);
        }
      }
    } else {
      // For guests, use localStorage
      const stored = localStorage.getItem(LOCALSTORAGE_GUEST_PREFS);
      if (stored) {
        try {
          setPreferences(JSON.parse(stored));
        } catch (e) {
          console.error("[useNotifications] Failed to parse guest preferences:", e);
        }
      } else {
        setPreferences(DEFAULT_GUEST_PREFERENCES);
      }
    }
  }, [isAuthenticated, user]);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...updates };

      if (isAuthenticated && user) {
        localStorage.setItem(`notification_prefs_${user.uid}`, JSON.stringify(updated));
      } else {
        localStorage.setItem(LOCALSTORAGE_GUEST_PREFS, JSON.stringify(updated));
      }

      return updated;
    });
  }, [isAuthenticated, user]);

  /**
   * Show a toast notification (hybrid: active tab + background)
   */
  const showToast = useCallback((data: ToastNotificationData) => {
    if (!preferences.toastEnabled) {
      return;
    }

    // Determine which notification method to use
    const isTabActive = !document.hidden;

    if (isTabActive) {
      // Active tab: use react-hot-toast
      toast(data.message, {
        duration: 5000,
        icon: "🔔",
        ariaProps: {
          role: "alert",
          "aria-live": "polite",
        },
      });
    } else {
      // Background tab: use Browser Notification API
      if (canShowSystemNotifications) {
        const notification = new Notification(data.alertName, {
          body: data.message,
          icon: "/favicon.ico", // Could use a custom notification icon
          tag: `${data.alertName}-${data.symbol}`,
          requireInteraction: false,
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      }
    }

    // Log for history (could send to backend)
    console.debug("[useNotifications] Toast shown:", data);
  }, [preferences.toastEnabled, canShowSystemNotifications]);

  /**
   * Play a notification sound
   */
  const playSound = useCallback((soundType?: SoundType) => {
    if (!preferences.soundEnabled) {
      return;
    }

    const soundToPlay = soundType || preferences.soundType;
    soundManager.play(soundToPlay);
  }, [preferences.soundEnabled, preferences.soundType]);

  /**
   * Send a Telegram notification
   */
  const sendTelegram = useCallback(async (data: ToastNotificationData): Promise<boolean> => {
    if (!preferences.telegramEnabled) {
      return false;
    }

    if (!isAuthenticated) {
      console.warn("[useNotifications] Telegram requires authentication");
      return false;
    }

    if (!data.alertTriggerId) {
      console.warn("[useNotifications] No alertTriggerId, skipping Telegram");
      return false;
    }

    try {
      const result = await sendNotification(data.alertTriggerId, 'telegram', data.message);
      console.debug("[useNotifications] Telegram notification sent:", result);
      return result.success;
    } catch (error) {
      console.error("[useNotifications] Failed to send Telegram notification:", error);
      return false;
    }
  }, [preferences.telegramEnabled, isAuthenticated]);

  /**
   * Show a notification (orchestrates all channels)
   * Uses per-alert settings if available, falls back to global preferences
   */
  const showNotification = useCallback((data: ToastNotificationData) => {
    // Get per-alert settings if alertId is provided
    const alertSettings = data.alertId ? alertSettingsRef.current.get(data.alertId) : null;
    const effectivePrefs = resolveEffectivePreferences(preferences, alertSettings);

    // Show toast if enabled
    if (effectivePrefs.toastEnabled) {
      showToast(data);
    }

    // Play sound if enabled (use per-alert soundType if specified)
    if (effectivePrefs.soundEnabled) {
      playSound(effectivePrefs.soundType);
    }

    // Send to Telegram if enabled (async, don't wait)
    if (effectivePrefs.telegramEnabled) {
      sendTelegram(data).catch((err) => {
        console.debug("[useNotifications] Telegram notification skipped:", err);
      });
    }
  }, [preferences, showToast, playSound, sendTelegram]);

  /**
   * Set per-alert notification settings
   * Called by components that manage per-alert settings
   */
  const setAlertSettings = useCallback((alertId: string, settings: AlertNotificationSettingsUpdate | null) => {
    alertSettingsRef.current.set(alertId, settings);
  }, []);

  return {
    showNotification,
    showToast,
    playSound,
    sendTelegram,
    preferences,
    updatePreferences,
    loadPreferences,
    canShowSystemNotifications,
    soundEnabled: preferences.soundEnabled,
    setAlertSettings,
  };
}

/**
 * Hook to get notification preferences
 */
export function useNotificationPreferences() {
  const { preferences, updatePreferences, loadPreferences } = useNotifications();

  return {
    preferences,
    updatePreferences,
    reload: loadPreferences,
    enableToast: () => updatePreferences({ toastEnabled: true }),
    disableToast: () => updatePreferences({ toastEnabled: false }),
    enableSound: () => updatePreferences({ soundEnabled: true }),
    disableSound: () => updatePreferences({ soundEnabled: false }),
    setSoundType: (type: SoundType) => updatePreferences({ soundType: type }),
    enableTelegram: () => updatePreferences({ telegramEnabled: true }),
    disableTelegram: () => updatePreferences({ telegramEnabled: false }),
  };
}
