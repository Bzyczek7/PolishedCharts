/**
 * Manual Verification Script for Feature 008: Overlay Indicator Rendering
 * User Story 1: Display Overlay Indicators on Price Chart
 *
 * This script provides a quick way to verify that:
 * 1. Overlay indicator instances can be added
 * 2. They render correctly on the chart
 * 3. They can be removed
 * 4. Styling (color, lineWidth) is applied correctly
 *
 * Run this in the browser console when the app is running.
 */

import type { IndicatorInstance } from '../components/types/indicators';

// ============================================================================
// MANUAL VERIFICATION STEPS
// ============================================================================

/**
 * Step 1: Verify the hooks are available
 * Run this in browser console to check if Feature 008 hooks are loaded
 */
export function verifyHooksAvailable() {
  console.log('=== Feature 008: Manual Verification ===');
  console.log('1. Checking if hooks are available...');
  console.log('   - useIndicatorInstances:', typeof (window as any).useIndicatorInstances !== 'undefined');
  console.log('   - useChartSeries:', typeof (window as any).useChartSeries !== 'undefined');
  console.log('   - formatIndicatorData:', typeof (window as any).formatIndicatorData !== 'undefined');
  console.log('');
  console.log('If all show true, the hooks are loaded.');
}

/**
 * Step 2: Check localStorage schema
 * Verify that overlay instances are stored with correct keys
 */
export function checkLocalStorageSchema(symbol: string = 'AAPL') {
  console.log('=== LocalStorage Schema Check ===');
  console.log(`Symbol: ${symbol}`);
  console.log('');

  // Check for indicator_list:${symbol}
  const listKey = `indicator_list:${symbol}`;
  const listData = localStorage.getItem(listKey);
  console.log(`1. ${listKey}:`, listData ? '✓ EXISTS' : '✗ NOT FOUND');
  if (listData) {
    try {
      const parsed = JSON.parse(listData);
      console.log('   Instances:', parsed.instances);
      console.log('   UpdatedAt:', parsed.updatedAt);
    } catch (e) {
      console.log('   ERROR: Failed to parse', e);
    }
  }

  // Check for individual indicator_instance:${id} keys
  console.log('');
  console.log('2. Individual instance keys (indicator_instance:${id}):');
  const instanceKeys = Object.keys(localStorage)
    .filter(key => key.startsWith('indicator_instance:'));
  console.log(`   Found ${instanceKeys.length} instance(s)`);

  instanceKeys.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const instance = JSON.parse(data) as IndicatorInstance;
        console.log(`   - ${key}:`);
        console.log(`     id: ${instance.id}`);
        console.log(`     symbol: ${instance.symbol}`);
        console.log(`     indicatorType: ${instance.indicatorType.name}`);
        console.log(`     displayName: ${instance.displayName}`);
        console.log(`     style.color: ${instance.style.color}`);
        console.log(`     isVisible: ${instance.isVisible}`);
      } catch (e) {
        console.log(`   - ${key}: ERROR parsing`, e);
      }
    }
  });
}

/**
 * Step 3: Create a test overlay instance directly
 * This bypasses the UI to test the core functionality
 */
export function createTestOverlayInstance(symbol: string = 'AAPL'): IndicatorInstance {
  const instance: IndicatorInstance = {
    id: crypto.randomUUID(),
    symbol,
    indicatorType: {
      category: 'overlay',
      name: 'sma',
      params: { period: 20 },
    },
    displayName: 'SMA(20)',
    style: {
      color: '#ff6d00', // orange
      lineWidth: 2,
      showLastValue: true,
    },
    isVisible: true,
    createdAt: new Date().toISOString(),
  };

  // Save to localStorage
  const instanceKey = `indicator_instance:${instance.id}`;
  localStorage.setItem(instanceKey, JSON.stringify(instance));

  // Update the list
  const listKey = `indicator_list:${symbol}`;
  let listData = localStorage.getItem(listKey);
  let instances: string[] = [];

  if (listData) {
    try {
      const parsed = JSON.parse(listData);
      instances = parsed.instances || [];
    } catch (e) {
      console.error('Failed to parse indicator list', e);
    }
  }

  instances.push(instance.id);
  localStorage.setItem(listKey, JSON.stringify({
    instances,
    updatedAt: new Date().toISOString(),
  }));

  console.log('=== Created Test Overlay Instance ===');
  console.log('ID:', instance.id);
  console.log('Symbol:', instance.symbol);
  console.log('Type:', instance.indicatorType.name);
  console.log('Params:', instance.indicatorType.params);
  console.log('Style:', instance.style);
  console.log('');
  console.log('✓ Instance saved to localStorage');
  console.log('✓ Refresh the page to see it render on the chart (if data is available)');

  return instance;
}

