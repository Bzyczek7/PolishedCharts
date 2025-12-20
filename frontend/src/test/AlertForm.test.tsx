import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AlertForm from '../components/AlertForm'
import { createAlert } from '../api/alerts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/alerts')

describe('AlertForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits correctly', async () => {
    vi.mocked(createAlert).mockResolvedValueOnce({
      id: 1,
      symbol_id: 1,
      condition: 'price_above',
      threshold: 150,
      is_active: true,
      created_at: '2023-10-27T12:00:00'
    })

    render(<AlertForm symbolId={1} />)

    fireEvent.change(screen.getByLabelText(/Threshold Price/i), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Alert/i }))

    await waitFor(() => {
      expect(createAlert).toHaveBeenCalledWith({
        symbol_id: 1,
        condition: 'price_above',
        threshold: 150,
      })
    })
    
    expect(screen.getByText(/Alert created successfully!/i)).toBeDefined()
  })
})
