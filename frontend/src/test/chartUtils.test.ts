import { describe, it, expect } from 'vitest'
import { formatDataForChart } from '../lib/chartUtils'

describe('chartUtils', () => {
  it('omits null or undefined values from chart data', () => {
    const timestamps = ['2023-10-27T00:00:00Z', '2023-10-27T00:01:00Z', '2023-10-27T00:02:00Z']
    const values = [10.5, null, 11.2]
    
    const result = formatDataForChart(timestamps, values)
    
    // Expecting 2 data points, NOT 3 with a zero
    expect(result).toHaveLength(2)
    expect(result.some(p => p.value === 0)).toBe(false)
  })
})
