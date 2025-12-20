import client from './client'

export interface Alert {
  id: number
  symbol_id: number
  condition: string
  threshold: number
  is_active: boolean
  created_at: string
}

export interface AlertCreate {
  symbol_id: number
  condition: string
  threshold: number
  is_active?: boolean
}

export const createAlert = async (alert: AlertCreate): Promise<Alert> => {
  const response = await client.post<Alert>('/alerts/', alert)
  return response.data
}

export const getAlerts = async (): Promise<Alert[]> => {
  const response = await client.get<Alert[]>('/alerts/')
  return response.data
}
