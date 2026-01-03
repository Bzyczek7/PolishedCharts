/**
 * useIndicatorData hook - Fetches and caches indicator data
 * Feature: 003-advanced-indicators
 * Fetches data for all active indicators using the generic getIndicator API
 * Feature: 005-indicator-parity
 * Supports fixture mode for parity validation without live API calls
 * Feature: 012-performance-optimization
 * Instrumented with performance logging and caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { IndicatorPane } from '../components/types/indicators';
import type { IndicatorOutput, IndicatorMetadata } from '../components/types/indicators';
import type { Candle } from '../api/candles';
import { getIndicator, batchGetIndicators, type IndicatorBatchRequest } from '../api/indicators';
import { isFixtureMode, loadFixture, getFixtureId, type FixtureData } from '../lib/fixtureLoader';
import { isValidSymbol } from '../utils/validation';
import { measurePerformance } from '../lib/performance';
import { getCachedIndicator, setCachedIndicator } from '../lib/indicatorCache';

/**
 * Migration: Convert old indicator names (e.g., 'cci_20') to clean names ('cci')
 * This ensures API calls use the correct indicator name even if localStorage has old data
 */
function migrateIndicatorNameForFetch(name: string): string {
  // Pattern: indicator_name_number (e.g., 'cci_20', 'rsi_14', 'sma_50')
  const match = name.match(/^([a-zA-Z_]+)_(\d+(\.\d+)?)$/);
  if (match) {
    const baseName = match[1];
    const knownIndicators = [
      'sma', 'ema', 'dema', 'tema', 'wma', 'hma', 'vwma', 'kama', 'mama',
      'rsi', 'cci', 'adx', 'aroon', 'mfi', 'willr', 'cmo', 'mom', 'roc',
      'atr', 'stoch', 'stochrsi', 'macd', 'bbands', 'kc', 'donchian',
      'uo', 'tsi', 'pgo', 'apo', 'ppo', 'ao', 'obv', 'fi', 'eri',
    ];
    if (knownIndicators.includes(baseName)) {
      return baseName;
    }
  }
  return name;
}

/**
 * Convert fixture indicator data to IndicatorOutput format
 * T037: Rendering contract - fixture data matches backend API response shape
 * Feature 005: Use exact same field names as backend API for compatibility
 */
