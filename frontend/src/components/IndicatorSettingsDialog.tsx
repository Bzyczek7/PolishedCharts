/**
 * IndicatorSettingsDialog component - Tabbed settings modal for overlay indicators
 * Feature: 008-overlay-indicator-rendering
 * Phase 9: Polish & Cross-Cutting Concerns
 *
 * T045 [P]: Create IndicatorSettingsDialog with Radix UI Dialog wrapper and tab state
 * T046 [P]: Integrate Radix UI Tabs for Inputs/Style/Visibility
 *
 * Provides a three-tab settings dialog matching TradingView:
 * - Inputs tab: Edit indicator parameters (period, source, etc.)
 * - Style tab: Customize colors and line appearance
 * - Visibility tab: Toggle indicator visibility
 *
 * All changes apply immediately (no confirmation button) per US2/US3 requirements.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { IndicatorSettingsInputs, validateParam } from './IndicatorSettingsInputs';
import { IndicatorSettingsStyle, type SeriesMetadata } from './IndicatorSettingsStyle';
import { IndicatorSettingsVisibility } from './IndicatorSettingsVisibility';
import type { IndicatorInstance, IndicatorStyle, ParameterDefinition, IndicatorMetadata } from './types/indicators';

/**
 * Props for IndicatorSettingsDialog component
 * T045: Dialog wrapper with tab state management
 */
export interface IndicatorSettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback: Dialog open state changed */
  onOpenChange: (open: boolean) => void;
  /** The indicator instance being edited (optional - dialog shows empty state if null) */
  indicator: IndicatorInstance | null;
  /** Full indicator metadata for trend mode detection */
  indicatorMetadata?: IndicatorMetadata & {
    parameters: ParameterDefinition[];
  };
  /** Callback: Apply changes to the indicator instance */
  onApplyChanges?: (instanceId: string, updates: Partial<IndicatorInstance>) => void;
  /** Callback: Remove this indicator */
  onRemove?: (instanceId: string) => void;
  /** Disabled state (e.g., while loading) */
  disabled?: boolean;
}

/**
 * IndicatorSettingsDialog component
 * T045 + T046: Radix UI Dialog with three-tab layout
 */
