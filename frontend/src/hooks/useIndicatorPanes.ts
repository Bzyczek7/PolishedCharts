/**
 * useIndicatorPanes hook
 * Feature: 002-supercharts-visuals
 *
 * Convenience hook for accessing indicator pane state from context.
 * All state management is handled by IndicatorPaneContext.
 */

import { useIndicatorPaneContext } from '../contexts/IndicatorPaneContext';

/**
 * Hook to access and manipulate indicator pane state
 *
 * @example
 * ```tsx
 * const { panes, addPane, removePane, setFocusedPane } = useIndicatorPanes();
 * ```
 *
 * Provides access to:
 * - panes: Array of indicator panes
 * - focusedPaneId: ID of the currently focused pane
 * - addPane: Add a new indicator pane (optionally at a specific position)
 * - removePane: Remove an indicator pane
 * - setPaneHeight: Set the height of a pane (percentage of chart height)
 * - setPanePosition: Change the position of a pane in the stack
 * - setPaneVisibility: Toggle pane visibility
 * - setFocusedPane: Set the focused pane
 * - reorderPanes: Reorder panes by providing a new order array
 * - getPaneById: Get a pane by its ID
 * - clearAllPanes: Remove all indicator panes
 */
export function useIndicatorPanes() {
  const context = useIndicatorPaneContext();
  return context;
}
