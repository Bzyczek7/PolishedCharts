/**
 * ToastNotification Component

Custom toast component for react-hot-toast that displays alert notifications.

Features:
- Shows alert name, symbol, and trigger condition
- WCAG 2.1 AA compliant (ARIA labels, keyboard navigation)
- Keyboard dismissible (Escape key)
- Maximum 100 characters with truncation indicator
- Visual indicator for notification type (toast/sound/Telegram)

Usage with react-hot-toast:
    toast.custom((t) => <ToastNotification toast={t} data={data} />, {
        duration: 5000,
    });

Or use the standalone version:
    <ToastNotificationStandalone data={notificationData} onDismiss={handleDismiss} />
*/

import { useEffect, useCallback } from "react";
import type { Toast, ToastNotificationData } from "@/types/notification";

interface ToastNotificationProps {
  toast: Toast;
  data: ToastNotificationData;
  onDismiss?: (id: string) => void;
}

/**
 * ToastNotification component for use with react-hot-toast
 */
export function ToastNotification({ toast, data, onDismiss }: ToastNotificationProps) {
  // Handle keyboard dismiss
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !toast.visible) {
        return;
      }
      if (event.key === "Escape") {
        if (onDismiss) {
          onDismiss(toast.id);
        } else {
          toast.remove();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toast, onDismiss]);

  // Get notification type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sound":
        return "🔔";
      case "telegram":
        return "📱";
      default:
        return "🔔";
    }
  };

  // Truncate message if needed
  const MAX_MESSAGE_LENGTH = 100;
  const isTruncated = data.message.length > MAX_MESSAGE_LENGTH;
  const displayMessage = isTruncated
    ? data.message.slice(0, MAX_MESSAGE_LENGTH - 3) + "..."
    : data.message;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`
        flex items-start gap-3 p-4 rounded-lg shadow-lg border
        max-w-sm w-full
        bg-white dark:bg-gray-800
        border-gray-200 dark:border-gray-700
        ${toast.visible ? "animate-enter" : "animate-leave"}
      `}
      style={{
        ...toast.style,
      }}
      data-toast-id={toast.id}
    >
      {/* Icon */}
      <span className="text-xl flex-shrink-0" aria-hidden="true">
        {getTypeIcon(data.type)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
            {data.alertName}
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {data.symbol}
          </span>
        </div>
        <p
          className="text-sm text-gray-600 dark:text-gray-300 mt-1"
          title={isTruncated ? data.message : undefined}
        >
          {displayMessage}
          {isTruncated && (
            <span
              className="ml-1 cursor-help text-blue-500 dark:text-blue-400"
              title={data.message}
            >
              (more)
            </span>
          )}
        </p>
        <time
          className="text-xs text-gray-400 dark:text-gray-500 mt-1 block"
          dateTime={data.triggeredAt}
        >
          {new Date(data.triggeredAt).toLocaleTimeString()}
        </time>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => {
          if (onDismiss) {
            onDismiss(toast.id);
          } else {
            toast.remove();
          }
        }}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700
                   text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                   focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-label={`Dismiss notification for ${data.alertName}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Standalone ToastNotification for use outside react-hot-toast
 */
interface StandaloneToastNotificationProps {
  data: ToastNotificationData;
  onDismiss: () => void;
  duration?: number;
}

export function StandaloneToastNotification({
  data,
  onDismiss,
  duration = 5000,
}: StandaloneToastNotificationProps) {
  useEffect(() => {
    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  // Get notification type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sound":
        return "🔔";
      case "telegram":
        return "📱";
      default:
        return "🔔";
    }
  };

  // Truncate message if needed
  const MAX_MESSAGE_LENGTH = 100;
  const isTruncated = data.message.length > MAX_MESSAGE_LENGTH;
  const displayMessage = isTruncated
    ? data.message.slice(0, MAX_MESSAGE_LENGTH - 3) + "..."
    : data.message;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-start gap-3 p-4 rounded-lg shadow-lg border
                 max-w-sm w-full
                 bg-white dark:bg-gray-800
                 border-gray-200 dark:border-gray-700"
    >
      {/* Icon */}
      <span className="text-xl flex-shrink-0" aria-hidden="true">
        {getTypeIcon(data.type)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
            {data.alertName}
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {data.symbol}
          </span>
        </div>
        <p
          className="text-sm text-gray-600 dark:text-gray-300 mt-1"
          title={isTruncated ? data.message : undefined}
        >
          {displayMessage}
          {isTruncated && (
            <span
              className="ml-1 cursor-help text-blue-500 dark:text-blue-400"
              title={data.message}
            >
              (more)
            </span>
          )}
        </p>
        <time
          className="text-xs text-gray-400 dark:text-gray-500 mt-1 block"
          dateTime={data.triggeredAt}
        >
          {new Date(data.triggeredAt).toLocaleTimeString()}
        </time>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700
                   text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                   focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-label={`Dismiss notification for ${data.alertName}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export default ToastNotification;
