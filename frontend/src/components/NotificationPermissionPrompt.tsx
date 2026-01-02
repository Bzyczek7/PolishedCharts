/**
 * NotificationPermissionPrompt Component

Shows a subtle prompt to enable notifications when:
- Browser supports notifications
- Permission has been denied
- User hasn't dismissed the prompt yet

Follows UX MVP Standard:
- Request permission only after explicit user gesture
- No auto-reprompt if permission denied
- Show subtle "Enable notifications" link in settings

Usage:
    <NotificationPermissionPrompt onEnable={handleEnable} />
*/

import { useNotificationPermission } from "@/hooks/useNotificationPermission";

interface NotificationPermissionPromptProps {
  onEnable?: () => void;
}

/**
 * Subtle notification permission prompt
 */
export function NotificationPermissionPrompt({
  onEnable,
}: NotificationPermissionPromptProps) {
  const {
    isSupported,
    isDenied,
    shouldShowDeniedMessage,
    requestPermission,
    dismissDeniedMessage,
  } = useNotificationPermission();

  // Don't show if notifications unsupported or permission granted
  if (!isSupported || !isDenied || !shouldShowDeniedMessage) {
    return null;
  }

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted && onEnable) {
      onEnable();
    }
  };

  return (
    <div
      role="alert"
      className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
    >
      <span>Notifications are disabled.</span>
      <button
        type="button"
        onClick={handleEnable}
        className="underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-1"
        aria-label="Enable browser notifications"
      >
        Enable notifications
      </button>
      <button
        type="button"
        onClick={dismissDeniedMessage}
        className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
        aria-label="Dismiss notification prompt"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}
