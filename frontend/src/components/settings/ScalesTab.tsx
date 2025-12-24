/**
 * ScalesTab - Settings for last price line, labels toggles
 * Feature: 002-supercharts-visuals
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useThemeSettings } from '../../hooks/useThemeSettings';

/**
 * ScalesTab component
 * Toggles for last price line/label, time labels
 *
 * @example
 * ```tsx
 * <ScalesTab />
 * ```
 */
export function ScalesTab() {
  const { settings, setScaleSetting } = useThemeSettings();

  return (
    <div className="space-y-4 p-2">
      <div className="pb-2 border-b border-[#2a2e39]">
        <h3 className="text-sm font-medium text-white mb-1">Price Scale</h3>
        <p className="text-xs text-slate-500">Settings for the right-side price axis</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="last-price-line" className="text-sm text-slate-300">
            Last Price Line
          </Label>
          <Switch
            id="last-price-line"
            checked={settings.scaleSettings.showLastPriceLine}
            onCheckedChange={(checked) => setScaleSetting('showLastPriceLine', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="last-price-label" className="text-sm text-slate-300">
            Last Price Label
          </Label>
          <Switch
            id="last-price-label"
            checked={settings.scaleSettings.showLastPriceLabel}
            onCheckedChange={(checked) => setScaleSetting('showLastPriceLabel', checked)}
          />
        </div>
      </div>

      <div className="pb-2 border-b border-[#2a2e39] pt-2">
        <h3 className="text-sm font-medium text-white mb-1">Time Scale</h3>
        <p className="text-xs text-slate-500">Settings for the bottom time axis</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="time-labels" className="text-sm text-slate-300">
            Time Labels
          </Label>
          <Switch
            id="time-labels"
            checked={settings.scaleSettings.showTimeLabels}
            onCheckedChange={(checked) => setScaleSetting('showTimeLabels', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="price-labels" className="text-sm text-slate-300">
            Price Labels
          </Label>
          <Switch
            id="price-labels"
            checked={settings.scaleSettings.showPriceLabels}
            onCheckedChange={(checked) => setScaleSetting('showPriceLabels', checked)}
          />
        </div>
      </div>
    </div>
  );
}

export default ScalesTab;
