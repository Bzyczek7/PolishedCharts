/**
 * NotificationSettingsDialog - Modal dialog for notification settings
 * Feature: 013-alarm-notifications
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NotificationSettings } from './NotificationSettings';

export interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * NotificationSettingsDialog component
 * Modal dialog for configuring notification preferences
 *
 * @example
 * ```tsx
 * <NotificationSettingsDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */
export function NotificationSettingsDialog({ open, onOpenChange }: NotificationSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1e222d] border-[#2a2e39] text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Notification Settings
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure how you want to receive alert notifications
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <NotificationSettings onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationSettingsDialog;