/**
 * Step 4: Remove a test instance
 */
export function removeTestInstance(instanceId: string, symbol: string = 'AAPL') {
  console.log('=== Removing Test Instance ===');
  console.log('ID:', instanceId);

  // Remove individual instance
  const instanceKey = `indicator_instance:${instanceId}`;
  localStorage.removeItem(instanceKey);
  console.log(`✓ Removed ${instanceKey}`);

  // Update the list
  const listKey = `indicator_list:${symbol}`;
  const listData = localStorage.getItem(listKey);
  if (listData) {
    try {
      const parsed = JSON.parse(listData);
      parsed.instances = (parsed.instances || []).filter((id: string) => id !== instanceId);
      localStorage.setItem(listKey, JSON.stringify(parsed));
      console.log(`✓ Removed from ${listKey}`);
    } catch (e) {
      console.error('Failed to update list', e);
    }
  }

  console.log('');
  console.log('✓ Refresh the page to see it removed from the chart');
}

/**
 * Step 5: Clear all overlay instances for a symbol
 */
export function clearAllOverlayInstances(symbol: string = 'AAPL') {
  console.log('=== Clearing All Overlay Instances ===');
  console.log('Symbol:', symbol);

  const listKey = `indicator_list:${symbol}`;
  const listData = localStorage.getItem(listKey);

  if (listData) {
    try {
      const parsed = JSON.parse(listData);
      const instances = parsed.instances || [];

      instances.forEach((id: string) => {
        const instanceKey = `indicator_instance:${id}`;
        localStorage.removeItem(instanceKey);
        console.log(`✓ Removed ${instanceKey}`);
      });

      localStorage.removeItem(listKey);
      console.log(`✓ Removed ${listKey}`);
    } catch (e) {
      console.error('Failed to clear instances', e);
    }
  } else {
    console.log('No instances found for', symbol);
  }

  console.log('');
  console.log('✓ Refresh the page to see all overlays removed');
}

/**
 * Complete Manual Test Flow
 * Run each step in order:
 */
export function runManualTest(symbol: string = 'AAPL') {
  console.clear();
  console.log('═══════════════════════════════════════════════');
  console.log('   Feature 008: Manual Verification Test');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Step 1: Check hooks
  verifyHooksAvailable();
  console.log('');

  // Step 2: Check initial localStorage state
  checkLocalStorageSchema(symbol);
  console.log('');

  // Step 3: Create test instance
  const instance = createTestOverlayInstance(symbol);
  console.log('');
  console.log('>>> NEXT STEP: Refresh the page <<<');
  console.log('After refresh, you should see:');
  console.log('  - An orange SMA(20) line on the chart');
  console.log('  - The line should have the indicator data points');
  console.log('');

  // Return cleanup function
  return () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('   Cleanup: Removing test instance');
    console.log('═══════════════════════════════════════════════');
    removeTestInstance(instance.id, symbol);
  };
}

// ============================================================================
// BROWSER CONSOLE EXPORTS
// ============================================================================

// Export functions to window object for browser console access
if (typeof window !== 'undefined') {
  (window as any).Feature008Test = {
    verifyHooksAvailable,
    checkLocalStorageSchema,
    createTestOverlayInstance,
    removeTestInstance,
    clearAllOverlayInstances,
    runManualTest,
  };
}

export default {
  verifyHooksAvailable,
  checkLocalStorageSchema,
  createTestOverlayInstance,
  removeTestInstance,
  clearAllOverlayInstances,
  runManualTest,
};
