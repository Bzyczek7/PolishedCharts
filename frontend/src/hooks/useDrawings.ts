/**
 * useDrawings hook
 * Feature: 002-supercharts-visuals
 *
 * Convenience hook for accessing drawing state from context.
 * All state management is handled by DrawingStateContext.
 */

import { useDrawingStateContext } from '../contexts/DrawingStateContext';

/**
 * Hook to access and manipulate drawing state
 *
 * @example
 * ```tsx
 * const { state, addDrawing, removeDrawing, setSelectedTool } = useDrawings();
 * ```
 *
 * Provides access to:
 * - state: Current drawing state (selectedTool, activeDrawing, drawings, hoveredDrawing, selectedDrawing)
 * - setSelectedTool: Update the selected drawing tool
 * - startDrawing: Start a new drawing operation
 * - updateActiveDrawing: Update temporary data for active drawing
 * - completeDrawing: Complete and save the active drawing
 * - cancelDrawing: Cancel the active drawing operation
 * - addDrawing: Add a completed drawing to the store
 * - updateDrawing: Update an existing drawing
 * - removeDrawing: Remove a drawing
 * - setHoveredDrawing: Set the hovered drawing
 * - setSelectedDrawing: Set the selected drawing for editing
 * - loadDrawingsForSymbol: Load drawings for a specific symbol
 * - clearDrawings: Clear all drawings for current symbol
 */
export function useDrawings() {
  const context = useDrawingStateContext();
  return context;
}
