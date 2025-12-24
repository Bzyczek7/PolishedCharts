/**
 * AppearanceTab - Settings for background, grid, and candle colors
 * Feature: 002-supercharts-visuals
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useThemeSettings } from '../../hooks/useThemeSettings';

/**
 * Get background color based on brightness level (0-100)
 * Maps #131722 (0) to #0a0e14 (100)
 */
function getBackgroundColor(brightness: number): string {
  // Linear interpolation between #131722 (dark) and #0a0e14 (darker)
  const r1 = 0x13, g1 = 0x17, b1 = 0x22;
  const r2 = 0x0a, g2 = 0x0e, b2 = 0x14;

  const factor = brightness / 100;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * AppearanceTab component
 * Background brightness slider, grid controls, candle color pickers
 *
 * @example
 * ```tsx
 * <AppearanceTab />
 * ```
 */
export function AppearanceTab() {
  const { settings, setBackgroundBrightness, setGridVisible, setGridOpacity, setCandleColor } =
    useThemeSettings();

  return (
    <div className="space-y-6 p-2">
      {/* Background Brightness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="brightness" className="text-sm text-slate-300">
            Background Brightness
          </Label>
          <span className="text-xs text-slate-500">{settings.backgroundBrightness}%</span>
        </div>
        <Slider
          id="brightness"
          value={[settings.backgroundBrightness]}
          onValueChange={(values) => setBackgroundBrightness(values[0])}
          min={0}
          max={100}
          step={1}
          className="w-full"
        />
        <div
          className="h-2 rounded border border-slate-600"
          style={{ backgroundColor: getBackgroundColor(settings.backgroundBrightness) }}
        />
      </div>

      {/* Grid Visibility */}
      <div className="flex items-center justify-between">
        <Label htmlFor="grid-visible" className="text-sm text-slate-300">
          Show Grid
        </Label>
        <Switch
          id="grid-visible"
          checked={settings.grid.visible}
          onCheckedChange={setGridVisible}
        />
      </div>

      {/* Grid Opacity */}
      {settings.grid.visible && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="grid-opacity" className="text-sm text-slate-300">
              Grid Opacity
            </Label>
            <span className="text-xs text-slate-500">{settings.grid.opacity}%</span>
          </div>
          <Slider
            id="grid-opacity"
            value={[settings.grid.opacity]}
            onValueChange={(values) => setGridOpacity(values[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Candle Colors */}
      <div className="space-y-4">
        <Label className="text-sm text-slate-300">Candle Colors</Label>

        <div className="flex items-center justify-between">
          <Label htmlFor="color-up" className="text-sm text-slate-400">
            Up Candle
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="color-up"
              type="color"
              value={settings.candleColors.up}
              onChange={(e) => setCandleColor('up', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="text-xs text-slate-500">{settings.candleColors.up}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="color-down" className="text-sm text-slate-400">
            Down Candle
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="color-down"
              type="color"
              value={settings.candleColors.down}
              onChange={(e) => setCandleColor('down', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="text-xs text-slate-500">{settings.candleColors.down}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppearanceTab;
