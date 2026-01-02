/**
 * Unit tests for OverlayIndicatorLegend component
 * Feature: 008-overlay-indicator-rendering
 * Phase 6: User Story 4 - Toggle Indicator Visibility
 * T035: Add grayed-out appearance for hidden indicators in legend
 *
 * Tests:
 * - Legend renders with indicators
 * - Hidden indicators appear grayed out
 * - Visibility toggle works
 * - Remove button works
 * - Empty state displays correctly
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverlayIndicatorLegend } from '../OverlayIndicatorLegend';
import type { IndicatorInstance } from '../types/indicators';

describe('OverlayIndicatorLegend', () => {
  const mockInstances: IndicatorInstance[] = [
    {
      id: '1',
      symbol: 'AAPL',
      indicatorType: {
        category: 'overlay',
        name: 'sma',
        params: { period: 20 },
      },
      displayName: 'SMA(20)',
      style: {
        color: '#ff0000',
        lineWidth: 2,
        showLastValue: true,
      },
      isVisible: true,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      symbol: 'AAPL',
      indicatorType: {
        category: 'overlay',
        name: 'ema',
        params: { period: 50 },
      },
      displayName: 'EMA(50)',
      style: {
        color: '#00ff00',
        lineWidth: 2,
        showLastValue: true,
      },
      isVisible: false,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  it('should render all indicators in legend', () => {
    const onToggleVisibility = vi.fn();

    render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
      />
    );

    expect(screen.getByText('SMA(20)')).toBeInTheDocument();
    expect(screen.getByText('EMA(50)')).toBeInTheDocument();
  });

  it('should show color swatches for each indicator', () => {
    const onToggleVisibility = vi.fn();

    const { container } = render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
      />
    );

    const swatches = container.querySelectorAll('[title^="#"]');
    expect(swatches).toHaveLength(2);
  });

  it('should apply grayed-out appearance for hidden indicators', () => {
    const onToggleVisibility = vi.fn();

    const { container } = render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
      />
    );

    const rows = container.querySelectorAll('div[class*="transition-colors"]');
    const visibleRow = rows[0];
    const hiddenRow = rows[1];

    // Visible indicator should NOT have opacity-50
    expect(visibleRow.className).not.toContain('opacity-50');

    // Hidden indicator should have opacity-50
    expect(hiddenRow.className).toContain('opacity-50');
  });

  it('should call onToggleVisibility when toggle is clicked', () => {
    const onToggleVisibility = vi.fn();

    render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
      />
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    expect(onToggleVisibility).toHaveBeenCalledWith('1');
  });

  it('should show remove buttons when onRemove is provided', () => {
    const onToggleVisibility = vi.fn();
    const onRemove = vi.fn();

    const { container } = render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
        onRemove={onRemove}
      />
    );

    const removeButtons = container.querySelectorAll('button[title="Remove indicator"]');
    expect(removeButtons).toHaveLength(2);
  });

  it('should not show remove buttons when onRemove is not provided', () => {
    const onToggleVisibility = vi.fn();

    const { container } = render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
      />
    );

    const removeButtons = container.querySelectorAll('button[title="Remove indicator"]');
    expect(removeButtons).toHaveLength(0);
  });

  it('should call onRemove when remove button is clicked', () => {
    const onToggleVisibility = vi.fn();
    const onRemove = vi.fn();

    const { container } = render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
        onRemove={onRemove}
      />
    );

    const removeButtons = container.querySelectorAll('button[title="Remove indicator"]');
    fireEvent.click(removeButtons[0]);

    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('should display empty state message when no indicators', () => {
    const onToggleVisibility = vi.fn();

    render(
      <OverlayIndicatorLegend
        instances={[]}
        onToggleVisibility={onToggleVisibility}
      />
    );

    expect(screen.getByText('No overlay indicators added')).toBeInTheDocument();
  });

  it('should display correct toggle states', () => {
    const onToggleVisibility = vi.fn();

    render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
      />
    );

    const switches = screen.getAllByRole('switch');

    // First indicator (visible) should have data-state="checked"
    expect(switches[0]).toHaveAttribute('data-state', 'checked');

    // Second indicator (hidden) should have data-state="unchecked"
    expect(switches[1]).toHaveAttribute('data-state', 'unchecked');
  });

  it('should apply custom className', () => {
    const onToggleVisibility = vi.fn();

    const { container } = render(
      <OverlayIndicatorLegend
        instances={mockInstances}
        onToggleVisibility={onToggleVisibility}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should truncate long display names with tooltip', () => {
    const onToggleVisibility = vi.fn();

    const longInstance: IndicatorInstance = {
      ...mockInstances[0],
      displayName: 'Very Long Indicator Name That Should Be Truncated',
    };

    render(
      <OverlayIndicatorLegend
        instances={[longInstance]}
        onToggleVisibility={onToggleVisibility}
      />
    );

    const nameElement = screen.getByText('Very Long Indicator Name That Should Be Truncated');
    expect(nameElement).toBeInTheDocument();
    expect(nameElement).toHaveClass('truncate');
    expect(nameElement).toHaveAttribute('title', 'Very Long Indicator Name That Should Be Truncated');
  });
});
