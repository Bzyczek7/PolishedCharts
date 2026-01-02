/**
 * IndicatorHeader component - TradingView-style compact indicator header
 * Feature: TradingView-style indicator UI
 *
 * Displays indicator name with compact icon buttons row (eye, gear, bell, delete, more).
 * Each icon shows a tooltip on hover and performs an action on click.
 *
 * Replaces the large hover-based context menu with a lightweight header that never blocks the chart.
 */

import * as React from 'react';
import { Eye, EyeOff, Settings, Bell, Trash2, MoreVertical } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { cn } from '../lib/utils';

/**
 * Action for the "more" popover
 */
export interface IndicatorHeaderAction {
  label: string;
  action: () => void;
}

/**
 * Props for IndicatorHeader component
 */
export interface IndicatorHeaderProps {
  /** Indicator display name (e.g., "cRSI 20") */
  name: string;
  /** Current visibility state */
  isVisible: boolean;
  /** Callback: Toggle visibility */
  onToggleVisibility: () => void;
  /** Callback: Remove indicator */
  onRemove: () => void;
  /** Callback: Open settings (optional) */
  onSettings?: () => void;
  /** Callback: Open alerts modal (optional) */
  onAlert?: () => void;
  /** Additional actions for "more" popover (optional) */
  moreActions?: IndicatorHeaderAction[];
  /** Optional CSS class name */
  className?: string;
  /** Legend items to display after the name */
  legendItems?: Array<{ key: string; color: string; value: number }>;
}

/**
 * IconButton component - wraps icon with tooltip
 */
interface IconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  className?: string;
}

function IconButton({ icon: Icon, label, onClick, className }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "h-6 w-6 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors",
            className
          )}
          type="button"
        >
          <Icon className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * IndicatorHeader component
 *
 * Layout: [name] [Eye] [Gear] [Bell] [Delete] [More]
 * Icons are hidden by default and revealed on hover/keyboard focus
 */
export function IndicatorHeader({
  name,
  isVisible,
  onToggleVisibility,
  onRemove,
  onSettings,
  onAlert,
  moreActions,
  className,
  legendItems,
}: IndicatorHeaderProps) {
  // Icon for visibility (swaps between Eye and EyeOff)
  const VisibilityIcon = isVisible ? Eye : EyeOff;

  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-xs", className)}>
      <span className="min-w-0 flex-1 truncate text-slate-300 font-medium">
        {name}
      </span>

      {/* Legend items (numbers) */}
      {legendItems?.map(it => (
        <span key={it.key} className="pointer-events-none" style={{ color: it.color }}>
          {it.value.toFixed(2)}
        </span>
      ))}

      {/* Icon buttons - positioned with flex auto margin, hidden by default */}
      <div className="pointer-events-auto flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-sm rounded px-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 ml-auto">
        {/* Visibility toggle */}
        <IconButton
          icon={VisibilityIcon}
          label={isVisible ? "Hide" : "Show"}
          onClick={onToggleVisibility}
        />

        {/* Settings */}
        {onSettings && (
          <IconButton
            icon={Settings}
            label="Settings"
            onClick={onSettings}
          />
        )}

        {/* Alerts */}
        {onAlert && (
          <IconButton
            icon={Bell}
            label="Alerts"
            onClick={onAlert}
          />
        )}

        {/* Delete */}
        <IconButton
          icon={Trash2}
          label="Remove"
          onClick={onRemove}
        />

        {/* More popover (if additional actions) */}
        {moreActions && moreActions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                type="button"
              >
                <MoreVertical className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-40 p-1">
              {moreActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export default IndicatorHeader;
