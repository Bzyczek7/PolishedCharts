/**
 * DrawingStorage - Utility for saving/loading drawings to localStorage
 * Feature: 002-supercharts-visuals
 */

import type { Drawing } from '../types/drawings';
import { getDrawingsKey, loadDrawings, saveDrawings, clearAllDrawings } from '../../utils/localStorage';

/**
 * DrawingStorage utility class
 * Handles per-symbol drawing persistence to localStorage
 *
 * Storage format: "drawings-{SYMBOL}" -> Drawing[]
 */
export class DrawingStorage {
  /**
   * Load all drawings for a specific symbol
   * @param symbol - Trading symbol (e.g., "AAPL")
   * @returns Array of drawings or empty array if none found
   */
  static loadForSymbol(symbol: string): Drawing[] {
    const key = getDrawingsKey(symbol);
    return loadDrawings<Drawing>(symbol);
  }

  /**
   * Save drawings for a specific symbol
   * @param symbol - Trading symbol
   * @param drawings - Array of drawings to save
   */
  static saveForSymbol(symbol: string, drawings: Drawing[]): void {
    saveDrawings(symbol, drawings);
  }

  /**
   * Add a single drawing for a symbol
   * @param symbol - Trading symbol
   * @param drawing - Drawing to add
   */
  static addDrawing(symbol: string, drawing: Drawing): void {
    const existing = this.loadForSymbol(symbol);
    const updated = [...existing, drawing];
    this.saveForSymbol(symbol, updated);
  }

  /**
   * Update a drawing for a symbol
   * @param symbol - Trading symbol
   * @param id - Drawing ID to update
   * @param updates - Partial drawing with updates
   */
  static updateDrawing(symbol: string, id: string, updates: Partial<Drawing>): void {
    const existing = this.loadForSymbol(symbol);
    const updated = existing.map(d => (d.id === id ? { ...d, ...updates } : d));
    this.saveForSymbol(symbol, updated);
  }

  /**
   * Delete a drawing for a symbol
   * @param symbol - Trading symbol
   * @param id - Drawing ID to delete
   */
  static deleteDrawing(symbol: string, id: string): void {
    const existing = this.loadForSymbol(symbol);
    const updated = existing.filter(d => d.id !== id);
    this.saveForSymbol(symbol, updated);
  }

  /**
   * Clear all drawings for a specific symbol
   * @param symbol - Trading symbol
   */
  static clearForSymbol(symbol: string): void {
    this.saveForSymbol(symbol, []);
  }

  /**
   * Clear ALL drawings across all symbols (use with caution)
   */
  static clearAll(): void {
    clearAllDrawings();
  }

  /**
   * Get list of symbols that have saved drawings
   * @returns Array of symbol strings
   */
  static getSymbolsWithDrawings(): string[] {
    const keys = Object.keys(localStorage);
    return keys
      .filter(key => key.startsWith('drawings-'))
      .map(key => key.replace('drawings-', '').toUpperCase());
  }
}

export default DrawingStorage;
