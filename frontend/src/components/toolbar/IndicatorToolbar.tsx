/**
 * IndicatorToolbar - Toolbar controls for indicator visibility and settings
 * Feature: 003-advanced-indicators
 * Phase 4: User Story 2 - Per-Symbol Indicator Toggles and Persistence
 * Tasks: T044a, T045
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { useIndicatorContext } from '../../contexts/IndicatorContext';
import type { IndicatorPane } from '../types/indicators';

export interface IndicatorToolbarProps {
  onOpenSettings?: (indicatorId: string) => void;
  onOpenDialog?: () => void;
}

/**
 * IndicatorToolbar component
 * T044a [US2] [P]: Create IndicatorToolbar component
 * T045 [US2]: Add indicator visibility toggle controls to toolbar
 *
 * Provides controls for:
 * - Adding new indicators
 * - Toggling indicator visibility
 * - Opening indicator settings
 */
export function IndicatorToolbar({ onOpenSettings, onOpenDialog }: IndicatorToolbarProps) {
  const { indicators, toggleIndicator, removeIndicator } = useIndicatorContext();

  const handleToggle = (indicatorId: string) => {
    toggleIndicator(indicatorId);
  };

  const handleRemove = (indicatorId: string) => {
    removeIndicator(indicatorId);
  };

  const handleSettings = (indicatorId: string) => {
    if (onOpenSettings) {
      onOpenSettings(indicatorId);
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-[#1e222d] border-b border-[#2a2e39]">
      {/* Add Indicator Button */}
      {onOpenDialog && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenDialog}
          className="text-slate-400 hover:text-white hover:bg-[#2a2e39]"
          title="Add Indicator"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="ml-1 text-xs">Add Indicator</span>
        </Button>
      )}

      {/* Indicator List */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {indicators.length === 0 ? (
          <span className="text-xs text-slate-500">No indicators</span>
        ) : (
          indicators.map((indicator) => (
            <div
              key={indicator.id}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#2a2e39] border border-[#363b45]"
            >
              {/* Indicator Name */}
              <span className="text-xs text-slate-300">{indicator.name}</span>

              {/* Visibility Toggle */}
              <button
                onClick={() => handleToggle(indicator.id)}
                className={`p-1 rounded transition-colors ${
                  indicator.displaySettings.visible
                    ? 'text-green-400 hover:bg-[#363b45]'
                    : 'text-slate-600 hover:bg-[#363b45]'
                }`}
                title={indicator.displaySettings.visible ? 'Visible' : 'Hidden'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {indicator.displaySettings.visible ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  )}
                </svg>
              </button>

              {/* Settings Button */}
              {onOpenSettings && (
                <button
                  onClick={() => handleSettings(indicator.id)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#363b45] transition-colors"
                  title="Settings"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}

              {/* Remove Button */}
              <button
                onClick={() => handleRemove(indicator.id)}
                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-[#363b45] transition-colors"
                title="Remove"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default IndicatorToolbar;
