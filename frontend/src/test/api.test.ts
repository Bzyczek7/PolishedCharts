import { describe, it, expect, vi } from 'vitest'
import client from '../api/client'
import { getCandles } from '../api/candles'

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('API Client', () => {
  it('getCandles fetches data correctly', async () => {
    const mockData = [{ ticker: 'IBM', close: 105.0 }]
    vi.mocked(client.get).mockResolvedValueOnce({ data: mockData })

    const candles = await getCandles('IBM')
    
    expect(client.get).toHaveBeenCalledWith('/candles/IBM')
    expect(candles).toEqual(mockData)
  })
})
