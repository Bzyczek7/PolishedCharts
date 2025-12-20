import { render, screen } from '@testing-library/react'
import App from '../App'
import { expect, test, vi } from 'vitest'

vi.mock('../api/candles', () => ({
  getCandles: vi.fn().mockResolvedValue([]),
}))

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn().mockReturnValue({
    addSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
  ColorType: { Solid: 'solid' },
  CandlestickSeries: vi.fn(),
  LineSeries: vi.fn(),
  HistogramSeries: vi.fn(),
}))

test('renders tradingalert heading', () => {
  render(<App />)
  expect(screen.getByText(/TradingAlert/i)).toBeDefined()
})