function fixtureToIndicatorOutput(
  fixture: FixtureData,
  indicatorName: string,
  _params: Record<string, number | string>
): IndicatorOutput {
  const indicatorData = fixture.indicators;

  // Map fixture indicator data to backend API response format
  // IMPORTANT: Use exact same field names as backend API (cRSI, not crsi)
  const data: Record<string, (number | null)[]> = {};
  let timestamps: number[] = [];

  // Convert candle timestamps (ISO strings) to Unix timestamps (seconds)
  timestamps = fixture.candles.map((c: { time: string }) =>
    Math.floor(new Date(c.time).getTime() / 1000)
  );

  // Helper to create indicator metadata
  const createMetadata = (
    displayType: 'overlay' | 'pane',
    colorMode: 'single' | 'gradient' | 'threshold' | 'trend',
    colorSchemes: Record<string, string>,
    seriesMetadata: Array<{
      field: string;
      role: 'main' | 'signal' | 'band' | 'histogram';
      label: string;
      line_color: string;
      line_style: 'solid' | 'dashed' | 'dotted' | 'dashdot';
      line_width: number;
    }>,
    thresholds?: { upper?: number; lower?: number }
  ): IndicatorMetadata => ({
    display_type: displayType,
    color_mode: colorMode,
    color_schemes: colorSchemes,
    thresholds: thresholds,
    series_metadata: seriesMetadata,
  });

  let metadata: IndicatorMetadata;

  // Extract indicator values based on indicator name
  // Use exact field names from backend API to ensure compatibility
  switch (indicatorName.toLowerCase()) {
    case 'crsi': {
      const crsiData = indicatorData.crsi;
      if (crsiData) {
        // Use exact field names from backend API: cRSI, cRSI_UpperBand, cRSI_LowerBand
        data.cRSI = crsiData.values;
        data.cRSI_UpperBand = Array(crsiData.values.length).fill(crsiData.upper_band);
        data.cRSI_LowerBand = Array(crsiData.values.length).fill(crsiData.lower_band);

        metadata = createMetadata(
          'pane',
          'threshold',
          { bullish: '#26a69a', bearish: '#ef5350', neutral: '#787b86' },
          [
            { field: 'cRSI', role: 'main', label: 'cRSI', line_color: '#00bcd4', line_style: 'solid', line_width: 2 },
            { field: 'cRSI_UpperBand', role: 'band', label: 'Upper Band', line_color: '#b2ebf2', line_style: 'dashed', line_width: 1 },
            { field: 'cRSI_LowerBand', role: 'band', label: 'Lower Band', line_color: '#b2ebf2', line_style: 'dashed', line_width: 1 },
          ],
          { upper: crsiData.upper_band, lower: crsiData.lower_band }
        );
      } else {
        metadata = createMetadata('pane', 'single', {}, []);
      }
      break;
    }
    case 'tdfi': {
      const tdfiData = indicatorData.tdfi;
      if (tdfiData) {
        // Use exact field names from backend API: TDFI, TDFI_Signal
        data.TDFI = tdfiData.values;
        // Create signal array based on thresholds (1=above upper, -1=below lower, 0=neutral)
        data.TDFI_Signal = tdfiData.values.map((v: number | null) => {
          if (v === null) return null;
          if (v > tdfiData.thresholds.upper) return 1;
          if (v < tdfiData.thresholds.lower) return -1;
          return 0;
        });

        metadata = createMetadata(
          'pane',
          'threshold',
          { bullish: '#26a69a', bearish: '#ef5350', neutral: '#787b86' },
          [
            { field: 'TDFI', role: 'main', label: 'TDFI', line_color: '#9e9e9e', line_style: 'solid', line_width: 2 },
            { field: 'TDFI_Signal', role: 'signal', label: 'Signal', line_color: '#9e9e9e', line_style: 'dashed', line_width: 1 },
          ],
          { upper: tdfiData.thresholds.upper, lower: tdfiData.thresholds.lower }
        );
      } else {
        metadata = createMetadata('pane', 'single', {}, []);
      }
      break;
    }
    case 'adxvma': {
      const adxvmaData = indicatorData.adxvma;
      if (adxvmaData) {
        data.ADXVMA = adxvmaData.values;

        metadata = createMetadata(
          'overlay',
          'single',
          { main: '#ff6d00' },
          [
            { field: 'ADXVMA', role: 'main', label: 'ADXVMA', line_color: '#ff6d00', line_style: 'solid', line_width: 2 },
          ]
        );
      } else {
        metadata = createMetadata('overlay', 'single', {}, []);
      }
      break;
    }
    case 'ema': {
      const emaData = indicatorData.ema;
      if (emaData) {
        data.ema = emaData.values;

        metadata = createMetadata(
          'overlay',
          'single',
          { main: '#2962ff' },
          [
            { field: 'ema', role: 'main', label: 'EMA(20)', line_color: '#2962ff', line_style: 'solid', line_width: 2 },
          ]
        );
      } else {
        metadata = createMetadata('overlay', 'single', {}, []);
      }
      break;
    }
    case 'sma': {
      const smaData = indicatorData.sma;
      if (smaData) {
        data.sma = smaData.values;

        metadata = createMetadata(
          'overlay',
          'single',
          { main: '#ff6d00' },
          [
            { field: 'sma', role: 'main', label: 'SMA(20)', line_color: '#ff6d00', line_style: 'solid', line_width: 2 },
          ]
        );
      } else {
        metadata = createMetadata('overlay', 'single', {}, []);
      }
      break;
    }
    default:
      console.warn(`[Fixture Mode] Unknown indicator: ${indicatorName}`);
      metadata = createMetadata('pane', 'single', {}, []);
  }

  return {
    symbol: fixture.symbol,
    interval: fixture.interval,
    timestamps,
    data,
    metadata,
    calculated_at: fixture.generated_at || new Date().toISOString(),
    data_points: timestamps.length,
  };
}

/**
 * Generate a unique fetch key for an indicator based on id and params
 * T030: Connect parameter changes to indicator data refetch
 * When params change, the fetch key changes, triggering a refetch
 */
function getIndicatorFetchKey(indicator: IndicatorPane): string {
  const paramsStr = JSON.stringify(indicator.indicatorType.params);
  return `${indicator.id}:${paramsStr}`;
}

