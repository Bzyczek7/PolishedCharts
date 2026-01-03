/**
 * useAlertNotificationSettings Hook

Provides per-alert notification settings management with caching and optimistic updates.

Features:
- Fetch and cache alert notification settings
- Optimistic updates for UI responsiveness
- Automatic refresh on settings change
- Integration with global preferences

Usage:
    const { settings, updateSettings, isLoading } = useAlertNotificationSettings(alertId);

    // Update settings with optimistic update
    await updateSettings({ toastEnabled: true, soundEnabled: false });
*/

import { useState, useCallback, useEffect, useRef } from "react";
import { getAlertNotificationSettings, updateAlertNotificationSettings } from "@/api/alerts";
import type { AlertNotificationSettingsUpdate } from "@/types/notification";

interface UseAlertNotificationSettingsReturn {
  /** Current settings (null if not loaded) */
  settings: AlertNotificationSettingsUpdate | null;
  /** Whether settings are currently loading */
  isLoading: boolean;
  /** Error message if fetch/update failed */
  error: string | null;
  /** Update notification settings */
  updateSettings: (settings: AlertNotificationSettingsUpdate) => Promise<void>;
  /** Reset settings to global defaults (null all) */
  resetToDefaults: () => Promise<void>;
  /** Refresh settings from server */
  refresh: () => Promise<void>;
}

export function useAlertNotificationSettings(
  alertId: string | null
): UseAlertNotificationSettingsReturn {
  const [settings, setSettings] = useState<AlertNotificationSettingsUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, AlertNotificationSettingsUpdate>>(new Map());

  const fetchSettings = useCallback(async () => {
    if (!alertId) {
      setSettings(null);
      return;
    }

    // Check cache first
    if (cacheRef.current.has(String(alertId))) {
      setSettings(cacheRef.current.get(String(alertId))!);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getAlertNotificationSettings(String(alertId));
      setSettings(data);
      cacheRef.current.set(String(alertId), data);
    } catch (err) {
      // 404 means no custom settings exist (use global)
      if (err && typeof err === "object" && "status" in err && (err as any).status === 404) {
        setSettings(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to fetch settings");
      }
    } finally {
      setIsLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (newSettings: AlertNotificationSettingsUpdate) => {
      if (!alertId) return;

      const previousSettings = settings;
      const previousCache = cacheRef.current.get(String(alertId));

      // Optimistic update
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      cacheRef.current.set(String(alertId), updatedSettings);
      setError(null);

      try {
        await updateAlertNotificationSettings(String(alertId), newSettings);
      } catch (err) {
        // Revert on failure
        setSettings(previousSettings);
        if (previousCache) {
          cacheRef.current.set(String(alertId), previousCache);
        } else {
          cacheRef.current.delete(String(alertId));
        }
        setError(err instanceof Error ? err.message : "Failed to update settings");
        throw err;
      }
    },
    [alertId, settings]
  );

  const resetToDefaults = useCallback(async () => {
    if (!alertId) return;

    // Set all fields to null (use global)
    const defaultSettings: AlertNotificationSettingsUpdate = {
      toastEnabled: null,
      soundEnabled: null,
      soundType: null,
      telegramEnabled: null,
    };

    // Optimistic update
    setSettings(defaultSettings);
    cacheRef.current.set(String(alertId), defaultSettings);
    setError(null);

    try {
      await updateAlertNotificationSettings(String(alertId), defaultSettings);
    } catch (err) {
      // Revert on failure - refetch
      await fetchSettings();
      setError(err instanceof Error ? err.message : "Failed to reset settings");
      throw err;
    }
  }, [alertId, fetchSettings]);

  const refresh = useCallback(async () => {
    cacheRef.current.delete(String(alertId));
    await fetchSettings();
  }, [alertId, fetchSettings]);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    resetToDefaults,
    refresh,
  };
}

/**
 * Hook to manage notification settings for multiple alerts
 * Useful for bulk operations
 */
export function useBulkAlertNotificationSettings(
  alertIds: (string | null)[]
): {
  settingsMap: Map<string | null, AlertNotificationSettingsUpdate | null>;
  isAnyLoading: boolean;
  updateSettings: (alertId: string, settings: AlertNotificationSettingsUpdate) => Promise<void>;
} {
  const [settingsMap, setSettingsMap] = useState<
    Map<string | null, AlertNotificationSettingsUpdate | null>
  >(new Map());
  const [loadingCount, setLoadingCount] = useState(0);

  const hooksRef = useRef<Map<string, ReturnType<typeof useAlertNotificationSettings>>>(new Map());

  // Create individual hooks for each alert
  const settingsMapResult = new Map<string | null, AlertNotificationSettingsUpdate | null>();
  let anyLoading = false;

  alertIds.forEach((id) => {
    if (!id) return;
    if (!hooksRef.current.has(String(id))) {
      hooksRef.current.set(String(id), useAlertNotificationSettings(id));
    }
    const hook = hooksRef.current.get(String(id))!;
    if (hook.isLoading) anyLoading = true;
    settingsMapResult.set(id, hook.settings);
  });

  const updateSettings = useCallback(
    async (alertId: string, settings: AlertNotificationSettingsUpdate) => {
      const hook = hooksRef.current.get(alertId);
      if (hook) {
        await hook.updateSettings(settings);
      }
    },
    []
  );

  return {
    settingsMap: settingsMapResult,
    isAnyLoading: anyLoading,
    updateSettings,
  };
}

export default useAlertNotificationSettings;
