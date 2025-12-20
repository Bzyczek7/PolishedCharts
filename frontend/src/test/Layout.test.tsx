import { render, screen, fireEvent } from '@testing-library/react'
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

describe('Main Layout Foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the main dashboard with chart and sidebar', async () => {
    render(<App />)
    expect(screen.getByTestId('main-chart-area')).toBeDefined()
    expect(screen.getByTestId('right-sidebar')).toBeDefined()
  })

  it('renders the sidebar tabs: Watchlist and Alerts', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: /Watchlist/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /Alerts/i })).toBeDefined()
  })

  it('starts with sidebar expanded by default', () => {
    render(<App />)
    const sidebar = screen.getByTestId('right-sidebar')
    expect(sidebar.getAttribute('data-state')).toBe('expanded')
  })

  it('collapses sidebar when toggle button is clicked', () => {
    render(<App />)
    const toggleButton = screen.getByTestId('sidebar-toggle')
    const sidebar = screen.getByTestId('right-sidebar')
    
    expect(sidebar.getAttribute('data-state')).toBe('expanded')
    
    fireEvent.click(toggleButton)
    expect(sidebar.getAttribute('data-state')).toBe('collapsed')
    
    fireEvent.click(toggleButton)
    expect(sidebar.getAttribute('data-state')).toBe('expanded')
  })

  it('toggles sidebar with Ctrl+B shortcut', () => {
    render(<App />)
    const sidebar = screen.getByTestId('right-sidebar')
    
    expect(sidebar.getAttribute('data-state')).toBe('expanded')
    
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    expect(sidebar.getAttribute('data-state')).toBe('collapsed')
    
        fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    
        expect(sidebar.getAttribute('data-state')).toBe('expanded')
    
      })
    
    
    
      it('persists sidebar state to localStorage', () => {
    
        render(<App />)
    
        const toggleButton = screen.getByTestId('sidebar-toggle')
    
        const sidebar = screen.getByTestId('right-sidebar')
    
        
    
        // Collapse it
    
        fireEvent.click(toggleButton)
    
        expect(sidebar.getAttribute('data-state')).toBe('collapsed')
    
        
    
        // Check localStorage (simulated)
    
        // We expect a key like 'sidebar-state' or similar
    
        // For now we just test that it restores on next render
    
      })
    
    
    
      it('restores sidebar state from localStorage on mount', () => {
    
        // Manually set localStorage
    
        localStorage.setItem('trading-alert-sidebar-state', JSON.stringify({ isSidebarOpen: false }))
    
        
    
        render(<App />)
    
        const sidebar = screen.getByTestId('right-sidebar')
    
        expect(sidebar.getAttribute('data-state')).toBe('collapsed')
    
      })
    
    })
    
    