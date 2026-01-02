/**
 * useIndicators hook - Manages global indicator state with localStorage persistence
 * Feature: Global Layout Persistence (TradingView-like behavior)
 *
 * Indicators are now global (not per-symbol) to enable layouts that transfer across tickers.
 */

import { useState, useCallback, useEffect } from 'react';
import type { IndicatorType, IndicatorPane, IndicatorStyle } from '../components/types/indicators';
import {
  listIndicatorsWithMetadata
} from '../api/indicators';
import { formatTvIndicatorLabel } from '../utils/indicatorLabel';
import { DEFAULT_INDICATOR_STYLE, INDICATOR_DEFAULT_COLORS } from '../components/types/indicators';

const STORAGE_KEY = 'tradingalert_indicators_global';

/**
 * T033 [US2] [P]: IndicatorState TypeScript interfaces
 */
export interface IndicatorState {
  indicators: IndicatorPane[];
  activeIndicatorId: string | null;
}

/**
 * Migration: Convert old indicator names (e.g., 'cci_20') to clean names ('cci')
 * Old format appended parameter suffixes to indicator names, new format uses clean names
 */
function migrateIndicatorName(name: string): string {
  // Pattern: indicator_name_number (e.g., 'cci_20', 'rsi_14', 'sma_50')
  const match = name.match(/^([a-zA-Z_]+)_(\d+(\.\d+)?)$/);
  if (match) {
    const baseName = match[1];
    // Check if it's a known indicator pattern (not something like 'adxvma_period')
    const knownIndicators = [
      'sma', 'ema', 'dema', 'tema', 'wma', 'hma', 'vwma', 'kama', 'mama',
      'rsi', 'cci', 'adx', 'aroon', 'mfi', 'willr', 'cmo', 'mom', 'roc',
      'atr', 'stoch', 'stochrsi', 'macd', 'bbands', 'kc', 'donchian',
      'uo', 'tsi', 'pgo', 'apo', 'ppo', 'ao', 'obv', 'fi', 'eri',
    ];
    if (knownIndicators.includes(baseName)) {
      console.log(`[useIndicators] Migrating indicator name: '${name}' -> '${baseName}'`);
      return baseName;
    }
  }
  return name;
}

/**
 * Load global indicators from localStorage
 */
function loadIndicatorsFromStorage(): IndicatorState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as IndicatorState;
      // Apply migration for old indicator names
      let needsSave = false;
      const migratedIndicators = data.indicators.map(ind => {
        const oldName = ind.indicatorType.name;
        const newName = migrateIndicatorName(oldName);
        if (newName !== oldName) {
          needsSave = true;
          return {
            ...ind,
            indicatorType: {
              ...ind.indicatorType,
              name: newName,
            },
          };
        }
        return ind;
      });
      if (needsSave) {
        data.indicators = migratedIndicators;
        saveIndicatorsToStorage(data);
      }
      return data;
    }
  } catch (e) {
    console.error('Failed to load indicators from localStorage:', e);
  }
  return { indicators: [], activeIndicatorId: null };
}

/**
 * Save global indicators to localStorage
 */
function saveIndicatorsToStorage(data: IndicatorState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save indicators to localStorage:', e);
  }
}

/**
 * Generate a unique ID for an indicator pane
 */
