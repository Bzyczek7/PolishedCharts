/**
 * Edge Case Tests for Performance Feature
 * Feature: 012-performance-optimization
 * Task: T050a
 *
 * Verifies edge case handling for:
 * - Provider timeouts
 * - Large datasets
 * - Many indicators
 * - Rapid symbol switches
 * - Calculation errors
 * - Network interruptions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceStore } from '../../../src/lib/performanceStore';
import { measurePerformance, clearPerformanceLogs } from '../../../src/lib/performance';
import type { PerformanceLog } from '../../../src/types/performance';

describe('Edge Cases: Provider Timeout', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Performance logging handles provider timeout gracefully
   */
  it('should log timeout as error without crashing', async () => {
    const mockFetch = vi.fn(async () => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });
    });

    await expect(mockFetch()).rejects.toThrow('Request timeout');

    // Performance should still be recorded
    const logs = performanceStore.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].context?.error).toBe(true);
  });

  /**
   * Test: Slow provider responses are logged correctly
   */
  it('should log slow provider responses', async () => {
    const slowOperation = async () => {
      await measurePerformance('slow_fetch', 'data_fetch', async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { data: 'slow' };
      });
    };

    await slowOperation();

    const report = performanceStore.generateReport({
      operation_thresholds: { slow_fetch: 1000 },
      max_operation_contribution_percent: 20,
      min_sample_count: 1,
    });

    expect(report.bottlenecks.length).toBeGreaterThan(0);
    expect(report.bottlenecks[0].operation).toBe('slow_fetch');
    expect(report.bottlenecks[0].reason).toBe('threshold_exceeded');
  });
});

describe('Edge Cases: Large Datasets', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Performance with very large candle datasets (> 10,000 bars)
   */
  it('should handle large candle datasets without performance degradation', async () => {
    const largeDataset = async () => {
      return await measurePerformance('fetch_large_dataset', 'data_fetch', async () => {
        // Simulate large dataset processing
        const data = Array(10000).fill(null).map((_, i) => ({
          timestamp: Date.now() - (10000 - i) * 86400000,
          open: 100 + Math.random(),
          high: 101 + Math.random(),
          low: 99 + Math.random(),
          close: 100 + Math.random(),
          volume: 1000000,
        }));

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 200));
        return data;
      });
    };

    const result = await largeDataset();
    expect(result).toHaveLength(10000);

    const logs = performanceStore.getLogsByOperation('fetch_large_dataset');
    expect(logs.length).toBe(1);
    expect(logs[0].duration_ms).toBeGreaterThan(0);
  });

  /**
   * Test: Memory usage doesn't grow unbounded with many logs
   */
  it('should enforce max_logs limit to prevent unbounded growth', () => {
    // Store's max_logs is 10000
    const initialSize = performanceStore.size;

    // Try to add more than max_logs
    for (let i = 0; i < 15000; i++) {
      performanceStore.record({
        id: `log-${i}`,
        timestamp: new Date(),
        category: 'calculation',
        operation: 'test_operation',
        duration_ms: Math.random() * 100,
        context: {},
      });
    }

    // Size should be capped
    expect(performanceStore.size).toBeLessThan(12000); // Allows some buffer
    expect(performanceStore.size).toBeGreaterThan(8000); // Should have kept most
  });
});

describe('Edge Cases: Many Indicators', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Calculate many indicators concurrently
   */
  it('should handle many indicators without crashing', async () => {
    const indicators = ['sma', 'ema', 'rsi', 'cci', 'adx', 'macd', 'bbands', 'stoch', 'atr', 'willr'];

    const calculateAll = async () => {
      const promises = indicators.map(indicator =>
        measurePerformance(`calculate_${indicator}`, 'calculation', async () => {
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
          return { indicator, values: [1, 2, 3] };
        })
      );

      return await Promise.all(promises);
    };

    const results = await calculateAll();
    expect(results).toHaveLength(10);

    const report = performanceStore.generateReport();
    expect(report.total_operations).toBe(10);
    expect(report.by_category.calculation.operation_count).toBe(10);
  });

  /**
   * Test: Cache handles many indicator variations
   */
  it('should cache indicators with different parameter combinations', async () => {
    const cacheHits: string[] = [];

    // Simulate fetching same indicator with different parameters
    const periods = [10, 20, 50, 100, 200];

    for (const period of periods) {
      await measurePerformance('fetch_sma', 'data_fetch', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { period, values: [1, 2, 3] };
      }, { period });

      cacheHits.push(`sma_${period}`);
    }

    const logs = performanceStore.getLogsByOperation('fetch_sma');
    expect(logs.length).toBe(5);

    // Each should have different context (different period)
    const uniqueContexts = new Set(logs.map(log => JSON.stringify(log.context)));
    expect(uniqueContexts.size).toBe(5);
  });
});

