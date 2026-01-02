/**
 * Fixture Loader for Indicator Parity Validation
 *
 * Loads golden fixture data in test mode without making live API calls.
 * Fixtures are served from /fixtures/{fixtureId}.json at runtime.
 */

import type {
  FixtureData,
  CandleData,
  IndicatorData,
  CRSIData,
  TDFIData,
  PriceIndicatorData,
  TimestampRange
} from './fixtureLoader.types';

// Re-export FixtureData for use in other modules
export type { FixtureData };

/**
 * Check if fixture mode is enabled via VITE_FIXTURE_MODE environment variable.
 * @returns true if running in fixture mode
 */
export function isFixtureMode(): boolean {
  return import.meta.env.VITE_FIXTURE_MODE !== undefined && import.meta.env.VITE_FIXTURE_MODE !== '';
}

/**
 * Get the current fixture ID from environment variable.
 * @returns fixture ID or undefined if not in fixture mode
 */
export function getFixtureId(): string | undefined {
  return import.meta.env.VITE_FIXTURE_MODE;
}

/**
 * Load fixture data by ID.
 * Fetches from runtime URL /fixtures/{fixtureId}.json (dev) or /base/fixtures/{fixtureId}.json (production).
 *
 * @param fixtureId - The fixture identifier (e.g., "fixture-aapl-1d-100")
 * @returns Promise<FixtureData> - The parsed fixture data
 * @throws Error if fixture not found or invalid
 */
export async function loadFixture(fixtureId: string): Promise<FixtureData> {
  const isDev = import.meta.env.DEV;
  const baseUrl = isDev ? '/fixtures' : '/base/fixtures';
  const url = `${baseUrl}/${fixtureId}.json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Fixture mode error: Could not load fixture '${fixtureId}'\n` +
      `Expected file: ${url}\n` +
      `Status: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  validateFixtureSchema(data);
  return data;
}

/**
 * List all available fixture IDs from the manifest.
 * @returns Promise<string[]> - Array of fixture IDs
 */
export async function listFixtures(): Promise<string[]> {
  const isDev = import.meta.env.DEV;
  const baseUrl = isDev ? '/fixtures' : '/base/fixtures';
  const url = `${baseUrl}/manifest.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Fallback: return known fixtures if manifest not found
      return [
        'fixture-aapl-1d-100',
        'fixture-tsla-1h-200',
        'fixture-spy-5m-150'
      ];
    }

    const manifest = await response.json();
    return manifest.fixtures?.map((f: any) => f.fixture_id) || [];
  } catch {
    // Fallback: return known fixtures
    return [
      'fixture-aapl-1d-100',
      'fixture-tsla-1h-200',
      'fixture-spy-5m-150'
    ];
  }
}

/**
 * Validate fixture schema at runtime.
 * @param data - The data to validate
 * @throws Error if schema is invalid
 */
function validateFixtureSchema(data: unknown): asserts data is FixtureData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid fixture: not an object');
  }

  const fixture = data as Record<string, unknown>;

  // Required top-level fields
  if (!fixture.fixture_id || typeof fixture.fixture_id !== 'string') {
    throw new Error('Invalid fixture: missing or invalid fixture_id');
  }
  if (!fixture.symbol || typeof fixture.symbol !== 'string') {
    throw new Error('Invalid fixture: missing or invalid symbol');
  }
  if (!fixture.interval || typeof fixture.interval !== 'string') {
    throw new Error('Invalid fixture: missing or invalid interval');
  }

  // Timestamp range
  if (!fixture.timestamp_range || typeof fixture.timestamp_range !== 'object') {
    throw new Error('Invalid fixture: missing or invalid timestamp_range');
  }

  // Candles array
  if (!Array.isArray(fixture.candles)) {
    throw new Error('Invalid fixture: missing or invalid candles array');
  }

  // Validate first candle structure
  if (fixture.candles.length > 0) {
    const firstCandle = fixture.candles[0] as Record<string, unknown>;
    if (!firstCandle.time || !firstCandle.open || !firstCandle.high ||
        !firstCandle.low || !firstCandle.close || firstCandle.volume === undefined) {
      throw new Error('Invalid fixture: candle missing required fields (time, open, high, low, close, volume)');
    }
  }

  // Indicators object
  if (!fixture.indicators || typeof fixture.indicators !== 'object') {
    throw new Error('Invalid fixture: missing or invalid indicators object');
  }
}

/**
 * Create mock fixture data for testing when fixtures are not yet available.
 * Useful for development and testing before fixtures are generated.
 *
 * @param symbol - Stock symbol
 * @param count - Number of candles to generate
 * @returns FixtureData - Mock fixture data
 */
export function createMockFixture(symbol: string = 'AAPL', count: number = 100): FixtureData {
  const candles: CandleData[] = [];
  const basePrice = 150.0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const time = new Date(now - (count - i) * dayMs);
    const variation = (Math.random() - 0.5) * 10;
    const open = basePrice + variation;
    const close = basePrice + variation + (Math.random() - 0.5) * 5;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;

    candles.push({
      time: time.toISOString().replace('.000', ''),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(1000000 + Math.random() * 500000)
    });
  }

  // Generate mock indicator values
  const crsiValues: (number | null)[] = [];
  const tdfiValues: (number | null)[] = [];
  const adxvmaValues: (number | null)[] = [];
  const emaValues: (number | null)[] = [];
  const smaValues: (number | null)[] = [];

  for (let i = 0; i < count; i++) {
    // Null values for early periods where indicators can't be computed
    crsiValues.push(i < 14 ? null : 30 + Math.random() * 40);
    tdfiValues.push(i < 13 ? null : (Math.random() - 0.5) * 0.8);
    adxvmaValues.push(i < 15 ? null : candles[i].close + (Math.random() - 0.5) * 5);
    emaValues.push(i < 20 ? null : candles[i].close + (Math.random() - 0.5) * 3);
    smaValues.push(i < 50 ? null : candles[i].close + (Math.random() - 0.5) * 4);
  }

  return {
    fixture_id: `mock-${symbol.toLowerCase()}-1d-${count}`,
    symbol: symbol.toUpperCase(),
    interval: '1d',
    timestamp_range: {
      start: candles[0].time,
      end: candles[candles.length - 1].time
    },
    candles,
    indicators: {
      crsi: {
        values: crsiValues,
        upper_band: 70,
        lower_band: 30,
        params: { period: 14, source: 'close' }
      },
      tdfi: {
        values: tdfiValues,
        thresholds: { upper: 0.05, lower: -0.05 },
        params: { rsi_period: 13, band_period: 13 }
      },
      adxvma: {
        values: adxvmaValues,
        params: { period: 15, threshold: 0 }
      },
      ema: {
        values: emaValues,
        params: { period: 20, source: 'close' }
      },
      sma: {
        values: smaValues,
        params: { period: 20, source: 'close' }
      }
    }
  };
}
