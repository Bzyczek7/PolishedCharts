/**
 * IndicatorSettings - Panel for editing indicator parameters
 * Feature: 003-advanced-indicators
 * Phase 4: User Story 2 - Per-Symbol Indicator Toggles and Persistence
 * Tasks: T045a, T046
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useIndicatorContext } from '../../contexts/IndicatorContext';
import type { IndicatorPane } from '../types/indicators';

export interface IndicatorSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicatorId: string | null;
}

/**
 * IndicatorSettings component
 * T045a [US2] [P]: Create IndicatorSettings component
 * T046 [US2]: Add indicator settings panel for parameter editing
 *
 * Provides controls for:
 * - Editing indicator parameters (periods, thresholds)
 * - Toggling indicator visibility
 * - Adjusting pane height
 */
export function IndicatorSettings({
  open,
  onOpenChange,
  indicatorId,
}: IndicatorSettingsProps) {
  const { indicators, updateIndicatorParams, toggleIndicator } = useIndicatorContext();
  const [localParams, setLocalParams] = useState<Record<string, number | string>>({});
  const [localHeight, setLocalHeight] = useState(25);

  // Find the current indicator
  const currentIndicator = indicators.find((ind) => ind.id === indicatorId);

  useEffect(() => {
    if (currentIndicator) {
      setLocalParams({ ...currentIndicator.indicatorType.params });
      setLocalHeight(currentIndicator.displaySettings.height);
    }
  }, [currentIndicator]);

  const handleSave = () => {
    if (currentIndicator && indicatorId) {
      updateIndicatorParams(indicatorId, localParams);
      onOpenChange(false);
    }
  };

  const handleParamChange = (paramName: string, value: number | string) => {
    // Convert string to number if it's a numeric value
    const numValue = typeof value === 'string' && value !== '' ? parseFloat(value) : value;
    setLocalParams((prev) => ({ ...prev, [paramName]: numValue }));
  };

  if (!currentIndicator) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1e222d] border-[#2a2e39] text-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            {currentIndicator.name} Settings
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Edit indicator parameters and visibility
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Visibility Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="visible" className="text-slate-300">
              Visible
            </Label>
            <Switch
              id="visible"
              checked={currentIndicator.displaySettings.visible}
              onCheckedChange={() => toggleIndicator(currentIndicator.id)}
              className="data-[state=checked]:bg-[#26a69a]"
            />
          </div>

          {/* Pane Height */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="height" className="text-slate-300">
                Pane Height: {localHeight}%
              </Label>
            </div>
            <Slider
              id="height"
              min={10}
              max={50}
              step={5}
              value={[localHeight]}
              onValueChange={([value]) => setLocalHeight(value)}
              className="cursor-pointer"
            />
          </div>

          {/* Parameter Controls */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300">Parameters</h3>
            {Object.entries(localParams).map(([paramName, paramValue]) => {
              if (typeof paramValue === 'number') {
                // Try to infer reasonable min/max based on parameter name
                let min = 1;
                let max = 200;
                let step = 1;

                if (paramName.toLowerCase().includes('period')) {
                  min = 2;
                  max = 200;
                  step = 1;
                } else if (paramName.toLowerCase().includes('threshold') || paramName.toLowerCase().includes('level')) {
                  min = -100;
                  max = 100;
                  step = 0.5;
                }

                return (
                  <div key={paramName} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={paramName} className="text-slate-400 text-sm capitalize">
                        {paramName}
                      </Label>
                      <span className="text-xs text-slate-500">{paramValue}</span>
                    </div>
                    <Slider
                      id={paramName}
                      min={min}
                      max={max}
                      step={step}
                      value={[paramValue as number]}
                      onValueChange={([value]) => handleParamChange(paramName, value)}
                      className="cursor-pointer"
                    />
                  </div>
                );
              }

              // String parameter (e.g., color)
              return (
                <div key={paramName} className="flex items-center justify-between">
                  <Label htmlFor={paramName} className="text-slate-400 text-sm capitalize">
                    {paramName}
                  </Label>
                  <input
                    id={paramName}
                    type="text"
                    value={paramValue}
                    onChange={(e) => handleParamChange(paramName, e.target.value)}
                    className="bg-[#2a2e39] border border-[#363b45] rounded px-2 py-1 text-sm text-white w-24"
                  />
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#26a69a] hover:bg-[#229989] text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default IndicatorSettings;