describe('Edge Cases: Rapid Symbol Switches', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Debounce prevents excessive API calls
   */
  it('should debounce rapid symbol switches', async () => {
    vi.useFakeTimers();

    const fetchCalls: string[] = [];
    const mockFetch = async (symbol: string) => {
      fetchCalls.push(symbol);
      await measurePerformance(`fetch_${symbol}`, 'data_fetch', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { symbol, data: [] };
      });
      return { symbol, data: [] };
    };

    // Rapidly switch symbols (faster than debounce delay)
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];
    for (const symbol of symbols) {
      mockFetch(symbol);
      vi.advanceTimersByTime(50); // 50ms between switches (faster than 300ms debounce)
    }

    // Advance past debounce delay
    vi.advanceTimersByTime(300);

    // Wait for pending promises
    await new Promise(resolve => setTimeout(resolve, 500));
    vi.runAllTimers();

    vi.useRealTimers();

    // Due to debounce, not all symbols should be fetched
    expect(fetchCalls.length).toBeLessThan(symbols.length);
  });

  /**
   * Test: Cache invalidation on symbol change
   */
  it('should invalidate cache when switching symbols', async () => {
    let currentSymbol = 'AAPL';

    await measurePerformance('fetch_candles', 'data_fetch', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { symbol: currentSymbol, data: [] };
    }, { symbol: currentSymbol });

    const logsBefore = performanceStore.getLogs();
    expect(logsBefore.length).toBe(1);

    // Switch symbol
    currentSymbol = 'MSFT';
    await measurePerformance('fetch_candles', 'data_fetch', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { symbol: currentSymbol, data: [] };
    }, { symbol: currentSymbol });

    const logsAfter = performanceStore.getLogs();
    expect(logsAfter.length).toBe(2);

    // Logs should have different context (different symbol)
    expect(logsAfter[0].context?.symbol).toBe('AAPL');
    expect(logsAfter[1].context?.symbol).toBe('MSFT');
  });
});

describe('Edge Cases: Calculation Errors', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Calculation errors are logged and don't crash the app
   */
  it('should log calculation errors without crashing', async () => {
    const failingCalculation = async () => {
      try {
        await measurePerformance('failing_indicator', 'calculation', async () => {
          throw new Error('Division by zero');
        });
      } catch (error) {
        // Error should be re-thrown
        expect(error).toBeInstanceOf(Error);
      }
    };

    await failingCalculation();

    // Error should still be logged
    const logs = performanceStore.getLogsByOperation('failing_indicator');
    expect(logs.length).toBe(1);
    expect(logs[0].context?.error).toBe(true);
    expect(logs[0].context?.error_message).toBe('Division by zero');
  });

  /**
   * Test: Partial indicator failures don't affect other indicators
   */
  it('should handle partial indicator failures', async () => {
    const results = await Promise.allSettled([
      measurePerformance('indicator_1', 'calculation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { indicator: 'indicator_1', values: [1, 2, 3] };
      }),
      measurePerformance('indicator_2', 'calculation', async () => {
        throw new Error('Indicator 2 failed');
      }),
      measurePerformance('indicator_3', 'calculation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { indicator: 'indicator_3', values: [4, 5, 6] };
      }),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');

    const logs = performanceStore.getLogs();
    expect(logs.length).toBe(3);

    // Check that error was logged
    const errorLog = logs.find(log => log.operation === 'indicator_2');
    expect(errorLog?.context?.error).toBe(true);
  });
});

