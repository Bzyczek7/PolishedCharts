# Watchlist Migration Instructions

## Quick Migration (Run in Browser Console)

1. **Open your browser's Developer Console**
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

2. **Make sure you're logged in** (you should see your avatar/email in the top right)

3. **Copy and paste this script into the console and press Enter:**

```javascript
(async function migrateWatchlist() {
  const LOCAL_STORAGE_KEY = 'polishedcharts_data';
  const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

  // Step 1: Read localStorage data
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    console.error('❌ No localStorage data found!');
    return;
  }

  const guestData = JSON.parse(data);
  console.log('📦 Found localStorage data:', {
    watchlistSymbols: guestData.watchlist?.symbols?.length || 0,
    alertsCount: guestData.alerts?.length || 0,
    layoutsCount: guestData.layouts?.length || 0,
  });

  // Step 2: Get Firebase auth token
  const { getAuth } = await import('/src/lib/firebase.ts');
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ You must be logged in first!');
    return;
  }

  const token = await user.getIdToken();
  console.log('✅ Got auth token for:', user.email);

  // Step 3: Merge with backend
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

  const response = await fetch(`${API_BASE}/api/v1/merge/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(mergeRequest),
  });

  if (!response.ok) {
    console.error('❌ Merge failed:', response.status);
    return;
  }

  const result = await response.json();
  console.log('✅ Merge successful!', result.stats);

  // Step 4: Clear localStorage after successful merge
  const totalMerged = result.stats.alerts.added + result.stats.alerts.updated +
                      result.stats.watchlist.added + result.stats.watchlist.updated +
                      result.stats.layouts.added + result.stats.layouts.updated;

  if (totalMerged > 0) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('🗑️ Cleared localStorage. Refresh to see your data!');
  } else {
    console.log('ℹ️ No data was merged. localStorage was NOT cleared.');
  }
})();
```

4. **Refresh the page** to see your migrated watchlist!

## What This Script Does

1. Reads your guest/default watchlist from localStorage (`polishedcharts_data`)
2. Sends it to the backend merge API endpoint
3. The backend upserts the data to your authenticated account
4. Clears localStorage after successful merge
5. Your watchlist, alerts, and layouts are now in the cloud!

## Troubleshooting

**Error: "No localStorage data found"**
- Make sure you have the default watchlist data in localStorage
- Check `localStorage.getItem('polishedcharts_data')` in console

**Error: "You must be logged in first"**
- Make sure you're signed in to your account
- Refresh the page and try again

**Merge successful but no data appeared**
- Check the console output for merge statistics
- Try refreshing the page
- Check your network tab for API errors
