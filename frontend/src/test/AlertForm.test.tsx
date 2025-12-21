import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AlertForm from '../components/AlertForm'
import { createAlert } from '../api/alerts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/alerts')

describe('AlertForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('submits correctly', async () => {
    vi.mocked(createAlert).mockResolvedValueOnce({ id: 1, symbol_id: 1, condition: 'price_above', threshold: 150, is_active: true } as any)
    render(<AlertForm symbol="IBM" />)

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

  it('submits cRSI band-cross condition correctly', async () => {
    vi.mocked(createAlert).mockResolvedValueOnce({
      id: 2,
      symbol_id: 1,
      condition: 'crsi_band_cross',
      threshold: 0,
      is_active: true,
      created_at: '2023-10-27T12:00:00'
    })

    render(<AlertForm symbol="IBM" />)

    fireEvent.change(screen.getByLabelText(/Condition/i), { target: { value: 'crsi_band_cross' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Alert/i }))

    await waitFor(() => {
      expect(createAlert).toHaveBeenCalledWith({
        symbol_id: 1,
        condition: 'crsi_band_cross',
        threshold: 0,
      })
    })
  })

  it('handles submission error', async () => {
    vi.mocked(createAlert).mockRejectedValueOnce(new Error('API Error'))
    
    render(<AlertForm symbol="IBM" />)
    
    fireEvent.change(screen.getByLabelText(/Threshold Price/i), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Alert/i }))
    
    await waitFor(() => {
        expect(screen.getByText(/Failed to create alert./i)).toBeDefined()
    })
  })
})
