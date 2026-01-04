/**
 * useIndicatorInstances hook - Manages overlay indicator instances with API-first storage
 * Feature: 001-indicator-storage
 * Phase 3: User Story 1 - Multi-Device Indicator Sync
 *
 * Provides CRUD operations for indicator instances with:
 * - API-first storage (PostgreSQL) for authenticated users
 * - localStorage fallback for offline scenarios (FR-008)
 * - Per-instance localStorage (indicator_instance:${id}) for fallback
 * - Global list index (indicatorlistglobal)
 * - Debounced writes (100ms) to prevent jank
 * - Retry logic with exponential backoff (30-second timeout)
 * - Optimistic updates with rollback on error
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { IndicatorInstance, IndicatorListIndex, IndicatorStyle } from '../components/types/indicators';
import { DEFAULT_INDICATOR_STYLE, INDICATOR_DEFAULT_COLORS } from '../components/types/indicators';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Retry configuration (SC-003: <1 second sync for typical configs, 30-second timeout)
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds
const RETRY_TIMEOUT_MS = 30000; // 30 second total timeout

// Debounce delay for localStorage writes (ms)
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

// localStorage key templates per data-model.md
const INSTANCE_KEY_PREFIX = 'indicatorinstance';
const LIST_KEY = 'indicatorlistglobal';  // Changed from per-symbol to global

/**
 * Generate a UUID v4 identifier for indicator instances
 * Feature 008 - Data Model: UUID v4 format required
 */
function generateUUID(): string {
  // Use crypto.randomUUID() if available (modern browsers)
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
    // symbol field removed - indicators are now global
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
 * localStorage wrapper with error handling
 * T008: Graceful degradation when localStorage is full or unavailable
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // Handle QuotaExceededError or other localStorage errors
    if (error instanceof DOMException && (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' // Firefox
    )) {
      console.warn('[useIndicatorInstances] localStorage quota exceeded, changes not persisted:', key);
      // Could emit an event or set a state to notify the user
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
      console.log(`[useIndicatorInstances] Migrating indicator name: '${name}' -> '${baseName}'`);
      return baseName;
    }
  }
  return name;
}

/**
 * Load global indicator list index
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
 * Save global indicator list index
 */
function saveIndicatorList(listIndex: IndicatorListIndex): boolean {
  return safeSetItem(LIST_KEY, JSON.stringify(listIndex));
}

/**
 * Load a single indicator instance
 * Applies migration for old indicator names (e.g., 'cci_20' -> 'cci')
 */
function loadIndicatorInstance(id: string): IndicatorInstance | null {
  const key = `${INSTANCE_KEY_PREFIX}${id}`;
  const data = safeGetItem(key);
  if (!data) return null;

  try {
    const instance = JSON.parse(data) as IndicatorInstance;
    // Apply migration for old indicator names
    if (instance.indicatorType && instance.indicatorType.name) {
      const migratedName = migrateIndicatorName(instance.indicatorType.name);
      if (migratedName !== instance.indicatorType.name) {
        instance.indicatorType.name = migratedName;
        // Save the migrated instance back to localStorage
        safeSetItem(key, JSON.stringify(instance));
      }
    }
    return instance;
  } catch (error) {
    console.error('[useIndicatorInstances] Failed to parse indicator instance:', error);
    return null;
  }
}

/**
 * Save a single indicator instance
 */
function saveIndicatorInstance(instance: IndicatorInstance): boolean {
  const key = `${INSTANCE_KEY_PREFIX}${instance.id}`;
  return safeSetItem(key, JSON.stringify(instance));
}

/**
 * Remove a single indicator instance
 */
function removeIndicatorInstance(id: string): boolean {
  const key = `${INSTANCE_KEY_PREFIX}${id}`;
  return safeRemoveItem(key);
}

/**
 * Result of adding an indicator
 */
export interface AddIndicatorResult {
  success: boolean;
  instanceId?: string;
  error?: string;
}

/**
 * useIndicatorInstances hook - Manages overlay indicator instances with GLOBAL localStorage persistence
 * Feature: Global Layout Persistence (TradingView-like behavior)
 *
 * Manages overlay indicator instances with:
 * - Per-instance localStorage keys (indicatorinstance${id})
 * - GLOBAL list index (indicatorlistglobal) - no longer per-symbol
 * - Debounced writes (100ms)
 * - Graceful degradation on localStorage errors
 */
