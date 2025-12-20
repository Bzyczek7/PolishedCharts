import { render, screen, fireEvent } from '@testing-library/react'
import LayoutManager from '../components/LayoutManager'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('LayoutManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    render(<LayoutManager activeLayout={null} onLayoutSelect={vi.fn()} onLayoutSave={vi.fn()} />)
    expect(screen.getByText('Layouts')).toBeDefined()
  })

  it('saves a new layout', () => {
    const onSave = vi.fn()
    render(<LayoutManager activeLayout={null} onLayoutSelect={vi.fn()} onLayoutSave={onSave} />)
    
    const input = screen.getByPlaceholderText('Layout name')
    fireEvent.change(input, { target: { value: 'My Layout' } })
    
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)
    
    expect(onSave).toHaveBeenCalledWith('My Layout')
  })

  it('selects an existing layout', () => {
    const onSelect = vi.fn()
    const mockLayouts = [
        { id: '1', name: 'Layout 1', activeIndicators: [], indicatorParams: {} }
    ]
    render(
        <LayoutManager 
            activeLayout={null} 
            onLayoutSelect={onSelect} 
            onLayoutSave={vi.fn()} 
            savedLayouts={mockLayouts}
        />
    )
    
    const layoutButton = screen.getByText('Layout 1')
    fireEvent.click(layoutButton)
    
    expect(onSelect).toHaveBeenCalledWith(mockLayouts[0])
  })
})