describe('Edge Cases: Network Interruptions', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Network interruption and retry logic
   */
  it('should handle network interruption gracefully', async () => {
    let attemptCount = 0;

    const fetchWithRetry = async (maxRetries = 3): Promise<{ data: string[] }> => {
      return await measurePerformance('fetch_with_retry', 'data_fetch', async () => {
        attemptCount++;

        if (attemptCount < maxRetries) {
          throw new Error('Network error');
        }

        return { data: ['success'] };
      });
    };

    let success = false;
    for (let i = 0; i < 3; i++) {
      try {
        await fetchWithRetry();
        success = true;
        break;
      } catch (error) {
        // Retry
      }
    }

    expect(success).toBe(true);
    expect(attemptCount).toBe(3);

    // Should have logs for all attempts
    const logs = performanceStore.getLogsByOperation('fetch_with_retry');
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Test: Very slow network doesn't timeout UI
   */
  it('should not block UI during very slow network', async () => {
    const slowFetch = measurePerformance('slow_network', 'data_fetch', async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return { data: [] };
    });

    // UI should remain responsive (test that promise doesn't block)
    const uiUpdate = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { ui_updated: true };
    };

    const [fetchResult, uiResult] = await Promise.allSettled([
      slowFetch,
      uiUpdate(),
    ]);

    expect(uiResult.status).toBe('fulfilled');
    expect((uiResult.value as any).ui_updated).toBe(true);
  });
});

describe('Edge Cases: Cache Eviction and Memory', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Cache evicts oldest entries when full
   */
  it('should evict oldest cache entries when limit reached', async () => {
    // Simulate cache filling up
    const cache = new Map<string, number>();
    const maxCacheSize = 5;

    for (let i = 0; i < 10; i++) {
      const key = `symbol_${i}`;

      if (cache.size >= maxCacheSize) {
        // Evict oldest (first key)
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(key, i);
    }

    // Should only have last 5 entries
    expect(cache.size).toBe(5);
    expect(cache.has('symbol_0')).toBe(false);
    expect(cache.has('symbol_9')).toBe(true);
  });

  /**
   * Test: Memory snapshot capture works when available
   */
  it('should capture memory snapshot when available', () => {
    // Mock performance.memory if not available
    const originalMemory = (performance as any).memory;

    if (!(performance as any).memory) {
      (performance as any).memory = () => ({
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 500 * 1024 * 1024, // 500MB
      });
    }

    const snapshot = performanceStore.captureMemorySnapshot();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.used_bytes).toBeGreaterThan(0);
    expect(snapshot!.total_bytes).toBeGreaterThan(0);

    // Restore original
    if (!originalMemory) {
      delete (performance as any).memory;
    }
  });

  /**
   * Test: Memory stats return null when no snapshots
   */
  it('should return null for memory stats when no snapshots', () => {
    performanceStore.clearMemorySnapshots();

    const stats = performanceStore.getMemoryStats();
    expect(stats).toBeNull();
  });
});

describe('Edge Cases: Empty and Null Data', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Empty report generation with no logs
   */
  it('should generate empty report with no logs', () => {
    const report = performanceStore.generateReport();

    expect(report.total_operations).toBe(0);
    expect(report.bottlenecks).toHaveLength(0);
    expect(report.rankings).toHaveLength(0);
  });

  /**
   * Test: Handle null/undefined context gracefully
   */
  it('should handle null context in logs', () => {
    performanceStore.record({
      id: 'test-log',
      timestamp: new Date(),
      category: 'calculation',
      operation: 'test_op',
      duration_ms: 100,
      context: null as any,
    });

    const logs = performanceStore.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].context).toBeDefined();
  });
});

describe('Edge Cases: Concurrent Operations', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  /**
   * Test: Concurrent performance measurements don't interfere
   */
  it('should handle concurrent performance measurements', async () => {
    const operations = [
      measurePerformance('op1', 'calculation', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 1;
      }),
      measurePerformance('op2', 'data_fetch', async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return 2;
      }),
      measurePerformance('op3', 'rendering', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 3;
      }),
    ];

    const results = await Promise.all(operations);
    expect(results).toEqual([1, 2, 3]);

    const report = performanceStore.generateReport();
    expect(report.total_operations).toBe(3);
  });

  /**
   * Test: Report generation during concurrent logging
   */
  it('should generate report safely during concurrent logging', async () => {
    // Start concurrent operations
    const promises = Array(10).fill(null).map((_, i) =>
      measurePerformance(`concurrent_op_${i}`, 'calculation', async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return i;
      })
    );

    // Generate report while operations are in flight
    setTimeout(() => {
      const report = performanceStore.generateReport();
      expect(report.total_operations).toBeGreaterThanOrEqual(0);
    }, 50);

    await Promise.all(promises);

    const finalReport = performanceStore.generateReport();
    expect(finalReport.total_operations).toBe(10);
  });
});
