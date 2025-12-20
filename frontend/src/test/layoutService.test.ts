import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveLayouts, loadLayouts } from '../services/layoutService'
import { Layout } from '../components/LayoutManager'

describe('layoutService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('saves and loads layouts from localStorage', () => {
    const mockLayouts: Layout[] = [
      { id: '1', name: 'Test Layout', activeIndicators: ['tdfi'], indicatorParams: {} }
    ]
    
    saveLayouts(mockLayouts)
    const loaded = loadLayouts()
    
    expect(loaded).toEqual(mockLayouts)
  })

  it('returns empty array if no layouts saved', () => {
    const loaded = loadLayouts()
    expect(loaded).toEqual([])
  })

  it('handles JSON parse error', () => {
    localStorage.setItem('trading_alert_layouts', 'invalid-json')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const loaded = loadLayouts()
    
    expect(loaded).toEqual([])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
