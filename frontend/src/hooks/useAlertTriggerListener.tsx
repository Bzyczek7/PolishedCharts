/**
 * useAlertTriggerListener Hook

Listens for alert triggers and triggers notifications via the notification system.

This hook integrates with the alert system to:
- Listen for alert trigger events (custom events or WebSocket)
- Format alert trigger data for notification display
- Trigger toast, sound, and Telegram notifications

Usage:
    const { triggerNotification, isListening } = useAlertTriggerListener();

    // Call when an alert triggers (e.g., from WebSocket message or polling)
    triggerNotification({
        alertId: 123,
        alertName: "AAPL Above $150",
        symbol: "AAPL",
        condition: "Price above $150.00",
        currentValue: 151.23,
        triggeredAt: new Date().toISOString(),
    });

Integration with WebSocket:
    const { lastMessage } = useWebSocket();
    useEffect(() => {
        if (lastMessage?.data?.type === 'alert_trigger') {
            triggerNotification(lastMessage.data.payload);
        }
    }, [lastMessage]);
*/

import { useCallback, useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import type { ToastNotificationData, NotificationType } from "@/types/notification";
import { useNotifications } from "@/hooks/useNotifications";
import { ToastNotification } from "@/components/ToastNotification";

interface AlertTriggerPayload {
  alertId: number | string;
  alertName: string;
  symbol: string;
  condition: string;
  currentValue: number;
  triggeredAt: string;
  notificationTypes?: NotificationType[]; // Which notifications to send (defaults: all)
}

interface UseAlertTriggerListenerReturn {
  /** Trigger a notification for an alert */
  triggerNotification: (payload: AlertTriggerPayload) => void;
  /** Whether the listener is active */
  isListening: boolean;
  /** Start listening for alert triggers */
  startListening: () => void;
  /** Stop listening for alert triggers */
  stopListening: () => void;
  /** Number of triggers received */
  triggerCount: number;
}

/**
 * Hook to listen for alert triggers and trigger notifications
 */
export function useAlertTriggerListener(): UseAlertTriggerListenerReturn {
  const { showNotification, showToast, playSound, preferences } = useNotifications();
  const [isListening, setIsListening] = useState(false);
  const [triggerCount, setTriggerCount] = useState(0);
  const eventHandlerRef = useRef<((event: CustomEvent) => void) | null>(null);

  /**
   * Format alert trigger data into notification data
   */
  const formatNotificationData = useCallback(
    (payload: AlertTriggerPayload): ToastNotificationData => {
      const message = `${payload.symbol} - ${payload.condition}\nCurrent: ${payload.currentValue.toFixed(2)}`;

      return {
        alertName: payload.alertName,
        symbol: payload.symbol,
        message,
        triggeredAt: payload.triggeredAt,
        type: "toast", // Primary type for display
      };
    },
    []
  );

  /**
   * Trigger notification for an alert
   */
  const triggerNotification = useCallback(
    (payload: AlertTriggerPayload) => {
      const startTime = performance.now();
      const notificationTypes = payload.notificationTypes || ["toast", "sound", "telegram"];

      console.debug("[useAlertTriggerListener] Alert triggered:", payload.alertName);

      // Format notification data
      const toastData = formatNotificationData(payload);

      // Trigger each enabled notification type
      if (notificationTypes.includes("toast") && preferences.toastEnabled) {
        // Use custom toast component for better UX
        toast.custom(
          (t) => <ToastNotification toast={t} data={toastData} />,
          {
            duration: 5000,
            position: "top-right",
          }
        );
      }

      if (notificationTypes.includes("sound") && preferences.soundEnabled) {
        playSound();
      }

      if (notificationTypes.includes("telegram") && preferences.telegramEnabled) {
        // Telegram is fire-and-forget
        try {
          showToast(toastData);
        } catch (err) {
          console.debug("[useAlertTriggerListener] Telegram notification skipped:", err);
        }
      }

      // Update trigger count
      setTriggerCount((prev) => prev + 1);

      const duration = performance.now() - startTime;
      console.debug(
        `[useAlertTriggerListener] Notifications triggered in ${duration.toFixed(2)}ms for ${payload.alertName}`
      );
    },
    [formatNotificationData, preferences, showToast, playSound]
  );

  /**
   * Handle custom event for alert trigger
   */
  const handleAlertTrigger = useCallback(
    (event: CustomEvent) => {
      const payload = event.detail as AlertTriggerPayload;
      triggerNotification(payload);
    },
    [triggerNotification]
  );

  /**
   * Start listening for alert triggers
   */
  const startListening = useCallback(() => {
    if (isListening) return;

    // Set up custom event listener
    eventHandlerRef.current = handleAlertTrigger;
    window.addEventListener("alert-trigger", handleAlertTrigger as EventListener);

    // Set up visibility change listener for hybrid notifications
    const handleVisibilityChange = () => {
      if (!document.hidden && isListening) {
        // Tab became active - could process queued notifications here
        console.debug("[useAlertTriggerListener] Tab became active");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    setIsListening(true);
    console.debug("[useAlertTriggerListener] Started listening for alert triggers");
  }, [isListening, handleAlertTrigger]);

  /**
   * Stop listening for alert triggers
   */
  const stopListening = useCallback(() => {
    if (!isListening) return;

    // Remove event listener
    if (eventHandlerRef.current) {
      window.removeEventListener("alert-trigger", eventHandlerRef.current as EventListener);
      eventHandlerRef.current = null;
    }

    document.removeEventListener("visibilitychange", () => {
      // Cleanup handled by the reference
    });

    setIsListening(false);
    console.debug("[useAlertTriggerListener] Stopped listening for alert triggers");
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    triggerNotification,
    isListening,
    startListening,
    stopListening,
    triggerCount,
  };
}

/**
 * Helper function to dispatch an alert trigger event
 * Can be used by any part of the application to trigger a notification
 */
export function dispatchAlertTrigger(payload: AlertTriggerPayload): void {
  const event = new CustomEvent("alert-trigger", {
    detail: payload,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

/**
 * Hook to use alert notifications with automatic trigger detection
 * Combines useAlertTriggerListener with useNotifications for convenience
 */
export function useAlertNotifications() {
  const notifications = useNotifications();
  const triggerListener = useAlertTriggerListener();

  return {
    ...notifications,
    ...triggerListener,
    // Convenience method to create and dispatch a trigger
    createAlertTrigger: (payload: Omit<AlertTriggerPayload, "triggeredAt">) => {
      const fullPayload: AlertTriggerPayload = {
        ...payload,
        triggeredAt: new Date().toISOString(),
      };
      dispatchAlertTrigger(fullPayload);
    },
  };
}

export default useAlertTriggerListener;
