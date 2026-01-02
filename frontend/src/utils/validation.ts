/**
 * Utility functions for validation
 */

/**
 * Returns the trimmed symbol if it's valid (non-empty after trimming), null otherwise
 */
export function getTrimmedValidSymbol(symbol: string): string | null {
  if (!symbol) {
    return null;
  }
  
  const trimmed = symbol.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Checks if a symbol is valid (non-empty after trimming)
 */
export function isValidSymbol(symbol: string): boolean {
  return getTrimmedValidSymbol(symbol) !== null;
}