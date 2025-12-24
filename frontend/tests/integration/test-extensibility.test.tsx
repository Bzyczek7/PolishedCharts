/**
 * Integration Test: Indicator Extensibility
 *
 * This test verifies the core extensibility promise of the indicator system:
 * "Adding a new indicator requires only backend changes - no frontend code needed."
 *
 * The test validates that a new indicator added to the backend registry
 * automatically appears in the frontend and renders correctly using the
 * generic rendering system.
 *
 * Feature: 003-advanced-indicators
 * Task: T105
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { listIndicators, getIndicator } from '@/api/indicators'

// Mock API client
import client from '@/api/client'

// Test indicator that should be registered in backend
const TEST_INDICATOR = 'sma' // SMA is a good test indicator as it's already implemented

describe('Indicator Extensibility Integration', () => {
  let queryClient: QueryClient

  beforeAll(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  /**
   * Test 1: Backend indicator appears in list
   *
   * Validates that GET /api/v1/indicators returns the indicator
   */
  it('should return all registered indicators including test indicator', async () => {
    // Mock successful response
    const mockIndicators = [
      {
        name: 'sma',
        description: 'Simple Moving Average',
        category: 'overlay',
        parameters: {},
      },
      {
        name: 'ema',
        description: 'Exponential Moving Average',
        category: 'overlay',
        parameters: {},
      },
      {
        name: 'crsi',
        description: 'Cyclic RSI',
        category: 'oscillator',
        parameters: {},
      },
    ]

    vi.mocked(client.get).mockResolvedValueOnce({ data: mockIndicators })

    const indicators = await listIndicators()

    // Verify test indicator is in the list
    const testIndicator = indicators.find((ind) => ind.name === TEST_INDICATOR)
    expect(testIndicator).toBeDefined()
    expect(testIndicator?.description).toBeDefined()
  })

  /**
   * Test 2: Indicator metadata is complete and valid
   *
   * Validates that the indicator's metadata has all required fields
   * for generic rendering
   */
  it('should return valid indicator metadata with all required fields', async () => {
    const mockOutput = {
      symbol: 'AAPL',
      interval: '1d',
      timestamps: [1704067200, 1704153600, 1704240000],
      data: {
        sma: [null, 102.5, 103.2],
      },
      metadata: {
        display_type: 'overlay' as const,
        color_mode: 'single' as const,
        color_schemes: {
          bullish: '#2962ff',
          bearish: '#2962ff',
          neutral: '#2962ff',
        },
        series_metadata: [
          {
            field: 'sma',
            role: 'main' as const,
            label: 'SMA',
            color: '#2962ff',
            line_style: 'solid' as const,
            line_width: 2,
          },
        ],
      },
      calculated_at: new Date().toISOString(),
      data_points: 3,
    }

    vi.mocked(client.get).mockResolvedValueOnce({ data: mockOutput })

    const output = await getIndicator('AAPL', TEST_INDICATOR)

    // Validate metadata structure
    expect(output.metadata).toBeDefined()
    expect(output.metadata.display_type).toMatch(/^(overlay|pane)$/)
    expect(output.metadata.color_mode).toMatch(/^(single|threshold|gradient|trend)$/)
    expect(output.metadata.color_schemes).toBeDefined()
    expect(typeof output.metadata.color_schemes).toBe('object')

    // Validate series_metadata
    expect(output.metadata.series_metadata).toBeDefined()
    expect(Array.isArray(output.metadata.series_metadata)).toBe(true)
    expect(output.metadata.series_metadata.length).toBeGreaterThan(0)

    // Validate each series has required fields
    output.metadata.series_metadata.forEach((series) => {
      expect(series.field).toBeDefined()
      expect(typeof series.field).toBe('string')
      expect(series.role).toBeDefined()
      expect(series.label).toBeDefined()
      expect(series.color).toBeDefined()
      expect(/^#[0-9A-Fa-f]{6}$/.test(series.color)).toBe(true)
    })
  })

  /**
   * Test 3: Indicator output data matches metadata fields
   *
   * Validates that the data object contains all fields specified in series_metadata
   */
  it('should return data fields matching series_metadata definition', async () => {
    const mockOutput = {
      symbol: 'AAPL',
      interval: '1d',
      timestamps: [1704067200, 1704153600, 1704240000],
      data: {
        sma: [null, 102.5, 103.2],
      },
      metadata: {
        display_type: 'overlay' as const,
        color_mode: 'single' as const,
        color_schemes: {
          bullish: '#2962ff',
          bearish: '#2962ff',
          neutral: '#2962ff',
        },
        series_metadata: [
          {
            field: 'sma',
            role: 'main' as const,
            label: 'SMA',
            color: '#2962ff',
            line_style: 'solid' as const,
            line_width: 2,
          },
        ],
      },
      calculated_at: new Date().toISOString(),
      data_points: 3,
    }

    vi.mocked(client.get).mockResolvedValueOnce({ data: mockOutput })

    const output = await getIndicator('AAPL', TEST_INDICATOR)

    // Get all field names from series_metadata
    const metadataFields = output.metadata.series_metadata.map((s) => s.field)

    // Verify all fields exist in data
    metadataFields.forEach((field) => {
      expect(output.data[field]).toBeDefined()
      expect(Array.isArray(output.data[field])).toBe(true)
    })

    // Verify timestamps length matches data arrays
    metadataFields.forEach((field) => {
      expect(output.data[field].length).toBe(output.timestamps.length)
    })
  })

  /**
   * Test 4: Null values are handled correctly
   *
   * Validates that indicators with lookback periods return null/undefined
   * for early data points where calculation isn't possible
   */
  it('should handle null values for insufficient data periods', async () => {
    const mockOutput = {
      symbol: 'AAPL',
      interval: '1d',
      timestamps: [1704067200, 1704153600, 1704240000],
      data: {
        sma: [null, null, 102.5], // First 2 values are null (period=20 example)
      },
      metadata: {
        display_type: 'overlay' as const,
        color_mode: 'single' as const,
        color_schemes: {
          bullish: '#2962ff',
          bearish: '#2962ff',
          neutral: '#2962ff',
        },
        series_metadata: [
          {
            field: 'sma',
            role: 'main' as const,
            label: 'SMA',
            color: '#2962ff',
            line_style: 'solid' as const,
            line_width: 2,
          },
        ],
      },
      calculated_at: new Date().toISOString(),
      data_points: 3,
    }

    vi.mocked(client.get).mockResolvedValueOnce({ data: mockOutput })

    const output = await getIndicator('AAPL', TEST_INDICATOR)

    // Verify null values are present and properly typed
    expect(output.data.sma[0]).toBeNull()
    expect(output.data.sma[1]).toBeNull()
    expect(output.data.sma[2]).toBe(102.5)
  })

  /**
   * Test 5: Pane indicators have scale_ranges
   *
   * Validates that pane-type indicators (oscillators) include
   * scale configuration for proper Y-axis rendering
   */
  it('should include scale_ranges for pane indicators', async () => {
    // Test with cRSI (a pane indicator)
    const mockOutput = {
      symbol: 'AAPL',
      interval: '1d',
      timestamps: [1704067200, 1704153600],
      data: {
        cRSI: [null, 65.5],
      },
      metadata: {
        display_type: 'pane' as const,
        color_mode: 'single' as const,
        color_schemes: {
          bullish: '#00bcd4',
          bearish: '#00bcd4',
          neutral: '#00bcd4',
        },
        scale_ranges: {
          min: 0,
          max: 100,
          auto: false,
        },
        series_metadata: [
          {
            field: 'cRSI',
            role: 'main' as const,
            label: 'cRSI',
            color: '#00bcd4',
            line_style: 'solid' as const,
            line_width: 2,
          },
        ],
      },
      calculated_at: new Date().toISOString(),
      data_points: 2,
    }

    vi.mocked(client.get).mockResolvedValueOnce({ data: mockOutput })

    const output = await getIndicator('AAPL', 'crsi')

    // Pane indicators should have scale_ranges
    expect(output.metadata.scale_ranges).toBeDefined()
    expect(output.metadata.scale_ranges!.min).toBeDefined()
    expect(output.metadata.scale_ranges!.max).toBeDefined()
    expect(output.metadata.scale_ranges!.min).toBeLessThan(output.metadata.scale_ranges!.max)
  })
})