export interface IndicatorDataMap {
  [indicatorId: string]: IndicatorOutput | null;
}

/**
 * Fetches data for all active indicators
 *
 * @param indicators - List of active indicator panes
 * @param symbol - Current symbol
 * @param interval - Current interval
 * @param dataVersion - Optional version counter that increments when candle data changes (e.g., backfill)
 * @param candleDateRange - Optional date range for synchronized loading
 * @param candles - Candle data array (used for guard - only fetch when candles exist)
 * @returns Map of indicator ID to IndicatorOutput
 */
export function useIndicatorData(
  indicators: IndicatorPane[],
  symbol: string,
  interval: string,
  dataVersion?: number,
  candleDateRange?: { from: string; to: string },
  candles?: Candle[]  // Added for guard - ensures we only fetch when candles exist
): IndicatorDataMap {
  const [dataMap, setDataMap] = useState<IndicatorDataMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track current data map without causing re-renders
  const dataMapRef = useRef<IndicatorDataMap>({});
  dataMapRef.current = dataMap;

  // Track which indicators have been fetched to avoid refetching
  // T030: Use composite key (id:params) to refetch when params change
  const fetchedRefs = useRef<Set<string>>(new Set());

  // T031: Track current symbol:interval cache key to prevent re-fetching on candle updates
  const currentCacheKeyRef = useRef<string>('');

  // Track previous dataVersion to detect when backfill occurs
  // When dataVersion changes, we need to refetch indicators with the extended date range
  const prevDataVersionRef = useRef<number>(0);

  // Cache for fixture data to avoid loading multiple times
  const fixtureCacheRef = useRef<FixtureData | null>(null);

  const fetchIndicatorData = useCallback(async (indicator: IndicatorPane): Promise<{ id: string; data: IndicatorOutput | null }> => {
    // T036: Check fixture mode first
    if (isFixtureMode()) {
      const fixtureId = getFixtureId();
      if (!fixtureId) {
        console.error('[Fixture Mode] No fixture ID set');
        return { id: indicator.id, data: null };
      }

      try {
        // Load fixture once and cache it
        if (!fixtureCacheRef.current) {
          fixtureCacheRef.current = await loadFixture(fixtureId);
        }

        // Convert fixture indicator data to backend API format
        const output = fixtureToIndicatorOutput(
          fixtureCacheRef.current,
          indicator.indicatorType.name,
          indicator.indicatorType.params
        );

        return { id: indicator.id, data: output };
      } catch (err) {
        console.error(`[Fixture Mode] Failed to load fixture data:`, err);
        return { id: indicator.id, data: null };
      }
    }

    // Normal API mode - use migrated indicator name to handle old localStorage data
    try {
      // T036: Check cache first
      const indicatorName = migrateIndicatorNameForFetch(indicator.indicatorType.name);

      const cached = getCachedIndicator(
        symbol,
        interval,
        indicatorName,
        indicator.indicatorType.params,
        candleDateRange?.from,  // Include date range in cache key
        candleDateRange?.to     // Include date range in cache key
      );

      if (cached) {
        return { id: indicator.id, data: cached };
      }

      // T011: Instrument with performance logging
      console.log('[API] Fetching indicator from API:', indicatorName, 'range:', candleDateRange?.from, 'to', candleDateRange?.to);
      const data = await measurePerformance(
        `calculate_${indicatorName}`,
        'calculation',
        () => getIndicator(
          symbol,
          indicatorName,
          interval,
          indicator.indicatorType.params,
          undefined,  // limit (use default)
          candleDateRange?.from,  // Pass date range to API
          candleDateRange?.to     // Pass date range to API
        ),
        {
          symbol,
          indicator: indicatorName,
          interval,
          params: JSON.stringify(indicator.indicatorType.params)
        }
      );

      // T036: Cache the result
      if (data) {
        setCachedIndicator(
          symbol,
          interval,
          indicatorName,
          indicator.indicatorType.params,
          data,
          candleDateRange?.from,  // Include date range in cache key
          candleDateRange?.to     // Include date range in cache key
        );
      }

      return { id: indicator.id, data };
    } catch (err) {
      // Extract backend error message from Axios error
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as any).response?.data?.detail || err.message
        : err instanceof Error
        ? err.message
        : 'Unknown error';

      console.error(`Failed to fetch data for ${indicator.indicatorType.name}:`, errorMessage);

      return { id: indicator.id, data: null };
    }
  }, [symbol, interval, candleDateRange]);

  useEffect(() => {
    // Guard: Only fetch when we have candle data (FR-001)
    // This prevents duplicate indicator fetches before candles arrive
    const hasCandles = candles && candles.length > 0;

    if (!hasCandles) {
      return;
    }
    if (!isValidSymbol(symbol)) {
      // Clear any cached fetch keys when symbol becomes invalid
      fetchedRefs.current.clear();
      setDataMap({});
      return;
    }

    if (indicators.length === 0) {
      setDataMap({});
      fetchedRefs.current.clear();
      return;
    }

    // T031: Only clear fetched cache when symbol or interval changes
    // This prevents re-fetching when candles update (e.g., websocket updates)
    // CRITICAL: Also clear when dataVersion changes to force refetch with extended range (backfill)
    const cacheKey = `${symbol}:${interval}`;
    const isNewSymbol = currentCacheKeyRef.current !== cacheKey;

    // Track dataVersion changes for backfill detection
    const dataVersionChanged = dataVersion && dataVersion !== prevDataVersionRef.current;

    // Clear fetchedRefs when needed: symbol change OR backfill (dataVersion change)
    if (isNewSymbol || dataVersionChanged) {
      if (dataVersionChanged) {
        console.log('[useIndicatorData] dataVersion changed from', prevDataVersionRef.current, 'to', dataVersion, '- clearing fetchedRefs to trigger refetch with extended range');
      }
      if (isNewSymbol) {
        currentCacheKeyRef.current = cacheKey;
      }
      fetchedRefs.current.clear();
    }

    // Check if we need to fetch anything
    // Only fetch if: new symbol, or indicators were added, or params changed
    const indicatorsToFetch = indicators.filter(ind => {
      const fetchKey = getIndicatorFetchKey(ind);
      return !fetchedRefs.current.has(fetchKey);
    });

    // If no indicators need fetching and we have data, skip the fetchAll call
    // T015: Always re-fetch when dataVersion changes (e.g., during backfill)
    // This ensures indicators are recalculated with the new extended date range
    const hasExistingData = indicators.every(ind => {
      const fetchKey = getIndicatorFetchKey(ind);
      return fetchedRefs.current.has(fetchKey) && dataMapRef.current[ind.id] !== undefined;
    });

    // Skip fetch only if we have all data AND version hasn't changed
    if (hasExistingData && !isNewSymbol && indicatorsToFetch.length === 0 && dataVersion === prevDataVersionRef.current) {
      // Already have all indicator data for this version, skip fetching
      return;
    }

    // Update prevDataVersionRef AFTER skip guard to ensure version change triggers fetch
    if (dataVersionChanged) {
      prevDataVersionRef.current = dataVersion;
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

      // Performance: Mark indicator fetch start (T3)
      console.log(`%c[T3 START] Fetching ${indicators.length} indicators for ${symbol} ${interval}`, 'color: #9C27B0; font-weight: bold');

      const currentDataMap = dataMapRef.current;
      const results: IndicatorDataMap = { ...currentDataMap }; // Start with current state

      // Collect indicators that need fetching
      const indicatorsToFetch: IndicatorPane[] = [];
      for (const indicator of indicators) {
        const fetchKey = getIndicatorFetchKey(indicator);
        if (!fetchedRefs.current.has(fetchKey)) {
          indicatorsToFetch.push(indicator);
          fetchedRefs.current.add(fetchKey);
        }
      }

      if (indicatorsToFetch.length > 0) {
        // OPTIMIZATION: Use batch endpoint for multiple indicators (2+)
        // All indicators in this hook share the same symbol/interval by design
        const canBatch = indicatorsToFetch.length > 1;

        if (canBatch && !isFixtureMode()) {
          // Use batch endpoint
          try {
            console.log(`[Batch] Fetching ${indicatorsToFetch.length} indicators via batch endpoint`);

            // Prepare batch requests
            const batchRequests: IndicatorBatchRequest[] = indicatorsToFetch.map(ind => ({
              symbol,
              interval,
              indicator_name: migrateIndicatorNameForFetch(ind.indicatorType.name),
              params: ind.indicatorType.params,
              from_ts: candleDateRange?.from,
              to_ts: candleDateRange?.to,
            }));

            // Batch fetch
            const batchResponse = await batchGetIndicators(batchRequests);

            // Process results
            for (let i = 0; i < indicatorsToFetch.length; i++) {
              const indicator = indicatorsToFetch[i];
              const result = batchResponse.results[i];

              if (result) {
                // Cache the result
                const indicatorName = migrateIndicatorNameForFetch(indicator.indicatorType.name);
                setCachedIndicator(
                  symbol,
                  interval,
                  indicatorName,
                  indicator.indicatorType.params,
                  result,
                  candleDateRange?.from,
                  candleDateRange?.to
                );
                results[indicator.id] = result;
              } else {
                // Check if there was an error for this indicator
                const error = batchResponse.errors.find(e => e.index === i);
                if (error) {
                  console.error(`[Batch] Failed to fetch ${indicator.indicatorType.name}:`, error.error);
                }
                results[indicator.id] = null;
              }
            }

            console.log(`[Batch] Completed: ${batchResponse.cache_hits} cache hits, ${batchResponse.cache_misses} cache misses, ${batchResponse.total_duration_ms}ms`);
          } catch (err) {
            console.error('[Batch] Batch fetch failed, falling back to individual fetches:', err);
            // Fallback to individual fetches
            const individualFetches = indicatorsToFetch.map(ind => fetchIndicatorData(ind));
            const fetchedResults = await Promise.all(individualFetches);
            for (const { id, data } of fetchedResults) {
              results[id] = data;
            }
          }
        } else {
          // Use individual fetches (mixed symbol/interval or fixture mode)
          const individualFetches = indicatorsToFetch.map(ind => fetchIndicatorData(ind));
          const fetchedResults = await Promise.all(individualFetches);
          for (const { id, data } of fetchedResults) {
            results[id] = data;
          }
        }

        setDataMap(results);
      }

      // Performance: Mark indicator fetch complete (T4)
      console.log(`%c[T4 DONE] Fetched ${indicators.length} indicators for ${symbol} ${interval}`, 'color: #9C27B0; font-weight: bold');

      setIsLoading(false);
    };

    fetchAll();
  }, [indicators, symbol, interval, dataVersion, fetchIndicatorData, candleDateRange, candles]);

  return dataMap;
}

