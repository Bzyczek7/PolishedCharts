/**
 * One-time migration script: Move localStorage indicators to cloud database.
 * Feature: 001-indicator-storage
 * 
 * This script reads all indicator configurations from localStorage and uploads them
 * to the cloud database via the POST /api/v1/indicator-configs endpoint.
 * 
 * Usage:
 * 1. Open browser console on your PolishedCharts instance
 * 2. Copy and paste this entire script
 * 3. Call await window.migrateIndicatorsToCloud()
 * 
 * T084 [P]: Create one-time migration script
 */

interface LocalStorageIndicatorInstance {
  id: string;
  indicatorType: {
    category: string;
    name: string;
    params: Record<string, number | string>;
  };
  displayName: string;
  style: {
    color: string;
    lineWidth: number;
    showLastValue?: boolean;
    seriesColors?: Record<string, string>;
  };
  isVisible: boolean;
  createdAt: string;
}

interface LocalStorageListIndex {
  instances: string[];
  updatedAt: string;
}

interface MigrationResult {
  success: boolean;
  total: number;
  migrated: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Load all indicators from localStorage
 */
function loadIndicatorsFromLocalStorage(): LocalStorageIndicatorInstance[] {
  const indicators: LocalStorageIndicatorInstance[] = [];
  
  // Load the global indicator list
  const listKey = 'indicatorlistglobal';
  const listData = localStorage.getItem(listKey);
  
  if (!listData) {
    console.log('[Migration] No indicator list found in localStorage.');
    return indicators;
  }
  
  try {
    const listIndex: LocalStorageListIndex = JSON.parse(listData);
    
    // Load each indicator instance
    for (const id of listIndex.instances) {
      const instanceKey = `indicatorinstance${id}`;
      const instanceData = localStorage.getItem(instanceKey);
      
      if (instanceData) {
        try {
          const instance: LocalStorageIndicatorInstance = JSON.parse(instanceData);
          indicators.push(instance);
        } catch (e) {
          console.error(`[Migration] Failed to parse indicator ${id}:`, e);
        }
      }
    }
  } catch (e) {
    console.error('[Migration] Failed to parse indicator list:', e);
  }
  
  return indicators;
}

/**
 * Upload indicator to cloud database
 */
async function uploadIndicatorToCloud(
  indicator: LocalStorageIndicatorInstance,
  authToken: string
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = (window as any).__API_URL__ || (import.meta.env.DEV ? 'http://localhost:8000/api/v1' : 'https://polishedcharts-backend.onrender.com/api/v1');
  
  const payload = {
    indicator_name: indicator.indicatorType.name.toLowerCase(),
    indicator_category: indicator.indicatorType.category,
    indicator_params: indicator.indicatorType.params,
    display_name: indicator.displayName,
    style: indicator.style,
    is_visible: indicator.isVisible,
  };
  
  try {
    const response = await fetch(`${apiUrl}/indicator-configs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }
    
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Main migration function
 */
async function migrateIndicatorsToCloud(): Promise<MigrationResult> {
  console.log('[Migration] Starting indicator migration from localStorage to cloud...');
  
  // Check if user is authenticated
  const auth = (window as any).__firebase_auth__;
  if (!auth || !auth.currentUser) {
    return {
      success: false,
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [{ id: 'N/A', error: 'User not authenticated. Please sign in first.' }],
    };
  }
  
  // Get Firebase auth token
  let authToken: string;
  try {
    authToken = await auth.currentUser.getIdToken(true);
  } catch (e) {
    return {
      success: false,
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [{ id: 'N/A', error: 'Failed to get auth token. Please sign in again.' }],
    };
  }
  
  // Load indicators from localStorage
  const indicators = loadIndicatorsFromLocalStorage();
  const total = indicators.length;
  
  if (total === 0) {
    console.log('[Migration] No indicators found in localStorage to migrate.');
    return {
      success: true,
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [],
    };
  }
  
  console.log(`[Migration] Found ${total} indicators in localStorage. Starting upload...`);
  
  // Upload each indicator
  let migrated = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];
  
  for (const indicator of indicators) {
    console.log(`[Migration] Uploading indicator: ${indicator.displayName} (${indicator.indicatorType.name})`);
    
    const result = await uploadIndicatorToCloud(indicator, authToken);
    
    if (result.success) {
      migrated++;
      console.log(`[Migration] ✓ Successfully migrated: ${indicator.displayName}`);
    } else {
      failed++;
      errors.push({ id: indicator.id, error: result.error || 'Unknown error' });
      console.error(`[Migration] ✗ Failed to migrate ${indicator.displayName}:`, result.error);
    }
  }
  
  // Summary
  console.log('\n[Migration] Migration complete!');
  console.log(`[Migration] Total: ${total}`);
  console.log(`[Migration] Migrated: ${migrated}`);
  console.log(`[Migration] Failed: ${failed}`);
  
  if (failed > 0) {
    console.error('[Migration] Errors:');
    errors.forEach(({ id, error }) => {
      console.error(`[Migration]   - ${id}: ${error}`);
    });
  }
  
  return {
    success: failed === 0,
    total,
    migrated,
    failed,
    errors,
  };
}

/**
 * Cleanup function: Remove migrated indicators from localStorage
 * WARNING: This is irreversible! Only call after successful migration.
 */
function cleanupLocalStorageAfterMigration(): void {
  console.log('[Cleanup] Removing migrated indicators from localStorage...');
  
  const listKey = 'indicatorlistglobal';
  const listData = localStorage.getItem(listKey);
  
  if (!listData) {
    console.log('[Cleanup] No indicator list found.');
    return;
  }
  
  try {
    const listIndex: LocalStorageListIndex = JSON.parse(listData);
    
    // Remove each indicator instance
    for (const id of listIndex.instances) {
      const instanceKey = `indicatorinstance${id}`;
      localStorage.removeItem(instanceKey);
      console.log(`[Cleanup] Removed: ${instanceKey}`);
    }
    
    // Remove the list itself
    localStorage.removeItem(listKey);
    console.log(`[Cleanup] Removed: ${listKey}`);
    
    console.log('[Cleanup] Cleanup complete! All indicators removed from localStorage.');
  } catch (e) {
    console.error('[Cleanup] Error during cleanup:', e);
  }
}

/**
 * Verification function: Count indicators in cloud vs localStorage
 */
async function verifyMigration(): Promise<{ localStorage: number; cloud: number }> {
  console.log('[Verification] Checking indicator counts...');
  
  // Count in localStorage
  const localIndicators = loadIndicatorsFromLocalStorage();
  const localStorageCount = localIndicators.length;
  
  // Count in cloud
  const auth = (window as any).__firebase_auth__;
  const apiUrl = (window as any).__API_URL__ || (import.meta.env.DEV ? 'http://localhost:8000/api/v1' : 'https://polishedcharts-backend.onrender.com/api/v1');
  
  let cloudCount = 0;
  if (auth && auth.currentUser) {
    try {
      const authToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${apiUrl}/indicator-configs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (response.ok) {
        const cloudIndicators = await response.json();
        cloudCount = cloudIndicators.length;
      }
    } catch (e) {
      console.error('[Verification] Failed to fetch cloud indicators:', e);
    }
  }
  
  console.log(`[Verification] localStorage: ${localStorageCount} indicators`);
  console.log(`[Verification] Cloud: ${cloudCount} indicators`);
  
  if (localStorageCount === cloudCount) {
    console.log('[Verification] ✓ Counts match! Migration appears successful.');
  } else {
    console.warn(`[Verification] ✗ Count mismatch! Expected ${localStorageCount}, got ${cloudCount}.`);
  }
  
  return { localStorage: localStorageCount, cloud: cloudCount };
}

// Export functions for browser console access
(window as any).migrateIndicatorsToCloud = migrateIndicatorsToCloud;
(window as any).cleanupLocalStorageAfterMigration = cleanupLocalStorageAfterMigration;
(window as any).verifyMigration = verifyMigration;

console.log('========================================');
console.log('Indicator Migration Script Loaded');
console.log('========================================');
console.log('Available functions:');
console.log('  1. await window.migrateIndicatorsToCloud()');
console.log('     - Migrates all localStorage indicators to cloud');
console.log('');
console.log('  2. window.verifyMigration()');
console.log('     - Verifies migration by comparing counts');
console.log('');
console.log('  3. window.cleanupLocalStorageAfterMigration()');
console.log('     - Removes all indicators from localStorage (IRREVERSIBLE!)');
console.log('========================================');
console.log('');
console.log('Usage:');
console.log('  1. Sign in to your account');
console.log('  2. Run: await window.migrateIndicatorsToCloud()');
console.log('  3. Verify: window.verifyMigration()');
console.log('  4. If successful: window.cleanupLocalStorageAfterMigration()');
console.log('========================================');
