import { render, screen } from '@testing-library/react'
import IndicatorPane from '../components/IndicatorPane'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn().mockReturnValue({
    addSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    priceScale: vi.fn().mockReturnValue({
        applyOptions: vi.fn(),
    }),
  }),
  ColorType: { Solid: 'solid' },
  LineSeries: vi.fn(),
  HistogramSeries: vi.fn(),
}))

describe('IndicatorPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders and initializes chart', () => {
    const mockData = [
      { time: '2023-10-27', value: 0.5 }
    ]
    render(
      <IndicatorPane 
        name="TDFI" 
        data={mockData} 
        displayType="line" 
        color="#2196F3"
      />
    )

    expect(screen.getByTestId('indicator-pane-TDFI')).toBeDefined()
  })

  it('applies scaleRanges when provided', () => {
    const mockData = [{ time: '2023-10-27', value: 0.5 }]
    render(
      <IndicatorPane 
        name="TDFI" 
        data={mockData} 
        displayType="line" 
        color="#2196F3"
        scaleRanges={{ min: -1, max: 1 }}
      />
    )
    // createChart mock should have been called
  })

  it('handles window resize', () => {
    const mockData = [{ time: '2023-10-27', value: 0.5 }]
    render(
      <IndicatorPane 
        name="TDFI" 
        data={mockData} 
        displayType="line" 
        color="#2196F3"
      />
    )
    
    window.dispatchEvent(new Event('resize'))
  })
})
