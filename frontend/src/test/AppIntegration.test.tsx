import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCandles } from '../api/candles'
import { getTDFI, getcRSI, getADXVMA } from '../api/indicators'

vi.mock('../api/candles')
vi.mock('../api/indicators', () => ({
    getTDFI: vi.fn(),
    getcRSI: vi.fn(),
    getADXVMA: vi.fn(),
}))

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
    addHistogramSeries: vi.fn().mockReturnValue({
        setData: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    priceScale: vi.fn().mockReturnValue({
        applyOptions: vi.fn(),
    }),
  }),
  ColorType: { Solid: 'solid' },
  CandlestickSeries: vi.fn(),
  LineSeries: vi.fn(),
  HistogramSeries: vi.fn(),
}))

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders layout manager', async () => {
    const user = userEvent.setup()
    vi.mocked(getCandles).mockResolvedValueOnce([])
    vi.mocked(getTDFI).mockResolvedValueOnce({ timestamps: [], tdfi: [], tdfi_signal: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getcRSI).mockResolvedValueOnce({ timestamps: [], crsi: [], upper_band: [], lower_band: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getADXVMA).mockResolvedValueOnce({ timestamps: [], adxvma: [], metadata: { display_type: 'overlay', color_schemes: { line: '#fff' } } })
    
    render(<App />)
    
    // Switch to Alerts tab where LayoutManager is located
    const alertsTab = screen.getByRole('tab', { name: /Alerts/i })
    await user.click(alertsTab)
    
    await waitFor(() => {
        expect(screen.getByText('Layouts')).toBeDefined()
    })
  })

  it('toggles an indicator', async () => {
    const user = userEvent.setup()
    vi.mocked(getCandles).mockResolvedValue([{ id: 1, ticker: 'IBM', timestamp: '2023-10-27T00:00:00', open: 100, high: 110, low: 90, close: 105, volume: 1000 }])
    vi.mocked(getTDFI).mockResolvedValue({ timestamps: ['2023-10-27T00:00:00'], tdfi: [0.1], tdfi_signal: [0], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getcRSI).mockResolvedValue({ timestamps: [], crsi: [], upper_band: [], lower_band: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getADXVMA).mockResolvedValue({ timestamps: [], adxvma: [], metadata: { display_type: 'overlay', color_schemes: { line: '#fff' } } })

    render(<App />)
    
    // Switch to Alerts tab
    const alertsTab = screen.getByRole('tab', { name: /Alerts/i })
    await user.click(alertsTab)
    
    // Wait for content
    await waitFor(() => {
        expect(screen.getByPlaceholderText('Layout name')).toBeDefined()
    })

    // Create a layout first
    const input = screen.getByPlaceholderText('Layout name')
    const saveButton = screen.getByText('Save')
    await user.type(input, 'Test')
    await user.click(saveButton)

    const indicatorsButton = screen.getByRole('button', { name: /Indicators/i })
    await user.click(indicatorsButton)
    
    const tdfiOption = await screen.findByText('TDFI')
    await user.click(tdfiOption)
    
    await waitFor(() => {
        expect(screen.getByTestId('indicator-pane-TDFI')).toBeDefined()
    })
  })
})
