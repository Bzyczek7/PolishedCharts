/**
 * ThemeSettingsContext - User-customizable appearance settings
 * Feature: 002-supercharts-visuals
 */

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { ThemeSettings } from '../components/types/theme';
import { DEFAULT_THEME_SETTINGS } from '../components/types/theme';
import { STORAGE_KEYS, get, set } from '../utils/localStorage';

interface ThemeSettingsContextValue {
  settings: ThemeSettings;
  setBackgroundBrightness: (brightness: number) => void;
  setGridVisible: (visible: boolean) => void;
  setGridOpacity: (opacity: number) => void;
  setCandleColor: (type: 'up' | 'down', color: string) => void;
  setScaleSetting: <K extends keyof ThemeSettings['scaleSettings']>(
    key: K,
    value: ThemeSettings['scaleSettings'][K]
  ) => void;
  resetToDefaults: () => void;
}

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | undefined>(undefined);

export interface ThemeSettingsProviderProps {
  children: ReactNode;
}

export function ThemeSettingsProvider({ children }: ThemeSettingsProviderProps) {
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    // Load from localStorage on init, fall back to defaults
    return get<ThemeSettings>(STORAGE_KEYS.THEME_SETTINGS, DEFAULT_THEME_SETTINGS);
  });

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    set(STORAGE_KEYS.THEME_SETTINGS, settings);
  }, [settings]);

  const setBackgroundBrightness = useCallback((brightness: number) => {
    setSettings(prev => ({
      ...prev,
      backgroundBrightness: Math.max(0, Math.min(100, brightness)),
    }));
  }, []);

  const setGridVisible = useCallback((visible: boolean) => {
    setSettings(prev => ({
      ...prev,
      grid: { ...prev.grid, visible },
    }));
  }, []);

  const setGridOpacity = useCallback((opacity: number) => {
    setSettings(prev => ({
      ...prev,
      grid: { ...prev.grid, opacity: Math.max(0, Math.min(100, opacity)) },
    }));
  }, []);

  const setCandleColor = useCallback((type: 'up' | 'down', color: string) => {
    setSettings(prev => ({
      ...prev,
      candleColors: { ...prev.candleColors, [type]: color },
    }));
  }, []);

  const setScaleSetting = useCallback(<K extends keyof ThemeSettings['scaleSettings']>(
    key: K,
    value: ThemeSettings['scaleSettings'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      scaleSettings: { ...prev.scaleSettings, [key]: value },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_THEME_SETTINGS);
  }, []);

  const value: ThemeSettingsContextValue = {
    settings,
    setBackgroundBrightness,
    setGridVisible,
    setGridOpacity,
    setCandleColor,
    setScaleSetting,
    resetToDefaults,
  };

  return (
    <ThemeSettingsContext.Provider value={value}>
      {children}
    </ThemeSettingsContext.Provider>
  );
}

export function useThemeSettingsContext(): ThemeSettingsContextValue {
  const context = useContext(ThemeSettingsContext);
  if (!context) {
    throw new Error('useThemeSettingsContext must be used within ThemeSettingsProvider');
  }
  return context;
}
