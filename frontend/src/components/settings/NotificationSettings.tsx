/**
 * NotificationSettings - Notification preferences UI component
 * Feature: 013-alarm-notifications
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  getNotificationSettings,
  updateNotificationSettings,
  validateTelegramCredentials,
  testTelegramConfig,
} from '@/api/notifications';
import type {
  NotificationSettingsResponse,
  NotificationPreferenceUpdate,
  TelegramValidationResult,
  TelegramTestResult,
  SoundType,
} from '@/types/notification';
import toast from 'react-hot-toast';

export interface NotificationSettingsProps {
  onClose?: () => void;
}

const SOUND_OPTIONS: { value: SoundType; label: string; description: string }[] = [
  { value: 'bell', label: 'Bell', description: 'Classic notification sound' },
  { value: 'alert', label: 'Alert', description: 'Urgent attention sound' },
  { value: 'chime', label: 'Chime', description: 'Subtle notification chime' },
];

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  // Settings state
  const [toastEnabled, setToastEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundType, setSoundType] = useState<SoundType>('bell');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [hasTelegramConfigured, setHasTelegramConfigured] = useState(false);

  // Telegram credentials (only for input, never stored in plaintext)
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  // Validation state
  const [telegramValid, setTelegramValid] = useState<boolean | null>(null);
  const [telegramTestResult, setTelegramTestResult] = useState<TelegramTestResult | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await getNotificationSettings();
      if (response.preference) {
        setToastEnabled(response.preference.toastEnabled);
        setSoundEnabled(response.preference.soundEnabled);
        setSoundType(response.preference.soundType as SoundType || 'bell');
        setTelegramEnabled(response.preference.telegramEnabled);
      }
      setHasTelegramConfigured(response.hasTelegramConfigured);
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const update: NotificationPreferenceUpdate = {
        toastEnabled,
        soundEnabled,
        soundType: telegramEnabled ? soundType : null,
        telegramEnabled,
      };

      // Only include Telegram credentials if provided
      if (telegramToken && telegramChatId) {
        update.telegramToken = telegramToken;
        update.telegramChatId = telegramChatId;
      }

      await updateNotificationSettings(update);
      toast.success('Notification settings saved');
      setHasTelegramConfigured(telegramEnabled && (!!telegramToken || !!telegramChatId));
      setTelegramToken('');
      setTelegramChatId('');
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleValidateTelegram = async () => {
    if (!telegramToken || !telegramChatId) {
      toast.error('Please enter both token and chat ID');
      return;
    }

    try {
      setTestingTelegram(true);
      const result = await validateTelegramCredentials({
        telegramToken,
        telegramChatId,
      });
      setTelegramValid(result.valid);
      if (result.valid) {
        toast.success(`Valid! Bot: @${result.botUsername}`);
      } else {
        toast.error(result.errorMessage || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Failed to validate Telegram:', error);
      toast.error('Failed to validate Telegram credentials');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    try {
      setTestingTelegram(true);
      const result = await testTelegramConfig();
      setTelegramTestResult(result);
      if (result.success) {
        toast.success('Test message sent! Check Telegram.');
      } else {
        toast.error(result.errorMessage || 'Failed to send test message');
      }
    } catch (error) {
      console.error('Failed to test Telegram:', error);
      toast.error('Failed to test Telegram configuration');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTelegramToggle = (enabled: boolean) => {
    if (enabled && !hasTelegramConfigured) {
      // User trying to enable Telegram without credentials configured
      const confirmed = confirm(
        "To enable Telegram notifications, you must first configure your Bot Token and Chat ID. " +
        "Would you like to configure them now?"
      );
      if (confirmed) {
        // User confirmed - enable toggle so they can fill in credentials
        setTelegramEnabled(true);
      } else {
        // User cancelled - keep toggle off (do nothing)
      }
    } else {
      // Either disabling, or enabling with existing credentials
      setTelegramEnabled(enabled);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <span className="text-xl">🔔</span> Toast Notifications
        </h3>
        <p className="text-sm text-slate-400">
          Show notification toasts when alerts trigger while the app is open.
        </p>

        <div className="flex items-center justify-between p-4 bg-[#1e222d] rounded-lg">
          <div>
            <Label htmlFor="toast-enabled" className="text-white">
              Enable Toast Notifications
            </Label>
            <p className="text-sm text-slate-400">
              Display in-app notifications for alert triggers
            </p>
          </div>
          <Switch
            id="toast-enabled"
            checked={toastEnabled}
            onCheckedChange={setToastEnabled}
          />
        </div>
      </div>

      {/* Sound Notifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <span className="text-xl">🔊</span> Sound Notifications
        </h3>
        <p className="text-sm text-slate-400">
          Play a sound when alerts trigger to get your attention.
        </p>

        <div className="flex items-center justify-between p-4 bg-[#1e222d] rounded-lg">
          <div>
            <Label htmlFor="sound-enabled" className="text-white">
              Enable Sound Notifications
            </Label>
            <p className="text-sm text-slate-400">
              Play a sound when alerts trigger
            </p>
          </div>
          <Switch
            id="sound-enabled"
            checked={soundEnabled}
            onCheckedChange={setSoundEnabled}
          />
        </div>

        {soundEnabled && (
          <div className="grid grid-cols-3 gap-3 p-4 bg-[#1e222d] rounded-lg">
            {SOUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSoundType(option.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  soundType === option.value
                    ? 'border-[#26a69a] bg-[#26a69a]/10'
                    : 'border-[#2a2e39] hover:border-[#3a3e49]'
                }`}
              >
                <div className="font-medium text-white">{option.label}</div>
                <div className="text-xs text-slate-400">{option.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Telegram Notifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <span className="text-xl">✈️</span> Telegram Notifications
        </h3>
        <p className="text-sm text-slate-400">
          Receive alert notifications directly on Telegram, even when the app is closed.
        </p>

        <div className="flex items-center justify-between p-4 bg-[#1e222d] rounded-lg">
          <div>
            <Label htmlFor="telegram-enabled" className="text-white">
              Enable Telegram Notifications
            </Label>
            <p className="text-sm text-slate-400">
              Send alerts to your Telegram account
            </p>
          </div>
          <Switch
            id="telegram-enabled"
            checked={telegramEnabled}
            onCheckedChange={handleTelegramToggle}
          />
        </div>

        {telegramEnabled && (
          <div className="p-4 bg-[#1e222d] rounded-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telegram-token" className="text-white">
                Bot Token
              </Label>
              <Input
                id="telegram-token"
                type="password"
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                className="bg-[#2a2e39] border-[#3a3e49] text-white"
              />
              <p className="text-xs text-slate-400">
                Get this from @BotFather on Telegram
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram-chat-id" className="text-white">
                Chat ID
              </Label>
              <Input
                id="telegram-chat-id"
                type="text"
                placeholder="-1001234567890 or @channel_username"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="bg-[#2a2e39] border-[#3a3e49] text-white"
              />
              <p className="text-xs text-slate-400">
                Your personal chat ID or channel/group username
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidateTelegram}
                disabled={testingTelegram || !telegramToken || !telegramChatId}
                className="border-[#3a3e49] text-slate-300 hover:bg-[#2a2e39]"
              >
                {testingTelegram ? 'Validating...' : 'Validate Credentials'}
              </Button>
              {hasTelegramConfigured && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestTelegram}
                  disabled={testingTelegram}
                  className="border-[#3a3e49] text-slate-300 hover:bg-[#2a2e39]"
                >
                  {testingTelegram ? 'Testing...' : 'Send Test Message'}
                </Button>
              )}
            </div>

            {telegramValid === false && (
              <p className="text-sm text-red-400">Invalid credentials. Please check and try again.</p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2e39]">
        {onClose && (
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#26a69a] text-white hover:bg-[#229182]"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

export default NotificationSettings;
