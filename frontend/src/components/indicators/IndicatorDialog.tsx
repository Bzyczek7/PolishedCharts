/**
 * IndicatorDialog - Modal for selecting and adding indicators
 * Feature: 002-supercharts-visuals, 003-advanced-indicators
 * T044 [US2]: Update IndicatorDialog to use useIndicators hook
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { IndicatorType, IndicatorInfo } from '../types/indicators';
import { listIndicators, listIndicatorsWithMetadata } from '@/api/indicators';
import { useIndicatorContext } from '../../contexts/IndicatorContext';

export interface IndicatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Format indicator parameters for display
 */
function formatParams(params: Record<string, number | string>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '';
  return `(${entries.map(([k, v]) => `${k}=${v}`).join(', ')})`;
}

/**
 * Convert IndicatorInfo to IndicatorType with default parameters
 */
function indicatorInfoToType(info: IndicatorInfo): IndicatorType {
  const params: Record<string, number | string> = {};

  // Handle parameters as object (from backend) or array (from type definition)
  if (Array.isArray(info.parameters)) {
    for (const param of info.parameters) {
      params[param.name] = param.default;
    }
  } else {
    // parameters is a dict/object from backend: { "period": {"default": 20, ...} }
    for (const [key, value] of Object.entries(info.parameters)) {
      if (typeof value === 'object' && value !== null && 'default' in value) {
        params[key] = (value as any).default;
      } else {
        // Fallback: use the value directly if it's a primitive
        params[key] = value as number | string;
      }
    }
  }

  return {
    category: info.category,
    name: info.name,
    params,
  };
}

/**
 * IndicatorDialog component
 * Modal dialog for selecting and adding indicators to the chart
 * Dynamically populates from backend API (T025 [US1])
 *
 * @example
 * ```tsx
 * <IndicatorDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onAddIndicator={(indicator) => addIndicatorPane(indicator)}
 * />
 * ```
 */
export function IndicatorDialog({
  open,
  onOpenChange,
}: IndicatorDialogProps) {
  const { addIndicator } = useIndicatorContext();
  const [selectedCategory, setSelectedCategory] = React.useState<'all' | 'overlay' | 'oscillator'>('all');
  const [availableIndicators, setAvailableIndicators] = useState<IndicatorInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch available indicators when dialog opens
  useEffect(() => {
    if (open && availableIndicators.length === 0) {
      setLoading(true);
      listIndicatorsWithMetadata()
        .then((data) => {
          setAvailableIndicators(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load indicators:', err);
          setLoading(false);
        });
    }
  }, [open, availableIndicators.length]);

  const filteredIndicators = availableIndicators.filter((indicator) => {
    if (selectedCategory === 'all') return true;
    return indicator.category === selectedCategory;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1e222d] border-[#2a2e39] text-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Add Indicator
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select an indicator to add to your chart
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'bg-[#26a69a] text-white' : 'text-slate-400 hover:text-white'}
            >
              All
            </Button>
            <Button
              variant={selectedCategory === 'overlay' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory('overlay')}
              className={selectedCategory === 'overlay' ? 'bg-[#26a69a] text-white' : 'text-slate-400 hover:text-white'}
            >
              Overlays
            </Button>
            <Button
              variant={selectedCategory === 'oscillator' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory('oscillator')}
              className={selectedCategory === 'oscillator' ? 'bg-[#26a69a] text-white' : 'text-slate-400 hover:text-white'}
            >
              Oscillators
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8 text-slate-400">
              Loading indicators...
            </div>
          )}

          {/* Indicator List */}
          {!loading && (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredIndicators.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No indicators available
                </div>
              ) : (
                filteredIndicators.map((indicator) => {
                  const indicatorType = indicatorInfoToType(indicator);
                  return (
                    <button
                      key={indicator.name}
                      onClick={() => {
                        addIndicator(indicatorType);
                        onOpenChange(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-[#2a2e39] transition-colors text-left"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-200">
                          {indicator.name.toUpperCase()}
                          <span className="text-slate-500 text-xs ml-1">
                            {formatParams(indicatorType.params)}
                          </span>
                        </span>
                        <span className="text-xs text-slate-500 text-left">
                          {indicator.description}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 capitalize ml-2">
                        {indicator.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Cancel Button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default IndicatorDialog;
