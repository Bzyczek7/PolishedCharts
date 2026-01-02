/**
 * LocalStorage hook with schema versioning and automatic migrations.
 *
 * Manages guest data (alerts, watchlist, layouts) in localStorage with:
 * - Schema version tracking
 * - Automatic migrations on app load
 * - UUID generation for merge operations
 * - ISO 8601 timestamp tracking
 *
 * Feature: 011-firebase-auth
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  LocalStorageData,
  GuestAlert,
  GuestWatchlist,
  GuestLayout,
  StorageMigration,
  UseLocalStorageReturn,
} from '../types/auth';
import { LOCAL_STORAGE_KEY, LOCAL_STORAGE_SCHEMA_VERSION } from '../types/auth';

/**
 * Generate a UUID for merge operations.
 * Simple implementation that doesn't require external libraries.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate ISO 8601 timestamp in UTC.
 */
function generateTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Add UUID and timestamps to a guest alert.
 */
function addAlertMetadata(alert: Partial<GuestAlert>): GuestAlert {
  const now = generateTimestamp();
  return {
    uuid: alert.uuid || generateUUID(),
    symbol: alert.symbol || '',
    condition: alert.condition || 'above',
    target: alert.target ?? 0,
    enabled: alert.enabled ?? true,
    created_at: alert.created_at || now,
    updated_at: alert.updated_at || now,
  };
}

/**
 * Add UUID and timestamps to a guest watchlist.
 */
function addWatchlistMetadata(watchlist: Partial<GuestWatchlist>): GuestWatchlist {
  const now = generateTimestamp();
  return {
    uuid: watchlist.uuid || generateUUID(),
    symbols: watchlist.symbols || [],
    sort_order: watchlist.sort_order || watchlist.symbols || [],
    created_at: watchlist.created_at || now,
    updated_at: watchlist.updated_at || now,
  };
}

/**
 * Add UUID and timestamps to a guest layout.
 */
function addLayoutMetadata(layout: Partial<GuestLayout>): GuestLayout {
  const now = generateTimestamp();
  return {
    uuid: layout.uuid || generateUUID(),
    name: layout.name || 'My Layout',
    config: layout.config || { indicators: [], chartSettings: { interval: '1d', chartType: 'candlestick' } },
    created_at: layout.created_at || now,
    updated_at: layout.updated_at || now,
  };
}

// =============================================================================
// Schema Migrations
// =============================================================================

/**
 * Migration definitions for localStorage schema changes.
 *
 * Each migration has a version number and a migrate function that
 * transforms data from the previous version to the current version.
 */
const migrations: StorageMigration[] = [
  {
    version: 1,
    migrate: (data: any): LocalStorageData => {
      // v0 -> v1 migration: Add UUIDs, timestamps to all entities
      const alerts = (data.alerts || []).map(addAlertMetadata);
      const watchlist = data.watchlist
        ? addWatchlistMetadata(data.watchlist)
        : addWatchlistMetadata({});
      const layouts = (data.layouts || []).map(addLayoutMetadata);

      return {
        schemaVersion: 1,
        alerts,
        watchlist,
        layouts,
      };
    },
  },
  // Future migrations will be added here
  // {
  //   version: 2,
  //   migrate: (data: any): LocalStorageData => { ... }
  // },
];

/**
 * Run migrations on localStorage data.
 */
