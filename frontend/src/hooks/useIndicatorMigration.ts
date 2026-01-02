/**
 * useIndicatorMigration hook - One-time migration from per-symbol to global indicator storage
 * Feature: Global Layout Persistence (TradingView-like behavior)
 *
 * Migrates:
 * - Pane indicators: tradingalert_indicators → tradingalert_indicators_global
 * - Overlay instances: indicatorlist${symbol} → indicatorlistglobal
 * - Removes per-symbol coupling to enable layouts that transfer across tickers
 */

import { useEffect, useState } from 'react';

interface IndicatorState {
  indicators: any[];
  activeIndicatorId: string | null;
}

interface PerSymbolIndicators {
  [symbol: string]: IndicatorState;
}

interface IndicatorListIndex {
  instances: string[];
  updatedAt: string | null;
}

const MIGRATION_FLAG = 'indicator_migration_v1';
const PANES_STORAGE_KEY_OLD = 'tradingalert_indicators';  // Actual current key
const PANES_STORAGE_KEY_NEW = 'tradingalert_indicators_global';
const OVERLAY_LIST_PREFIX_OLD = 'indicatorlist';
const OVERLAY_LIST_KEY_NEW = 'indicatorlistglobal';
const INSTANCE_KEY_PREFIX = 'indicatorinstance';

/**
 * Migration hook that runs once on app mount
 */
export function useIndicatorMigration(): { isMigrating: boolean; migrationComplete: boolean } {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);

  useEffect(() => {
    // Check if migration already ran
    const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG);
    if (alreadyMigrated) {
      setMigrationComplete(true);
      return;
    }

    const performMigration = () => {
      console.log('[useIndicatorMigration] Starting migration from per-symbol to global storage...');
      setIsMigrating(true);

      try {
        // Step 1: Backup existing data
        console.log('[useIndicatorMigration] Step 1: Creating backups...');
        createBackups();

        // Step 2: Migrate pane indicators
        console.log('[useIndicatorMigration] Step 2: Migrating pane indicators...');
        migratePaneIndicators();

        // Step 3: Migrate overlay instances
        console.log('[useIndicatorMigration] Step 3: Migrating overlay instances...');
        migrateOverlayInstances();

        // Step 4: Mark migration as complete
        localStorage.setItem(MIGRATION_FLAG, Date.now().toString());
        console.log('[useIndicatorMigration] Migration complete!');
        setMigrationComplete(true);
      } catch (error) {
        console.error('[useIndicatorMigration] Migration failed:', error);
        // Don't set flag so migration can be retried
      } finally {
        setIsMigrating(false);
      }
    };

    // Run migration asynchronously to avoid blocking initial render
    const timer = setTimeout(performMigration, 100);
    return () => clearTimeout(timer);
  }, []);

  return { isMigrating, migrationComplete };
}

/**
 * Create backups of all existing data
 */
function createBackups(): void {
  // Backup pane indicators
  const panes = localStorage.getItem(PANES_STORAGE_KEY_OLD);
  if (panes) {
    localStorage.setItem(`${PANES_STORAGE_KEY_OLD}_backup`, panes);
    console.log('[useIndicatorMigration] Backed up pane indicators');
  }

  // Backup overlay lists (per-symbol)
  const allKeys = Object.keys(localStorage);
  const overlayListKeys = allKeys.filter(key => key.startsWith(OVERLAY_LIST_PREFIX_OLD));

  overlayListKeys.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      localStorage.setItem(`${key}_backup`, data);
    }
  });
  console.log(`[useIndicatorMigration] Backed up ${overlayListKeys.length} overlay lists`);
}

/**
 * Migrate pane indicators from per-symbol to global
 */
