/**
 * IndicatorContextMenu component - Hover-based context menu for indicator actions
 * Feature: 008-overlay-indicator-rendering
 * Phase 7: User Story 5 - Access Context Menu Actions (Priority: P3)
 *
 * T036: Create hover-based context menu with viewport-relative positioning
 * T040: Add viewport-aware positioning for context menu collision detection
 *
 * Provides a context menu with actions: Alert, Hide, Settings, Source Code, Remove
 * Triggered on hover with 200ms delay
 * Positions intelligently to avoid viewport edge collisions
 *
 * Sticky hover behavior: Menu accepts mouse enter/leave handlers to stay open
 * when hovering over menu content.
 */

import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * Context menu action type - includes 'alert' for indicator-based alerts
 */
export type IndicatorAction = 'alert' | 'hide' | 'settings' | 'source' | 'remove';

/**
 * Props for context menu actions
 */
export interface ContextMenuAction {
  type: IndicatorAction;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Props for IndicatorContextMenu component
 */
export interface IndicatorContextMenuProps {
  /** Whether the menu is open (controlled by parent via hover) */
  open: boolean;
  /** Callback: Menu open state changed */
  onOpenChange: (open: boolean) => void;
  /** Menu actions to display */
  actions: ContextMenuAction[];
  /** Callback: Action clicked */
  onActionClick: (action: IndicatorAction) => void;
  /** Optional CSS class name */
  className?: string;
  /** Anchor element for positioning */
  anchorEl?: HTMLElement | null;
  /** Callback: Mouse enter on menu content (for sticky hover) */
  onMouseEnter?: () => void;
  /** Callback: Mouse leave from menu content (for sticky hover) */
  onMouseLeave?: () => void;
}

/**
 * IndicatorContextMenu component
 * T036: Create hover-based context menu with Radix UI Popover
 * T040: Viewport-aware positioning with collision detection
 * Sticky hover: Menu stays open when hovering over menu content
 *
 * Displays a popup menu with action buttons when triggered.
 * Uses Radix UI Popover for accessibility and positioning.
 */
export function IndicatorContextMenu({
  open,
  onOpenChange,
  actions,
  onActionClick,
  className,
  anchorEl,
  onMouseEnter,
  onMouseLeave,
}: IndicatorContextMenuProps) {
  // Calculate position if anchor element is provided
  // Use layout effect for synchronous position calculation before paint
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  React.useLayoutEffect(() => {
    if (anchorEl && open) {
      const rect = anchorEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Position: directly below the anchor element
      const top = rect.bottom + 8;
      let left = rect.left;

      // Only adjust horizontal position if menu would go off screen horizontally
      const estimatedMenuWidth = 180;
      if (left + estimatedMenuWidth > viewportWidth) {
        left = viewportWidth - estimatedMenuWidth - 16;
      }

      // Update state synchronously before paint
      setPosition({ top, left });
    }
  }, [anchorEl, open]);

  const handleActionClick = (action: IndicatorAction) => {
    onActionClick(action);
    onOpenChange(false); // Close menu after action
  };

  // Don't render if closed
  if (!open) return null;

  return (
    <div
      role="menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
      className={cn(
        'w-48 rounded-md border border-slate-700 bg-slate-800 p-1 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
    >
      {actions.map((action) => (
        <button
          key={action.type}
          onClick={() => handleActionClick(action.type)}
          disabled={action.disabled}
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
            'transition-colors pointer-events-auto',
            'focus:bg-slate-700 focus:outline-none',
            'disabled:pointer-events-none disabled:opacity-50',
            !action.disabled && 'hover:bg-slate-700'
          )}
        >
          {action.icon && (
            <span className="h-4 w-4 shrink-0">{action.icon}</span>
          )}
          <span className="flex-1 text-left">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

export default IndicatorContextMenu;
