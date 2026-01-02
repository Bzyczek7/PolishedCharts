/**
 * Frontend Candle Cache
 *
 * Feature: 012-performance-optimization
 * In-memory cache for candle data to speed up symbol switching
 */

import type { Candle } from '../api/candles';

/**
 * Cache entry for candle data
 */
interface CandleCacheEntry {
  candles: Candle[];
  timestamp: number;  // When cached (ms since epoch)
  latestTimestamp: string;  // Timestamp of newest candle
  accessCount: number;
  lastAccess: number;  // Last access time (ms since epoch)
}

/**
 * Configuration for the candle cache
 */
interface CandleCacheConfig {
  maxSize: number;          // Maximum number of entries
  ttl: number;              // Time-to-live in milliseconds
  memoryBudget: number;     // Memory budget in bytes (approximate)
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CandleCacheConfig = {
  maxSize: 20,              // Cache up to 20 symbols
  ttl: 60000,               // 1 minute TTL
  memoryBudget: 50 * 1024 * 1024,  // 50MB budget
};

/**
 * Generate cache key from symbol and interval
 */
function generateCacheKey(symbol: string, interval: string): string {
  return `${symbol.toLowerCase()}:${interval}`;
}

/**
 * Estimate memory size of candle data
 */
function estimateCandleSize(candles: Candle[]): number {
  // Rough estimate: each candle ~100 bytes
  return candles.length * 100;
}

/**
 * Candle cache with LRU eviction and TTL expiration
 */
export class CandleCache {
  private cache: Map<string, CandleCacheEntry> = new Map();
  private config: CandleCacheConfig;
  private currentMemory: number = 0;

  constructor(config: Partial<CandleCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get candles from cache
   */
  get(symbol: string, interval: string): Candle[] | null {
    const key = generateCacheKey(symbol, interval);
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

    return entry.candles;
  }

  /**
   * Set candles in cache
   */
  set(symbol: string, interval: string, candles: Candle[]): void {
    const key = generateCacheKey(symbol, interval);

    // Calculate memory requirement
    const size = estimateCandleSize(candles);

    // Check if entry already exists
    const existing = this.cache.get(key);
    if (existing) {
      this.currentMemory -= estimateCandleSize(existing.candles);
    }

    // Evict if necessary
    while (
      (this.cache.size >= this.config.maxSize || this.currentMemory + size > this.config.memoryBudget) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // Add entry
    const latestTimestamp = candles.length > 0
      ? candles[candles.length - 1].timestamp
      : '';

    this.cache.set(key, {
      candles,
      timestamp: Date.now(),
      latestTimestamp,
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
      this.currentMemory -= estimateCandleSize(entry.candles);
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
  has(symbol: string, interval: string): boolean {
    const key = generateCacheKey(symbol, interval);
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
    hitRate: number;
    ttl: number;
  } {
    let totalAccess = 0;
    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
    }

    return {
      entries: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsed: this.currentMemory,
      memoryBudget: this.config.memoryBudget,
      hitRate: totalAccess > 0 ? 1 : 0,  // Simplified - needs miss tracking
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
 * Global candle cache instance
 */
export const candleCache = new CandleCache();

/**
 * Get candles from cache or return null
 */
export function getCachedCandles(symbol: string, interval: string): Candle[] | null {
  return candleCache.get(symbol, interval);
}

/**
 * Set candles in cache
 */
export function setCachedCandles(symbol: string, interval: string, candles: Candle[]): void {
  candleCache.set(symbol, interval, candles);
}

/**
 * Invalidate all cached data for a symbol
 */
export function invalidateCandleCache(symbol: string): void {
  candleCache.invalidate(symbol);
}

/**
 * Clear all candle cache entries
 */
export function clearCandleCache(): void {
  candleCache.clear();
}

/**
 * Check if candles are cached (doesn't update access time)
 */
export function hasCachedCandles(symbol: string, interval: string): boolean {
  return candleCache.has(symbol, interval);
}
