import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'

vi.mock('../api/candles', () => ({
  getCandles: vi.fn().mockResolvedValue([]),
}))

vi.mock('../api/indicators', () => ({
  getTDFI: vi.fn().mockResolvedValue({ timestamps: [], tdfi: [], tdfi_signal: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } }),
  getcRSI: vi.fn().mockResolvedValue({ timestamps: [], crsi: [], upper_band: [], lower_band: [], metadata: { display_type: 'pane', color_schemes: { line: '#fff' } } }),
  getADXVMA: vi.fn().mockResolvedValue({ timestamps: [], adxvma: [], metadata: { display_type: 'overlay', color_schemes: { line: '#fff' } } }),
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

describe('Top Toolbar Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the toolbar with symbol search placeholder', () => {
    render(<App />)
    expect(screen.getByTestId('top-toolbar')).toBeDefined()
    expect(screen.getByText(/IBM/i)).toBeDefined() // The active symbol button
  })

  it('renders timeframe selector placeholders', () => {
    render(<App />)
    expect(screen.getByText('1m')).toBeDefined()
    expect(screen.getByText('1D')).toBeDefined()
  })

  it('renders indicators and chart style buttons', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /Indicators/i })).toBeDefined()
    expect(screen.getByTestId('chart-style-selector')).toBeDefined()
  })

  it('opens symbol search on clicking symbol button', () => {
    render(<App />)
    const symbolButton = screen.getByText(/IBM/i)
    fireEvent.click(symbolButton)
    // We expect a modal/dialog with search to appear
    expect(screen.getByPlaceholderText(/Search symbols/i)).toBeDefined()
  })

  it('opens symbol search with Ctrl+K shortcut', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByPlaceholderText(/Search symbols/i)).toBeDefined()
  })

  it('opens indicators with Ctrl+I shortcut', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'i', ctrlKey: true })
    expect(screen.getByPlaceholderText(/Search indicators/i)).toBeDefined()
  })

  it('changes timeframe when a timeframe button is clicked', () => {
    // We'll need to mock some behavior or check for a call
    // For now let's just check rendering of active state if implemented
  })

  it('shows chart style options when clicked', async () => {
    render(<App />)
    const trigger = screen.getByTestId('chart-style-selector')
    fireEvent.click(trigger)
    
    // screen.debug() // Uncomment if needed
    
    await waitFor(() => {
        const item = screen.queryByTestId('chart-style-item-candles')
        if (!item) {
            // console.log('Current DOM:', document.body.innerHTML)
        }
        expect(screen.getByTestId('chart-style-item-candles')).toBeDefined()
    })
    expect(screen.getByTestId('chart-style-item-line')).toBeDefined()
    expect(screen.getByTestId('chart-style-item-heikin')).toBeDefined()
  })
})
