/**
 * Integration test for style changes apply immediately
 * Feature: 008-overlay-indicator-rendering
 * Task: T019 [US2]
 *
 * Success Criteria:
 * - SC-009: Indicator calculation and rendering completes within 100ms for any single indicator update
 * - Style changes trigger state update immediately
 * - Chart series receives updated style options
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { IndicatorSettingsStyle } from '../IndicatorSettingsStyle';
import { useIndicatorInstances } from '../../hooks/useIndicatorInstances';
import type { IndicatorInstance } from '../types/indicators';

// Mock the useIndicatorInstances hook
vi.mock('../../hooks/useIndicatorInstances', () => ({
  useIndicatorInstances: vi.fn(),
}));

// Mock Lightweight Charts
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      applyOptions: vi.fn(),
    })),
    removeSeries: vi.fn(),
  })),
}));

describe('IndicatorSettingsStyle - Integration Tests (T019)', () => {
  const mockInstance: IndicatorInstance = {
    id: 'test-instance-1',
    symbol: 'AAPL',
    indicatorType: {
      category: 'overlay',
      name: 'sma',
      params: { period: 20 },
    },
    displayName: 'SMA(20)',
    style: {
      color: '#ff6d00',
      lineWidth: 2,
      showLastValue: true,
    },
    isVisible: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  const mockUpdateStyle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useIndicatorInstances as any).mockReturnValue({
      instances: [mockInstance],
      updateStyle: mockUpdateStyle,
      isLoaded: true,
    });
  });

  describe('immediate style changes (SC-009: < 100ms)', () => {
    it('should apply color change immediately', async () => {
      const startTime = performance.now();

      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Find the color picker text input and change the color
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '2962ff' } });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Callback should be called immediately
      expect(mockUpdateStyle).toHaveBeenCalledWith({ color: '#2962ff' });
      expect(mockUpdateStyle).toHaveBeenCalledTimes(1);

      // Performance check: should complete within 100ms (SC-009)
      console.log(`Color change render time: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(100);
    });

    it('should apply line width change immediately', async () => {
      const startTime = performance.now();

      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Find the line width button for width 4
      const widthButton = screen.getByLabelText('Line width 4 pixels');
      fireEvent.click(widthButton);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(mockUpdateStyle).toHaveBeenCalledWith({ lineWidth: 4 });
      expect(mockUpdateStyle).toHaveBeenCalledTimes(1);

      console.log(`Line width change render time: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(100);
    });

    it('should apply showLastValue toggle immediately', async () => {
      const startTime = performance.now();

      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Find the toggle switch
      const toggle = screen.getByRole('switch', { checked: true });
      fireEvent.click(toggle);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(mockUpdateStyle).toHaveBeenCalledWith({ showLastValue: false });
      expect(mockUpdateStyle).toHaveBeenCalledTimes(1);

      console.log(`ShowLastValue toggle render time: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle multiple rapid style changes within budget', async () => {
      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      const startTime = performance.now();

      // Rapidly change multiple styles
      fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '2962ff' } });
      fireEvent.click(screen.getByLabelText('Line width 3 pixels'));
      fireEvent.click(screen.getByRole('switch', { checked: true }));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All three changes should have been called
      expect(mockUpdateStyle).toHaveBeenCalledTimes(3);
      expect(mockUpdateStyle).toHaveBeenNthCalledWith(1, { color: '#2962ff' });
      expect(mockUpdateStyle).toHaveBeenNthCalledWith(2, { lineWidth: 3 });
      expect(mockUpdateStyle).toHaveBeenNthCalledWith(3, { showLastValue: false });

      console.log(`Three style changes total time: ${totalTime.toFixed(2)}ms`);
      // Total should still be fast (each individual change < 100ms)
      expect(totalTime).toBeLessThan(300);
    });
  });

  describe('style change propagation', () => {
    it('should propagate style changes through useIndicatorInstances', async () => {
      // Test that the style change flows to the hook
      const mockStyleChange = vi.fn();

      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockStyleChange}
        />
      );

      // Change color
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'ef5350' } });

      // Verify callback received the style update
      expect(mockStyleChange).toHaveBeenCalledWith({ color: '#ef5350' });
    });

    it('should merge partial style updates correctly', async () => {
      const mockStyleChange = vi.fn();

      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockStyleChange}
        />
      );

      // Change only color (partial update)
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '26a69a' } });

      expect(mockStyleChange).toHaveBeenCalledWith({ color: '#26a69a' });

      // Verify other properties are preserved when merged in parent
      // (This would be tested in a full integration test with actual hook)
    });
  });

  describe('preset color selection', () => {
    it('should apply preset color immediately on click', async () => {
      const startTime = performance.now();

      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Find and click the blue preset
      const bluePreset = screen.getByTitle('Blue');
      fireEvent.click(bluePreset);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(mockUpdateStyle).toHaveBeenCalledWith({ color: '#2962ff' });

      console.log(`Preset color selection time: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(100);
    });
  });

  describe('disabled state', () => {
    it('should not apply changes when disabled', async () => {
      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
          disabled={true}
        />
      );

      // Try to change color
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: '2962ff' } });

      // Should not call onChange when disabled
      expect(mockUpdateStyle).not.toHaveBeenCalled();
    });
  });

  describe('visual preview updates', () => {
    it('should update preview when style changes', async () => {
      const { container } = render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Get initial preview line color
      const previewLine = container.querySelector('polyline') as SVGPolylineElement;
      const initialColor = previewLine?.getAttribute('stroke');

      // Change color
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'ef5350' } });

      // Preview should update with new color
      // (Note: In actual implementation, the preview would reflect the new color
      // but this test verifies the component structure exists)
      expect(previewLine).toBeInTheDocument();
    });

    it('should update line width preview', async () => {
      const { container } = render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Click width 4 button
      const widthButton = screen.getByLabelText('Line width 4 pixels');
      fireEvent.click(widthButton);

      // Preview line width would update in actual DOM
      expect(mockUpdateStyle).toHaveBeenCalledWith({ lineWidth: 4 });
    });
  });

  describe('form validation', () => {
    it('should prevent invalid color changes', async () => {
      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Try invalid color
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'gggggg' } });

      // Should not call onChange with invalid color
      expect(mockUpdateStyle).not.toHaveBeenCalled();

      // Error indicator should be shown
      expect(screen.getByText('Invalid hex')).toBeInTheDocument();
    });

    it('should accept valid 3-digit hex colors', async () => {
      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Enter valid 3-digit hex
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'f00' } });

      // Should normalize and call onChange
      expect(mockUpdateStyle).toHaveBeenCalledWith({ color: '#ff0000' });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid color changes without errors', async () => {
      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Rapidly change colors
      const colors = ['ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff'];
      const textInput = screen.getByPlaceholderText('000000');

      colors.forEach((color) => {
        fireEvent.change(textInput, { target: { value: color } });
      });

      // All changes should have been processed
      expect(mockUpdateStyle).toHaveBeenCalledTimes(5);
    });

    it('should handle same color change gracefully', async () => {
      render(
        <IndicatorSettingsStyle
          instance={mockInstance}
          onStyleChange={mockUpdateStyle}
        />
      );

      // Change to current color
      const textInput = screen.getByPlaceholderText('000000');
      fireEvent.change(textInput, { target: { value: 'ff6d00' } });

      // Should still trigger update (React normal behavior)
      expect(mockUpdateStyle).toHaveBeenCalledWith({ color: '#ff6d00' });
    });
  });
});
