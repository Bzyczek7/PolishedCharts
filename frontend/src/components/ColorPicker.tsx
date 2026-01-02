/**
 * ColorPicker component - Native HTML5 color input wrapper with hex validation
 * Feature: 008-overlay-indicator-rendering
 * Task: T020 [P] [US2]
 *
 * Provides a color picker using browser's native input[type="color"]
 * with hex color code display and validation.
 */

import { useState, useCallback, useEffect } from 'react';

interface ColorPickerProps {
  /** Current color value in hex format (e.g., "#ff6d00") */
  value: string;
  /** Callback when color changes - receives hex color code */
  onChange: (color: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Label for the color picker input */
  label?: string;
  /** Show/hide the hex text input */
  showTextInput?: boolean;
  /** CSS class name for styling */
  className?: string;
}

/**
 * Validates hex color code format
 * Accepts: #RGB, #RRGGBB (with or without #)
 */
function isValidHexColor(color: string): boolean {
  if (!color) return false;

  // Remove # if present
  const hex = color.replace('#', '');

  // Validate: 3 or 6 hex digits
  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Normalizes hex color to #rrggbb format (lowercase)
 * Converts #RGB to #RRGGBB and normalizes to lowercase
 */
function normalizeHexColor(color: string): string {
  if (!color) return '#000000';

  let hex = color.replace('#', '').toLowerCase();

  // Convert 3-digit to 6-digit
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(char => char + char)
      .join('');
  }

  return `#${hex}`;
}

/**
 * Format hex color for display (always uppercase)
 */
function formatHexDisplay(color: string): string {
  return normalizeHexColor(color).toUpperCase();
}

/**
 * ColorPicker component
 * T020 [P] [US2]: Create ColorPicker component with native input wrapper and hex validation
 */
export function ColorPicker({
  value,
  onChange,
  disabled = false,
  label,
  showTextInput = true,
  className = '',
}: ColorPickerProps) {
  const [textValue, setTextValue] = useState(() => formatHexDisplay(value));
  const [isValid, setIsValid] = useState(true);

  // Sync internal state when value prop changes (e.g., from parent updates)
  // This ensures the text input updates when the color changes via other means
  useEffect(() => {
    setTextValue(formatHexDisplay(value));
    setIsValid(true);
  }, [value]);

  /**
   * Handle color change from native color picker
   */
  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value;
      setTextValue(formatHexDisplay(newColor));
      setIsValid(true);
      onChange(newColor);
    },
    [onChange]
  );

  /**
   * Handle text input change
   */
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Defensive: don't process if disabled
      if (disabled) return;

      // Truncate to max 6 characters for both display and validation
      let input = e.target.value.slice(0, 6);

      // Allow empty input while typing
      if (!input) {
        setTextValue('');
        setIsValid(true);
        return;
      }

      // For validation, only consider 3 or 6 character lengths
      const valid = (input.length === 3 || input.length === 6) && isValidHexColor(input);

      if (valid) {
        const normalized = normalizeHexColor(input);
        setTextValue(formatHexDisplay(normalized));
        setIsValid(true);
        onChange(normalized);
      } else {
        // Show truncated input (but don't call useOnChange)
        setTextValue(input);
        setIsValid(false);
      }
    },
    [onChange, disabled]
  );

  /**
   * Handle text input blur
   * If invalid, revert to current value
   */
  const handleTextBlur = useCallback(() => {
    if (!isValid || !textValue) {
      setTextValue(formatHexDisplay(value));
      setIsValid(true);
    }
  }, [isValid, textValue, value]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <label className="text-sm text-slate-300">{label}</label>
      )}

      {/* Native color picker input */}
      <div className="relative flex items-center">
        <input
          type="color"
          value={normalizeHexColor(value)}
          onChange={handleColorChange}
          disabled={disabled}
          className={`
            w-10 h-10 rounded cursor-pointer border-2
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-400'}
            ${isValid ? 'border-slate-600' : 'border-red-500'}
          `}
          aria-label={label || 'Pick a color'}
        />
      </div>

      {/* Hex text input */}
      {showTextInput && (
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
            #
          </span>
          <input
            type="text"
            value={textValue.replace('#', '')}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            disabled={disabled}
            maxLength={6}
            className={`
              w-24 px-6 py-1.5 bg-slate-800 border rounded text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${isValid
                ? 'border-slate-600 text-slate-200'
                : 'border-red-500 text-red-400'
              }
              font-mono uppercase
            `}
            aria-label="Hex color code"
            placeholder="000000"
          />
        </div>
      )}

      {/* Validation error indicator */}
      {!isValid && (
        <span className="text-xs text-red-400" role="alert">
          Invalid hex
        </span>
      )}
    </div>
  );
}

/**
 * Default color presets for quick selection
 */
export const COLOR_PRESETS = [
  { name: 'Orange', value: '#ff6d00' },
  { name: 'Blue', value: '#2962ff' },
  { name: 'Red', value: '#ef5350' },
  { name: 'Green', value: '#26a69a' },
  { name: 'Cyan', value: '#00bcd4' },
  { name: 'Yellow', value: '#ffeb3b' },
  { name: 'Purple', value: '#aa00ff' },
  { name: 'Gray', value: '#9e9e9e' },
  { name: 'White', value: '#ffffff' },
] as const;

/**
 * ColorPicker with presets
 * Extended version with quick-select color swatches
 */
interface ColorPickerWithPresetsProps extends ColorPickerProps {
  /** Show preset color swatches */
  showPresets?: boolean;
  /** Custom preset colors */
  presets?: ReadonlyArray<{ name: string; value: string }>;
}

export function ColorPickerWithPresets({
  showPresets = true,
  presets = COLOR_PRESETS,
  ...colorPickerProps
}: ColorPickerWithPresetsProps) {
  return (
    <div className="space-y-3">
      <ColorPicker {...colorPickerProps} />

      {showPresets && (
        <div className="space-y-2">
          <span className="text-sm text-slate-400">Quick Select:</span>
          <div className="grid grid-cols-5 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => colorPickerProps.onChange(preset.value)}
                disabled={colorPickerProps.disabled}
                className={`
                  w-full aspect-square rounded border-2 transition-all
                  ${colorPickerProps.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105 hover:border-slate-400'
                  }
                  ${colorPickerProps.value === preset.value
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                    : 'border-slate-600'
                  }
                `}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
                aria-label={`Select ${preset.name} color`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColorPicker;
