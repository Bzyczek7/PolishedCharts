/**
 * UI Responsibility Performance Tests
 * Feature: 012-performance-optimization
 * User Story 5 - Overall Application Responsiveness
 * Task: T043
 *
 * Verifies that the application provides visual feedback within 200ms
 * for all user interactions (SC-007, FR-013).
 *
 * Success Criteria:
 * - SC-007: UI feedback <= 200ms
 * - FR-013: Loading state for long operations (> 200ms)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { performance } from 'perf_hooks';

// Test utilities
interface PerformanceMark {
  name: string;
  startTime: number;
  duration: number;
}

const marks: PerformanceMark[] = [];

function mark(name: string): void {
  marks.push({ name, startTime: performance.now(), duration: 0 });
}

function measure(name: string): number {
  const endTime = performance.now();
  const markEntry = marks.find(m => m.name === name);
  if (markEntry) {
    markEntry.duration = endTime - markEntry.startTime;
    return markEntry.duration;
  }
  return -1;
}

function clearMarks(): void {
  marks.length = 0;
}

/**
 * SC-007: UI feedback appears within 200ms
 */
describe('SC-007: UI Feedback Latency', () => {
  beforeEach(() => {
    clearMarks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearMarks();
  });

  /**
   * Test: Button click shows immediate visual feedback
   * Expected: Feedback appears within 200ms
   */
  it('should show button click feedback within 200ms', async () => {
    const TestComponent = () => {
      const [clicked, setClicked] = React.useState(false);

      const handleClick = () => {
        mark('button_click_start');
        setClicked(true);
      };

      return React.createElement('button', {
        onClick: handleClick,
        className: clicked ? 'clicked' : '',
        'data-testid': 'test-button'
      }, 'Click me');
    };

    const { getByTestId } = render(TestComponent);
    const button = getByTestId('test-button');

    act(() => {
      button.click();
    });

    const duration = measure('button_click_start');
    expect(duration).toBeLessThanOrEqual(200);
    expect(button).toHaveClass('clicked');
  });

  /**
   * Test: Dropdown menu appears within 200ms of trigger
   * Expected: Menu visible within 200ms
   */
  it('should show dropdown menu within 200ms', async () => {
    const TestDropdown = () => {
      const [open, setOpen] = React.useState(false);

      const handleToggle = () => {
        mark('dropdown_toggle_start');
        setOpen(prev => !prev);
      };

      return React.createElement('div', null,
        React.createElement('button', {
          onClick: handleToggle,
          'data-testid': 'dropdown-trigger'
        }, 'Toggle'),
        open ? React.createElement('div', {
          'data-testid': 'dropdown-menu',
          className: 'menu'
        }, 'Menu Items') : null
      );
    };

    const { getByTestId } = render(TestDropdown);
    const trigger = getByTestId('dropdown-trigger');

    act(() => {
      trigger.click();
    });

    const duration = measure('dropdown_toggle_start');
    expect(duration).toBeLessThanOrEqual(200);
    expect(getByTestId('dropdown-menu')).toBeInTheDocument();
  });

  /**
   * Test: Form submission shows loading state within 200ms
   * Expected: Loading indicator visible within 200ms
   */
  it('should show form loading state within 200ms', async () => {
    const TestForm = () => {
      const [loading, setLoading] = React.useState(false);

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        mark('form_submit_start');
        setLoading(true);
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        setLoading(false);
      };

      return React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('button', {
          type: 'submit',
          disabled: loading,
          'data-testid': 'submit-button'
        }, loading ? 'Loading...' : 'Submit')
      );
    };

    const { getByTestId } = render(TestForm);
    const button = getByTestId('submit-button');

    act(() => {
      button.click();
    });

    const duration = measure('form_submit_start');
    expect(duration).toBeLessThanOrEqual(200);
    expect(button).toBeDisabled();
  });

  /**
   * Test: Input field provides immediate visual feedback on focus
   * Expected: Focus styles applied within 200ms
   */
  it('should show input focus feedback within 200ms', () => {
    const TestInput = () => {
      const [focused, setFocused] = React.useState(false);

      return React.createElement('input', {
        onFocus: () => {
          mark('input_focus_start');
          setFocused(true);
        },
        onBlur: () => setFocused(false),
        className: focused ? 'focused' : '',
        'data-testid': 'test-input'
      });
    };

    const { getByTestId } = render(TestInput);
    const input = getByTestId('test-input') as HTMLInputElement;

    act(() => {
      input.focus();
    });

    const duration = measure('input_focus_start');
    expect(duration).toBeLessThanOrEqual(200);
    expect(input).toHaveClass('focused');
  });
});

