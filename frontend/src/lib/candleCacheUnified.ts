/**
 * Unified candle caching layer
 *
 * Global Standard: "One caching policy for all candle consumers: memory cache first,
 * then IndexedDB (with TTL), then API. Full-window loads update the entire cache;
 * backfills merge with existing data before persisting."
 */

import { candleIndexedDB } from './candleIndexedDB'
import { getCachedCandles, setCachedCandles } from './candleCache'
import type { Candle } from '../api/candles'

/**
 * Fetch candles with caching.
 * Use this for FULL WINDOW loads only (e.g., initial symbol load).
 * For backfills, use mergeAndPersistCandles instead.
 *
 * Cache hierarchy:
 * 1. In-memory cache (fastest) - 60 second TTL
 * 2. IndexedDB (persistent) - 5 minute TTL
 * 3. API fetch
 *
 * @param symbol - Stock/crypto symbol
 * @param interval - Chart interval (e.g., '1d', '1h')
 * @param fetchFn - Function to fetch from API if cache miss
 * @returns Candle data
 */
export async function getCandlesWithCache(
  symbol: string,
  interval: string,
  fetchFn: () => Promise<Candle[]>
): Promise<Candle[]> {
  // 1. Check in-memory cache (fastest)
  const memCached = getCachedCandles(symbol, interval)
  if (memCached && memCached.length > 0) {
    return memCached
  }

  // 2. Check IndexedDB (persistent, slower)
  const idbCached = await candleIndexedDB.get(symbol, interval)
  if (idbCached && idbCached.candles.length > 0) {
    // Populate memory cache from IndexedDB
    setCachedCandles(symbol, interval, idbCached.candles)
    return idbCached.candles
  }

  // 3. Fetch from API
  const candles = await fetchFn()

  // 4. Update BOTH caches (full replace for full-window loads)
  setCachedCandles(symbol, interval, candles)
  await candleIndexedDB.set(symbol, interval, candles)

  return candles
}

/**
 * Merge new candles with existing and persist to both caches.
 * Use this for BACKFILLS (partial range fetches).
 * This prevents overwriting the full cache with a partial window.
 *
 * @param symbol - Stock/crypto symbol
 * @param interval - Chart interval
 * @param existingCandles - Currently loaded candles
 * @param newCandles - New candles from backfill
 * @returns Merged candles array
 */
export async function mergeAndPersistCandles(
  symbol: string,
  interval: string,
  existingCandles: Candle[],
  newCandles: Candle[]
): Promise<Candle[]> {
  // First, deduplicate the new candles by timestamp
  const uniqueNewCandlesMap = new Map<string, Candle>();
  newCandles.forEach(candle => {
    uniqueNewCandlesMap.set(candle.timestamp, candle);
  });
  const uniqueNewCandles = Array.from(uniqueNewCandlesMap.values());

  // Then merge with existing candles, avoiding duplicates
  const existingTimestamps = new Set(existingCandles.map(c => c.timestamp));
  const filteredNewCandles = uniqueNewCandles.filter(c => !existingTimestamps.has(c.timestamp));

  const mergedCandles = [...existingCandles, ...filteredNewCandles].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Update BOTH caches with merged data
  setCachedCandles(symbol, interval, mergedCandles)
  await candleIndexedDB.set(symbol, interval, mergedCandles)

  return mergedCandles
}

/**
 * Update caches for WebSocket real-time updates.
 * Similar to mergeAndPersistCandles but optimized for single-candle appends.
 *
 * NOTE: This function appends newCandle to existingCandles internally.
 * Pass the PRE-APPEND array (existing candles before the new one).
 *
 * @param symbol - Stock/crypto symbol
 * @param interval - Chart interval
 * @param existingCandles - Candles BEFORE append (pass prev from setState)
 * @param newCandle - New candle from WebSocket
 * @returns Updated candles array
 */
export async function appendCandleToCache(
  symbol: string,
  interval: string,
  existingCandles: Candle[],  // BEFORE append (pass prev from setState)
  newCandle: Candle
): Promise<Candle[]> {
  const updated = [...existingCandles, newCandle]

  // Update both caches
  setCachedCandles(symbol, interval, updated)
  await candleIndexedDB.set(symbol, interval, updated)

  return updated
}

/**
 * Sync both caches with a given candles array.
 * Use this when candles have been transformed (e.g., deduped, merged, sorted).
 * This is a generic function that overwrites the cache with the provided data.
 *
 * @param symbol - Stock/crypto symbol
 * @param interval - Chart interval
 * @param candles - Final candles array to store in cache
 */
export async function syncCandlesToCache(
  symbol: string,
  interval: string,
  candles: Candle[]
): Promise<void> {
  // Update both caches
  setCachedCandles(symbol, interval, candles)
  await candleIndexedDB.set(symbol, interval, candles)
}
