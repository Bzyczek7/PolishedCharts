/**
 * Drawing-related TypeScript types
 * Feature: 002-supercharts-visuals
 */

/**
 * Drawing types available
 */
export type DrawingType =
  | 'trendline'       // Two-click diagonal line
  | 'horizontal_line' // Single-click horizontal line
  | 'rectangle'       // Click-drag rectangle
  | 'text';           // Click to place text

/**
 * Tool types for toolbar selection
 */
export type ToolType =
  | 'cursor'
  | 'trendline'
  | 'horizontal_line'
  | 'rectangle'
  | 'text';

/**
 * Drawing entity - persists in localStorage per symbol
 */
export interface Drawing {
  id: string;                  // UUID
  type: DrawingType;
  // Chart coordinates (not screen pixels)
  time1?: number;              // Unix timestamp (ms) or time index
  price1?: number;             // Price value
  time2?: number;              // For trendline endpoint, rectangle corner
  price2?: number;
  // Visual properties
  color: string;               // Hex color (default #ffff00)
  lineWidth: number;           // 1 (thin), 2 (medium), 3 (thick)
  fillOpacity?: number;        // For rectangles: 0-100
  zIndex?: number;             // Rendering order (for overlapping)
  // Text content (for text drawings)
  text?: string;               // Text content
  fontSize?: number;           // Font size in pixels
  // Pane reference
  paneId: string;              // 'main' or indicator pane ID
}

/**
 * Drawing state for active drawing operations
 */
export interface DrawingState {
  selectedTool: ToolType;
  activeDrawing: {
    type: DrawingType;
    step: number;              // 0 = no click, 1 = first click, 2 = complete
    tempData?: Partial<Drawing>; // In-progress drawing data
  };
  drawings: Drawing[];         // All drawings for current symbol
  hoveredDrawing?: Drawing;    // Drawing under cursor
  selectedDrawing?: Drawing;   // Currently selected for editing
}
