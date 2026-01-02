/**
 * Manual Migration Script: Guest Watchlist to Authenticated User Account
 *
 * INSTRUCTIONS:
 * 1. Open your browser's Developer Console (F12 or Cmd+Option+I)
 * 2. Copy and paste this entire script into the console
 * 3. Press Enter to run the migration
 * 4. The script will migrate your localStorage data to your account
 *
 * The script does:
 * - Reads localStorage watchlist/alerts/layouts
 * - Sends to merge API endpoint
 * - Clears localStorage after successful merge
 * - Shows merge statistics
 */

(async function migrateGuestData() {
  const LOCAL_STORAGE_KEY = 'polishedcharts_data';
  const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';

  console.log('🚀 Starting guest data migration...');

  // Step 1: Read localStorage data
  const localStorageRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!localStorageRaw) {
    console.error('❌ No localStorage data found. Key:', LOCAL_STORAGE_KEY);
    console.log('If you have data, check the key name in localStorage.');
    return;
  }

  let guestData;
  try {
    guestData = JSON.parse(localStorageRaw);
    console.log('📦 Found localStorage data:', {
      schemaVersion: guestData.schemaVersion,
      alertsCount: guestData.alerts?.length || 0,
      watchlistSymbols: guestData.watchlist?.symbols?.length || 0,
      layoutsCount: guestData.layouts?.length || 0,
    });
  } catch (e) {
    console.error('❌ Failed to parse localStorage data:', e);
    return;
  }

  // Step 2: Check if user is authenticated (Firebase)
  let auth;
  try {
    const firebaseModule = await import('../lib/firebase.js');
    auth = firebaseModule.auth;
  } catch (e) {
    console.error('❌ Failed to load Firebase auth module:', e);
    console.log('Make sure you are running this from the app context.');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.error('❌ No authenticated user found. Please sign in first.');
    return;
  }

  console.log('✅ Authenticated as:', user.email);

  // Step 3: Get Firebase ID token
  let idToken;
  try {
    idToken = await user.getIdToken();
    console.log('🔑 Got Firebase ID token');
  } catch (e) {
    console.error('❌ Failed to get ID token:', e);
    return;
  }

  // Step 4: Call merge API
  const mergeRequest = {
    schemaVersion: guestData.schemaVersion || 1,
    alerts: guestData.alerts || [],
    watchlist: guestData.watchlist || {
      uuid: crypto.randomUUID(),
      symbols: [],
      sort_order: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    layouts: guestData.layouts || [],
  };

  console.log('📤 Sending merge request to API...');

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/merge/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(mergeRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Merge API failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Merge successful!');
    console.log('📊 Merge statistics:', result.stats);

    // Step 5: Clear localStorage after successful merge
    const totalMerged =
      result.stats.alerts.added + result.stats.alerts.updated +
      result.stats.watchlist.added + result.stats.watchlist.updated +
      result.stats.layouts.added + result.stats.layouts.updated;

    if (totalMerged > 0) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      console.log('🗑️ Cleared localStorage after successful merge');
      console.log('🎉 Migration complete! Refresh the page to see your data.');
    } else {
      console.log('ℹ️ No data was merged (all items were skipped or already up-to-date)');
      console.log('💡 localStorage was NOT cleared. You can manually clear it if desired.');
    }

  } catch (e) {
    console.error('❌ Merge request failed:', e);
  }
})();
