/**
 * useCrosshair hook
 * Feature: 002-supercharts-visuals
 *
 * Convenience hook for accessing crosshair state from context.
 * All state management is handled by CrosshairContext.
 */

import { useCrosshairContext } from '../contexts/CrosshairContext';

/**
 * Hook to access and manipulate crosshair state
 *
 * @example
 * ```tsx
 * const { state, showCrosshair, hideCrosshair } = useCrosshair();
 * ```
 *
 * Provides access to:
 * - state: Current crosshair state (visible, timeIndex, price, sourcePaneId)
 * - showCrosshair: Show crosshair at a specific time index and price
 * - hideCrosshair: Hide the crosshair
 * - setCrosshairVisible: Toggle crosshair visibility without changing position
 */
export function useCrosshair() {
  const context = useCrosshairContext();
  return context;
}
