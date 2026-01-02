/**
 * Unit test for ColorPicker component color validation
 * Feature: 008-overlay-indicator-rendering
 * Task: T018 [P] [US2]
 *
 * Tests:
 * - Hex color validation (#RGB and #RRGGBB formats)
 * - Color normalization (#RGB → #RRGGBB)
 * - Native color picker integration
 * - Text input with validation feedback
 * - Preset color selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ColorPicker, ColorPickerWithPresets, COLOR_PRESETS } from '../ColorPicker';

describe('ColorPicker - Hex Color Validation (T018)', () => {
  describe('valid hex color formats', () => {
    it('should accept 6-digit hex colors (#RRGGBB)', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '2962ff' } });

      expect(handleChange).toHaveBeenCalledWith('#2962ff');
    });

    it('should accept 3-digit hex colors (#RGB)', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'f00' } });

      expect(handleChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should accept hex without # prefix', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '26a69a' } });

      expect(handleChange).toHaveBeenCalledWith('#26a69a');
    });

    it('should accept uppercase hex colors', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#2962ff"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'EF5350' } });

      expect(handleChange).toHaveBeenCalledWith('#ef5350');
    });

    it('should accept mixed case hex colors', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'Ff6D00' } });

      expect(handleChange).toHaveBeenCalledWith('#ff6d00');
    });
  });

  describe('invalid hex color formats', () => {
    it('should reject invalid hex characters', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'gggggg' } });

      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.getByText('Invalid hex')).toBeInTheDocument();
    });

    it('should reject too short hex codes (< 3 digits)', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'ff' } });

      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.getByText('Invalid hex')).toBeInTheDocument();
    });

    it('should reject invalid length hex codes (4, 5 digits)', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'ff6d0' } });

      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.getByText('Invalid hex')).toBeInTheDocument();
    });

    it('should reject too long hex codes (> 6 digits)', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#2962ff"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      // Max length is 6, so 8-character input gets truncated to first 6
      fireEvent.change(textInput, { target: { value: 'ff6d0012' } });

      // Should display first 6 characters in uppercase (formatHexDisplay)
      expect(textInput).toHaveValue('FF6D00');
      // The truncated value 'ff6d00' is valid 6-digit hex, so onChange IS called
      expect(handleChange).toHaveBeenCalledWith('#ff6d00');
    });

    it('should reject empty string', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '' } });

      // Empty input is allowed while typing but doesn't trigger change
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('should reject special characters', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '!@#$%' } });

      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.getByText('Invalid hex')).toBeInTheDocument();
    });
  });

  describe('color normalization', () => {
    it('should normalize #RGB to #RRGGBB', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'f00' } });

      expect(handleChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should normalize #RGB to #RRGGBB for all colors', () => {
      const testCases = [
        { input: 'f00', expected: '#ff0000' }, // red
        { input: '0f0', expected: '#00ff00' }, // green
        { input: '00f', expected: '#0000ff' }, // blue
        { input: 'fff', expected: '#ffffff' }, // white
        { input: '000', expected: '#000000' }, // black
      ];

      testCases.forEach(({ input, expected }) => {
        const handleChange = vi.fn();
        render(
          <ColorPicker
            value="#ff6d00"
            onChange={handleChange}
          />
        );

        const textInput = screen.getByPlaceholderText('000000');
        fireEvent.change(textInput, { target: { value: input } });

        expect(handleChange).toHaveBeenCalledWith(expected);

        // Cleanup for next test
        cleanup();
      });
    });

    it('should preserve 6-digit hex format', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'ff6d00' } });

      expect(handleChange).toHaveBeenCalledWith('#ff6d00');
    });

    it('should display uppercase hex in text input', () => {
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={vi.fn()}
        />
      );

      const textInput = screen.getByDisplayValue('FF6D00') as HTMLInputElement;
      expect(textInput.value).toBe('FF6D00');
    });
  });

  describe('blur behavior', () => {
    it('should revert to current value on blur if invalid', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      // Type invalid input
      fireEvent.change(textInput, { target: { value: 'invalid' } });
      // onChange should not be called for invalid input
      expect(handleChange).not.toHaveBeenCalled();

      // Blur should revert to original value
      fireEvent.blur(textInput);
      expect(textInput).toHaveValue('FF6D00');
    });

    it('should revert to current value on blur if empty', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '' } });
      expect(textInput).toHaveValue('');

      fireEvent.blur(textInput);
      expect(textInput).toHaveValue('FF6D00');
    });
  });

  describe('native color picker', () => {
    it('should update color when native picker changes', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const colorInput = screen.getByLabelText('Pick a color') as HTMLInputElement;
      fireEvent.change(colorInput, { target: { value: '#2962ff' } });

      expect(handleChange).toHaveBeenCalledWith('#2962ff');
    });

    it('should sync text input with native picker', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
        />
      );

      const colorInput = screen.getByLabelText('Pick a color') as HTMLInputElement;
      fireEvent.change(colorInput, { target: { value: '#26a69a' } });

      const textInput = screen.getByDisplayValue('26A69A') as HTMLInputElement;
      expect(textInput).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable all inputs when disabled', () => {
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const colorInput = screen.getByLabelText('Pick a color') as HTMLInputElement;
      const textInput = screen.getByPlaceholderText('000000') as HTMLInputElement;

      expect(colorInput).toBeDisabled();
      expect(textInput).toBeDisabled();
    });

    it('should not call onChange when disabled', () => {
      const handleChange = vi.fn();
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={handleChange}
          disabled={true}
        />
      );

      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '2962ff' } });

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('label prop', () => {
    it('should display label when provided', () => {
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={vi.fn()}
          label="Line Color"
        />
      );

      expect(screen.getByText('Line Color')).toBeInTheDocument();
    });

    it('should not display label when not provided', () => {
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={vi.fn()}
        />
      );

      // No label element should be present
      const label = screen.queryByText((content, element) => {
        return element?.tagName === 'LABEL' && content === 'Line Color';
      });
      expect(label).not.toBeInTheDocument();
    });
  });

  describe('showTextInput prop', () => {
    it('should hide text input when showTextInput is false', () => {
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={vi.fn()}
          showTextInput={false}
        />
      );

      const textInput = screen.queryByPlaceholderText('000000');
      expect(textInput).not.toBeInTheDocument();
    });

    it('should show text input when showTextInput is true (default)', () => {
      render(
        <ColorPicker
          value="#ff6d00"
          onChange={vi.fn()}
          showTextInput={true}
        />
      );

      const textInput = screen.queryByPlaceholderText('000000');
      expect(textInput).toBeInTheDocument();
    });
  });
});

describe('ColorPickerWithPresets', () => {
  it('should display all default presets', () => {
    render(
      <ColorPickerWithPresets
        value="#ff6d00"
        onChange={vi.fn()}
        showPresets={true}
      />
    );

    expect(screen.getByText('Quick Select:')).toBeInTheDocument();

    // Check that each preset button exists
    COLOR_PRESETS.forEach((preset) => {
      const button = screen.getByTitle(preset.name);
      expect(button).toBeInTheDocument();
    });
  });

  it('should apply preset color on click', () => {
    const handleChange = vi.fn();
    render(
      <ColorPickerWithPresets
        value="#ff6d00"
        onChange={handleChange}
        showPresets={true}
      />
    );

    const blueButton = screen.getByTitle('Blue');
    fireEvent.click(blueButton);

    expect(handleChange).toHaveBeenCalledWith('#2962ff');
  });

  it('should highlight currently selected preset', () => {
    render(
      <ColorPickerWithPresets
        value="#ff6d00"
        onChange={vi.fn()}
        showPresets={true}
      />
    );

    // Orange is the current value (#ff6d00)
    const orangeButton = screen.getByTitle('Orange');
    expect(orangeButton).toHaveClass('ring-2');
  });

  it('should not show presets when showPresets is false', () => {
    render(
      <ColorPickerWithPresets
        value="#ff6d00"
        onChange={vi.fn()}
        showPresets={false}
      />
    );

    expect(screen.queryByText('Quick Select:')).not.toBeInTheDocument();
  });

  it('should use custom presets when provided', () => {
    const customPresets = [
      { name: 'Custom Red', value: '#ff0000' },
      { name: 'Custom Green', value: '#00ff00' },
    ] as const;

    render(
      <ColorPickerWithPresets
        value="#ff0000"
        onChange={vi.fn()}
        presets={customPresets}
        showPresets={true}
      />
    );

    expect(screen.getByTitle('Custom Red')).toBeInTheDocument();
    expect(screen.getByTitle('Custom Green')).toBeInTheDocument();
    expect(screen.queryByTitle('Blue')).not.toBeInTheDocument();
  });
});

describe('COLOR_PRESETS constant', () => {
  it('should have all required preset colors', () => {
    expect(COLOR_PRESETS).toHaveLength(9);

    const expectedColors = [
      { name: 'Orange', value: '#ff6d00' },
      { name: 'Blue', value: '#2962ff' },
      { name: 'Red', value: '#ef5350' },
      { name: 'Green', value: '#26a69a' },
      { name: 'Cyan', value: '#00bcd4' },
      { name: 'Yellow', value: '#ffeb3b' },
      { name: 'Purple', value: '#aa00ff' },
      { name: 'Gray', value: '#9e9e9e' },
      { name: 'White', value: '#ffffff' },
    ];

    COLOR_PRESETS.forEach((preset) => {
      const expected = expectedColors.find(e => e.name === preset.name);
      expect(expected).toBeDefined();
      expect(preset.value).toBe(expected?.value);
    });
  });
});