export function IndicatorSettingsDialog({
  open,
  onOpenChange,
  indicator,
  indicatorMetadata,
  onApplyChanges,
  onRemove,
  disabled = false,
}: IndicatorSettingsDialogProps) {
  // Active tab state
  const [activeTab, setActiveTab] = useState<'inputs' | 'style' | 'visibility'>('inputs');

  // Invalid drafts state (from child Inputs component)
  const [hasInvalidDrafts, setHasInvalidDrafts] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  // Local state for parameter changes (applied immediately per US2/US3)
  const [pendingParams, setPendingParams] = useState<Record<string, number | string>>({});
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({});

  // Local state for style changes (applied immediately per US2)
  const [pendingStyle, setPendingStyle] = useState<Partial<IndicatorStyle>>({});

  /**
   * Get current parameter values (merge pending params with indicator params)
   * MUST be called before early return to satisfy Rules of Hooks
   */
  const currentParams = useMemo(() => {
    if (!indicator) return {};
    return {
      ...indicator.indicatorType.params,
      ...pendingParams,
    };
  }, [indicator?.indicatorType?.params, pendingParams]);

  const hasErrors = Object.keys(paramErrors).length > 0;

  /**
   * Handle parameter value change
   * Validates and applies immediately (per US3 requirements)
   * FIXED: Use computed error instead of stale paramErrors state
   */
  const handleParamChange = useCallback((name: string, value: number | string) => {
    if (!indicator || !indicatorMetadata) return;

    // Update pending params
    setPendingParams(prev => ({ ...prev, [name]: value }));

    // Validate against parameter definition
    const paramDef = indicatorMetadata.parameters.find(p => p.name === name);
    if (paramDef) {
      // FIX: Compute error locally and use it immediately (don't rely on stale paramErrors state)
      const nextError = validateParam(name, value, paramDef);
      setParamErrors(prev => {
        if (nextError) {
          return { ...prev, [name]: nextError };
        } else {
          const { [name]: omitted, ...rest } = prev;
          return rest;
        }
      });

      // FIX: Use computed nextError instead of checking stale paramErrors[name]
      if (!nextError) {
        onApplyChanges?.(indicator.id, {
          indicatorType: {
            ...indicator.indicatorType,
            params: { ...indicator.indicatorType.params, [name]: value },
          },
        });
      }
    }
  }, [indicator, indicatorMetadata, onApplyChanges]);

  // Keep a ref to always have access to the current indicator value
  // This avoids stale closures in callbacks
  const indicatorRef = useRef(indicator);
  useEffect(() => {
    indicatorRef.current = indicator;
  }, [indicator]);

  /**
   * Handle style change
   * Applies immediately (per US2 requirements)
   */
  const handleStyleChange = useCallback((styleUpdate: Partial<IndicatorStyle>) => {
    const currentIndicator = indicatorRef.current;
    if (!currentIndicator) return;

    // Merge with current style
    const updatedStyle: IndicatorStyle = {
      ...currentIndicator.style,
      ...styleUpdate,
    };

    // Apply immediately
    onApplyChanges?.(currentIndicator.id, { style: updatedStyle });
  }, [onApplyChanges]);

  /**
   * Handle visibility toggle
   */
  const handleVisibilityToggle = useCallback((visible: boolean) => {
    if (!indicator) return;

    onApplyChanges?.(indicator.id, { isVisible: visible });
  }, [indicator, onApplyChanges]);

  /**
   * Handle remove indicator
   */
  const handleRemove = useCallback(() => {
    if (!indicator) return;

    // Close dialog first
    onOpenChange(false);

    // Then remove
    onRemove?.(indicator.id);
  }, [indicator, onOpenChange, onRemove]);

  /**
   * Intercept dialog close - show confirmation if invalid drafts exist
   */
  const handleOpenChangeWrapper = useCallback((open: boolean) => {
    if (!open && hasInvalidDrafts) {
      setShowExitConfirmation(true);
    } else {
      onOpenChange(open);
    }
  }, [hasInvalidDrafts, onOpenChange]);

  /**
   * Intercept tab switch - show confirmation if invalid drafts exist
   */
  const handleTabChangeWrapper = useCallback((value: string) => {
    if (hasInvalidDrafts && activeTab === 'inputs') {
      setShowExitConfirmation(true);
    } else {
      setActiveTab(value as 'inputs' | 'style' | 'visibility');
    }
  }, [hasInvalidDrafts, activeTab]);

  /**
   * Handle exit confirmation - revert and close
   */
  const handleExitConfirm = useCallback(() => {
    // Dialog will unmount, child component's drafts will be discarded
    // Parent params remain at last committed values (no invalid values applied)
    setHasInvalidDrafts(false);
    setShowExitConfirmation(false);
    onOpenChange(false);
  }, [onOpenChange]);

  /**
   * Handle exit cancellation - keep editing
   */
  const handleExitCancel = useCallback(() => {
    setShowExitConfirmation(false);
    // Stay on Inputs tab with invalid draft
  }, []);

  /**
   * Reset local state when dialog opens/closes or indicator changes
   */
  const resetState = useCallback(() => {
    setPendingParams({});
    setParamErrors({});
    setPendingStyle({});
    setActiveTab('inputs');
  }, []);

  // Reset when indicator changes - use useEffect instead of conditional useState
  useEffect(() => {
    resetState();
  }, [indicator?.id, resetState]);

  /**
   * Empty state: No indicator selected
   * Early return is safe here because all hooks have been called above
   */
  if (!indicator) {
    return (
      <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Indicator Settings</DialogTitle>
            <DialogDescription>
              No indicator selected. Select an indicator from the legend to edit its settings.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center text-slate-500">
            <p>No indicator selected</p>
            <p className="text-sm mt-2">Select an indicator from the legend to edit its settings.</p>
          </div>
        </DialogContent>
      </Dialog>
      </>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-xl text-slate-100">
            {indicator.displayName}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Customize indicator parameters, style, and visibility. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChangeWrapper}
          className="w-full"
        >
          {/* T046: Tab list with three tabs */}
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="inputs" className="data-[state=active]:bg-slate-700">
              Inputs
            </TabsTrigger>
            <TabsTrigger value="style" className="data-[state=active]:bg-slate-700">
              Style
            </TabsTrigger>
            <TabsTrigger value="visibility" className="data-[state=active]:bg-slate-700">
              Visibility
            </TabsTrigger>
          </TabsList>

          {/* Inputs Tab: T027/T028 - Parameter editing */}
          <TabsContent value="inputs" className="mt-4 space-y-4">
            {indicatorMetadata?.parameters && Array.isArray(indicatorMetadata.parameters) && indicatorMetadata.parameters.length > 0 ? (
              <>
                <IndicatorSettingsInputs
                  params={currentParams}
                  parameterDefinitions={indicatorMetadata.parameters}
                  onParamChange={handleParamChange}
                  errors={paramErrors}
                  disabled={disabled}
                  onDraftValidityChange={setHasInvalidDrafts}
                />
                {hasErrors && (
                  <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
                    <p className="text-sm text-red-400">
                      Please fix validation errors before continuing.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                No parameters available for this indicator
              </div>
            )}
          </TabsContent>

          {/* Style Tab: T021 - Visual appearance customization */}
          <TabsContent value="style" className="mt-4">
            <IndicatorSettingsStyle
              instance={indicator}
              onStyleChange={handleStyleChange}
              disabled={disabled}
              showLabels={true}
              seriesMetadata={indicatorMetadata?.series_metadata}
              indicatorMetadata={indicatorMetadata}
            />
          </TabsContent>

          {/* Visibility Tab: T032 - Show/hide toggle */}
          <TabsContent value="visibility" className="mt-4 space-y-6">
            <div className="space-y-4">
              {/* Visibility Toggle */}
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <IndicatorSettingsVisibility
                  visible={indicator.isVisible}
                  onToggle={handleVisibilityToggle}
                  disabled={disabled}
                  label="Show on chart"
                />
                <p className="text-xs text-slate-500 mt-2">
                  {indicator.isVisible
                    ? 'Indicator is visible on the chart'
                    : 'Indicator is hidden but not removed'}
                </p>
              </div>

              {/* Instance Info */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Instance Info</p>
                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 space-y-1">
                  <p className="text-xs text-slate-400">
                    <span className="font-medium">Type:</span> {indicator.indicatorType.name.toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="font-medium">ID:</span> {indicator.id}
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="font-medium">Symbol:</span> {indicator.symbol}
                  </p>
                </div>
              </div>

              {/* Remove Button */}
              {onRemove && (
                <div className="pt-4 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={disabled}
                    className="w-full px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove Indicator
                  </button>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    This will permanently remove this indicator instance
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Exit Confirmation Dialog */}
    <Dialog open={showExitConfirmation} onOpenChange={setShowExitConfirmation}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Invalid values detected</DialogTitle>
          <DialogDescription className="text-slate-400">
            You have invalid parameter values. Revert to last valid values?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            onClick={handleExitCancel}
            variant="outline"
            className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
          >
            Keep Editing
          </Button>
          <Button
            onClick={handleExitConfirm}
            className="bg-red-900 hover:bg-red-800 text-white"
          >
            Revert & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}

export default IndicatorSettingsDialog;
