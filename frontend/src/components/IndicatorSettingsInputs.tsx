/**
 * IndicatorSettingsInputs component - Parameter editing inputs for indicator settings
 * Feature: 008-overlay-indicator-rendering
 * Phase 5: User Story 3 - Configure Indicator Parameters via UI (Priority: P2)
 *
 * T027: Create IndicatorSettingsInputs component for parameter editing with validation
 * T028: Implement parameter validation against min/max ranges with error display
 * T031: Add validation error display with clear messaging
 *
 * Renders input fields for each indicator parameter with:
 * - Live validation against min/max ranges
 * - Clear error messages for invalid values
 * - Number inputs for int/float types
 * - Text inputs for string types
 * - Step support for numeric inputs
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ParameterDefinition } from './types/indicators';

/**
 * Props for IndicatorSettingsInputs component
 * Contract: contracts/ui-components.md section 4
 */
export interface IndicatorSettingsInputsProps {
  /** Current parameter values */
  params: Record<string, number | string>;

  /** Parameter definitions from backend */
  parameterDefinitions: ParameterDefinition[];

  /** Callback: Parameter value changed */
  onParamChange: (name: string, value: number | string) => void;

  /** Validation errors (param name -> error message) */
  errors: Record<string, string>;

  /** Disabled state for all inputs */
  disabled?: boolean;

  /** Callback: Notify parent if there are invalid drafts that should block navigation */
  onDraftValidityChange?: (hasInvalidDrafts: boolean) => void;
}

/**
 * Validate a parameter value against its definition
 * T028: Implement parameter validation against min/max ranges with error display
 *
 * @param name - Parameter name
 * @param value - Parameter value to validate
 * @param definition - Parameter definition with constraints
 * @returns Error message if invalid, null if valid
 */
export function validateParam(
  name: string,
  value: number | string,
  definition: ParameterDefinition
): string | null {
  // Type-specific validation
  if (definition.type === 'int' || definition.type === 'integer') {
    // Check if value is a valid integer
    if (typeof value === 'string') {
      const numValue = Number(value);
      if (isNaN(numValue) || !Number.isInteger(numValue)) {
        return `${name} must be an integer`;
      }
      value = numValue;
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return `${name} must be an integer`;
    }
  } else if (definition.type === 'float') {
    // Check if value is a valid number
    if (typeof value === 'string') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return `${name} must be a number`;
      }
      value = numValue;
    }
    if (typeof value !== 'number' || isNaN(value)) {
      return `${name} must be a number`;
    }
  }

  // Min/max validation for numeric types
  if (definition.min !== undefined && typeof value === 'number' && value < definition.min) {
    return `${name} must be at least ${definition.min}`;
  }

  if (definition.max !== undefined && typeof value === 'number' && value > definition.max) {
    return `${name} must be at most ${definition.max}`;
  }

  // Empty string validation for string types
  if (definition.type === 'str' && typeof value === 'string' && value.trim() === '') {
    return `${name} cannot be empty`;
  }

  return null; // Valid
}

/**
 * IndicatorSettingsInputs component
 * Displays parameter input fields with validation
 */
