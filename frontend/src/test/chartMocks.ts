import { vi } from 'vitest'

export const timeScaleMock = {
  fitContent: vi.fn(),
  subscribeVisibleTimeRangeChange: vi.fn(),
  unsubscribeVisibleTimeRangeChange: vi.fn(),
  setVisibleRange: vi.fn(),
  getVisibleRange: vi.fn().mockReturnValue({ from: 1000, to: 2000 }),
}

export const chartMock = {
  addSeries: vi.fn().mockReturnValue({
    setData: vi.fn(),
    createPriceLine: vi.fn(),
    applyOptions: vi.fn(),
  }),
  applyOptions: vi.fn(),
  remove: vi.fn(),
  timeScale: vi.fn().mockReturnValue(timeScaleMock),
  priceScale: vi.fn().mockReturnValue({
    applyOptions: vi.fn(),
  }),
}
