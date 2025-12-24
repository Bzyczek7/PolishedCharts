import axios from 'axios';

interface WatchlistItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
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
    // Return empty array or mock data in case of error
    return symbols.map(symbol => ({
      symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      error: 'Failed to fetch data'
    }));
  }
};