export function IndicatorSettingsInputs({
  params,
  parameterDefinitions,
  onParamChange,
  errors,
  disabled = false,
  onDraftValidityChange,
}: IndicatorSettingsInputsProps) {
  // Draft state for numeric parameters (typing in progress)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [lastCommittedValues, setLastCommittedValues] = useState<Record<string, number>>({});

  // Track which fields have been edited (dirty)
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

  // Initialize drafts only when params structure changes (not on every value change)
  // Use the param names as a key to detect when indicator changes
  const paramNames = useMemo(() => parameterDefinitions.map(p => p.name).sort(), [parameterDefinitions]);

  useEffect(() => {
    const initialValues: Record<string, number> = {};
    const initialDrafts: Record<string, string> = {};

    parameterDefinitions.forEach(def => {
      if (def.type === 'int' || def.type === 'float') {
        const value = (params[def.name] ?? def.default) as number;
        initialValues[def.name] = value;

        // Only initialize draft if field is not dirty (don't overwrite user's typing)
        if (!dirtyFields.has(def.name)) {
          initialDrafts[def.name] = String(value);
        }
      }
    });

    setLastCommittedValues(initialValues);

    // Merge with existing drafts (preserve dirty fields)
    setDraftValues(prev => ({ ...initialDrafts, ...prev }));

    // Reset dirty fields when indicator changes
    setDirtyFields(new Set());
  }, [paramNames]); // Only re-run when parameter names change (indicator switch)

  /**
   * Validate a draft value (for intermediate typing state)
   * Returns validation result with parsed value if valid
   */
  const validateDraft = useCallback((
    draft: string,
    def: ParameterDefinition
  ): { valid: boolean; parsedValue?: number; error?: string; isPartial?: boolean } => {
    // Allow partial values during typing
    if (draft === '' || draft === '-' || draft === '.' || draft.endsWith('.')) {
      return { valid: false, isPartial: true };
    }

    const numValue = def.type === 'int' ? parseInt(draft, 10) : parseFloat(draft);
    if (isNaN(numValue)) {
      return { valid: false, error: 'Invalid number' };
    }

    if (def.min !== undefined && numValue < def.min) {
      return { valid: false, error: `Must be at least ${def.min}`, parsedValue: numValue };
    }
    if (def.max !== undefined && numValue > def.max) {
      return { valid: false, error: `Must be at most ${def.max}`, parsedValue: numValue };
    }

    return { valid: true, parsedValue: numValue };
  }, []);

  /**
   * Check if field has invalid draft that should block navigation
   * Partial values ('', '-', '.') don't block navigation
   */
  const hasInvalidDraft = useCallback((name: string, def: ParameterDefinition): boolean => {
    const draft = draftValues[name];
    if (!draft || !dirtyFields.has(name)) return false;

    const validation = validateDraft(draft, def);
    // Only block if truly invalid (not partial)
    return !validation.valid && !validation.isPartial;
  }, [draftValues, dirtyFields, validateDraft]);

  /**
   * Handle draft change (typing) - just update draft string, no validation
   */
  const handleDraftChange = useCallback((name: string, value: string) => {
    setDraftValues(prev => ({ ...prev, [name]: value }));
    setDirtyFields(prev => new Set(prev).add(name));
  }, []);

  /**
   * Handle blur - commit if valid, mark as invalid if not
   */
  const handleBlur = useCallback((def: ParameterDefinition) => {
    const { name } = def;
    const draft = draftValues[name];

    if (!dirtyFields.has(name)) {
      return; // Field wasn't edited, nothing to do
    }

    const validation = validateDraft(draft || '', def);

    if (validation.valid && validation.parsedValue !== undefined) {
      // Commit to parent
      onParamChange(name, validation.parsedValue);
      setLastCommittedValues(prev => ({ ...prev, [name]: validation.parsedValue! }));

      // Update draft to match committed value (in case of clamping)
      setDraftValues(prev => ({ ...prev, [name]: String(validation.parsedValue!) }));
    } else if (!validation.valid && !validation.isPartial) {
      // Truly invalid draft - stay in draft state, will trigger confirmation on exit
      // Don't commit, don't revert yet
    } else if (validation.isPartial) {
      // Partial value ('', '-', '.') - revert to last committed
      revertDraft(name);
    }
  }, [draftValues, dirtyFields, validateDraft, onParamChange]);

  /**
   * Revert draft to last committed value (Escape key)
   */
  const revertDraft = useCallback((name: string) => {
    const lastValue = lastCommittedValues[name];
    if (lastValue !== undefined) {
      setDraftValues(prev => ({ ...prev, [name]: String(lastValue) }));
      setDirtyFields(prev => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }, [lastCommittedValues]);

  /**
   * Notify parent of invalid drafts that should block navigation
   */
  useEffect(() => {
    const hasInvalid = parameterDefinitions.some(def => {
      if (def.type !== 'int' && def.type !== 'float') return false;
      return hasInvalidDraft(def.name, def);
    });
    onDraftValidityChange?.(hasInvalid);
  }, [draftValues, parameterDefinitions, hasInvalidDraft, onDraftValidityChange]);

  // Determine step value for numeric inputs
  const getStep = (definition: ParameterDefinition): number => {
    if (definition.step !== undefined) {
      return definition.step;
    }
    if (definition.type === 'int') {
      return 1;
    }
    // Default for float
    return 0.01;
  };

  // Render input based on parameter type
  const renderInput = (definition: ParameterDefinition) => {
    const { name, type, description } = definition;
    const value = params[name] ?? definition.default;
    const error = errors[name];

    // Get draft validation state for this field
    const draft = draftValues[name];
    const isDirty = dirtyFields.has(name);
    const draftValidation = isDirty && draft ? validateDraft(draft || '', definition) : null;

    // Determine if this field has an error
    // Show error if: (1) committed error exists, or (2) draft is invalid (not partial)
    const hasError = (error !== undefined && value !== '') ||
                     (draftValidation && !draftValidation.valid && !draftValidation.isPartial);

    // Show warning icon for partial or invalid drafts
    const showWarning = isDirty && draftValidation && !draftValidation.valid;

    // Common input classes
    const inputClasses = `
      w-full px-3 py-2 rounded border text-sm
      ${hasError
        ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
        : 'border-slate-700 focus:ring-blue-500 focus:border-blue-500'
      }
      bg-slate-800 text-white
      disabled:bg-slate-900 disabled:text-slate-500
      transition-colors
    `;

    if (type === 'str') {
      return (
        <div key={name} className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`param-${name}`}
              className="text-sm font-medium text-slate-300"
            >
              {name}
            </label>
            {hasError && (
              <span className="text-xs text-red-400">{error}</span>
            )}
          </div>
          <input
            id={`param-${name}`}
            type="text"
            value={String(value ?? '')}
            onChange={(e) => handleDraftChange(name, e.target.value)}
            onBlur={() => handleBlur(definition)}
            disabled={disabled}
            className={inputClasses}
            placeholder={description}
          />
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
      );
    }

    // Numeric input (int or float)
    const min = definition.min ?? Number.MIN_SAFE_INTEGER;
    const max = definition.max ?? Number.MAX_SAFE_INTEGER;
    const step = getStep(definition);

    return (
      <div key={name} className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label
              htmlFor={`param-${name}`}
              className="text-sm font-medium text-slate-300"
            >
              {name}
            </label>
            {showWarning && (
              <AlertTriangle className="w-4 h-4 text-amber-500" aria-label="Invalid value" />
            )}
          </div>
          {hasError && (
            <span className="text-xs text-red-400">
              {draftValidation?.error || error}
            </span>
          )}
        </div>
        <input
          id={`param-${name}`}
          type="number"
          value={draftValues[name] ?? String(value ?? '')}
          onChange={(e) => handleDraftChange(name, e.target.value)}
          onBlur={() => handleBlur(definition)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleBlur(definition);
            if (e.key === 'Escape') revertDraft(name);
          }}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={inputClasses}
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{description}</span>
          <span>
            {definition.min !== undefined && definition.max !== undefined
              ? `Range: ${definition.min} - ${definition.max}`
              : definition.min !== undefined
                ? `Min: ${definition.min}`
                : definition.max !== undefined
                  ? `Max: ${definition.max}`
                  : null}
          </span>
        </div>
      </div>
    );
  };

  if (parameterDefinitions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No parameters available for this indicator
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parameterDefinitions.map(renderInput)}
    </div>
  );
}

export default IndicatorSettingsInputs;