/**
 * Extended return type with loading state
 * T048: Expose loading state for skeleton UI
 */
export interface IndicatorDataMapWithLoading {
  [key: string]: IndicatorOutput | null | boolean | string | undefined;
  isLoading?: boolean;  // Changed from _isLoading - clearer property name
  error?: string | null;  // Changed from _error
}

/**
 * Fetches data for all active indicators with loading state
 * T048: Return loading state for skeleton UI
 *
 * @param indicators - List of active indicator panes
 * @param symbol - Current symbol
 * @param interval - Current interval
 * @param dataVersion - Optional version counter that increments when candle data changes (e.g., backfill)
 * @param candleDateRange - Optional date range for synchronized candle/indicator loading
 * @param candles - Candle data array (used for guard - only fetch when candles exist)
 * @returns Map of indicator ID to IndicatorOutput, with isLoading and error metadata
 */
export function useIndicatorDataWithLoading(
  indicators: IndicatorPane[],
  symbol: string,
  interval: string,
  dataVersion?: number,
  candleDateRange?: { from: string; to: string },
  candles?: Candle[]  // Added for guard - ensures we only fetch when candles exist
): IndicatorDataMapWithLoading {
  const dataMap = useIndicatorData(indicators, symbol, interval, dataVersion, candleDateRange, candles);  // Pass through
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track fetch state
  useEffect(() => {
    if (indicators.length === 0) {
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check if all indicators have data
    const allHaveData = indicators.every(ind => dataMap[ind.id] !== undefined);
    const anyHasNull = indicators.some(ind => dataMap[ind.id] === null);

    if (!allHaveData) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      if (anyHasNull) {
        setError('Some indicators failed to load');
      } else {
        setError(null);
      }
    }
  }, [indicators, dataMap]);

  return {
    ...dataMap,
    isLoading,  // Changed from _isLoading - clearer property name
    error,      // Changed from _error
  } as IndicatorDataMapWithLoading;
}
