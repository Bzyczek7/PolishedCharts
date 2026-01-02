/**
 * OverlayIndicatorLegend component - Legend showing overlay indicators with visibility control
 * Feature: 008-overlay-indicator-rendering
 * Phase 6: User Story 4 - Toggle Indicator Visibility (Priority: P3)
 * Phase 7: User Story 5 - Access Context Menu Actions (Priority: P3)
 *
 * T035: Add grayed-out appearance for hidden indicators in legend
 * T037: Create OverlayIndicatorLegend component with hover state tracking
 * T038: Implement hover state tracking with 200ms delay for context menu positioning
 * T039: Connect context menu actions to handlers
 *
 * Displays a list of overlay indicators with their colors, names, and visibility toggles.
 * Hidden indicators appear grayed out but remain in the list.
 * Hovering over an indicator row shows a context menu with actions.
 *
 * Sticky hover behavior: Menu stays open when hovering over the menu content,
 * and closes with a delay after leaving both the trigger and the menu.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { IndicatorAlertModal } from './IndicatorAlertModal';
import type { IndicatorInstance } from './types/indicators';

/**
 * Chart data point for crosshair value lookup
 */
export interface ChartDataPoint {
  time: number;
  value: number;
}

/**
 * Props for OverlayIndicatorLegend component
 */
export interface OverlayIndicatorLegendProps {
  /** Array of overlay indicator instances */
  instances: IndicatorInstance[];
  /** Callback: Toggle visibility for an instance */
  onToggleVisibility: (instanceId: string) => void;
  /** Callback: Remove an instance */
  onRemove?: (instanceId: string) => void;
  /** Callback: Open settings for an instance */
  onSettings?: (instanceId: string) => void;
  /** Callback: View source code for an instance */
  onViewSource?: (instanceId: string) => void;
  /** Callback: Alert created successfully */
  onAlertCreated?: () => void;
  /** Current symbol for the alert */
  symbol: string;
  /** Current chart interval (e.g., '1d', '1h', '15m') */
  interval: string;
  /** Optional CSS class name */
  className?: string;
  /** Phase 0: Current crosshair time for value display */
  crosshairTime?: number | null;
  /** Phase 0: Series data map for crosshair value lookup (instanceId -> data points) */
  seriesDataMap?: Record<string, ChartDataPoint[]>;
}


/**
 * OverlayIndicatorLegend component
 * T035: Legend with grayed-out appearance for hidden indicators
 * T037: Hover state tracking (key by instance.id)
 * T038: 200ms delay for context menu positioning
 * T039: Connect context menu actions to handlers
 * Sticky hover: Menu stays open when hovering over menu content
 *
 * Shows each overlay indicator with:
 * - Color swatch matching indicator color
 * - Display name (e.g., "SMA(20)")
 * - Visibility toggle
 * - Optional remove button
 * - Grayed out appearance when hidden
 * - Context menu on hover (Hide, Settings, Source Code, Remove)
 */
export function OverlayIndicatorLegend({
  instances,
  onToggleVisibility,
  onRemove,
  onSettings,
  onViewSource,
  onAlertCreated,
  symbol,
  interval,
  className,
  crosshairTime,
  seriesDataMap,
}: OverlayIndicatorLegendProps) {
  // Alert modal state
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertIndicator, setAlertIndicator] = useState<{instance: IndicatorInstance} | null>(null);

  // T037: Track row elements for positioning
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Phase 0: Helper to find value at crosshair time
  const getValueAtCrosshair = useCallback((instanceId: string): string | null => {
    if (!crosshairTime || !seriesDataMap) {
      return null;
    }

    const seriesData = seriesDataMap[instanceId];
    if (!seriesData || seriesData.length === 0) {
      return null;
    }

    // Find the data point at the crosshair time
    const dataPoint = seriesData.find(point => point.time === crosshairTime);
    if (dataPoint) {
      // Format value with 2 decimal places
      return dataPoint.value.toFixed(2);
    }

    return null;
  }, [crosshairTime, seriesDataMap]);

  if (instances.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {/* Minimal legend matching IndicatorPane style: white names with colored crosshair values */}
      <div className="group flex gap-2 text-xs">
        {instances.map((instance) => {
          const crosshairValue = getValueAtCrosshair(instance.id);
          return (
            <div
              key={instance.id}
              ref={(el) => {
                if (el) rowRefs.current.set(instance.id, el);
              }}
              className="relative group/instance inline-flex items-center gap-1"
            >
              <span
                className="pointer-events-auto cursor-help"
                style={{
                  color: instance.isVisible ? '#d1d4dc' : '#787b86',
                  opacity: instance.isVisible ? 1 : 0.5,
                }}
                title={instance.displayName}
              >
                {instance.displayName}
                {crosshairValue && (
                  <span style={{ marginLeft: '4px', opacity: 0.8, color: instance.style.color }}>
                    {crosshairValue}
                  </span>
                )}
              </span>

              {/* Icon buttons - positioned with flex auto margin, hidden by default */}
              <div className="pointer-events-auto flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-sm rounded px-1 opacity-0 transition-opacity duration-200 group-hover/instance:opacity-100">
                {/* Visibility toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(instance.id);
                  }}
                  className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                  type="button"
                  title={instance.isVisible ? "Hide" : "Show"}
                >
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {instance.isVisible ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    )}
                  </svg>
                </button>

                {/* Settings */}
                {onSettings && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSettings(instance.id);
                    }}
                    className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                    type="button"
                    title="Settings"
                  >
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}

                {/* Alert */}
                {onViewSource && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAlertModalOpen(true);
                      setAlertIndicator({ instance });
                    }}
                    className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                    type="button"
                    title="Alerts"
                  >
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H6" />
                    </svg>
                  </button>
                )}

                {/* Delete */}
                {onRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(instance.id);
                    }}
                    className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                    type="button"
                    title="Remove"
                  >
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert modal */}
      {isAlertModalOpen && alertIndicator && (
        <IndicatorAlertModal
          open={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          onAlertCreated={() => {
            onAlertCreated?.();
            setIsAlertModalOpen(false);
          }}
          symbol={symbol}
          interval={interval}
          indicator={{
            name: alertIndicator.instance.indicatorType.name.toLowerCase(),
            field: alertIndicator.instance.indicatorType.name.toLowerCase(), // For overlays, field is usually same as base name
            params: alertIndicator.instance.indicatorType.params,
            displayName: alertIndicator.instance.displayName,
          }}
        />
      )}
    </div>
  );
}

export default OverlayIndicatorLegend;
