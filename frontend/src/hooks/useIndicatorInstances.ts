/**
 * useIndicatorInstances hook - Manages overlay indicator instances with API-first storage
 * Feature: 001-indicator-storage
 * Phase 3: User Story 1 - Multi-Device Indicator Sync
 *
 * Provides CRUD operations for indicator instances with:
 * - API-first storage (PostgreSQL) for authenticated users
 * - localStorage fallback for offline scenarios (FR-008)
 * - Retry logic with exponential backoff (30-second timeout)
 * - Optimistic updates with rollback on error
 *
 * This is a NEW implementation that replaces the localStorage-only version.
 * The old version is preserved in useIndicatorInstancesLegacy.ts for reference.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { IndicatorInstance, IndicatorListIndex, IndicatorStyle } from '../components/types/indicators';
import { DEFAULT_INDICATOR_STYLE, INDICATOR_DEFAULT_COLORS } from '../components/types/indicators';
import { useAuth } from '../hooks/useAuthContext';

// API base URL (note: VITE_API_URL should NOT include /api/v1 path)
const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://polishedcharts-backend.onrender.com')

// Retry configuration (SC-003: <1 second sync for typical configs, 30-second timeout)
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds

// localStorage key templates (for fallback)
const INSTANCE_KEY_PREFIX = 'indicatorinstance';
const LIST_KEY = 'indicatorlistglobal';

// Debounce delay for localStorage writes (ms) - only used for fallback
const WRITE_DEBOUNCE_MS = 100;

/**
 * Sleep helper for retry delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  const jitter = Math.random() * 1000; // Add up to 1 second of jitter
  return exponentialDelay + jitter;
}

/**
 * Generate a UUID v4 identifier for indicator instances
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get default color for an indicator type
 */
function getDefaultColor(indicatorName: string): string {
  return INDICATOR_DEFAULT_COLORS[indicatorName.toLowerCase()] || DEFAULT_INDICATOR_STYLE.color;
}

/**
 * Create a new indicator instance with defaults
 */