function migratePaneIndicators(): void {
  const stored = localStorage.getItem(PANES_STORAGE_KEY_OLD);
  if (!stored) {
    console.log('[useIndicatorMigration] No existing pane indicators found');
    return;
  }

  try {
    const perSymbolData = JSON.parse(stored) as PerSymbolIndicators;
    const symbols = Object.keys(perSymbolData);

    if (symbols.length === 0) {
      console.log('[useIndicatorMigration] No symbols with pane indicators');
      return;
    }

    console.log(`[useIndicatorMigration] Migrating pane indicators from ${symbols.length} symbols:`, symbols);

    // Collect unique indicator types across all symbols
    const indicatorTypeMap = new Map<string, any[]>();

    symbols.forEach(symbol => {
      const symbolState = perSymbolData[symbol];
      if (symbolState?.indicators) {
        symbolState.indicators.forEach(indicator => {
          const typeKey = `${indicator.indicatorType.name}_${JSON.stringify(indicator.indicatorType.params)}`;

          if (!indicatorTypeMap.has(typeKey)) {
            indicatorTypeMap.set(typeKey, []);
          }
          indicatorTypeMap.get(typeKey)!.push({ symbol, indicator });
        });
      }
    });

    // Merge strategy: Use most common params for each indicator type
    const mergedIndicators: any[] = [];

    indicatorTypeMap.forEach((instances, typeKey) => {
      if (instances.length > 0) {
        // Use the most recent instance (by createdAt if available, or last in array)
        const selectedInstance = instances[instances.length - 1];
        mergedIndicators.push(selectedInstance.indicator);
        console.log(`[useIndicatorMigration] Merged indicator ${typeKey} from ${instances.length} symbols`);
      }
    });

    // Determine active indicator ID (use most common across symbols)
    const activeIdMap = new Map<string, number>();
    symbols.forEach(symbol => {
      const symbolState = perSymbolData[symbol];
      if (symbolState?.activeIndicatorId) {
        const count = activeIdMap.get(symbolState.activeIndicatorId) || 0;
        activeIdMap.set(symbolState.activeIndicatorId, count + 1);
      }
    });

    let mostCommonActiveId: string | null = null;
    let maxCount = 0;
    activeIdMap.forEach((count, id) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonActiveId = id;
      }
    });

    const globalState: IndicatorState = {
      indicators: mergedIndicators,
      activeIndicatorId: mostCommonActiveId
    };

    // Write global state
    localStorage.setItem(PANES_STORAGE_KEY_NEW, JSON.stringify(globalState));
    console.log(`[useIndicatorMigration] Migrated ${mergedIndicators.length} pane indicators to global storage`);
  } catch (error) {
    console.error('[useIndicatorMigration] Failed to migrate pane indicators:', error);
    throw error;
  }
}

/**
 * Migrate overlay instances from per-symbol lists to global list
 */
function migrateOverlayInstances(): void {
  // Get all per-symbol overlay lists
  const allKeys = Object.keys(localStorage);
  const overlayListKeys = allKeys.filter(key =>
    key.startsWith(OVERLAY_LIST_PREFIX_OLD) &&
    !key.includes('_backup') &&
    key !== OVERLAY_LIST_PREFIX_OLD &&
    key !== OVERLAY_LIST_KEY_NEW
  );

  if (overlayListKeys.length === 0) {
    console.log('[useIndicatorMigration] No existing overlay lists found');
    return;
  }

  console.log(`[useIndicatorMigration] Found ${overlayListKeys.length} overlay lists to migrate`);

  // Collect all instance IDs from all symbols
  const allInstanceIds = new Set<string>();
  const instancesBySymbol: Record<string, string[]> = {};

  overlayListKeys.forEach(listKey => {
    try {
      const symbol = listKey.substring(OVERLAY_LIST_PREFIX_OLD.length);
      const data = localStorage.getItem(listKey);

      if (data) {
        const listIndex = JSON.parse(data) as IndicatorListIndex;
        const instances = listIndex.instances || [];

        console.log(`[useIndicatorMigration] Found ${instances.length} instances for symbol ${symbol}`);

        instances.forEach(instanceId => {
          allInstanceIds.add(instanceId);

          // Track which symbols had this instance
          if (!instancesBySymbol[instanceId]) {
            instancesBySymbol[instanceId] = [];
          }
          instancesBySymbol[instanceId].push(symbol);
        });

        // Backup individual instances referenced by this list
        instances.forEach(instanceId => {
          const instanceKey = `${INSTANCE_KEY_PREFIX}${instanceId}`;
          const instanceData = localStorage.getItem(instanceKey);
          if (instanceData) {
            localStorage.setItem(`${instanceKey}_backup`, instanceData);
          }
        });
      }
    } catch (error) {
      console.error(`[useIndicatorMigration] Failed to process list ${listKey}:`, error);
    }
  });

  // Remove symbol field from migrated instances
  console.log(`[useIndicatorMigration] Removing symbol field from ${allInstanceIds.size} instances`);
  allInstanceIds.forEach(instanceId => {
    const instanceKey = `${INSTANCE_KEY_PREFIX}${instanceId}`;
    const instanceData = localStorage.getItem(instanceKey);

    if (instanceData) {
      try {
        const instance = JSON.parse(instanceData);
        // Remove symbol field
        delete instance.symbol;
        // Write back without symbol field
        localStorage.setItem(instanceKey, JSON.stringify(instance));
      } catch (error) {
        console.error(`[useIndicatorMigration] Failed to update instance ${instanceId}:`, error);
      }
    }
  });

  // Create global list with all instance IDs
  const globalListIndex: IndicatorListIndex = {
    instances: Array.from(allInstanceIds),
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(OVERLAY_LIST_KEY_NEW, JSON.stringify(globalListIndex));
  console.log(`[useIndicatorMigration] Migrated ${allInstanceIds.size} overlay instances to global list`);
}
