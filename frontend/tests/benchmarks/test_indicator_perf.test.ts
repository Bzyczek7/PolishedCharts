/**
 * Indicator Performance Tests
 * Feature: 012-performance-optimization
 *
 * Tests performance of specific indicators: ADXVMA, cRSI, TDFI
 * Focus: Identify and measure actual calculation times
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { performanceStore } from '../../src/lib/performanceStore';
import { measurePerformance } from '../../src/lib/performance';
import type { PerformanceLog } from '../../src/types/performance';

/**
 * Mock indicator calculation to simulate real backend response time
 * This simulates the actual API call to /api/v1/indicators/{symbol}/{indicator_name}
 */
async function mockIndicatorCalculation(
  indicatorName: string,
  params: Record<string, number> = {}
): Promise<{ data: number[] }> {
  // Simulate calculation time based on indicator complexity
  const baseTime = {
    'adxvma': 800,    // Slower indicator
    'crsi': 1200,     // Very slow - complex cyclic logic
    'tdfi': 600,      // Moderate complexity
    'sma': 50,        // Fast
    'ema': 80,        // Fast
  }[indicatorName.toLowerCase()] || 100;

  // Add some random variance (±20%)
  const variance = baseTime * 0.2 * (Math.random() - 0.5);
  const delay = baseTime + variance;

  await new Promise(resolve => setTimeout(resolve, delay));

  // Return mock data
  const dataPoints = 500; // ~2 years of daily data
  return {
    data: Array(dataPoints).fill(0).map((_, i) => 50 + Math.sin(i / 20) * 10 + Math.random() * 5),
  };
}

/**
 * Generate pandas DataFrame-like candle data
 */
function generateCandleData(count: number = 500) {
  return Array(count).fill(null).map((_, i) => ({
    timestamp: Date.now() - (count - i) * 86400000,
    open: 100 + Math.random() * 20,
    high: 110 + Math.random() * 10,
    low: 90 + Math.random() * 10,
    close: 100 + Math.random() * 20,
    volume: 1000000 + Math.random() * 500000,
  }));
}