function createIndicatorInstance(
  indicatorName: string,
  params: Record<string, number | string>
): IndicatorInstance {
  const id = generateUUID();
  const defaultColor = getDefaultColor(indicatorName);

  // Generate display name (e.g., "SMA (20)")
  const paramValues = Object.values(params).join(', ');
  const displayName = `${indicatorName.toUpperCase()}(${paramValues})`;

  return {
    id,
    indicatorType: {
      category: 'overlay',
      name: indicatorName,
      params,
    },
    displayName,
    style: {
      ...DEFAULT_INDICATOR_STYLE,
      color: defaultColor,
    },
    isVisible: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Convert IndicatorInstance to API format
 */
function instanceToAPI(instance: IndicatorInstance) {
  return {
    uuid: instance.id,
    indicator_name: instance.indicatorType.name.toLowerCase(),
    indicator_category: instance.indicatorType.category,
    indicator_params: instance.indicatorType.params,
    display_name: instance.displayName,
    style: instance.style,
    is_visible: instance.isVisible,
  };
}

/**
 * Convert API response to IndicatorInstance
 */
function apiToInstance(apiResponse: any): IndicatorInstance {
  return {
    id: apiResponse.uuid,
    indicatorType: {
      category: apiResponse.indicator_category,
      name: apiResponse.indicator_name,
      params: apiResponse.indicator_params,
    },
    displayName: apiResponse.display_name,
    style: apiResponse.style,
    isVisible: apiResponse.is_visible,
    createdAt: apiResponse.created_at,
  };
}

// =============================================================================
// localStorage Fallback Functions (FR-008)
// =============================================================================

/**
 * Safe localStorage setItem with error handling
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.warn('[useIndicatorInstances] localStorage quota exceeded:', key);
      return false;
    }
    console.error('[useIndicatorInstances] localStorage error:', error);
    return false;
  }
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('[useIndicatorInstances] localStorage read error:', error);
    return null;
  }
}

function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('[useIndicatorInstances] localStorage remove error:', error);
    return false;
  }
}

/**
 * Load global indicator list from localStorage
 */
function loadIndicatorList(): IndicatorListIndex | null {
  const data = safeGetItem(LIST_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data) as IndicatorListIndex;
  } catch (error) {
    console.error('[useIndicatorInstances] Failed to parse indicator list:', error);
    return null;
  }
}

/**
 * Save global indicator list to localStorage
 */
function saveIndicatorList(listIndex: IndicatorListIndex): boolean {
  return safeSetItem(LIST_KEY, JSON.stringify(listIndex));
}

/**
 * Load a single indicator instance from localStorage
 */
function loadIndicatorInstance(id: string): IndicatorInstance | null {
  const key = `${INSTANCE_KEY_PREFIX}${id}`;
  const data = safeGetItem(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as IndicatorInstance;
  } catch (error) {
    console.error('[useIndicatorInstances] Failed to parse indicator instance:', error);
    return null;
  }
}

/**
 * Save a single indicator instance to localStorage
 */
function saveIndicatorInstance(instance: IndicatorInstance): boolean {
  const key = `${INSTANCE_KEY_PREFIX}${instance.id}`;
  return safeSetItem(key, JSON.stringify(instance));
}

/**
 * Remove a single indicator instance from localStorage
 */
function removeIndicatorInstance(id: string): boolean {
  const key = `${INSTANCE_KEY_PREFIX}${id}`;
  return safeRemoveItem(key);
}

/**
 * Clear all indicators from localStorage
 */
function clearLocalStorageIndicators(): void {
  const listIndex = loadIndicatorList();
  if (listIndex) {
    for (const id of listIndex.instances) {
      removeIndicatorInstance(id);
    }
  }
  safeRemoveItem(LIST_KEY);
}

// =============================================================================
// Result Types
// =============================================================================

export interface AddIndicatorResult {
  success: boolean;
  instanceId?: string;
  error?: string;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useIndicatorInstances() {
  const { user, isAuthenticated } = useAuth();
  const [instances, setInstances] = useState<IndicatorInstance[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Refs for tracking pending operations
  const pendingWritesRef = useRef<Map<string, IndicatorInstance>>(new Map());
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);

  /**
   * Fetch indicators from API with retry logic
   */
  const fetchIndicatorsFromAPI = useCallback(async (token: string): Promise<IndicatorInstance[]> => {
    const axios = (await import('axios')).default;
    
    const response = await axios.get(`${API_BASE_URL}/api/v1/indicator-configs`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: 10000, // 10 second timeout
    });

    return response.data.map(apiToInstance);
  }, []);

  /**
   * Load indicators - try API first, fallback to localStorage (FR-008)
   */
  const loadIndicators = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      if (isAuthenticated && user) {
        // Authenticated user - try API first
        try {
          const token = await user.getIdToken();
          const apiInstances = await fetchIndicatorsFromAPI(token);
          setInstances(apiInstances);
          setIsOffline(false);
        } catch (apiError) {
          console.warn('[useIndicatorInstances] API fetch failed, using localStorage fallback:', apiError);
          // Fallback to localStorage (FR-008)
          const listIndex = loadIndicatorList();
          if (listIndex) {
            const loadedInstances: IndicatorInstance[] = [];
            for (const id of listIndex.instances) {
              const instance = loadIndicatorInstance(id);
              if (instance) loadedInstances.push(instance);
            }
            setInstances(loadedInstances);
            setIsOffline(true); // Show offline indicator
          } else {
            setInstances([]);
          }
          setError(apiError instanceof Error ? apiError : new Error('API fetch failed'));
        }
      } else {
        // Guest user - use localStorage only
        const listIndex = loadIndicatorList();
        if (listIndex) {
          const loadedInstances: IndicatorInstance[] = [];
          for (const id of listIndex.instances) {
            const instance = loadIndicatorInstance(id);
            if (instance) loadedInstances.push(instance);
          }
          setInstances(loadedInstances);
        } else {
          setInstances([]);
        }
        setIsOffline(false);
      }
    } catch (err) {
      console.error('[useIndicatorInstances] Failed to load indicators:', err);
      setError(err instanceof Error ? err : new Error('Failed to load indicators'));
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
      isLoadingRef.current = false;
    }
  }, [isAuthenticated, user, fetchIndicatorsFromAPI]);

  // Load indicators on mount and when auth state changes
  useEffect(() => {
    loadIndicators();
  }, [isAuthenticated, user]);

  /**
   * Create indicator via API with retry logic
   */
  const createIndicatorAPI = useCallback(async (instance: IndicatorInstance, token: string): Promise<void> => {
    const axios = (await import('axios')).default;
    
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await axios.post(
          `${API_BASE_URL}/api/v1/indicator-configs`,
          instanceToAPI(instance),
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            timeout: 10000,
          }
        );
        return; // Success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to create indicator');
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = calculateRetryDelay(attempt);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }, []);

  /**
   * Delete indicator via API with retry logic
   */
  const deleteIndicatorAPI = useCallback(async (instanceId: string, token: string): Promise<void> => {
    const axios = (await import('axios')).default;
    
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await axios.delete(
          `${API_BASE_URL}/api/v1/indicator-configs/${instanceId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            timeout: 10000,
          }
        );
        return; // Success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to delete indicator');
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = calculateRetryDelay(attempt);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }, []);

  /**
   * Update indicator via API with retry logic
   */
  const updateIndicatorAPI = useCallback(async (instance: IndicatorInstance, token: string): Promise<void> => {
    const axios = (await import('axios')).default;
    
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await axios.put(
          `${API_BASE_URL}/api/v1/indicator-configs/${instance.id}`,
          {
            indicator_params: instance.indicatorType.params,
            display_name: instance.displayName,
            style: instance.style,
            is_visible: instance.isVisible,
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            timeout: 10000,
          }
        );
        return; // Success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to update indicator');
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = calculateRetryDelay(attempt);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }, []);

  /**
   * Add a new indicator instance
   * Returns synchronously for backward compatibility (optimistic update).
   * API sync happens in background.
   */
  const addIndicator = useCallback((
    indicatorName: string,
    params: Record<string, number | string>
  ): AddIndicatorResult => {
    const newInstance = createIndicatorInstance(indicatorName, params);

    // Optimistic update - add to state immediately (synchronous)
    const newInstances = [...instances, newInstance];
    setInstances(newInstances);

    // Sync with API in background if authenticated (fire and forget)
    if (isAuthenticated && user) {
      user.getIdToken().then(token => {
        createIndicatorAPI(newInstance, token).catch(err => {
          // Rollback on error
          console.error('[useIndicatorInstances] Failed to create indicator in API, rolling back:', err);
          setInstances(instances); // Rollback state

          // Fallback to localStorage
          saveIndicatorInstance(newInstance);
          const listIndex: IndicatorListIndex = {
            instances: newInstances.map(inst => inst.id),
            updatedAt: new Date().toISOString(),
          };
          saveIndicatorList(listIndex);
          setIsOffline(true);
        });
      });
    } else {
      // Guest mode - save to localStorage immediately
      saveIndicatorInstance(newInstance);
      const listIndex: IndicatorListIndex = {
        instances: newInstances.map(inst => inst.id),
        updatedAt: new Date().toISOString(),
      };
      saveIndicatorList(listIndex);
    }

    return { success: true, instanceId: newInstance.id };
  }, [instances, isAuthenticated, user, createIndicatorAPI]);

  /**
   * Remove an indicator instance
   * Returns synchronously for backward compatibility (optimistic update).
   * API sync happens in background.
   */
  const removeIndicator = useCallback((instanceId: string): boolean => {
    const previousInstances = instances;

    // Optimistic update - remove from state immediately
    const newInstances = instances.filter(inst => inst.id !== instanceId);
    setInstances(newInstances);

    // Sync with API in background if authenticated (fire and forget)
    if (isAuthenticated && user) {
      user.getIdToken().then(token => {
        deleteIndicatorAPI(instanceId, token).catch(err => {
          // Rollback on error
          console.error('[useIndicatorInstances] Failed to delete indicator from API, rolling back:', err);
          setInstances(previousInstances); // Rollback state
        });
      });
    } else {
      // Guest mode - remove from localStorage immediately
      removeIndicatorInstance(instanceId);
      const listIndex: IndicatorListIndex = {
        instances: newInstances.map(inst => inst.id),
        updatedAt: new Date().toISOString(),
      };
      saveIndicatorList(listIndex);
    }
    return true;
  }, [instances, isAuthenticated, user, deleteIndicatorAPI]);

  /**
   * Update instance style
   * Returns synchronously for backward compatibility (optimistic update).
   * API sync happens in background.
   */
  const updateStyle = useCallback((
    instanceId: string,
    style: Partial<IndicatorStyle>
  ): boolean => {
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    const updatedStyle: IndicatorStyle = {
      ...instance.style,
      ...style,
    };

    const updatedInstance: IndicatorInstance = {
      ...instance,
      style: updatedStyle,
    };

    // Optimistic update
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Sync with API in background if authenticated (fire and forget)
    if (isAuthenticated && user) {
      user.getIdToken().then(token => {
        updateIndicatorAPI(updatedInstance, token).catch(err => {
          // Rollback on error
          console.error('[useIndicatorInstances] Failed to update style in API, rolling back:', err);
          setInstances(instances);
        });
      });
    } else {
      // Guest mode - save to localStorage immediately
      saveIndicatorInstance(updatedInstance);
    }
    return true;
  }, [instances, isAuthenticated, user, updateIndicatorAPI]);

  /**
   * Update instance parameters
   * Returns synchronously for backward compatibility (optimistic update).
   * API sync happens in background.
   */
  const updateParams = useCallback((
    instanceId: string,
    params: Record<string, number | string>
  ): boolean => {
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    const updatedParams = { ...instance.indicatorType.params, ...params };
    const paramValues = Object.values(updatedParams).join(', ');
    const displayName = `${instance.indicatorType.name.toUpperCase()}(${paramValues})`;

    const updatedInstance: IndicatorInstance = {
      ...instance,
      indicatorType: {
        ...instance.indicatorType,
        params: updatedParams,
      },
      displayName,
    };

    // Optimistic update
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Sync with API in background if authenticated (fire and forget)
    if (isAuthenticated && user) {
      user.getIdToken().then(token => {
        updateIndicatorAPI(updatedInstance, token).catch(err => {
          // Rollback on error
          console.error('[useIndicatorInstances] Failed to update params in API, rolling back:', err);
          setInstances(instances);
        });
      });
    } else {
      // Guest mode - save to localStorage immediately
      saveIndicatorInstance(updatedInstance);
    }
    return true;
  }, [instances, isAuthenticated, user, updateIndicatorAPI]);

  /**
   * Toggle instance visibility
   * Returns synchronously for backward compatibility (optimistic update).
   * API sync happens in background.
   */
  const toggleVisibility = useCallback((instanceId: string): boolean => {
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    const updatedInstance: IndicatorInstance = {
      ...instance,
      isVisible: !instance.isVisible,
    };

    // Optimistic update
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Sync with API in background if authenticated (fire and forget)
    if (isAuthenticated && user) {
      user.getIdToken().then(token => {
        updateIndicatorAPI(updatedInstance, token).catch(err => {
          // Rollback on error
          console.error('[useIndicatorInstances] Failed to toggle visibility in API, rolling back:', err);
          setInstances(instances);
        });
      });
    } else {
      // Guest mode - save to localStorage immediately
      saveIndicatorInstance(updatedInstance);
    }
    return true;
  }, [instances, isAuthenticated, user, updateIndicatorAPI]);

  /**
   * Update instance (generic method)
   * Returns synchronously for backward compatibility (optimistic update).
   * API sync happens in background.
   */
  const updateInstance = useCallback((
    instanceId: string,
    updates: Partial<IndicatorInstance>
  ): boolean => {
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    const updatedInstance: IndicatorInstance = {
      ...instance,
      ...updates,
    };

    // Optimistic update
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Sync with API in background if authenticated (fire and forget)
    if (isAuthenticated && user) {
      user.getIdToken().then(token => {
        updateIndicatorAPI(updatedInstance, token).catch(err => {
          // Rollback on error
          console.error('[useIndicatorInstances] Failed to update instance in API, rolling back:', err);
          setInstances(instances);
        });
      });
    } else {
      // Guest mode - save to localStorage immediately
      saveIndicatorInstance(updatedInstance);
    }
    return true;
  }, [instances, isAuthenticated, user, updateIndicatorAPI]);

  /**
   * Clear localStorage (for guest -> auth transition)
   */
  const clearLocalStorage = useCallback(() => {
    clearLocalStorageIndicators();
  }, []);

  return {
    instances,
    isLoaded,
    isLoading,
    error,
    isOffline,
    addIndicator,
    removeIndicator,
    updateStyle,
    updateParams,
    toggleVisibility,
    updateInstance,
    clearLocalStorage,
  };
}
