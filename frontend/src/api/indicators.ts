import client from './client'

export interface IndicatorMetadata {
  display_type: 'overlay' | 'pane'
  color_schemes: Record<string, string>
  scale_ranges?: {
    min: number
    max: number
  }
  series_metadata?: {
    field: string
    role: 'main' | 'signal' | 'band'
    label: string
    line_color: string
    line_style: 'solid' | 'dashed'
    line_width: number
    display_type?: 'line' | 'histogram'
  }[]
  reference_levels?: {
    value: number
    line_color: string
    line_label: string
  }[]
}

export interface TDFIOutput {
  timestamps: string[]
  tdfi: (number | null)[]
  tdfi_signal: (number | null)[]
  metadata: IndicatorMetadata
}

export interface cRSIOutput {
  timestamps: string[]
  crsi: (number | null)[]
  upper_band: (number | null)[]
  lower_band: (number | null)[]
  metadata: IndicatorMetadata
}

export interface ADXVMAOutput {
  timestamps: string[]
  adxvma: (number | null)[]
  metadata: IndicatorMetadata
}

export const getTDFI = async (symbol: string): Promise<TDFIOutput> => {
  const response = await client.get<TDFIOutput>(`/indicators/${symbol}/tdfi`)
  return response.data
}

export const getcRSI = async (symbol: string): Promise<cRSIOutput> => {
  const response = await client.get<cRSIOutput>(`/indicators/${symbol}/crsi`)
  return response.data
}

export const getADXVMA = async (symbol: string): Promise<ADXVMAOutput> => {
  const response = await client.get<ADXVMAOutput>(`/indicators/${symbol}/adxvma`)
  return response.data
}
