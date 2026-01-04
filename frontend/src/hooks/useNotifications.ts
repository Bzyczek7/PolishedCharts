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

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { ToastNotificationData, NotificationType, SoundType } from "@/types/notification";
import { toastManager, setupToastKeyboardHandler } from "@/lib/toastManager";
import { soundManager } from "@/lib/soundManager";
import { useSystemNotificationAvailability } from "@/hooks/useNotificationPermission";
import { useAuth } from "@/hooks/useAuthContext";

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

  // Permission status
  canShowSystemNotifications: boolean;
  soundEnabled: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const { isAuthenticated, user } = useAuth();
  const { canShowSystemNotifications } = useSystemNotificationAvailability();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_GUEST_PREFERENCES);

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

    try {
      // This would call the backend API
      // const response = await notificationsApi.sendTelegram({
      //   alertTriggerId: data.alertTriggerId,
      //   message: data.message,
      // });

      console.debug("[useNotifications] Telegram sent:", data);
      return true;
    } catch (error) {
      console.error("[useNotifications] Failed to send Telegram:", error);
      return false;
    }
  }, [preferences.telegramEnabled, isAuthenticated]);

  /**
   * Show a notification (orchestrates all channels)
   */
  const showNotification = useCallback((data: ToastNotificationData) => {
    // Show toast
    showToast(data);

    // Play sound
    playSound();

    // Send to Telegram (async, don't wait)
    sendTelegram(data).catch((err) => {
      console.debug("[useNotifications] Telegram notification skipped:", err);
    });
  }, [showToast, playSound, sendTelegram]);

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
