/**
 * IndicatorContext - Provides indicator state management to the app
 * Feature: 003-advanced-indicators
 * Phase 4: User Story 2 - Per-Symbol Indicator Toggles and Persistence
 * Task: T041 [US2]: Create IndicatorContext provider
 */

import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useIndicators } from '../hooks/useIndicators';
import type { IndicatorType, IndicatorPane } from '../components/types/indicators';

interface IndicatorContextValue {
  indicators: IndicatorPane[];
  activeIndicatorId: string | null;
  isLoaded: boolean;
  addIndicator: (indicatorType: IndicatorType) => string;
  removeIndicator: (indicatorId: string) => void;
  toggleIndicator: (indicatorId: string) => void;
  updateIndicatorParams: (indicatorId: string, params: Record<string, number | string>) => void;
  setActiveIndicatorId: (id: string | null) => void;
}

const IndicatorContext = createContext<IndicatorContextValue | undefined>(undefined);

export interface IndicatorProviderProps {
  children: ReactNode;
  symbol: string;
}

/**
 * IndicatorProvider - Wraps the app to provide indicator state management
 */
export function IndicatorProvider({ children, symbol }: IndicatorProviderProps) {
  const indicatorState = useIndicators(symbol);

  return (
    <IndicatorContext.Provider value={indicatorState}>
      {children}
    </IndicatorContext.Provider>
  );
}

/**
 * useIndicatorContext - Hook to access indicator context
 */
export function useIndicatorContext(): IndicatorContextValue {
  const context = useContext(IndicatorContext);
  if (!context) {
    throw new Error('useIndicatorContext must be used within an IndicatorProvider');
  }
  return context;
}
