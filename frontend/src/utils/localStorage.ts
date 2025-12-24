/**
 * localStorage utility with error handling
 * Feature: 002-supercharts-visuals
 */

/**
 * Storage keys used throughout the application
 */
export const STORAGE_KEYS = {
  DRAWINGS_PREFIX: 'drawings-',           // e.g., drawings-AAPL
  THEME_SETTINGS: 'chart-theme-settings',
} as const;

/**
 * Get a value from localStorage
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist or parsing fails
 * @returns Parsed value or default
 */
export function get<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Error reading from localStorage (key: ${key}):`, error);
    return defaultValue;
  }
}

/**
 * Set a value in localStorage
 * @param key - Storage key
 * @param value - Value to store (will be JSON serialized)
 * @returns true if successful, false otherwise
 */
export function set<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Error writing to localStorage (key: ${key}):`, error);
    return false;
  }
}

/**
 * Remove a value from localStorage
 * @param key - Storage key to remove
 * @returns true if successful, false otherwise
 */
export function remove(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Error removing from localStorage (key: ${key}):`, error);
    return false;
  }
}

/**
 * Get drawings storage key for a specific symbol
 * @param symbol - Trading symbol (e.g., "AAPL")
 * @returns Storage key for drawings (e.g., "drawings-AAPL")
 */
export function getDrawingsKey(symbol: string): string {
  return `${STORAGE_KEYS.DRAWINGS_PREFIX}${symbol.toUpperCase()}`;
}

/**
 * Load drawings for a specific symbol
 * @param symbol - Trading symbol
 * @returns Array of drawings or empty array
 */
export function loadDrawings<T>(symbol: string): T[] {
  const key = getDrawingsKey(symbol);
  return get<T[]>(key, []);
}

/**
 * Save drawings for a specific symbol
 * @param symbol - Trading symbol
 * @param drawings - Array of drawings to store
 * @returns true if successful
 */
export function saveDrawings<T>(symbol: string, drawings: T[]): boolean {
  const key = getDrawingsKey(symbol);
  return set(key, drawings);
}

/**
 * Clear all drawings (use with caution)
 * @returns true if successful
 */
export function clearAllDrawings(): boolean {
  try {
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    // Remove all drawing-related keys
    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEYS.DRAWINGS_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    return true;
  } catch (error) {
    console.warn('Error clearing drawings from localStorage:', error);
    return false;
  }
}
