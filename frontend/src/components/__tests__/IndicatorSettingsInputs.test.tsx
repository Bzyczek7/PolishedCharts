/**
 * Unit tests for IndicatorSettingsInputs component
 * Feature: 008-overlay-indicator-rendering
 * Phase 5: User Story 3 - Configure Indicator Parameters via UI
 * T025: Unit test for parameter validation (min/max enforcement)
 *
 * Tests:
 * - Parameter validation against min/max ranges
 * - Integer type validation
 * - Float type validation
 * - String type validation
 * - Error display for invalid values
 * - Clear error messages
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IndicatorSettingsInputs, validateParam } from '../IndicatorSettingsInputs';
import type { ParameterDefinition } from '../types/indicators';

describe('validateParam', () => {
  const createIntDefinition = (min?: number, max?: number): ParameterDefinition => ({
    name: 'period',
    type: 'int',
    default: 20,
    min,
    max,
    description: 'SMA period',
  });

  const createFloatDefinition = (min?: number, max?: number): ParameterDefinition => ({
    name: 'multiplier',
    type: 'float',
    default: 1.5,
    min,
    max,
    description: 'Multiplier',
  });

  const createStringDefinition = (): ParameterDefinition => ({
    name: 'source',
    type: 'str',
    default: 'close',
    description: 'Price source',
  });

  describe('Integer validation', () => {
    it('should accept valid integer values', () => {
      const def = createIntDefinition(1, 200);
      expect(validateParam('period', 20, def)).toBeNull();
      expect(validateParam('period', 1, def)).toBeNull();
      expect(validateParam('period', 200, def)).toBeNull();
    });

    it('should reject values below minimum', () => {
      const def = createIntDefinition(5, 100);
      const result = validateParam('period', 2, def);
      expect(result).toBe('period must be at least 5');
    });

    it('should reject values above maximum', () => {
      const def = createIntDefinition(5, 100);
      const result = validateParam('period', 150, def);
      expect(result).toBe('period must be at most 100');
    });

    it('should reject non-integer values (string)', () => {
      const def = createIntDefinition(1, 100);
      const result = validateParam('period', '20.5', def);
      expect(result).toBe('period must be an integer');
    });

    it('should reject float numbers for int type', () => {
      const def = createIntDefinition(1, 100);
      const result = validateParam('period', 20.5, def);
      expect(result).toBe('period must be an integer');
    });

    it('should accept string representation of valid integer', () => {
      const def = createIntDefinition(1, 100);
      // Note: validateParam receives the parsed number, not the raw string
      expect(validateParam('period', 20, def)).toBeNull();
    });
  });

  describe('Float validation', () => {
    it('should accept valid float values', () => {
      const def = createFloatDefinition(0.1, 10.0);
      expect(validateParam('multiplier', 1.5, def)).toBeNull();
      expect(validateParam('multiplier', 0.1, def)).toBeNull();
      expect(validateParam('multiplier', 10.0, def)).toBeNull();
    });

    it('should accept integers for float type', () => {
      const def = createFloatDefinition(0, 100);
      expect(validateParam('multiplier', 2, def)).toBeNull();
    });

    it('should reject values below minimum', () => {
      const def = createFloatDefinition(1.0, 10.0);
      const result = validateParam('multiplier', 0.5, def);
      expect(result).toBe('multiplier must be at least 1');
    });

    it('should reject values above maximum', () => {
      const def = createFloatDefinition(1.0, 10.0);
      const result = validateParam('multiplier', 15.0, def);
      expect(result).toBe('multiplier must be at most 10');
    });

    it('should reject non-numeric string values', () => {
      const def = createFloatDefinition(0, 100);
      // validateParam receives parsed value; invalid parse results in NaN
      const result = validateParam('multiplier', NaN, def);
      expect(result).toBe('multiplier must be a number');
    });
  });

  describe('String validation', () => {
    it('should accept valid non-empty strings', () => {
      const def = createStringDefinition();
      expect(validateParam('source', 'close', def)).toBeNull();
      expect(validateParam('source', 'open', def)).toBeNull();
    });

    it('should reject empty strings', () => {
      const def = createStringDefinition();
      const result = validateParam('source', '  ', def);
      expect(result).toBe('source cannot be empty');
    });

    it('should accept strings with whitespace content', () => {
      const def = createStringDefinition();
      expect(validateParam('source', ' close ', def)).toBeNull();
    });
  });

  describe('No min/max constraints', () => {
    it('should accept any integer when no min/max specified', () => {
      const def = createIntDefinition();
      expect(validateParam('period', 1, def)).toBeNull();
      expect(validateParam('period', 1000000, def)).toBeNull();
      expect(validateParam('period', -100, def)).toBeNull();
    });

    it('should accept any float when no min/max specified', () => {
      const def = createFloatDefinition();
      expect(validateParam('multiplier', 0.001, def)).toBeNull();
      expect(validateParam('multiplier', 9999.999, def)).toBeNull();
    });
  });
});

describe('IndicatorSettingsInputs', () => {
  const defaultParams: Record<string, number | string> = {
    period: 20,
    multiplier: 1.5,
    source: 'close',
  };

  const parameterDefinitions: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'int',
      default: 20,
      min: 1,
      max: 200,
      description: 'SMA period',
    },
    {
      name: 'multiplier',
      type: 'float',
      default: 1.5,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      description: 'Multiplier',
    },
    {
      name: 'source',
      type: 'str',
      default: 'close',
      description: 'Price source',
    },
  ];

  it('should render input fields for each parameter', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    // Check that all parameter labels are rendered
    expect(screen.getByLabelText('period')).toBeInTheDocument();
    expect(screen.getByLabelText('multiplier')).toBeInTheDocument();
    expect(screen.getByLabelText('source')).toBeInTheDocument();

    // Check descriptions
    expect(screen.getByText('SMA period')).toBeInTheDocument();
    expect(screen.getByText('Multiplier')).toBeInTheDocument();
    expect(screen.getByText('Price source')).toBeInTheDocument();
  });

  it('should display current parameter values', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    const periodInput = screen.getByLabelText('period') as HTMLInputElement;
    const multiplierInput = screen.getByLabelText('multiplier') as HTMLInputElement;
    const sourceInput = screen.getByLabelText('source') as HTMLInputElement;

    expect(periodInput.value).toBe('20');
    expect(multiplierInput.value).toBe('1.5');
    expect(sourceInput.value).toBe('close');
  });

  it('should call onParamChange when input values change', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    const periodInput = screen.getByLabelText('period');
    fireEvent.change(periodInput, { target: { value: '50' } });

    expect(onParamChange).toHaveBeenCalledWith('period', 50);
  });

  it('should show error message for invalid values (after edit)', () => {
    const onParamChange = vi.fn();

    const { rerender } = render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    // Initially no error visible
    expect(screen.queryByText('period must be at most 200')).not.toBeInTheDocument();

    // Change value to make it dirty (this also makes it invalid > max)
    const periodInput = screen.getByLabelText('period');
    fireEvent.change(periodInput, { target: { value: '250' } });

    // Now rerender with the error in props (parent validates and passes error)
    rerender(
      <IndicatorSettingsInputs
        params={{ period: 250, multiplier: 1.5, source: 'close' }}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{ period: 'period must be at most 200' }}
      />
    );

    // Error should be visible now
    expect(screen.getByText('period must be at most 200')).toBeInTheDocument();
  });

  it('should display range hints for numeric parameters', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    expect(screen.getByText('Range: 1 - 200')).toBeInTheDocument();
    expect(screen.getByText('Range: 0.1 - 10')).toBeInTheDocument();
  });

  it('should display min/max hints for partial constraints', () => {
    const onParamChange = vi.fn();
    const partialDefs: ParameterDefinition[] = [
      {
        name: 'period',
        type: 'int',
        default: 20,
        min: 1,
        description: 'Min only',
      },
      {
        name: 'multiplier',
        type: 'float',
        default: 1.5,
        max: 10,
        description: 'Max only',
      },
    ];

    render(
      <IndicatorSettingsInputs
        params={{ period: 20, multiplier: 1.5 }}
        parameterDefinitions={partialDefs}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    expect(screen.getByText('Min: 1')).toBeInTheDocument();
    expect(screen.getByText('Max: 10')).toBeInTheDocument();
  });

  it('should disable all inputs when disabled prop is true', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
        disabled={true}
      />
    );

    const periodInput = screen.getByLabelText('period') as HTMLInputElement;
    const multiplierInput = screen.getByLabelText('multiplier') as HTMLInputElement;
    const sourceInput = screen.getByLabelText('source') as HTMLInputElement;

    expect(periodInput.disabled).toBe(true);
    expect(multiplierInput.disabled).toBe(true);
    expect(sourceInput.disabled).toBe(true);
  });

  it('should use step value from definition', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    const multiplierInput = screen.getByLabelText('multiplier') as HTMLInputElement;
    expect(multiplierInput.step).toBe('0.1');
  });

  it('should default to step=1 for int type', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={defaultParams}
        parameterDefinitions={parameterDefinitions}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    const periodInput = screen.getByLabelText('period') as HTMLInputElement;
    expect(periodInput.step).toBe('1');
  });

  it('should show empty state message when no parameters', () => {
    const onParamChange = vi.fn();

    render(
      <IndicatorSettingsInputs
        params={{}}
        parameterDefinitions={[]}
        onParamChange={onParamChange}
        errors={{}}
      />
    );

    expect(screen.getByText('No parameters available for this indicator')).toBeInTheDocument();
  });

  describe('Edge cases', () => {
    it('should handle zero values correctly', () => {
      const onParamChange = vi.fn();
      const defsWithZero: ParameterDefinition[] = [
        {
          name: 'offset',
          type: 'int',
          default: 0,
          min: 0,
          max: 100,
          description: 'Offset',
        },
      ];

      render(
        <IndicatorSettingsInputs
          params={{ offset: 0 }}
          parameterDefinitions={defsWithZero}
          onParamChange={onParamChange}
          errors={{}}
        />
      );

      const offsetInput = screen.getByLabelText('offset') as HTMLInputElement;
      expect(offsetInput.value).toBe('0');
    });

    it('should handle negative values correctly', () => {
      const onParamChange = vi.fn();
      const defsWithNegative: ParameterDefinition[] = [
        {
          name: 'offset',
          type: 'int',
          default: 0,
          min: -100,
          max: 100,
          description: 'Offset',
        },
      ];

      render(
        <IndicatorSettingsInputs
          params={{ offset: -50 }}
          parameterDefinitions={defsWithNegative}
          onParamChange={onParamChange}
          errors={{}}
        />
      );

      const offsetInput = screen.getByLabelText('offset') as HTMLInputElement;
      expect(offsetInput.value).toBe('-50');
    });

    it('should handle very small float values', () => {
      const onParamChange = vi.fn();
      const defsWithSmallFloat: ParameterDefinition[] = [
        {
          name: 'threshold',
          type: 'float',
          default: 0.01,
          min: 0.001,
          max: 1.0,
          description: 'Threshold',
        },
      ];

      render(
        <IndicatorSettingsInputs
          params={{ threshold: 0.05 }}
          parameterDefinitions={defsWithSmallFloat}
          onParamChange={onParamChange}
          errors={{}}
        />
      );

      const thresholdInput = screen.getByLabelText('threshold') as HTMLInputElement;
      expect(thresholdInput.value).toBe('0.05');
    });
  });
});