function runMigrations(data: any): LocalStorageData {
  let currentData = data;
  const currentVersion = data?.schemaVersion || 0;

  // Run each migration in sequence
  for (const migration of migrations) {
    if (currentVersion < migration.version) {
      console.log(`Running localStorage migration: v${currentVersion} -> v${migration.version}`);
      currentData = migration.migrate(currentData);
      currentData.schemaVersion = migration.version;
    }
  }

  return currentData as LocalStorageData;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing localStorage with schema migrations.
 *
 * @returns LocalStorage data and operations
 */
export function useLocalStorage(): UseLocalStorageReturn {
  const [data, setData] = useState<LocalStorageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      let parsedData: any;

      if (!raw) {
        // Initialize with empty schema
        parsedData = {
          schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
          alerts: [],
          watchlist: addWatchlistMetadata({}),
          layouts: [],
        };
      } else {
        parsedData = JSON.parse(raw);
      }

      // Run migrations if needed
      const migratedData = runMigrations(parsedData);

      // Save migrated data back to localStorage
      if (raw && JSON.stringify(migratedData) !== raw) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(migratedData));
      }

      setData(migratedData);
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load localStorage:', error);
      // Initialize with empty data on error
      const emptyData: LocalStorageData = {
        schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
        alerts: [],
        watchlist: addWatchlistMetadata({}),
        layouts: [],
      };
      setData(emptyData);
      setIsLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save data to localStorage.
   */
  const save = useCallback((newData: LocalStorageData) => {
    try {
      // Ensure schema version is set
      newData.schemaVersion = LOCAL_STORAGE_SCHEMA_VERSION;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
    } catch (error) {
      console.error('Failed to save localStorage:', error);
      throw error;
    }
  }, []);

  /**
   * Clear all localStorage data.
   */
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      const emptyData: LocalStorageData = {
        schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
        alerts: [],
        watchlist: addWatchlistMetadata({}),
        layouts: [],
      };
      setData(emptyData);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      throw error;
    }
  }, []);

  /**
   * Get current schema version.
   */
  const getSchemaVersion = useCallback((): number => {
    return data?.schemaVersion || LOCAL_STORAGE_SCHEMA_VERSION;
  }, [data]);

  return {
    data,
    isLoading,
    isLoaded,
    save,
    clear,
    getSchemaVersion,
  };
}

/**
 * Helper functions for adding entities to localStorage.
 */
export const localStorageHelpers = {
  /**
   * Add an alert to localStorage.
   */
  addAlert: (currentData: LocalStorageData, alert: Partial<GuestAlert>): LocalStorageData => {
    const newAlert = addAlertMetadata(alert);
    return {
      ...currentData,
      alerts: [...currentData.alerts, newAlert],
    };
  },

  /**
   * Update an alert in localStorage.
   */
  updateAlert: (currentData: LocalStorageData, uuid: string, updates: Partial<GuestAlert>): LocalStorageData => {
    return {
      ...currentData,
      alerts: currentData.alerts.map((alert) =>
        alert.uuid === uuid
          ? { ...alert, ...updates, updated_at: generateTimestamp() }
          : alert
      ),
    };
  },

  /**
   * Remove an alert from localStorage.
   */
  removeAlert: (currentData: LocalStorageData, uuid: string): LocalStorageData => {
    return {
      ...currentData,
      alerts: currentData.alerts.filter((alert) => alert.uuid !== uuid),
    };
  },

  /**
   * Update watchlist in localStorage.
   */
  updateWatchlist: (currentData: LocalStorageData, symbols: string[], sortOrder?: string[]): LocalStorageData => {
    return {
      ...currentData,
      watchlist: {
        ...currentData.watchlist,
        symbols,
        sort_order: sortOrder || symbols,
        updated_at: generateTimestamp(),
      },
    };
  },

  /**
   * Add a layout to localStorage.
   */
  addLayout: (currentData: LocalStorageData, layout: Partial<GuestLayout>): LocalStorageData => {
    const newLayout = addLayoutMetadata(layout);
    return {
      ...currentData,
      layouts: [...currentData.layouts, newLayout],
    };
  },

  /**
   * Update a layout in localStorage.
   */
  updateLayout: (currentData: LocalStorageData, uuid: string, updates: Partial<GuestLayout>): LocalStorageData => {
    return {
      ...currentData,
      layouts: currentData.layouts.map((layout) =>
        layout.uuid === uuid
          ? { ...layout, ...updates, updated_at: generateTimestamp() }
          : layout
      ),
    };
  },

  /**
   * Remove a layout from localStorage.
   */
  removeLayout: (currentData: LocalStorageData, uuid: string): LocalStorageData => {
    return {
      ...currentData,
      layouts: currentData.layouts.filter((layout) => layout.uuid !== uuid),
    };
  },
};
