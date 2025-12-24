/**
 * useIndicatorData hook - Fetches and caches indicator data
 * Feature: 003-advanced-indicators
 * Fetches data for all active indicators using the generic getIndicator API
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { IndicatorPane } from '../components/types/indicators';
import type { IndicatorOutput } from '../components/types/indicators';
import { getIndicator } from '../api/indicators';

export interface IndicatorDataMap {
  [indicatorId: string]: IndicatorOutput | null;
}

/**
 * Fetches data for all active indicators
 *
 * @param indicators - List of active indicator panes
 * @param symbol - Current symbol
 * @param interval - Current interval
 * @returns Map of indicator ID to IndicatorOutput
 */
export function useIndicatorData(
  indicators: IndicatorPane[],
  symbol: string,
  interval: string
): IndicatorDataMap {
  const [dataMap, setDataMap] = useState<IndicatorDataMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track current data map without causing re-renders
  const dataMapRef = useRef<IndicatorDataMap>({});
  dataMapRef.current = dataMap;

  // Track which indicators have been fetched to avoid refetching
  const fetchedRefs = useRef<Set<string>>(new Set());

  const fetchIndicatorData = useCallback(async (indicator: IndicatorPane) => {
    try {
      const data = await getIndicator(
        symbol,
        indicator.indicatorType.name,
        interval,
        indicator.indicatorType.params
      );
      return { id: indicator.id, data };
    } catch (err) {
      console.error(`Failed to fetch data for ${indicator.indicatorType.name}:`, err);
      return { id: indicator.id, data: null };
    }
  }, [symbol, interval]);

  useEffect(() => {
    if (indicators.length === 0) {
      setDataMap({});
      fetchedRefs.current.clear();
      return;
    }

    // Initialize data map with null values for new indicators to prevent race conditions
    const initialDataMap = { ...dataMapRef.current };
    const newIndicatorIds = indicators.filter(ind => !initialDataMap[ind.id]).map(ind => ind.id);

    // Set initial null values for new indicators to avoid the "no data" condition
    if (newIndicatorIds.length > 0) {
      newIndicatorIds.forEach(id => {
        initialDataMap[id] = null; // Set initial state as null rather than undefined
      });
      setDataMap(initialDataMap);
    }

    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);

      const currentDataMap = dataMapRef.current;
      const results: IndicatorDataMap = { ...currentDataMap }; // Start with current state
      const newFetches: Promise<{ id: string; data: IndicatorOutput | null }>[] = [];

      for (const indicator of indicators) {
        // Only fetch if not already in progress
        if (!fetchedRefs.current.has(indicator.id)) {
          newFetches.push(fetchIndicatorData(indicator));
          fetchedRefs.current.add(indicator.id);
        }
      }

      if (newFetches.length > 0) {
        const fetchedResults = await Promise.all(newFetches);
        for (const { id, data } of fetchedResults) {
          results[id] = data;
        }
        setDataMap(results);
      }

      setIsLoading(false);
    };

    fetchAll();
  }, [indicators, symbol, interval, fetchIndicatorData]);

  return dataMap;
}
