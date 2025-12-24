/**
 * IndicatorPaneHeader - Header for indicator panes with focus/close buttons
 * Feature: 002-supercharts-visuals
 */

import React from 'react';
import { X, Focus } from 'lucide-react';

export interface IndicatorPaneHeaderProps {
  name: string;
  isFocused?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  className?: string;
}

/**
 * IndicatorPaneHeader component
 * Displays the indicator name with focus and close buttons
 *
 * @example
 * ```tsx
 * <IndicatorPaneHeader
 *   name="RSI"
 *   isFocused={true}
 *   onFocus={() => console.log('focused')}
 *   onClose={() => console.log('closed')}
 * />
 * ```
 */
export function IndicatorPaneHeader({
  name,
  isFocused = false,
  onFocus,
  onClose,
  className = '',
}: IndicatorPaneHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between px-2 py-1 bg-[#1e222d] border-b border-[#2a2e39] ${isFocused ? 'ring-1 ring-[#26a69a]' : ''} ${className}`}
      data-testid="indicator-pane-header"
    >
      <div className="flex items-center gap-2">
        {onFocus && (
          <button
            onClick={onFocus}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label={`Focus ${name} pane`}
            title="Focus pane"
          >
            <Focus className="h-3 w-3" />
          </button>
        )}
        <span className="text-xs text-slate-300 font-medium">{name}</span>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-red-400 transition-colors"
          aria-label={`Close ${name} pane`}
          title="Close pane"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default IndicatorPaneHeader;