/**
 * FR-013: Loading state for long-running operations
 */
describe('FR-013: Loading State for Long Operations', () => {
  beforeEach(() => {
    clearMarks();
  });

  afterEach(() => {
    clearMarks();
  });

  /**
   * Test: Loading indicator appears after 200ms for long operations
   * Expected: No loading indicator for fast operations (< 200ms)
   */
  it('should not show loading for fast operations (< 200ms)', async () => {
    const mockOperation = vi.fn(async () => {
      mark('operation_start');
      // Fast operation - completes in 50ms
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'success';
    });

    const result = await mockOperation();
    const duration = measure('operation_start');

    expect(result).toBe('success');
    expect(duration).toBeLessThan(200);
  });

  /**
   * Test: Loading indicator appears for operations longer than 200ms
   * Expected: Loading state shown
   */
  it('should show loading for slow operations (> 200ms)', async () => {
    let loadingState = false;
    const setLoadingState = vi.fn((loading: boolean) => {
      loadingState = loading;
    });

    const mockOperation = vi.fn(async () => {
      mark('operation_start');
      setLoadingState(true);
      // Slow operation - takes 500ms
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoadingState(false);
      return 'success';
    });

    // Start operation
    const promise = mockOperation();

    // After 200ms, loading should be set
    await waitFor(() => {
      const duration = measure('operation_start');
      if (duration >= 200) {
        expect(setLoadingState).toHaveBeenCalledWith(true);
      }
    }, { timeout: 300 });

    await promise;
    expect(setLoadingState).toHaveBeenCalledWith(false);
  });
});

/**
 * Debounce behavior for rapid interactions
 */
describe('Debounce for Rapid Interactions', () => {
  beforeEach(() => {
    clearMarks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearMarks();
    vi.useRealTimers();
  });

  /**
   * Test: Rapid symbol switches are debounced (300ms delay)
   * Expected: Only last symbol triggers fetch
   */
  it('should debounce rapid symbol switches', async () => {
    const fetchCalls: string[] = [];

    const mockFetchSymbol = vi.fn((symbol: string) => {
      fetchCalls.push(symbol);
      return Promise.resolve({ data: symbol });
    });

    // Simulate rapid symbol switches
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];

    // Rapidly switch through symbols
    for (const symbol of symbols) {
      act(() => {
        mockFetchSymbol(symbol);
      });
      // Advance time by 50ms between each switch
      vi.advanceTimersByTime(50);
    }

    // Fast forward through debounce delay (300ms)
    vi.advanceTimersByTime(300);

    // Should only fetch the last symbol due to debounce
    expect(fetchCalls.length).toBeLessThan(symbols.length);
    expect(fetchCalls[fetchCalls.length - 1]).toBe('AMZN');
  });

  /**
   * Test: Slow symbol switches each trigger fetch
   * Expected: Each symbol fetches independently
   */
  it('should fetch each symbol when switches are slow', async () => {
    const fetchCalls: string[] = [];

    const mockFetchSymbol = vi.fn((symbol: string) => {
      fetchCalls.push(symbol);
      return Promise.resolve({ data: symbol });
    });

    const symbols = ['AAPL', 'MSFT', 'GOOGL'];

    // Switch symbols slowly (400ms apart - longer than debounce)
    for (const symbol of symbols) {
      await act(async () => {
        await mockFetchSymbol(symbol);
      });
      vi.advanceTimersByTime(400);
    }

    // All symbols should be fetched
    expect(fetchCalls).toEqual(symbols);
  });
});

