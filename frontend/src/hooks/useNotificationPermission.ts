/**
 * useNotificationPermission Hook

Manages browser notification permission state with localStorage persistence.
Follows UX MVP Standard:
- Request permission only after explicit user gesture
- No auto-reprompt if permission denied
- Store permission state in localStorage
- Re-verify on session start

Usage:
    const { isSupported, isGranted, requestPermission } = useNotificationPermission();
*/

import { useState, useEffect, useCallback } from "react";
import type { NotificationPermissionStatus } from "@/types/notification";

const LOCALSTORAGE_KEY = "notification_permission_state";
const PERMISSION_GRANTED = "granted";

/**
 * Check if browser supports the Notification API
 */
const checkIsSupported = (): boolean => {
  return typeof window !== "undefined" && "Notification" in window;
};

/**
 * Get current permission status from the Notification API
 */
const getCurrentPermission = (): NotificationPermissionStatus["state"] => {
  if (!checkIsSupported()) {
    return "unsupported";
  }

  // Notification.permission can be: 'granted', 'denied', or 'default'
  // We map 'default' to 'prompt' for consistency with our types
  const permission = Notification.permission;
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  return "prompt";
};

/**
 * Hook for managing notification permissions
 */
export function useNotificationPermission(): NotificationPermissionStatus & {
  requestPermission: () => Promise<boolean>;
  dismissDeniedMessage: () => void;
  shouldShowDeniedMessage: boolean;
} {
  const [status, setStatus] = useState<NotificationPermissionStatus>({
    isSupported: checkIsSupported(),
    state: "prompt",
    isGranted: false,
    isDenied: false,
  });

  const [shouldShowDeniedMessage, setShouldShowDeniedMessage] = useState(false);

  // Load persisted state on mount and verify with actual permission
  useEffect(() => {
    if (!checkIsSupported()) {
      setStatus((prev) => ({
        ...prev,
        isSupported: false,
        state: "unsupported",
        isGranted: false,
        isDenied: false,
      }));
      return;
    }

    // Check actual permission from browser
    const currentPermission = getCurrentPermission();

    // Check if we've shown the denied message before
    const hasSeenDeniedMessage = localStorage.getItem("notification_denied_shown") === "true";

    setStatus({
      isSupported: true,
      state: currentPermission,
      isGranted: currentPermission === "granted",
      isDenied: currentPermission === "denied",
    });

    // Show denied message if permission is denied and we haven't shown it
    if (currentPermission === "denied" && !hasSeenDeniedMessage) {
      setShouldShowDeniedMessage(true);
    }
  }, []);

  /**
   * Request notification permission
   * Only call this after explicit user gesture (button click)
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!checkIsSupported()) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();

      const newStatus: NotificationPermissionStatus["state"] =
        permission === "granted" ? "granted" :
        permission === "denied" ? "denied" : "prompt";

      setStatus({
        isSupported: true,
        state: newStatus,
        isGranted: newStatus === "granted",
        isDenied: newStatus === "denied",
      });

      // If denied, show the denied message
      if (newStatus === "denied") {
        setShouldShowDeniedMessage(true);
        localStorage.setItem("notification_denied_shown", "true");
      }

      return permission === "granted";
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }, []);

  /**
   * Dismiss the denied permission message
   */
  const dismissDeniedMessage = useCallback(() => {
    setShouldShowDeniedMessage(false);
    localStorage.setItem("notification_denied_shown", "true");
  }, []);

  return {
    ...status,
    requestPermission,
    dismissDeniedMessage,
    shouldShowDeniedMessage,
  };
}

/**
 * Hook for checking if we can show system notifications
 * Useful for determining whether to use Browser Notification API for background tab
 */
export function useSystemNotificationAvailability() {
  const { isSupported, isGranted } = useNotificationPermission();

  return {
    canShowSystemNotifications: isSupported && isGranted,
    shouldUseSystemNotifications: () => {
      // Only use system notifications if tab is hidden and we have permission
      if (typeof document === "undefined") {
        return false;
      }
      return isSupported && isGranted && document.hidden;
    },
  };
}
