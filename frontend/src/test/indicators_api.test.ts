import { describe, it, expect, vi } from 'vitest'
import client from '../api/client'
import { getTDFI, getcRSI, getADXVMA } from '../api/indicators'

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('Indicators API', () => {
  it('getTDFI fetches data correctly', async () => {
    const mockData = {
      tdfi: [0.1, 0.2],
      tdfi_signal: [0, 1],
      metadata: { display_type: 'pane', color_schemes: {} }
    }
    vi.mocked(client.get).mockResolvedValueOnce({ data: mockData })

    const result = await getTDFI('IBM')
    
    expect(client.get).toHaveBeenCalledWith('/indicators/IBM/tdfi')
    expect(result).toEqual(mockData)
  })

  it('getcRSI fetches data correctly', async () => {
    const mockData = {
      crsi: [50, 60],
      upper_band: [70, 70],
      lower_band: [30, 30],
      metadata: { display_type: 'pane', color_schemes: {} }
    }
    vi.mocked(client.get).mockResolvedValueOnce({ data: mockData })

    const result = await getcRSI('IBM')
    
    expect(client.get).toHaveBeenCalledWith('/indicators/IBM/crsi')
    expect(result).toEqual(mockData)
  })

  it('getADXVMA fetches data correctly', async () => {
    const mockData = {
      adxvma: [100, 101],
      metadata: { display_type: 'overlay', color_schemes: {} }
    }
    vi.mocked(client.get).mockResolvedValueOnce({ data: mockData })

    const result = await getADXVMA('IBM')
    
    expect(client.get).toHaveBeenCalledWith('/indicators/IBM/adxvma')
    expect(result).toEqual(mockData)
  })
})
