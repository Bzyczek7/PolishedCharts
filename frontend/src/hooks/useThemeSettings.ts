/**
 * useThemeSettings hook
 * Feature: 002-supercharts-visuals
 *
 * Convenience hook for accessing theme settings from context.
 * All state management is handled by ThemeSettingsContext.
 */

import { useThemeSettingsContext } from '../contexts/ThemeSettingsContext';

/**
 * Hook to access and manipulate theme settings
 *
 * @example
 * ```tsx
 * const { settings, setBackgroundBrightness, setGridVisible } = useThemeSettings();
 * ```
 *
 * Provides access to:
 * - settings: Current theme settings object
 * - setBackgroundBrightness: Set background brightness (0-100)
 * - setGridVisible: Toggle grid visibility
 * - setGridOpacity: Set grid opacity (0-100)
 * - setCandleColor: Set up or down candle color
 * - setScaleSetting: Update a scale setting
 * - resetToDefaults: Reset all settings to defaults
 */
export function useThemeSettings() {
  const context = useThemeSettingsContext();
  return context;
}
