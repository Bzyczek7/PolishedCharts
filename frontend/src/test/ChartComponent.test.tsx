import { render, screen, waitFor } from '@testing-library/react'
import ChartComponent from '../components/ChartComponent'
import { getCandles } from '../api/candles'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/candles')

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn().mockReturnValue({
    addCandlestickSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
  ColorType: { Solid: 'solid' },
}))

describe('ChartComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches candles on mount', async () => {
    const mockCandles = [
      { timestamp: '2023-10-27T00:00:00', open: 100, high: 110, low: 90, close: 105, volume: 1000 }
    ]
    vi.mocked(getCandles).mockResolvedValueOnce(mockCandles)

    render(<ChartComponent symbol="IBM" />)

    await waitFor(() => {
      expect(getCandles).toHaveBeenCalledWith('IBM')
    })
    
    expect(screen.getByTestId('chart-container')).toBeDefined()
  })
})