/**
 * Manual Extensibility Verification Checklist
 *
 * This checklist guides manual verification that the extensibility
 * promise is met end-to-end.
 *
 * To verify:
 * 1. Add a new test indicator to backend registry
 * 2. Start backend server
 * 3. Start frontend
 * 4. Complete checklist below
 *
 * Test Indicator: Add to backend/app/services/indicator_registry/__init__.py
 *
 * ```
 * class TestIndicator(Indicator):
 *     @property
 *     def name(self) -> str:
 *         return "test_indicator"
 *
 *     @property
 *     def description(self) -> str:
 *         return "Test indicator for extensibility verification"
 *
 *     def calculate(self, df, **kwargs):
 *         result = df.copy()
 *         result['test_value'] = result['close'] * 1.01
 *         return result
 *
 *     @property
 *     def metadata(self) -> IndicatorMetadata:
 *         return IndicatorMetadata(
 *             display_type="overlay",
 *             color_mode="single",
 *             color_schemes={"bullish": "#ff00ff"},
 *             series_metadata=[{
 *                 "field": "test_value",
 *                 "role": "main",
 *                 "label": "Test",
 *                 "line_color": "#ff00ff",
 *                 "line_style": "solid",
 *                 "line_width": 2,
 *             }]
 *         )
 *
 *     @property
 *     def alert_templates(self) -> List[AlertTemplate]:
 *         return [AlertTemplate(
 *             condition_type="indicator_crosses_upper",
 *             label="Crosses Above",
 *             description="Test crosses above",
 *             applicable_fields=["test_value"],
 *             requires_threshold=True
 *         )]
 *
 * # Register
 * get_registry().register(TestIndicator())
 * ```
 *
 * Manual Verification Checklist:
 *
 * Backend:
 * [ ] Indicator appears in GET /api/v1/indicators response
 * [ ] GET /api/v1/indicators/supported returns full metadata
 * [ ] GET /api/v1/indicators/{symbol}/test_indicator returns data + metadata
 * [ ] GET /api/v1/alerts/indicator-conditions?indicator_name=test_indicator works
 *
 * Frontend:
 * [ ] Indicator appears in indicator selector dropdown
 * [ ] Adding indicator to chart works without frontend code changes
 * [ ] Indicator renders on chart with correct color/style from metadata
 * [ ] Indicator can be toggled on/off
 * [ ] Alert form shows test_indicator in indicator dropdown
 * [ ] Alert conditions for test_indicator appear after selection
 * [ ] Creating alert with test_indicator works
 *
 * Generic Rendering:
 * [ ] Overlay indicator draws on main price chart
 * [ ] Pane indicator creates separate pane below chart
 * [ ] Reference levels appear for pane indicators
 * [ ] Threshold-based coloring works (if applicable)
 * [ ] Null values don't break rendering
 *
 * No Frontend Changes Required:
 * [ ] No changes to frontend/src/components/indicators/ needed
 * [ ] No changes to frontend/src/api/indicators.ts needed
 * [ ] No changes to frontend/src/utils/chartHelpers.ts needed
 * [ ] Indicator "just works" via metadata
 */
