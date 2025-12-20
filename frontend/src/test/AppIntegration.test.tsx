import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
    vi.mocked(getCandles).mockResolvedValueOnce([])
    vi.mocked(getTDFI).mockResolvedValueOnce({ tdfi: [], tdfi_signal: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getcRSI).mockResolvedValueOnce({ crsi: [], upper_band: [], lower_band: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getADXVMA).mockResolvedValueOnce({ adxvma: [], metadata: { display_type: 'overlay', color_schemes: { line: '#fff' } } })
    
    render(<App />)
    expect(screen.getByText('Layouts')).toBeDefined()
  })

  it('toggles an indicator', async () => {
    vi.mocked(getCandles).mockResolvedValue([])
    vi.mocked(getTDFI).mockResolvedValue({ tdfi: [0.1], tdfi_signal: [0], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getcRSI).mockResolvedValue({ crsi: [], upper_band: [], lower_band: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } })
    vi.mocked(getADXVMA).mockResolvedValue({ adxvma: [], metadata: { display_type: 'overlay', color_schemes: { line: '#fff' } } })

    render(<App />)
    
    // Create a layout first
    const input = screen.getByPlaceholderText('Layout name')
    const saveButton = screen.getByText('Save')
    fireEvent.change(input, { target: { value: 'Test' } })
    fireEvent.click(saveButton)

    const tdfiButton = screen.getByText('TDFI')
    fireEvent.click(tdfiButton)
    
    await waitFor(() => {
        expect(screen.getByTestId('indicator-pane-TDFI')).toBeDefined()
    })
  })
})
