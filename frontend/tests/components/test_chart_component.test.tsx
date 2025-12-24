import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { render, screen, waitFor } from '@testing-library/react'
import ChartComponent from '../../src/components/ChartComponent'
import type { Candle } from '../../src/api/candles'

describe('ChartComponent', () => {
  const mockCandles: Candle[] = [
    { timestamp: '2023-10-27T00:00:00Z', open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { timestamp: '2023-10-27T01:00:00Z', open: 105, high: 115, low: 100, close: 110, volume: 1200 },
  ]

  // T066 [US4] Test: Multiple charts maintain independent state
  it('should maintain independent state for multiple charts', async () => {
    const onTimeScaleInit1 = vi.fn()
    const onTimeScaleInit2 = vi.fn()

    const { container: container1 } = render(
      <ChartComponent
        symbol="AAPL"
        candles={mockCandles}
        onTimeScaleInit={onTimeScaleInit1}
      />
    )

    const { container: container2 } = render(
      <ChartComponent
        symbol="SPY"
        candles={mockCandles}
        onTimeScaleInit={onTimeScaleInit2}
      />
    )

    // Verify both charts rendered independently
    expect(container1.querySelector('[data-testid="chart-container"]')).toBeTruthy()
    expect(container2.querySelector('[data-testid="chart-container"]')).toBeTruthy()

    // Verify each chart has its own time scale
    await waitFor(() => {
      expect(onTimeScaleInit1).toHaveBeenCalled()
      expect(onTimeScaleInit2).toHaveBeenCalled()
    })

    // Verify the time scales are different instances
    const timeScale1 = onTimeScaleInit1.mock.calls[0]?.[0]
    const timeScale2 = onTimeScaleInit2.mock.calls[0]?.[0]

    expect(timeScale1).not.toBe(timeScale2)
  })

  it('should handle symbol changes independently', async () => {
    const { rerender } = render(
      <ChartComponent
        symbol="AAPL"
        candles={mockCandles}
      />
    )

    // Get initial chart element
    const chartElement1 = screen.getByTestId('chart-container')

    // Rerender with different symbol
    rerender(
      <ChartComponent
        symbol="SPY"
        candles={mockCandles}
      />
    )

    // Chart should still exist (same component instance)
    expect(screen.getByTestId('chart-container')).toBeTruthy()
  })
})
