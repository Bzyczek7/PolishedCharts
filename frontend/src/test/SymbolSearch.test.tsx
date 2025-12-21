import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SymbolSearch from '../components/SymbolSearch'

describe('SymbolSearch Component', () => {
  it('filters results based on input', async () => {
    const onSelect = vi.fn()
    render(<SymbolSearch open={true} onOpenChange={vi.fn()} onSelect={onSelect} />)
    
    const input = screen.getByPlaceholderText(/Search symbols/i)
    fireEvent.change(input, { target: { value: 'AAPL' } })
    
    // AAPL should be visible
    expect(screen.getByText('AAPL')).toBeDefined()
    
    // MSFT should NOT be visible (fuzzy filter should hide it)
    expect(screen.queryByText('MSFT')).toBeNull()
  })

  it('calls onSelect when an item is clicked', async () => {
    const onSelect = vi.fn()
    render(<SymbolSearch open={true} onOpenChange={vi.fn()} onSelect={onSelect} />)
    
    const item = screen.getByText('AAPL')
    fireEvent.click(item)
    
    expect(onSelect).toHaveBeenCalledWith('AAPL')
  })
})
