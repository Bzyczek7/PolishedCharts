import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AlertsList from '../components/AlertsList'
import type { Alert } from '../components/AlertsList'

describe('Alerts List Rendering and Filtering', () => {
  const mockAlerts: Alert[] = [
    { id: '1', symbol: 'IBM', condition: 'price_above', threshold: 150, status: 'active', createdAt: new Date().toISOString() },
    { id: '2', symbol: 'AAPL', condition: 'price_below', threshold: 170, status: 'triggered', createdAt: new Date().toISOString() }
  ]

  it('renders the alerts list container and items', () => {
    render(<AlertsList alerts={mockAlerts} onToggleMute={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByTestId('alerts-list-container')).toBeDefined()
    expect(screen.getByText('IBM')).toBeDefined()
    expect(screen.getByText('AAPL')).toBeDefined()
  })

  it('filters alerts by status', async () => {
    render(<AlertsList alerts={mockAlerts} onToggleMute={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />)
    
    // Initially both shown
    expect(screen.getByText('IBM')).toBeDefined()
    expect(screen.getByText('AAPL')).toBeDefined()

    // Filter by Triggered
    const triggeredFilter = screen.getByRole('button', { name: /triggered/i })
    fireEvent.click(triggeredFilter)

    expect(screen.queryByText('IBM')).toBeNull()
    expect(screen.getByText('AAPL')).toBeDefined()
  })

  it('shows empty state message when no alerts match', () => {
    render(<AlertsList alerts={[]} onToggleMute={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByText(/No alerts found/i)).toBeDefined()
  })

  it('calls onSelect when view on chart is clicked', async () => {
    const onSelect = vi.fn()
    render(<AlertsList alerts={mockAlerts} onToggleMute={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />)
    
    // ExternalLink icon button
    const viewButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-external-link'))
    fireEvent.click(viewButtons[0])
    
    expect(onSelect).toHaveBeenCalledWith('IBM')
  })

  it('calls onToggleMute when mute button is clicked', async () => {
    const onToggleMute = vi.fn()
    render(<AlertsList alerts={mockAlerts} onToggleMute={onToggleMute} onDelete={vi.fn()} onSelect={vi.fn()} />)
    
    // Bell/BellOff icon button
    const muteButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-bell') || b.querySelector('svg.lucide-bell-off'))
    fireEvent.click(muteButtons[0])
    
    expect(onToggleMute).toHaveBeenCalledWith('1')
  })

  it('toggles mute when M key is pressed', async () => {
    const onToggleMute = vi.fn()
    render(<AlertsList alerts={mockAlerts} onToggleMute={onToggleMute} onDelete={vi.fn()} onSelect={vi.fn()} />)
    
    const alertItem = screen.getByText('IBM').closest('div[tabindex="0"]')!
    fireEvent.keyDown(alertItem, { key: 'm' })
    
    expect(onToggleMute).toHaveBeenCalledWith('1')
  })

  it('calls onDelete when Delete key is pressed', async () => {
    const onDelete = vi.fn()
    render(<AlertsList alerts={mockAlerts} onToggleMute={vi.fn()} onDelete={onDelete} onSelect={vi.fn()} />)
    
    const alertItem = screen.getByText('IBM').closest('div[tabindex="0"]')!
    fireEvent.keyDown(alertItem, { key: 'Delete' })
    
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('calls onSelect when Enter key is pressed', async () => {
    const onSelect = vi.fn()
    render(<AlertsList alerts={mockAlerts} onToggleMute={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />)
    
    const alertItem = screen.getByText('IBM').closest('div[tabindex="0"]')!
    fireEvent.keyDown(alertItem, { key: 'Enter' })
    
    expect(onSelect).toHaveBeenCalledWith('IBM')
  })

  it('filters alerts by search text', async () => {
    render(<AlertsList alerts={mockAlerts} onToggleMute={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />)
    
    const searchInput = screen.getByPlaceholderText(/Filter alerts.../i)
    fireEvent.change(searchInput, { target: { value: 'AAPL' } })
    
    expect(screen.queryByText('IBM')).toBeNull()
    expect(screen.getByText('AAPL')).toBeDefined()
  })

  it('expands an alert row when clicked and shows history/statistics', async () => {
    const mockAlertsWithHistory: any[] = [
      { 
        id: '1', 
        symbol: 'IBM', 
        condition: 'price_above', 
        threshold: 150, 
        status: 'active', 
        createdAt: new Date().toISOString(),
        history: [
            { timestamp: new Date().toISOString(), price: 151 }
        ],
        statistics: {
            triggerCount24h: 5,
            lastTriggered: new Date().toISOString()
        }
      }
    ]
    
    render(<AlertsList alerts={mockAlertsWithHistory} onToggleMute={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />)
    
    const alertItem = screen.getByText('IBM').closest('div[tabindex="0"]')!
    
    // Initially history should not be visible
    expect(screen.queryByText(/Trigger History/i)).toBeNull()
    
    // Click to expand
    fireEvent.click(alertItem)
    
    // Now history and statistics should be visible
    expect(screen.getByText(/Trigger History/i)).toBeDefined()
    expect(screen.getByText(/Trigger count \(24h\)/i)).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })
})
