/**
 * ChartStateContext - Central chart state management
 * Feature: 002-supercharts-visuals
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ChartState, Interval, ToolType } from '../components/types/chart';
import { DEFAULT_CHART_THEME } from '../utils/chartColors';

interface ChartStateContextValue {
  state: ChartState;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: Interval) => void;
  setZoom: (level: number) => void;
  setScroll: (position: number, offset: number) => void;
  setVisibleTimeRange: (from: number, to: number) => void;
  setActiveTool: (tool: ToolType) => void;
  setFocusedPane: (paneId: string) => void;
  setTheme: (theme: Partial<ChartState['theme']>) => void;
  setDataAvailable: (available: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
}

const ChartStateContext = createContext<ChartStateContextValue | undefined>(undefined);

export interface ChartStateProviderProps {
  children: ReactNode;
  initialSymbol?: string;
  initialInterval?: Interval;
}

export function ChartStateProvider({
  children,
  initialSymbol = 'AAPL',
  initialInterval = '1D',
}: ChartStateProviderProps) {
  const [state, setState] = useState<ChartState>({
    symbol: initialSymbol,
    interval: initialInterval,
    zoom: {
      level: 1,
      maxLevel: 10,
    },
    scroll: {
      position: 0,
      offset: 0,
    },
    activeTool: 'cursor',
    focusedPaneId: 'main',
    dataAvailable: false,
    loading: false,
    theme: DEFAULT_CHART_THEME,
  });

  const setSymbol = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, symbol }));
  }, []);

  const setInterval = useCallback((interval: Interval) => {
    setState(prev => ({ ...prev, interval }));
  }, []);

  const setZoom = useCallback((level: number) => {
    setState(prev => ({
      ...prev,
      zoom: { ...prev.zoom, level: Math.max(1, Math.min(prev.zoom.maxLevel, level)) },
    }));
  }, []);

  const setScroll = useCallback((position: number, offset: number) => {
    setState(prev => ({
      ...prev,
      scroll: { position, offset },
    }));
  }, []);

  const setVisibleTimeRange = useCallback((from: number, to: number) => {
    setState(prev => ({
      ...prev,
      visibleTimeRange: { from, to },
    }));
  }, []);

  const setActiveTool = useCallback((tool: ToolType) => {
    setState(prev => ({ ...prev, activeTool: tool }));
  }, []);

  const setFocusedPane = useCallback((paneId: string) => {
    setState(prev => ({ ...prev, focusedPaneId: paneId }));
  }, []);

  const setTheme = useCallback((themeUpdate: Partial<ChartState['theme']>) => {
    // Theme updates are handled by ThemeSettingsProvider
  }, []);

  const setDataAvailable = useCallback((available: boolean) => {
    setState(prev => ({ ...prev, dataAvailable: available }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error?: string) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const value: ChartStateContextValue = {
    state,
    setSymbol,
    setInterval,
    setZoom,
    setScroll,
    setVisibleTimeRange,
    setActiveTool,
    setFocusedPane,
    setTheme,
    setDataAvailable,
    setLoading,
    setError,
  };

  return (
    <ChartStateContext.Provider value={value}>
      {children}
    </ChartStateContext.Provider>
  );
}

export function useChartStateContext(): ChartStateContextValue {
  const context = useContext(ChartStateContext);
  if (!context) {
    throw new Error('useChartStateContext must be used within ChartStateProvider');
  }
  return context;
}
