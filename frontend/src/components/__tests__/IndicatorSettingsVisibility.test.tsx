/**
 * Unit tests for IndicatorSettingsVisibility component
 * Feature: 008-overlay-indicator-rendering
 * Phase 6: User Story 4 - Toggle Indicator Visibility
 * T032: Create IndicatorSettingsVisibility component with Radix UI Switch
 *
 * Tests:
 * - Toggle switch renders correctly
 * - onToggle is called with correct value
 * - Disabled state works
 * - Label displays correctly
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IndicatorSettingsVisibility } from '../IndicatorSettingsVisibility';

describe('IndicatorSettingsVisibility', () => {
  it('should render toggle switch with default label', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={true}
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('Visible')).toBeInTheDocument();
  });

  it('should render toggle switch with custom label', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={true}
        onToggle={onToggle}
        label="Show Indicator"
      />
    );

    expect(screen.getByText('Show Indicator')).toBeInTheDocument();
  });

  it('should call onToggle with false when unchecked', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={true}
        onToggle={onToggle}
      />
    );

    const checkbox = screen.getByRole('switch');
    fireEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('should call onToggle with true when checked', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={false}
        onToggle={onToggle}
      />
    );

    const checkbox = screen.getByRole('switch');
    fireEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('should display checked state correctly', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={true}
        onToggle={onToggle}
      />
    );

    const checkbox = screen.getByRole('switch');
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('should display unchecked state correctly', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={false}
        onToggle={onToggle}
      />
    );

    const checkbox = screen.getByRole('switch');
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
  });

  it('should be disabled when disabled prop is true', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={true}
        onToggle={onToggle}
        disabled={true}
      />
    );

    const checkbox = screen.getByRole('switch');
    expect(checkbox).toHaveAttribute('data-disabled', '');
  });

  it('should not call onToggle when disabled and clicked', () => {
    const onToggle = vi.fn();

    render(
      <IndicatorSettingsVisibility
        visible={true}
        onToggle={onToggle}
        disabled={true}
      />
    );

    const checkbox = screen.getByRole('switch');
    fireEvent.click(checkbox);

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const onToggle = vi.fn();

    const { container } = render(
      <IndicatorSettingsVisibility
        visible={true}
        onToggle={onToggle}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
