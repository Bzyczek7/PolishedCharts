import { render, screen } from '@testing-library/react'
import ChartComponent from '../components/ChartComponent'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn().mockReturnValue({
    addSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
    }),
    addCandlestickSeries: vi.fn().mockReturnValue({
        setData: vi.fn(),
    }),
    addLineSeries: vi.fn().mockReturnValue({
        setData: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
  ColorType: { Solid: 'solid' },
  CandlestickSeries: vi.fn(),
  LineSeries: vi.fn(),
}))

describe('ChartComponent', () => {

  beforeEach(() => {

    vi.clearAllMocks()

  })



  it('renders and initializes chart', async () => {
    const mockCandles = [
      { ticker: 'IBM', timestamp: '2023-10-27T00:00:00', open: 100, high: 110, low: 90, close: 105, volume: 1000 }
    ]

    render(<ChartComponent symbol="IBM" candles={mockCandles} />)
    
    expect(screen.getByTestId('chart-container')).toBeDefined()
  })

  it('renders overlay indicators when provided', async () => {
    const mockCandles = [
      { ticker: 'IBM', timestamp: '2023-10-27T00:00:00', open: 100, high: 110, low: 90, close: 105, volume: 1000 }
    ]

    const mockOverlay = {
        id: 'test-overlay',
        data: [{ time: 1698364800, value: 102 }],
        color: '#FF9800'
    }

    render(<ChartComponent symbol="IBM" candles={mockCandles} overlays={[mockOverlay]} />)
  })

})



    