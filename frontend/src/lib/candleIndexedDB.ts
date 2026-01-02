/**
 * IndexedDB wrapper for candle caching
 *
 * Provides persistent browser storage for candle data with TTL support.
 * Keys are formatted as ${symbol}:${interval} to ensure correct lookups.
 */

const DB_NAME = 'TradingAlertDB'
const DB_VERSION = 1
const STORE_NAME = 'candles'
const CACHE_TTL = 300000 // 5 minutes

export interface CachedCandles {
  id: string  // Key: ${symbol}:${interval}
  symbol: string
  interval: string
  candles: any[]  // Candle[] from api/candles
  timestamp: number
}

export const candleIndexedDB = {
  /**
   * Initialize the IndexedDB database.
   * Creates the object store if it doesn't exist.
   */
  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('symbol', 'symbol', { unique: false })
          store.createIndex('interval', 'interval', { unique: false })
        }
      }
    })
  },

  /**
   * Get cached candles for a symbol/interval pair.
   * Returns null if not found, expired, or on error.
   */
  async get(symbol: string, interval: string): Promise<CachedCandles | null> {
    const db = await this.init()
    const key = `${symbol}:${interval}`  // CORRECT: use full key, not just symbol

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(key)  // Use get(key) not index lookup

      request.onsuccess = () => {
        const result = request.result
        if (!result) {
          resolve(null)
          return
        }

        // Check TTL
        const age = Date.now() - result.timestamp
        if (age > CACHE_TTL) {
          // Expired - delete and return null
          this.delete(symbol, interval).then(() => resolve(null))
          return
        }

        resolve(result)
      }
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Store candles in IndexedDB for a symbol/interval pair.
   * Replaces any existing data for the same key.
   */
  async set(symbol: string, interval: string, candles: any[]): Promise<void> {
    const db = await this.init()
    const cached: CachedCandles = {
      id: `${symbol}:${interval}`,
      symbol,
      interval,
      candles,
      timestamp: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(cached)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Delete cached candles for a symbol/interval pair.
   */
  async delete(symbol: string, interval: string): Promise<void> {
    const db = await this.init()
    const key = `${symbol}:${interval}`

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}
