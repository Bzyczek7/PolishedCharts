import { createAuthenticatedAxios } from '@/services/authService'
import { getTrimmedValidSymbol } from '../utils/validation'

export interface Candle {
  ticker: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const getCandles = async (
    symbol: string,
    interval: string = '1d',
    from?: string,
    to?: string
): Promise<Candle[]> => {
  // Validate symbol to prevent malformed URLs
  const validSymbol = getTrimmedValidSymbol(symbol);
  if (!validSymbol) {
    throw new Error('Symbol is required for candles API calls');
  }

  const params: any = { interval }
  if (from) params.from = from
  if (to) params.to = to

  const authClient = await createAuthenticatedAxios()
  const response = await authClient.get<Candle[]>(`/candles/${validSymbol}`, { params })
  return response.data
}
