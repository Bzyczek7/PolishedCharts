/**
 * Toast Queue Manager

Manages toast notification queue with the following UX MVP behaviors:
- Maximum 5 concurrent toasts visible
- Queue additional notifications when at capacity
- Dismiss order: oldest first (FIFO)
- Text truncation: max 100 characters with ellipsis
- Keyboard dismiss: Escape key closes active toast
- Duration: 5 seconds for all toast notifications

Usage:
    import { toastManager } from '@/lib/toastManager';

    // Show a toast
    toastManager.show({
      title: 'Alert Triggered',
      message: 'AAPL price above $150',
    });

    // Clear all toasts
    toastManager.clear();
*/

import type { ToastNotificationData } from "@/types/notification";

const MAX_VISIBLE_TOASTS = 5;
const MAX_MESSAGE_LENGTH = 100;
const TOAST_DURATION_MS = 5000;

interface QueuedToast {
  id: string;
  data: ToastNotificationData;
  timestamp: number;
  dismissed: boolean;
}

// In-memory queue for toasts waiting to be displayed
const toastQueue: QueuedToast[] = [];

// Track visible toast IDs for deduplication
const visibleToastIds = new Set<string>();

/**
 * Generate a unique toast ID
 */
function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Truncate message to max length with ellipsis
 */
function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message;
  }
  return message.slice(0, MAX_MESSAGE_LENGTH - 3) + "...";
}

/**
 * Check if a toast with the same alert is already visible
 */
function isToastDuplicate(data: ToastNotificationData): boolean {
  return visibleToastIds.has(data.alertName + data.symbol);
}

class ToastQueueManager {
  private notifyListeners: (() => void)[] = [];
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Show a toast notification
   */
  show(data: ToastNotificationData): string | null {
    // Check for duplicates
    if (isToastDuplicate(data)) {
      console.debug("[ToastManager] Duplicate toast suppressed:", data.alertName);
      return null;
    }

    const toast: QueuedToast = {
      id: generateToastId(),
      data,
      timestamp: Date.now(),
      dismissed: false,
    };

    // If we have room, show immediately; otherwise queue
    if (visibleToastIds.size < MAX_VISIBLE_TOASTS) {
      this.displayToast(toast);
    } else {
      toastQueue.push(toast);
      this.notifyListeners.forEach((cb) => cb());
    }

    return toast.id;
  }

  /**
   * Display a toast from the queue
   */
  private displayToast(toast: QueuedToast): void {
    if (toast.dismissed) return;

    visibleToastIds.add(toast.id);

    // Dispatch custom event for the toast component to pick up
    const event = new CustomEvent("show-toast", {
      detail: {
        id: toast.id,
        ...toast.data,
        message: truncateMessage(toast.data.message),
        duration: TOAST_DURATION_MS,
      },
    });
    window.dispatchEvent(event);

    // Auto-dismiss after duration
    this.scheduleAutoDismiss(toast.id, TOAST_DURATION_MS);

    // Process queue if there's room
    this.processQueue();
  }

  /**
   * Schedule auto-dismiss for a toast
   */
  private scheduleAutoDismiss(toastId: string, delay: number): void {
    setTimeout(() => {
      this.dismiss(toastId);
    }, delay);
  }

  /**
   * Dismiss a specific toast
   */
  dismiss(toastId: string): void {
    const event = new CustomEvent("dismiss-toast", {
      detail: { id: toastId },
    });
    window.dispatchEvent(event);

    this.removeToast(toastId);
  }

  /**
   * Remove toast from tracking
   */
  private removeToast(toastId: string): void {
    visibleToastIds.delete(toastId);

    // Mark in queue as dismissed
    const queuedToast = toastQueue.find((t) => t.id === toastId);
    if (queuedToast) {
      queuedToast.dismissed = true;
    }

    // Process queue to show waiting toasts
    this.processQueue();
    this.notifyListeners.forEach((cb) => cb());
  }

  /**
   * Process the queue and show waiting toasts
   */
  private processQueue(): void {
    // Find first non-dismissed toast in queue
    const nextToast = toastQueue.find((t) => !t.dismissed);

    if (nextToast && visibleToastIds.size < MAX_VISIBLE_TOASTS) {
      // Remove from queue
      const index = toastQueue.indexOf(nextToast);
      toastQueue.splice(index, 1);

      // Display it
      this.displayToast(nextToast);
    }
  }

  /**
   * Dismiss the oldest toast (FIFO)
   */
  dismissOldest(): void {
    if (visibleToastIds.size > 0) {
      // The oldest toast would have been dispatched first
      // We need to track the order - for now, just dismiss by event
      const oldestId = Array.from(visibleToastIds)[0];
      this.dismiss(oldestId);
    }
  }

  /**
   * Clear all visible toasts
   */
  clear(): void {
    // Dispatch clear event
    const event = new CustomEvent("clear-all-toasts");
    window.dispatchEvent(event);

    // Clear tracking
    visibleToastIds.clear();

    // Clear queue
    toastQueue.length = 0;

    this.notifyListeners.forEach((cb) => cb());
  }

  /**
   * Get current queue status
   */
  getStatus(): { visible: number; queued: number } {
    return {
      visible: visibleToastIds.size,
      queued: toastQueue.filter((t) => !t.dismissed).length,
    };
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(callback: () => void): () => void {
    this.notifyListeners.push(callback);
    return () => {
      const index = this.notifyListeners.indexOf(callback);
      if (index > -1) {
        this.notifyListeners.splice(index, 1);
      }
    };
  }
}

// Singleton instance
export const toastManager = new ToastQueueManager();

/**
 * Handle keyboard events for toast dismissal
 */
export function setupToastKeyboardHandler(): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      toastManager.dismissOldest();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
