/**
 * useIndicators hook - Manages indicator state per symbol with localStorage persistence
 * Feature: 003-advanced-indicators
 * Phase 4: User Story 2 - Per-Symbol Indicator Toggles and Persistence
 * Tasks: T032-T040
 */

import { useState, useCallback, useEffect } from 'react';
import type { IndicatorType, IndicatorPane } from '../components/types/indicators';
import { listIndicatorsWithMetadata } from '../api/indicators';

const STORAGE_KEY = 'tradingalert_indicators';

/**
 * T033 [US2] [P]: IndicatorState TypeScript interfaces
 */
export interface IndicatorState {
  indicators: IndicatorPane[];
  activeIndicatorId: string | null;
}

export interface PerSymbolIndicators {
  [symbol: string]: IndicatorState;
}

/**
 * Load indicators from localStorage for a specific symbol
 * T034 [US2] [P]: Create localStorage utility functions
 */
function loadIndicatorsFromStorage(): PerSymbolIndicators {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load indicators from localStorage:', e);
  }
  return {};
}

/**
 * Save indicators to localStorage
 */
function saveIndicatorsToStorage(data: PerSymbolIndicators): void {
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
  const params = Object.entries(type.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return params ? `${type.name.toUpperCase()} (${params})` : type.name.toUpperCase();
}

/**
 * useIndicators hook
 * T032 [US2] [P]: create useIndicators hook
 *
 * Manages indicator state with localStorage persistence per symbol
 */
export function useIndicators(currentSymbol: string) {
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

  // T039 [US2]: Implement loadIndicatorsForSymbol function
  const loadIndicatorsForSymbol = useCallback((symbol: string) => {
    const stored = loadIndicatorsFromStorage();
    const symbolState = stored[symbol];

    if (symbolState) {
      // Check if any indicators have missing or invalid category information
      const indicatorsWithMissingCategories = symbolState.indicators.filter(ind =>
        !ind.indicatorType.category ||
        (ind.indicatorType.category !== 'overlay' && ind.indicatorType.category !== 'oscillator')
      );

      // If there are indicators with missing categories, fetch the correct metadata
      if (indicatorsWithMissingCategories.length > 0) {
        // Fetch all indicator metadata from the backend in the background
        fetchAndCacheIndicatorMetadata()
          .then(indicatorMap => {
            // Update indicators with missing categories
            const updatedIndicators = symbolState.indicators.map(ind => {
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
            const updatedStored = { ...stored };
            updatedStored[symbol] = {
              ...symbolState,
              indicators: updatedIndicators
            };
            saveIndicatorsToStorage(updatedStored);

            // Update the state with corrected indicators
            setIndicators(updatedIndicators);
            setActiveIndicatorId(symbolState.activeIndicatorId);
            setIsLoaded(true);
          })
          .catch(error => {
            console.error('Error updating indicator categories:', error);
            // If there's an error, still use the original indicators
            setIndicators(symbolState.indicators);
            setActiveIndicatorId(symbolState.activeIndicatorId);
            setIsLoaded(true);
          });
      } else {
        // No indicators need category updates, proceed normally
        setIndicators(symbolState.indicators);
        setActiveIndicatorId(symbolState.activeIndicatorId);
        setIsLoaded(true);
      }
    } else {
      setIndicators([]);
      setActiveIndicatorId(null);
      setIsLoaded(true);
    }
  }, [fetchAndCacheIndicatorMetadata]);

  // T040 [US2]: Implement saveIndicatorsForSymbol function
  const saveIndicatorsForSymbol = useCallback((symbol: string, newIndicators: IndicatorPane[], newActiveId: string | null) => {
    const stored = loadIndicatorsFromStorage();
    stored[symbol] = {
      indicators: newIndicators,
      activeIndicatorId: newActiveId,
    };
    saveIndicatorsToStorage(stored);
  }, []);

  // Load indicators when symbol changes
  useEffect(() => {
    if (currentSymbol) {
      loadIndicatorsForSymbol(currentSymbol);
    }
  }, [currentSymbol, loadIndicatorsForSymbol]);

  // T035 [US2]: Implement addIndicator function
  const addIndicator = useCallback((indicatorType: IndicatorType) => {
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
    };

    const newIndicators = [...indicators, newIndicator];
    setIndicators(newIndicators);
    saveIndicatorsForSymbol(currentSymbol, newIndicators, activeIndicatorId);
    return newIndicator.id;
  }, [indicators, currentSymbol, activeIndicatorId, saveIndicatorsForSymbol]);

  // T036 [US2]: Implement removeIndicator function
  const removeIndicator = useCallback((indicatorId: string) => {
    const newIndicators = indicators.filter(ind => ind.id !== indicatorId);
    const newActiveId = activeIndicatorId === indicatorId ? null : activeIndicatorId;
    setIndicators(newIndicators);
    setActiveIndicatorId(newActiveId);
    saveIndicatorsForSymbol(currentSymbol, newIndicators, newActiveId);
  }, [indicators, currentSymbol, activeIndicatorId, saveIndicatorsForSymbol]);

  // T037 [US2]: Implement toggleIndicator function
  const toggleIndicator = useCallback((indicatorId: string) => {
    const newIndicators = indicators.map(ind =>
      ind.id === indicatorId
        ? { ...ind, displaySettings: { ...ind.displaySettings, visible: !ind.displaySettings.visible } }
        : ind
    );
    setIndicators(newIndicators);
    saveIndicatorsForSymbol(currentSymbol, newIndicators, activeIndicatorId);
  }, [indicators, currentSymbol, activeIndicatorId, saveIndicatorsForSymbol]);

  // T038 [US2]: Implement updateIndicatorParams function
  const updateIndicatorParams = useCallback((indicatorId: string, newParams: Record<string, number | string>) => {
    const newIndicators = indicators.map(ind => {
      if (ind.id === indicatorId) {
        const updatedType: IndicatorType = {
          ...ind.indicatorType,
          params: { ...ind.indicatorType.params, ...newParams },
        };
        return {
          ...ind,
          indicatorType: updatedType,
          name: getIndicatorDisplayName(updatedType),
        };
      }
      return ind;
    });
    setIndicators(newIndicators);
    saveIndicatorsForSymbol(currentSymbol, newIndicators, activeIndicatorId);
  }, [indicators, currentSymbol, activeIndicatorId, saveIndicatorsForSymbol]);

  return {
    indicators,
    activeIndicatorId,
    isLoaded,
    addIndicator,
    removeIndicator,
    toggleIndicator,
    updateIndicatorParams,
    setActiveIndicatorId: useCallback((id: string | null) => {
      setActiveIndicatorId(id);
      saveIndicatorsForSymbol(currentSymbol, indicators, id);
    }, [currentSymbol, indicators, saveIndicatorsForSymbol]),
  };
}
