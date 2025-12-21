import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AlertsView from '../components/AlertsView'
import type { Alert } from '../components/AlertsList'

describe('AlertsView', () => {
  const mockAlerts: Alert[] = [
    { id: '1', symbol: 'IBM', condition: 'price_above', threshold: 150, status: 'active', createdAt: new Date().toISOString() },
  ]

  it('renders the AlertsList and AlertForm components', () => {
    render(
      <AlertsView
        alerts={mockAlerts}
        symbol="IBM"
        onToggleMute={vi.fn()}
        onDelete={vi.fn()}
        onSelect={vi.fn()}
        onAlertCreated={vi.fn()}
      />
    )

    // Check for a unique element from AlertsList
    expect(screen.getByText('Monitoring')).toBeDefined()
    expect(screen.getByText('IBM')).toBeDefined()

    // Check for a unique element from AlertForm
    expect(screen.getByText('Set Alert')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create Alert' })).toBeDefined()
  })
})
