import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Watchlist from '../components/Watchlist'
import { TooltipProvider } from '../components/ui/tooltip'

// Mock lightweight-charts as it's not needed for this component test
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(),
  ColorType: { Solid: 'solid' },
  LineSeries: 'LineSeries',
  CandlestickSeries: 'CandlestickSeries',
  HistogramSeries: 'HistogramSeries',
  LineStyle: { Solid: 0, Dashed: 1 },
}))

describe('Watchlist Tooltips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows detailed info in tooltip when hovering over a symbol', async () => {
    const items = [
      { symbol: 'IBM', price: 145.20, change: 1.50, changePercent: 1.04 }
    ]
    render(
      <TooltipProvider>
        <Watchlist 
            items={items} 
            onAddClick={vi.fn()} 
            onRemove={vi.fn()} 
            onSelect={vi.fn()} 
            onReorder={vi.fn()} 
        />
      </TooltipProvider>
    )
    
    const symbolCell = screen.getByText('IBM')
    fireEvent.mouseEnter(symbolCell)
    
    // Use a longer timeout and search for the NYSE text which is distinct
    await waitFor(() => {
        expect(screen.getByText(/NYSE/i)).toBeDefined()
    }, { timeout: 2000 })
  })
})
