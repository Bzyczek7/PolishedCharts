import client from './client'

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
  const params: any = { interval }
  if (from) params.from = from
  if (to) params.to = to
  
  const response = await client.get<Candle[]>(`/candles/${symbol}`, { params })
  return response.data
}
