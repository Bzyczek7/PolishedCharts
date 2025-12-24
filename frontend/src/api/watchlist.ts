import axios from 'axios';

export interface WatchlistItem {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  timestamp?: string;
  error?: string;
}

export const getLatestPrices = async (symbols: string[]): Promise<WatchlistItem[]> => {
  try {
    const symbolsParam = symbols.join(',');
    const response = await axios.get(`/api/v1/candles/latest_prices/${symbolsParam}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching latest prices:', error);
    // Return error entries for each symbol
    return symbols.map(symbol => ({
      symbol,
      error: 'Failed to fetch data'
    }));
  }
};