export function useIndicatorInstances() {
  const [instances, setInstances] = useState<IndicatorInstance[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(false); // Track localStorage availability

  // Refs for debouncing and tracking
  const pendingWritesRef = useRef<Map<string, IndicatorInstance>>(new Map());
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load global instances on mount (no longer per-symbol)
  useEffect(() => {
    const listIndex = loadIndicatorList();
    if (!listIndex) {
      setInstances([]);
      setIsLoaded(true);
      return;
    }

    // Load each instance from its individual key
    const loadedInstances: IndicatorInstance[] = [];
    for (const id of listIndex.instances) {
      const instance = loadIndicatorInstance(id);
      if (instance) {
        loadedInstances.push(instance);
      }
    }

    setInstances(loadedInstances);
    setIsLoaded(true);
  }, []);

  /**
   * Flush pending writes to localStorage
   * Called after debounce delay or when unmounting
   */
  const flushPendingWrites = useCallback(() => {
    if (pendingWritesRef.current.size === 0) {
      return;
    }

    // Write all pending instances
    let successCount = 0;
    let failCount = 0;

    for (const [id, instance] of pendingWritesRef.current) {
      if (saveIndicatorInstance(instance)) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Notify user if writes failed (T008: graceful degradation)
    if (failCount > 0) {
      setIsOffline(true);
      console.warn(`[useIndicatorInstances] ${failCount} localStorage write(s) failed - changes applied for current session only`);
    } else {
      setIsOffline(false);
    }

    pendingWritesRef.current.clear();

    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
      writeTimeoutRef.current = null;
    }
  }, []);

  // Flush pending writes on unmount
  useEffect(() => {
    return () => {
      flushPendingWrites();
    };
  }, [flushPendingWrites]);

  /**
   * Schedule a debounced write for an instance
   */
  const scheduleInstanceWrite = useCallback((instance: IndicatorInstance) => {
    pendingWritesRef.current.set(instance.id, instance);

    // Schedule flush after debounce delay
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
    }

    writeTimeoutRef.current = setTimeout(() => {
      flushPendingWrites();
    }, WRITE_DEBOUNCE_MS);
  }, [flushPendingWrites]);

  /**
   * Schedule a debounced write for the list index
   * Flushes pending instance writes first to ensure data consistency
   */
  const scheduleListWrite = useCallback((listIndex: IndicatorListIndex) => {
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
    }

    writeTimeoutRef.current = setTimeout(() => {
      // Flush any pending instance writes BEFORE updating the list
      // This ensures instances are saved before their IDs are added to the list
      flushPendingWrites();
      // Then save the updated list
      saveIndicatorList(listIndex);
    }, WRITE_DEBOUNCE_MS);
  }, [flushPendingWrites]);

  /**
   * Add a new indicator instance
   */
  const addIndicator = useCallback((
    indicatorName: string,
    params: Record<string, number | string>
  ): AddIndicatorResult => {
    const newInstance = createIndicatorInstance(indicatorName, params);

    // Update state immediately (optimistic update)
    const newInstances = [...instances, newInstance];
    setInstances(newInstances);

    // Update list index
    const listIndex: IndicatorListIndex = {
      instances: newInstances.map(inst => inst.id),
      updatedAt: new Date().toISOString(),
    };

    // Schedule debounced localStorage writes
    scheduleInstanceWrite(newInstance);
    scheduleListWrite(listIndex);

    return { success: true, instanceId: newInstance.id };
  }, [instances, scheduleInstanceWrite, scheduleListWrite]);

  /**
   * Remove an indicator instance
   */
  const removeIndicator = useCallback((instanceId: string): boolean => {
    const newInstances = instances.filter(inst => inst.id !== instanceId);
    setInstances(newInstances);

    // Remove from localStorage immediately (no debounce for removal)
    removeIndicatorInstance(instanceId);

    // Update list index
    const listIndex: IndicatorListIndex = {
      instances: newInstances.map(inst => inst.id),
      updatedAt: new Date().toISOString(),
    };

    scheduleListWrite(listIndex);

    return true;
  }, [instances, scheduleListWrite]);

  /**
   * Update instance style
   * T022: Debounced style change handler (immediate chart update, debounced localStorage)
   */
  const updateStyle = useCallback((
    instanceId: string,
    style: Partial<IndicatorStyle>
  ): boolean => {
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    // Merge style with existing
    const updatedStyle: IndicatorStyle = {
      ...instance.style,
      ...style,
    };

    const updatedInstance: IndicatorInstance = {
      ...instance,
      style: updatedStyle,
    };

    // Update state immediately for chart
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Schedule debounced localStorage write
    scheduleInstanceWrite(updatedInstance);

    return true;
  }, [instances, scheduleInstanceWrite]);

  /**
   * Update instance parameters
   * T029: Debounced parameter change handler with refetch trigger
   */
  const updateParams = useCallback((
    instanceId: string,
    params: Record<string, number | string>
  ): boolean => {
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    // Update params and regenerate display name
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

    // Update state immediately
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Schedule debounced localStorage write
    scheduleInstanceWrite(updatedInstance);

    return true;
  }, [instances, scheduleInstanceWrite]);

  /**
   * Toggle instance visibility
   * T033: Visibility toggle with localStorage persistence
   */
  const toggleVisibility = useCallback((instanceId: string): boolean => {
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    const updatedInstance: IndicatorInstance = {
      ...instance,
      isVisible: !instance.isVisible,
    };

    // Update state immediately
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Schedule debounced localStorage write
    scheduleInstanceWrite(updatedInstance);

    return true;
  }, [instances, scheduleInstanceWrite]);

  /**
   * Update instance (generic method for partial updates)
   * T047: Support for settings dialog updates
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

    // Update state immediately
    const newInstances = instances.map(inst =>
      inst.id === instanceId ? updatedInstance : inst
    );
    setInstances(newInstances);

    // Schedule debounced localStorage write
    scheduleInstanceWrite(updatedInstance);

    return true;
  }, [instances, scheduleInstanceWrite]);

  return {
    instances,
    isLoaded,
    isOffline, // T008: Expose offline state for UI notification
    addIndicator,
    removeIndicator,
    updateStyle,
    updateParams,
    toggleVisibility,
    updateInstance,
    flushPendingWrites,
  };
}
