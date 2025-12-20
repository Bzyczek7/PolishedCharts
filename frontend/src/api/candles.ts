import client from './client'

export interface Candle {
  id: number
  ticker: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const getCandles = async (symbol: string): Promise<Candle[]> => {
  const response = await client.get<Candle[]>(`/candles/${symbol}`)
  return response.data
}