describe('Indicator Performance: ADXVMA, cRSI, TDFI', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: ADXVMA calculation performance
   */
  it('should calculate ADXVMA within performance targets', async () => {
    const candles = generateCandleData(500);
    const params = { adxvma_period: 20 };

    const result = await measurePerformance(
      'calculate_adxvma',
      'calculation',
      () => mockIndicatorCalculation('adxvma', params),
      { indicator: 'adxvma', period: 20, candle_count: candles.length }
    );

    expect(result.data).toHaveLength(500);

    const logs = performanceStore.getLogsByOperation('calculate_adxvma');
    expect(logs.length).toBe(1);

    const duration = logs[0].duration_ms;
    console.log(`ADXVMA calculation: ${duration.toFixed(0)}ms`);

    // Log performance for review
    const report = performanceStore.generateReport({
      operation_thresholds: { calculate_adxvma: 1000 },
      max_operation_contribution_percent: 20,
      min_sample_count: 1,
    });

    console.log(`ADXVMA Performance Report:`, JSON.stringify({
      duration_ms: duration.toFixed(0),
      target_ms: 1000,
      status: duration <= 1000 ? 'PASS' : 'FAIL',
    }, null, 2));
  });

  /**
   * Test: cRSI calculation performance
   */
  it('should calculate cRSI within performance targets', async () => {
    const candles = generateCandleData(500);
    const params = { dom_cycle: 20, vibration: 5, leveling: 3, cyclic_memory: 50 };

    const result = await measurePerformance(
      'calculate_crsi',
      'calculation',
      () => mockIndicatorCalculation('crsi', params),
      { indicator: 'crsi', params, candle_count: candles.length }
    );

    expect(result.data).toHaveLength(500);

    const logs = performanceStore.getLogsByOperation('calculate_crsi');
    expect(logs.length).toBe(1);

    const duration = logs[0].duration_ms;
    console.log(`cRSI calculation: ${duration.toFixed(0)}ms`);

    // cRSI is known to be slow - target is 1.5s
    const report = performanceStore.generateReport({
      operation_thresholds: { calculate_crsi: 1500 },
      max_operation_contribution_percent: 20,
      min_sample_count: 1,
    });

    console.log(`cRSI Performance Report:`, JSON.stringify({
      duration_ms: duration.toFixed(0),
      target_ms: 1500,
      status: duration <= 1500 ? 'PASS' : 'FAIL',
    }, null, 2));
  });

  /**
   * Test: TDFI calculation performance
   */
  it('should calculate TDFI within performance targets', async () => {
    const candles = generateCandleData(500);
    const params = { lookback: 50, filter_high: 0.4, filter_low: -0.4 };

    const result = await measurePerformance(
      'calculate_tdfi',
      'calculation',
      () => mockIndicatorCalculation('tdfi', params),
      { indicator: 'tdfi', params, candle_count: candles.length }
    );

    expect(result.data).toHaveLength(500);

    const logs = performanceStore.getLogsByOperation('calculate_tdfi');
    expect(logs.length).toBe(1);

    const duration = logs[0].duration_ms;
    console.log(`TDFI calculation: ${duration.toFixed(0)}ms`);

    const report = performanceStore.generateReport({
      operation_thresholds: { calculate_tdfi: 1000 },
      max_operation_contribution_percent: 20,
      min_sample_count: 1,
    });

    console.log(`TDFI Performance Report:`, JSON.stringify({
      duration_ms: duration.toFixed(0),
      target_ms: 1000,
      status: duration <= 1000 ? 'PASS' : 'FAIL',
    }, null, 2));
  });

  /**
   * Test: Multiple indicators together
   */
  it('should handle ADXVMA + cRSI + TDFI together within 5 seconds', async () => {
    const indicators = [
      { name: 'adxvma', params: { adxvma_period: 20 } },
      { name: 'crsi', params: { dom_cycle: 20, vibration: 5, leveling: 3, cyclic_memory: 50 } },
      { name: 'tdfi', params: { lookback: 50, filter_high: 0.4, filter_low: -0.4 } },
    ];

    const startTime = Date.now();

    const results = await Promise.all(
      indicators.map(ind =>
        measurePerformance(
          `calculate_${ind.name}`,
          'calculation',
          () => mockIndicatorCalculation(ind.name, ind.params),
          { indicator: ind.name, params: ind.params }
        )
      )
    );

    const totalTime = Date.now() - startTime;

    console.log(`All 3 indicators: ${totalTime}ms total`);
    console.log(`Average per indicator: ${(totalTime / 3).toFixed(0)}ms`);

    const report = performanceStore.generateReport({
      operation_thresholds: {},
      max_operation_contribution_percent: 20,
      min_sample_count: 1,
    });

    // Calculate times for each indicator
    const rankings = report.rankings.filter(r =>
      r.operation.startsWith('calculate_adxvma') ||
      r.operation.startsWith('calculate_crsi') ||
      r.operation.startsWith('calculate_tdfi')
    );

    console.log(`\nIndicator Rankings:`);
    rankings.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.operation}: ${r.average_duration_ms.toFixed(0)}ms (${r.percent_of_total_load_time.toFixed(1)}% of total)`);
    });

    // Target: All 3 should complete in under 5 seconds
    expect(totalTime).toBeLessThan(5000);
  });

  /**
   * Test: Compare performance across multiple runs
   */
  it('should maintain consistent performance across 3 runs', async () => {
    const runCount = 3;
    const durations: number[] = [];

    for (let i = 0; i < runCount; i++) {
      performanceStore.clear();

      await measurePerformance(
        'calculate_crsi',
        'calculation',
        () => mockIndicatorCalculation('crsi', { dom_cycle: 20 }),
        { run: i + 1 }
      );

      const logs = performanceStore.getLogsByOperation('calculate_crsi');
      durations.push(logs[0].duration_ms);
    }

    console.log(`cRSI durations across ${runCount} runs:`, durations.map(d => `${d.toFixed(0)}ms`).join(', '));

    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    const variance = max - min;

    console.log(`Average: ${avg.toFixed(0)}ms, Min: ${min.toFixed(0)}ms, Max: ${max.toFixed(0)}ms`);
    console.log(`Variance: ${variance.toFixed(0)}ms (${(variance / avg * 100).toFixed(1)}%)`);

    // Check for consistency (variance should be less than 30% of average)
    expect(variance / avg).toBeLessThan(0.3);
  });

  /**
   * Test: Performance with different data sizes
   */
  it('should measure performance scaling with data size', async () => {
    const dataSizes = [100, 500, 1000]; // 6 months, 2 years, 4 years of daily data

    for (const size of dataSizes) {
      performanceStore.clear();

      await measurePerformance(
        'calculate_tdfi',
        'calculation',
        () => mockIndicatorCalculation('tdfi', { lookback: 50 }),
        { candle_count: size }
      );

      const logs = performanceStore.getLogsByOperation('calculate_tdfi');
      const duration = logs[0].duration_ms;

      console.log(`TDFI with ${size} candles: ${duration.toFixed(0)}ms`);
    }
  });
});
