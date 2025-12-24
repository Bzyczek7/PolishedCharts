/**
 * CrosshairContext - Synchronized crosshair state across all chart panes
 * Feature: 002-supercharts-visuals
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { CrosshairState } from '../components/types/contexts';

interface CrosshairContextValue {
  state: CrosshairState;
  showCrosshair: (timeIndex: number, price?: number, sourcePaneId?: string) => void;
  hideCrosshair: () => void;
  setCrosshairVisible: (visible: boolean) => void;
}

const CrosshairContext = createContext<CrosshairContextValue | undefined>(undefined);

export interface CrosshairProviderProps {
  children: ReactNode;
}

export function CrosshairProvider({ children }: CrosshairProviderProps) {
  const [state, setState] = useState<CrosshairState>({
    visible: false,
  });

  const showCrosshair = useCallback((timeIndex: number, price?: number, sourcePaneId?: string) => {
    setState({
      visible: true,
      timeIndex,
      price,
      sourcePaneId,
    });
  }, []);

  const hideCrosshair = useCallback(() => {
    setState({
      visible: false,
    });
  }, []);

  const setCrosshairVisible = useCallback((visible: boolean) => {
    setState(prev => ({
      ...prev,
      visible,
    }));
  }, []);

  const value: CrosshairContextValue = {
    state,
    showCrosshair,
    hideCrosshair,
    setCrosshairVisible,
  };

  return (
    <CrosshairContext.Provider value={value}>
      {children}
    </CrosshairContext.Provider>
  );
}

export function useCrosshairContext(): CrosshairContextValue {
  const context = useContext(CrosshairContext);
  if (!context) {
    throw new Error('useCrosshairContext must be used within CrosshairProvider');
  }
  return context;
}
