/**
 * SettingsDialog - Modal dialog with Appearance/Scales/Trading/Events tabs
 * Feature: 002-supercharts-visuals
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppearanceTab } from './AppearanceTab';
import { ScalesTab } from './ScalesTab';
import { useThemeSettings } from '../../hooks/useThemeSettings';

type TabType = 'appearance' | 'scales' | 'trading' | 'events';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * SettingsDialog component
 * Modal dialog for customizing chart appearance and settings
 *
 * @example
 * ```tsx
 * <SettingsDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const { resetToDefaults } = useThemeSettings();

  const tabs: { id: TabType; label: string; disabled: boolean }[] = [
    { id: 'appearance', label: 'Appearance', disabled: false },
    { id: 'scales', label: 'Scales', disabled: false },
    { id: 'trading', label: 'Trading', disabled: true }, // Greyed out for MVP per spec
    { id: 'events', label: 'Events', disabled: true }, // Greyed out for MVP per spec
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1e222d] border-[#2a2e39] text-slate-200 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Chart Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tab Headers */}
          <div className="flex border-b border-[#2a2e39]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  tab.disabled
                    ? 'text-slate-600 cursor-not-allowed'
                    : activeTab === tab.id
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#26a69a]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-64">
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'scales' && <ScalesTab />}
            {activeTab === 'trading' && (
              <div className="flex items-center justify-center h-64 text-slate-500">
                Trading settings are not available in this version.
              </div>
            )}
            {activeTab === 'events' && (
              <div className="flex items-center justify-center h-64 text-slate-500">
                Events settings are not available in this version.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-[#2a2e39]">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="text-slate-400 hover:text-white"
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-[#26a69a] text-white hover:bg-[#229182]"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
