/**
 * IndicatorSettingsVisibility component - Visibility toggle switch for indicator settings
 * Feature: 008-overlay-indicator-rendering
 * Phase 6: User Story 4 - Toggle Indicator Visibility (Priority: P3)
 *
 * T032: Create IndicatorSettingsVisibility component with Radix UI Switch
 *
 * Provides a simple toggle switch for showing/hiding indicators without removing them.
 * Uses Radix UI Switch for accessibility and consistent styling.
 */

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '../lib/utils';

/**
 * Props for IndicatorSettingsVisibility component
 */
export interface IndicatorSettingsVisibilityProps {
  /** Current visibility state */
  visible: boolean;
  /** Callback: Toggle visibility */
  onToggle: (visible: boolean) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Label text for the switch */
  label?: string;
  /** Additional CSS class name */
  className?: string;
}

/**
 * IndicatorSettingsVisibility component
 * T032: Create visibility toggle with Radix UI Switch
 *
 * Displays a toggle switch with optional label for controlling indicator visibility.
 */
export function IndicatorSettingsVisibility({
  visible,
  onToggle,
  disabled = false,
  label = 'Visible',
  className,
}: IndicatorSettingsVisibilityProps) {
  const handleCheckedChange = (checked: boolean) => {
    onToggle(checked);
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SwitchPrimitives.Root
        checked={visible}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        className={cn(
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-700'
        )}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
            'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
          )}
        />
      </SwitchPrimitives.Root>
      {label && (
        <label
          htmlFor={undefined}
          className={cn(
            'text-sm font-medium leading-none',
            disabled ? 'text-slate-500' : 'text-slate-300'
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
}

export default IndicatorSettingsVisibility;