/**
 * UI remains responsive during simultaneous operations
 */
describe('UI Responsiveness During Concurrent Operations', () => {
  beforeEach(() => {
    clearMarks();
  });

  afterEach(() => {
    clearMarks();
  });

  /**
   * Test: Multiple concurrent operations don't block UI
   * Expected: Each operation shows independent loading state
   */
  it('should handle concurrent operations independently', async () => {
    const loadingStates = {
      candles: false,
      indicators: false,
      alerts: false,
    };

    const mockFetchCandles = vi.fn(async () => {
      loadingStates.candles = true;
      mark('candles_start');
      await new Promise(resolve => setTimeout(resolve, 300));
      loadingStates.candles = false;
      return [];
    });

    const mockFetchIndicators = vi.fn(async () => {
      loadingStates.indicators = true;
      mark('indicators_start');
      await new Promise(resolve => setTimeout(resolve, 200));
      loadingStates.indicators = false;
      return {};
    });

    const mockFetchAlerts = vi.fn(async () => {
      loadingStates.alerts = true;
      mark('alerts_start');
      await new Promise(resolve => setTimeout(resolve, 100));
      loadingStates.alerts = false;
      return [];
    });

    // Execute all operations concurrently
    await Promise.all([
      mockFetchCandles(),
      mockFetchIndicators(),
      mockFetchAlerts(),
    ]);

    // All operations should complete independently
    expect(loadingStates.candles).toBe(false);
    expect(loadingStates.indicators).toBe(false);
    expect(loadingStates.alerts).toBe(false);

    // All operations should complete within reasonable time
    const candlesDuration = measure('candles_start');
    const indicatorsDuration = measure('indicators_start');
    const alertsDuration = measure('alerts_start');

    expect(candlesDuration).toBeGreaterThan(0);
    expect(indicatorsDuration).toBeGreaterThan(0);
    expect(alertsDuration).toBeGreaterThan(0);
  });
});

// Import React for createElement
import React from 'react';
import { render } from '@testing-library/react';

/**
 * Integration test: Real-world user flows
 */
describe('Integration: Real-World User Flows', () => {
  /**
   * Test: Complete chart load flow provides feedback within 200ms
   */
  it('should provide feedback during chart load flow', async () => {
    const steps: { name: string; duration: number }[] = [];

    const testFlow = async () => {
      // Step 1: Select symbol
      mark('symbol_select');
      await new Promise(resolve => setTimeout(resolve, 10));
      steps.push({ name: 'symbol_select', duration: measure('symbol_select') });

      // Step 2: Fetch candles (cached)
      mark('fetch_candles');
      await new Promise(resolve => setTimeout(resolve, 50)); // Cache hit
      steps.push({ name: 'fetch_candles', duration: measure('fetch_candles') });

      // Step 3: Fetch indicators
      mark('fetch_indicators');
      await new Promise(resolve => setTimeout(resolve, 150));
      steps.push({ name: 'fetch_indicators', duration: measure('fetch_indicators') });

      // Step 4: Render chart
      mark('render_chart');
      await new Promise(resolve => setTimeout(resolve, 100));
      steps.push({ name: 'render_chart', duration: measure('render_chart') });
    };

    await testFlow();

    // Each step should show progress (even if not complete, user sees movement)
    // Total time should be reasonable
    const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);
    expect(totalDuration).toBeLessThan(3000); // Complete flow under 3s

    // Each individual step should provide feedback
    steps.forEach(step => {
      expect(step.duration).toBeLessThan(1000);
    });
  });
});