function generateIndicatorId(): string {
  return `indicator-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create indicator display name from type
 */
function getIndicatorDisplayName(type: IndicatorType): string {
  return formatTvIndicatorLabel(type.name, type.params);
}

/**
 * useIndicators hook
 *
 * Manages global indicator state with localStorage persistence.
 * Indicators are shared across all tickers (TradingView-like behavior).
 */
export function useIndicators() {
  const [indicators, setIndicators] = useState<IndicatorPane[]>([]);
  const [activeIndicatorId, setActiveIndicatorId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cache for indicator metadata to avoid repeated API calls
  const [indicatorMetadataCache, setIndicatorMetadataCache] = useState<Map<string, any> | null>(null);

  // Function to fetch and cache indicator metadata
  const fetchAndCacheIndicatorMetadata = useCallback(async () => {
    if (indicatorMetadataCache) {
      return indicatorMetadataCache; // Return cached data if available
    }

    try {
      const allIndicatorMetadata = await listIndicatorsWithMetadata();
      const indicatorMap = new Map();
      allIndicatorMetadata.forEach((indicator: any) => {
        indicatorMap.set(indicator.name, indicator);
      });

      setIndicatorMetadataCache(indicatorMap);
      return indicatorMap;
    } catch (error) {
      console.error('Error fetching indicator metadata:', error);
      return new Map(); // Return empty map if there's an error
    }
  }, [indicatorMetadataCache]);

  // Load global indicators on mount
  const loadIndicators = useCallback(() => {
    const stored = loadIndicatorsFromStorage();

    // Check if any indicators have missing or invalid category information
    const indicatorsWithMissingCategories = stored.indicators.filter(ind =>
      !ind.indicatorType.category ||
      (ind.indicatorType.category !== 'overlay' && ind.indicatorType.category !== 'oscillator')
    );

    // If there are indicators with missing categories, fetch the correct metadata
    if (indicatorsWithMissingCategories.length > 0) {
      // Fetch all indicator metadata from the backend in the background
      fetchAndCacheIndicatorMetadata()
        .then(indicatorMap => {
          // Update indicators with missing categories
          const updatedIndicators = stored.indicators.map(ind => {
            if (!ind.indicatorType.category ||
                (ind.indicatorType.category !== 'overlay' && ind.indicatorType.category !== 'oscillator')) {
              // Find the correct metadata for this indicator
              const metadata = indicatorMap.get(ind.indicatorType.name);
              if (metadata && metadata.category) {
                // Update the indicator with the correct category
                return {
                  ...ind,
                  indicatorType: {
                    ...ind.indicatorType,
                    category: metadata.category
                  }
                };
              }
            }
            return ind;
          });

          // Update the stored data with corrected indicators
          const updatedStored: IndicatorState = {
            ...stored,
            indicators: updatedIndicators
          };
          saveIndicatorsToStorage(updatedStored);

          // Update the state with corrected indicators
          setIndicators(updatedIndicators);
          setActiveIndicatorId(stored.activeIndicatorId);
          setIsLoaded(true);
        })
        .catch(error => {
          console.error('Error updating indicator categories:', error);
          // If there's an error, still use the original indicators
          setIndicators(stored.indicators);
          setActiveIndicatorId(stored.activeIndicatorId);
          setIsLoaded(true);
        });
    } else {
      // No indicators need category updates, proceed normally
      setIndicators(stored.indicators);
      setActiveIndicatorId(stored.activeIndicatorId);
      setIsLoaded(true);
    }
  }, [fetchAndCacheIndicatorMetadata]);

  // Load indicators once on mount (not when symbol changes)
  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  // Save global indicators
  const saveIndicators = useCallback((newIndicators: IndicatorPane[], newActiveId: string | null) => {
    const state: IndicatorState = {
      indicators: newIndicators,
      activeIndicatorId: newActiveId,
    };
    saveIndicatorsToStorage(state);
  }, []);

  // T035 [US2]: Implement addIndicator function
  // Phase 2: Add default style to new indicators
  const addIndicator = useCallback((indicatorType: IndicatorType) => {
    const defaultColor = INDICATOR_DEFAULT_COLORS?.[indicatorType.name.toLowerCase()]
      || DEFAULT_INDICATOR_STYLE.color;
    const defaultStyle: IndicatorStyle = {
      ...DEFAULT_INDICATOR_STYLE,
      color: defaultColor,
    };

    const newIndicator: IndicatorPane = {
      id: generateIndicatorId(),
      indicatorType,
      name: getIndicatorDisplayName(indicatorType),
      displaySettings: {
        visible: true,
        height: 25,
        position: indicators.length + 1,
      },
      focusState: 'active',
      style: defaultStyle,  // Phase 2: Add default style
    };

    const newIndicators = [...indicators, newIndicator];
    setIndicators(newIndicators);
    saveIndicators(newIndicators, activeIndicatorId);
    return newIndicator.id;
  }, [indicators, activeIndicatorId, saveIndicators]);

  // T036 [US2]: Implement removeIndicator function
  const removeIndicator = useCallback((indicatorId: string) => {
    const newIndicators = indicators.filter(ind => ind.id !== indicatorId);
    const newActiveId = activeIndicatorId === indicatorId ? null : activeIndicatorId;
    setIndicators(newIndicators);
    setActiveIndicatorId(newActiveId);
    saveIndicators(newIndicators, newActiveId);
  }, [indicators, activeIndicatorId, saveIndicators]);

  // T037 [US2]: Implement toggleIndicator function
  const toggleIndicator = useCallback((indicatorId: string) => {
    const newIndicators = indicators.map(ind =>
      ind.id === indicatorId
        ? { ...ind, displaySettings: { ...ind.displaySettings, visible: !ind.displaySettings.visible } }
        : ind
    );
    setIndicators(newIndicators);
    saveIndicators(newIndicators, activeIndicatorId);
  }, [indicators, activeIndicatorId, saveIndicators]);

  // T038 [US2]: Implement updateIndicatorParams function
  const updateIndicatorParams = useCallback((indicatorId: string, newParams: Record<string, number | string>) => {
    const newIndicators = indicators.map(ind => {
      if (ind.id === indicatorId) {
        const updatedType: IndicatorType = {
          ...ind.indicatorType,
          params: { ...ind.indicatorType.params, ...newParams },
        };
        const newName = getIndicatorDisplayName(updatedType);
        return {
          ...ind,
          indicatorType: updatedType,
          name: newName,
        };
      }
      return ind;
    });
    setIndicators(newIndicators);
    saveIndicators(newIndicators, activeIndicatorId);
  }, [indicators, activeIndicatorId, saveIndicators]);

  // Phase 2: Update indicator style (color, line width, show last value)
  const updateIndicatorStyle = useCallback((indicatorId: string, newStyle: Partial<IndicatorStyle>) => {
    const newIndicators = indicators.map(ind => {
      if (ind.id === indicatorId) {
        return {
          ...ind,
          style: {
            ...(ind.style || DEFAULT_INDICATOR_STYLE),
            ...newStyle,
          },
        };
      }
      return ind;
    });
    setIndicators(newIndicators);
    saveIndicators(newIndicators, activeIndicatorId);
  }, [indicators, activeIndicatorId, saveIndicators]);

  return {
    indicators,
    activeIndicatorId,
    isLoaded,
    addIndicator,
    removeIndicator,
    toggleIndicator,
    updateIndicatorParams,
    updateIndicatorStyle,  // Phase 2: Expose new function
    setActiveIndicatorId: useCallback((id: string | null) => {
      setActiveIndicatorId(id);
      saveIndicators(indicators, id);
    }, [indicators, saveIndicators]),
  };
}
