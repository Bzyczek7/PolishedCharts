import { render, screen, waitFor } from '@testing-library/react'
import IndicatorPane from '../components/IndicatorPane'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChart } from 'lightweight-charts'

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

  it('renders multiple series and price lines from metadata', async () => {
    const mainData = [{ time: 1698364800, value: 50 }]
    const bandData = [{ time: 1698364800, value: 70 }]
    
    render(
      <IndicatorPane 
        name="cRSI" 
        mainSeries={{
            data: mainData,
            displayType: "line",
            color: "#4CAF50"
        }}
        additionalSeries={[
            {
                data: bandData,
                displayType: "line",
                color: "#ef4444",
                lineWidth: 1
            }
        ]}
        priceLines={[
            { value: 70, color: "#475569", label: "70" }
        ]}
      />
    )

    await waitFor(() => {
        expect(createChart).toHaveBeenCalled()
    })

    const chartMock = vi.mocked(createChart).mock.results[0].value
    // Should have called addSeries twice (main + additional)
    expect(chartMock.addSeries).toHaveBeenCalledTimes(2)
    
    const seriesMock = chartMock.addSeries.mock.results[0].value
    expect(seriesMock.createPriceLine).toHaveBeenCalledWith(expect.objectContaining({
        price: 70
    }))
  })

  it('applies scaleRanges when provided', async () => {
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
    
    await waitFor(() => {
        expect(createChart).toHaveBeenCalled()
    })
    
    const chartMock = vi.mocked(createChart).mock.results[0].value
    expect(chartMock.priceScale).toHaveBeenCalledWith('right')
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
