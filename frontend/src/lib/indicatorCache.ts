/**
 * Frontend Indicator Cache
 *
 * Feature: 012-performance-optimization
 * In-memory cache for indicator calculation results
 */

import type { IndicatorOutput } from '../components/types/indicators';

/**
 * Cache entry for indicator data
 */
interface IndicatorCacheEntry {
  data: IndicatorOutput;
  timestamp: number;  // When cached (ms since epoch)
  dataTimestamp: string;  // Timestamp of newest candle used in calculation
  accessCount: number;
  lastAccess: number;  // Last access time (ms since epoch)
}

/**
 * Configuration for the indicator cache
 */
interface IndicatorCacheConfig {
  maxSize: number;          // Maximum number of entries
  ttl: number;              // Time-to-live in milliseconds
  memoryBudget: number;     // Memory budget in bytes (approximate)
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: IndicatorCacheConfig = {
  maxSize: 50,              // Cache up to 50 indicator results
  ttl: 60000,               // 1 minute TTL
  memoryBudget: 100 * 1024 * 1024,  // 100MB budget
};

/**
 * Generate cache key from indicator parameters
 * Includes optional date range to prevent cache collisions when using date-filtered queries
 */
function generateIndicatorCacheKey(
  symbol: string,
  interval: string,
  indicatorName: string,
  params: Record<string, number | string>,
  from?: string,  // Optional date range start
  to?: string     // Optional date range end
): string {
  // Sort params for consistency
  const sortedParams = Object.entries(params)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  // Append date range to cache key if provided
  const rangeKey = (from && to) ? `:${from}:${to}` : '';
  return `${symbol.toLowerCase()}:${interval}:${indicatorName}:${sortedParams}${rangeKey}`;
}

/**
 * Estimate memory size of indicator data
 */
function estimateIndicatorSize(data: IndicatorOutput): number {
  // Rough estimate based on data points and series
  const dataPointCount = data.data_points || 0;
  const seriesCount = Object.keys(data.data).length;
  // Each data point ~16 bytes (float) + overhead
  return dataPointCount * seriesCount * 16 + 1000;  // 1KB base overhead
}

/**
 * Indicator cache with LRU eviction and TTL expiration
 */
export class IndicatorCache {
  private cache: Map<string, IndicatorCacheEntry> = new Map();
  private config: IndicatorCacheConfig;
  private currentMemory: number = 0;

  constructor(config: Partial<IndicatorCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get indicator data from cache
   */
  get(
    symbol: string,
    interval: string,
    indicatorName: string,
    params: Record<string, number | string>,
    from?: string,  // Optional date range start
    to?: string     // Optional date range end
  ): IndicatorOutput | null {
    const key = generateIndicatorCacheKey(symbol, interval, indicatorName, params, from, to);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    // Check TTL
    if (now - entry.timestamp > this.config.ttl) {
      this.remove(key);
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccess = now;

    return entry.data;
  }

  /**
   * Set indicator data in cache
   */
  set(
    symbol: string,
    interval: string,
    indicatorName: string,
    params: Record<string, number | string>,
    data: IndicatorOutput,
    from?: string,  // Optional date range start
    to?: string     // Optional date range end
  ): void {
    const key = generateIndicatorCacheKey(symbol, interval, indicatorName, params, from, to);

    // Calculate memory requirement
    const size = estimateIndicatorSize(data);

    // Check if entry already exists
    const existing = this.cache.get(key);
    if (existing) {
      this.currentMemory -= estimateIndicatorSize(existing.data);
    }

    // Evict if necessary
    while (
      (this.cache.size >= this.config.maxSize || this.currentMemory + size > this.config.memoryBudget) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // Add entry
    const dataTimestamp = data.timestamps && data.timestamps.length > 0
      ? new Date(data.timestamps[data.timestamps.length - 1] * 1000).toISOString()
      : '';

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      dataTimestamp,
      accessCount: 0,
      lastAccess: Date.now(),
    });

    this.currentMemory += size;
  }

  /**
   * Remove entry from cache
   */
  private remove(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemory -= estimateIndicatorSize(entry.data);
      this.cache.delete(key);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.remove(oldestKey);
    }
  }

  /**
   * Invalidate all entries for a symbol
   */
  invalidate(symbol: string): void {
    const prefix = symbol.toLowerCase() + ':';
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.remove(key);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.currentMemory = 0;
  }

  /**
   * Check if cache has an entry (doesn't update access time)
   */
  has(
    symbol: string,
    interval: string,
    indicatorName: string,
    params: Record<string, number | string>,
    from?: string,  // Optional date range start
    to?: string     // Optional date range end
  ): boolean {
    const key = generateIndicatorCacheKey(symbol, interval, indicatorName, params, from, to);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.remove(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    maxSize: number;
    memoryUsed: number;
    memoryBudget: number;
    ttl: number;
  } {
    return {
      entries: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsed: this.currentMemory,
      memoryBudget: this.config.memoryBudget,
      ttl: this.config.ttl,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.remove(key);
    }

    return keysToDelete.length;
  }
}

/**
 * Global indicator cache instance
 */
export const indicatorCache = new IndicatorCache();

/**
 * Get indicator data from cache
 */
export function getCachedIndicator(
  symbol: string,
  interval: string,
  indicatorName: string,
  params: Record<string, number | string>,
  from?: string,  // Optional date range start
  to?: string     // Optional date range end
): IndicatorOutput | null {
  return indicatorCache.get(symbol, interval, indicatorName, params, from, to);
}

/**
 * Set indicator data in cache
 */
export function setCachedIndicator(
  symbol: string,
  interval: string,
  indicatorName: string,
  params: Record<string, number | string>,
  data: IndicatorOutput,
  from?: string,  // Optional date range start
  to?: string     // Optional date range end
): void {
  indicatorCache.set(symbol, interval, indicatorName, params, data, from, to);
}

/**
 * Invalidate all cached indicators for a symbol
 */
export function invalidateIndicatorCache(symbol: string): void {
  indicatorCache.invalidate(symbol);
}

/**
 * Clear all indicator cache entries
 */
export function clearIndicatorCache(): void {
  indicatorCache.clear();
}
