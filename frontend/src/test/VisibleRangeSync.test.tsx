import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'
import { createChart } from 'lightweight-charts'

// Mock lightweight-charts with everything defined inside to avoid hoisting issues
vi.mock('lightweight-charts', () => {
  const timeScaleMock = {
    fitContent: vi.fn(),
    subscribeVisibleTimeRangeChange: vi.fn(),
    unsubscribeVisibleTimeRangeChange: vi.fn(),
    setVisibleRange: vi.fn(),
    getVisibleRange: vi.fn().mockReturnValue({ from: 1000, to: 2000 }),
  }
  
  const chartMock = {
    addSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
      applyOptions: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: vi.fn().mockReturnValue(timeScaleMock),
    priceScale: vi.fn().mockReturnValue({
      applyOptions: vi.fn(),
    }),
  }

  return {
    createChart: vi.fn().mockReturnValue(chartMock),
    ColorType: { Solid: 'solid' },
    LineSeries: 'LineSeries',
    CandlestickSeries: 'CandlestickSeries',
    HistogramSeries: 'HistogramSeries',
    LineStyle: { Solid: 0, Dashed: 1 },
  }
})

// Mock ResizeObserver
let observerCallback: any = null;
class ResizeObserverMock {
  constructor(callback: any) {
    observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
(window as any).ResizeObserver = ResizeObserverMock as any;

describe('Visible Range Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    observerCallback = null;
  })

  it('synchronizes indicator panes when main chart visible range changes', async () => {
    // Mock loadLayouts to return indicators
    vi.mock('../services/layoutService', async (importOriginal) => {
        const actual: any = await importOriginal();
        return {
            ...actual,
            loadLayouts: () => [{
                id: 'test',
                name: 'Test Layout',
                activeIndicators: ['tdfi', 'crsi'],
                indicatorParams: {}
            }],
            loadWatchlist: () => ['IBM'],
            loadAlerts: () => []
        }
    })

    render(<App />)

    // Trigger ResizeObserver to set non-zero dimensions
    if (observerCallback) {
        observerCallback([{ contentRect: { width: 1000, height: 800 } }]);
    }

    // Wait for charts to be created
    await waitFor(() => {
      expect(createChart).toHaveBeenCalled()
    })

    const chartMockInstance = vi.mocked(createChart).mock.results[0].value
    const mainTimeScale = chartMockInstance.timeScale()
    
    // Check if App subscribed to visible range changes
    expect(mainTimeScale.subscribeVisibleTimeRangeChange).toHaveBeenCalled()
    
    // Simulate a visible range change on the main chart
    const onRangeChange = mainTimeScale.subscribeVisibleTimeRangeChange.mock.calls[0][0]
    const newRange = { from: 1600000000, to: 1600003600 }
    onRangeChange(newRange)
    
    // Check if the indicator panes were updated
    // Indicator charts are the ones created after the main chart
    const indicatorChartMocks = vi.mocked(createChart).mock.results.slice(1).map(r => r.value)
    expect(indicatorChartMocks.length).toBeGreaterThan(0)
    
    for (const indicatorChart of indicatorChartMocks) {
        expect(indicatorChart.timeScale().setVisibleRange).toHaveBeenCalledWith(newRange)
    }
  })
})