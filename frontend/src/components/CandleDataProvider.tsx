/**
 * CandleDataProvider Component
 *
 * Feature: 004-candle-data-refresh
 * Purpose: Wrapper component that uses useCandleData hook to provide polled candle data
 *
 * This component bridges the polling hook (useCandleData) with the ChartComponent.
 * It handles data fetching, polling refresh, and provides the data to children.
 */
import type { ReactNode } from 'react';
import { useCandleData } from '../hooks/useCandleData';

export interface CandleDataProviderProps {
  symbol: string;
  interval: string;
  children: (state: ReturnType<typeof useCandleData>) => ReactNode;
}

/**
 * CandleDataProvider - uses useCandleData hook and passes state to children
 *
 * This allows ChartComponent to receive polled data without being tightly
 * coupled to the hook implementation.
 */
export function CandleDataProvider({ symbol, interval, children }: CandleDataProviderProps) {
  const candleState = useCandleData(symbol, interval);

  return <>{children(candleState)}</>;
}
