/**
 * OscillatorSettingsDialog component - Adapter wrapper for oscillator indicator settings
 * Feature: Oscillator Context Menu and Settings Dialog
 * Phase 4: Create OscillatorSettingsDialog
 *
 * Adapter that converts IndicatorPane (oscillator) to IndicatorInstance format
 * and reuses the existing IndicatorSettingsDialog component.
 *
 * Key differences from overlay indicators:
 * - Oscillators use displaySettings.visible (not isVisible)
 * - Oscillators have single-pane behavior (no multi-instance)
 */

import { useCallback, useMemo } from 'react';
import { IndicatorSettingsDialog } from './IndicatorSettingsDialog';
import type {
  IndicatorPane,
  IndicatorInstance,
  IndicatorStyle,
  ParameterDefinition,
  IndicatorMetadata,
  IndicatorDisplayType,
  ColorMode,
} from './types/indicators';
import type { SeriesMetadata } from './IndicatorSettingsStyle';
import { DEFAULT_INDICATOR_STYLE, INDICATOR_DEFAULT_COLORS } from './types/indicators';

/**
 * Props for OscillatorSettingsDialog component
 */
export interface OscillatorSettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback: Dialog open state changed */
  onOpenChange: (open: boolean) => void;
  /** The oscillator indicator pane being edited */
  indicator: IndicatorPane | null;
  /** Parameter definitions and metadata from backend for this indicator type */
  indicatorMetadata?: (IndicatorMetadata & {
    parameters: ParameterDefinition[];
  }) | {
    parameters: ParameterDefinition[];
    /** Series metadata for multi-series color customization */
    series_metadata?: SeriesMetadata[];
    /** Optional display_type for compatibility */
    display_type?: IndicatorDisplayType;
    /** Optional color_mode for compatibility */
    color_mode?: ColorMode;
    /** Optional color_schemes for compatibility */
    color_schemes?: Record<string, string>;
  };
  /** Callback: Apply style changes to the oscillator */
  onStyleChange?: (indicatorId: string, style: Partial<IndicatorStyle>) => void;
  /** Callback: Apply parameter changes to the oscillator */
  onParamsChange?: (indicatorId: string, params: Record<string, number | string>) => void;
  /** Callback: Toggle visibility */
  onVisibilityToggle?: (indicatorId: string) => void;
  /** Callback: Remove this indicator */
  onRemove?: (indicatorId: string) => void;
  /** Disabled state (e.g., while loading) */
  disabled?: boolean;
}

/**
 * Convert IndicatorPane to IndicatorInstance format for the settings dialog
 * Maps oscillator-specific fields to instance format
 */
function paneToInstance(pane: IndicatorPane): IndicatorInstance {
  return {
    id: pane.id,
    symbol: 'oscillator',  // Oscillators are symbol-agnostic in this context
    indicatorType: {
      category: 'overlay',  // Dialog expects overlay type for compatibility
      name: pane.indicatorType.name,
      params: pane.indicatorType.params,
    },
    displayName: pane.name,
    style: pane.style || { ...DEFAULT_INDICATOR_STYLE },
    isVisible: pane.displaySettings.visible,  // Map from displaySettings.visible
    createdAt: new Date().toISOString(),
  };
}

/**
 * OscillatorSettingsDialog component
 * Adapter wrapper that converts IndicatorPane to IndicatorInstance
 * and reuses the existing IndicatorSettingsDialog component
 */
export function OscillatorSettingsDialog({
  open,
  onOpenChange,
  indicator,
  indicatorMetadata,
  onStyleChange,
  onParamsChange,
  onVisibilityToggle,
  onRemove,
  disabled = false,
}: OscillatorSettingsDialogProps) {
  /**
   * Handle changes from the settings dialog
   * Converts IndicatorInstance updates back to IndicatorPane operations
   */
  const handleApplyChanges = useCallback((instanceId: string, updates: Partial<IndicatorInstance>) => {
    if (!indicator) return;

    // Handle style changes
    if (updates.style && onStyleChange) {
      onStyleChange(instanceId, updates.style);
    }

    // Handle parameter changes
    if (updates.indicatorType?.params && onParamsChange) {
      onParamsChange(instanceId, updates.indicatorType.params);
    }

    // Handle visibility changes (convert isVisible → displaySettings.visible toggle)
    if (updates.isVisible !== undefined && onVisibilityToggle) {
      // Only toggle if the value is different
      if (updates.isVisible !== indicator.displaySettings.visible) {
        onVisibilityToggle(instanceId);
      }
    }
  }, [indicator, onStyleChange, onParamsChange, onVisibilityToggle]);

  /**
   * Handle remove indicator
   */
  const handleRemove = useCallback((instanceId: string) => {
    onRemove?.(instanceId);
  }, [onRemove]);

  // Convert IndicatorPane to IndicatorInstance for the dialog
  // Use JSON serialization for deep equality comparison of style changes
  // This ensures the instance is recalculated when style.color or other style properties change
  const instance = useMemo(() => {
    if (!indicator) return null;
    return paneToInstance(indicator);
  }, [indicator?.id, JSON.stringify(indicator?.style)]);

  return (
    <IndicatorSettingsDialog
      key={indicator?.id || 'oscillator-settings'}
      open={open}
      onOpenChange={onOpenChange}
      indicator={instance}
      indicatorMetadata={indicatorMetadata as (IndicatorMetadata & { parameters: ParameterDefinition[]; }) | undefined}
      onApplyChanges={handleApplyChanges}
      onRemove={handleRemove}
      disabled={disabled}
    />
  );
}

export default OscillatorSettingsDialog;
