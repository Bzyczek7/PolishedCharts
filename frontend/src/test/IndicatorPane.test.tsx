import { render, screen } from '@testing-library/react'
import IndicatorPane from '../components/IndicatorPane'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('IndicatorPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders and initializes chart', () => {
    const mockData = [
      { time: 1698364800, value: 0.5 }
    ]
    render(
      <IndicatorPane 
        name="TDFI" 
        mainSeries={{
            data: mockData,
            displayType: "line",
            color: "#2196F3"
        }}
      />
    )

    expect(screen.getByTestId('indicator-pane-TDFI')).toBeDefined()
  })

  it('applies scaleRanges when provided', () => {
    const mockData = [{ time: 1698364800, value: 0.5 }]
    render(
      <IndicatorPane 
        name="TDFI" 
        mainSeries={{
            data: mockData,
            displayType: "line",
            color: "#2196F3"
        }}
        scaleRanges={{ min: -1, max: 1 }}
      />
    )
  })

  it('handles window resize', () => {
    const mockData = [{ time: 1698364800, value: 0.5 }]
    render(
      <IndicatorPane 
        name="TDFI" 
        mainSeries={{
            data: mockData,
            displayType: "line",
            color: "#2196F3"
        }}
      />
    )
    
    window.dispatchEvent(new Event('resize'))
  })
})
