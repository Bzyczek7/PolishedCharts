/**
 * BulkNotificationActions Component

Provides bulk notification settings updates for selected alerts.

Features:
- Multi-select alerts via checkboxes
- Batch update notification settings
- Progress indicator during operation
- Success/failure counts display

Usage:
    <BulkNotificationActions
      selectedAlertIds={['uuid1', 'uuid2']}
      onComplete={handleBulkComplete}
    />

Feature: 013-alarm-notifications
*/

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateAlertNotificationSettings } from "@/api/alerts";
import type { AlertNotificationSettingsUpdate, SoundType } from "@/types/notification";
import toast from "react-hot-toast";

interface BulkNotificationActionsProps {
  selectedAlertIds: string[];
  onComplete?: () => void;
}

export function BulkNotificationActions({ selectedAlertIds, onComplete }: BulkNotificationActionsProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Settings to apply
  const [toastEnabled, setToastEnabled] = useState<boolean | null>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean | null>(false);
  const [soundType, setSoundType] = useState<SoundType>("bell");
  const [telegramEnabled, setTelegramEnabled] = useState<boolean | null>(false);

  if (selectedAlertIds.length === 0) {
    return null;
  }

  const handleBulkUpdate = async () => {
    if (selectedAlertIds.length === 0) return;

    setLoading(true);
    setProgress(0);
    setTotal(selectedAlertIds.length);
    setSuccessCount(0);
    setFailureCount(0);

    const settings: AlertNotificationSettingsUpdate = {
      toastEnabled: toastEnabled === null ? null : toastEnabled,
      soundEnabled: soundEnabled === null ? null : soundEnabled,
      soundType: soundEnabled ? soundType : null,
      telegramEnabled: telegramEnabled === null ? null : telegramEnabled,
    };

    const errors: { alertId: string; error: string }[] = [];

    for (const alertId of selectedAlertIds) {
      try {
        await updateAlertNotificationSettings(alertId, settings);
        setSuccessCount((prev) => prev + 1);
      } catch (error) {
        setFailureCount((prev) => prev + 1);
        errors.push({ alertId, error: String(error) });
      }
      setProgress((prev) => prev + 1);

      // Small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    setLoading(false);

    // Show result
    if (failureCount === 0) {
      toast.success(`Updated ${successCount} alert(s)`);
    } else {
      toast.error(`Updated ${successCount}, failed ${failureCount}`);
    }

    // Log detailed errors
    if (errors.length > 0) {
      console.error("Bulk update errors:", errors);
    }

    onComplete?.();
  };

  const hasChanges =
    toastEnabled !== true || soundEnabled !== false || telegramEnabled !== false;

  return (
    <div className="space-y-4 p-4 bg-[#1e222d] rounded-lg border border-[#2a2e39]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">
          Bulk Notification Settings
        </h3>
        <span className="text-sm text-slate-400">
          {selectedAlertIds.length} selected
        </span>
      </div>

      {/* Progress */}
      {loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Updating...</span>
            <span className="text-white">{progress}/{total}</span>
          </div>
          <div className="w-full bg-[#2a2e39] rounded-full h-2">
            <div
              className="bg-[#26a69a] h-2 rounded-full transition-all"
              style={{ width: `${(progress / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!loading && (successCount > 0 || failureCount > 0) && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-400">✓ {successCount} updated</span>
          {failureCount > 0 && (
            <span className="text-red-400">✗ {failureCount} failed</span>
          )}
        </div>
      )}

      {/* Settings Toggle */}
      {!loading && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
        >
          <span>{showSettings ? "▼" : "▶"}</span>
          {showSettings ? "Hide Settings" : "Configure Settings"}
        </button>
      )}

      {/* Settings */}
      {showSettings && !loading && (
        <div className="space-y-4 p-3 bg-[#2a2e39] rounded">
          {/* Toast */}
          <div className="flex items-center justify-between">
            <Label htmlFor="bulk-toast" className="text-white">
              Toast Notifications
            </Label>
            <Switch
              id="bulk-toast"
              checked={toastEnabled ?? true}
              onCheckedChange={(checked) => setToastEnabled(checked ? true : null)}
            />
          </div>

          {/* Sound */}
          <div className="flex items-center justify-between">
            <Label htmlFor="bulk-sound" className="text-white">
              Sound Notifications
            </Label>
            <Switch
              id="bulk-sound"
              checked={soundEnabled ?? false}
              onCheckedChange={(checked) => setSoundEnabled(checked ? true : null)}
            />
          </div>

          {/* Sound Type */}
          {soundEnabled && (
            <div className="grid grid-cols-3 gap-2">
              {(["bell", "alert", "chime"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSoundType(type)}
                  className={`p-2 rounded text-sm border ${
                    soundType === type
                      ? "border-[#26a69a] bg-[#26a69a]/20 text-white"
                      : "border-[#3a3e49] text-slate-400 hover:border-[#4a4e59]"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Telegram */}
          <div className="flex items-center justify-between">
            <Label htmlFor="bulk-telegram" className="text-white">
              Telegram
            </Label>
            <Switch
              id="bulk-telegram"
              checked={telegramEnabled ?? false}
              onCheckedChange={(checked) => setTelegramEnabled(checked ? true : null)}
            />
          </div>

          {/* Apply Button */}
          <Button
            onClick={handleBulkUpdate}
            disabled={!hasChanges}
            className="w-full bg-[#26a69a] hover:bg-[#229182] disabled:opacity-50"
          >
            Apply to {selectedAlertIds.length} Alert{selectedAlertIds.length !== 1 ? "s" : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

export default BulkNotificationActions;
