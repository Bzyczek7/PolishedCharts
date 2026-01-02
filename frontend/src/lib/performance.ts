/**
 * Performance Utilities - Helper functions for performance measurement
 *
 * Feature: 012-performance-optimization
 * Provides utilities for timing operations and measuring performance
 */

import { performanceStore } from './performanceStore';
import type {
  PerformanceLog,
  PerformanceCategory,
  ThresholdConfig,
  PerformanceReport,
  DEFAULT_THRESHOLDS,
} from '../types/performance';

/**
 * Generate a unique ID for performance logs
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Measure an async operation and record its performance
 *
 * @param operation - Name of the operation being measured
 * @param category - Category of the operation
 * @param fn - Async function to measure
 * @param context - Additional context for the operation
 * @returns Result of the async function
 */
export async function measurePerformance<T>(
  operation: string,
  category: PerformanceCategory,
  fn: () => Promise<T>,
  context?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const start = performance.now();
  const startTime = new Date();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    performanceStore.record({
      id: generateId(),
      timestamp: startTime,
      category,
      operation,
      duration_ms: duration,
      context: context || {},
    });

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    performanceStore.record({
      id: generateId(),
      timestamp: startTime,
      category,
      operation,
      duration_ms: duration,
      context: { ...context, error: true, error_message: error instanceof Error ? error.message : String(error) },
    });

    throw error;
  }
}

/**
 * Measure a synchronous operation and record its performance
 *
 * @param operation - Name of the operation being measured
 * @param category - Category of the operation
 * @param fn - Function to measure
 * @param context - Additional context for the operation
 * @returns Result of the function
 */
export function measurePerformanceSync<T>(
  operation: string,
  category: PerformanceCategory,
  fn: () => T,
  context?: Record<string, string | number | boolean | undefined>
): T {
  const start = performance.now();
  const startTime = new Date();

  try {
    const result = fn();
    const duration = performance.now() - start;

    performanceStore.record({
      id: generateId(),
      timestamp: startTime,
      category,
      operation,
      duration_ms: duration,
      context: context || {},
    });

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    performanceStore.record({
      id: generateId(),
      timestamp: startTime,
      category,
      operation,
      duration_ms: duration,
      context: { ...context, error: true, error_message: error instanceof Error ? error.message : String(error) },
    });

    throw error;
  }
}

/**
 * Create a performance timer for manual measurement
 *
 * Usage:
 * ```ts
 * const timer = startPerformanceTimer('my_operation', 'calculation');
 * // ... do work ...
 * timer.end({ foo: 'bar' });
 * ```
 */
export function startPerformanceTimer(
  operation: string,
  category: PerformanceCategory
): {
  end: (context?: Record<string, string | number | boolean | undefined>) => void;
} {
  const start = performance.now();
  const startTime = new Date();

  return {
    end: (context?: Record<string, string | number | boolean | undefined>) => {
      const duration = performance.now() - start;
      performanceStore.record({
        id: generateId(),
        timestamp: startTime,
        category,
        operation,
        duration_ms: duration,
        context: context || {},
      });
    },
  };
}

/**
 * Generate a performance report from collected logs
 */
export function generatePerformanceReport(thresholds?: ThresholdConfig): PerformanceReport {
  return performanceStore.generateReport(thresholds);
}

/**
 * Clear all performance logs
 */
export function clearPerformanceLogs(): void {
  performanceStore.clear();
}

/**
 * Get performance logs within a time range
 */
export function getPerformanceLogs(start?: Date, end?: Date) {
  return performanceStore.getLogs(start, end);
}

/**
 * Get logs for a specific operation
 */
export function getLogsByOperation(operation: string) {
  return performanceStore.getLogsByOperation(operation);
}

/**
 * Get logs for a specific category
 */
export function getLogsByCategory(category: PerformanceCategory) {
  return performanceStore.getLogsByCategory(category);
}

/**
 * Compare performance before/after an optimization
 */
export function comparePerformance(
  beforeLogs: import('../types/performance').PerformanceLog[],
  afterLogs: import('../types/performance').PerformanceLog[]
) {
  return performanceStore.compare(beforeLogs, afterLogs);
}

/**
 * Detect regressions between baseline and current performance
 */
export function detectRegressions(
  baselineLogs: import('../types/performance').PerformanceLog[],
  currentLogs: import('../types/performance').PerformanceLog[],
  threshold: number = 10
): string[] {
  return performanceStore.detectRegressions(baselineLogs, currentLogs, threshold);
}

/**
 * Export performance data as JSON
 */
export function exportPerformanceData(): string {
  const logs = performanceStore.getLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Format milliseconds as human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${Math.round(ms * 1000)}μs`;
  } else if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else {
      const minutes = seconds / 60;
      return `${minutes.toFixed(1)}m`;
    }
  }
}

/**
 * Calculate percent improvement between two values
 */
export function calculateImprovement(before: number, after: number): number {
  if (before === 0) return 0;
  return ((before - after) / before) * 100;
}

/**
 * Check if performance meets success criteria
 */
export function checkSuccessCriteria(
  report: PerformanceReport,
  thresholds: ThresholdConfig = {
    operation_thresholds: {},
    max_operation_contribution_percent: 20,
    min_sample_count: 3,
  }
): {
  met: string[];
  not_met: string[];
  warnings: string[];
} {
  const met: string[] = [];
  const not_met: string[] = [];
  const warnings: string[] = [];

  // Check each operation threshold
  for (const [operation, threshold] of Object.entries(thresholds.operation_thresholds)) {
    const ranking = report.rankings.find(r => r.operation === operation);
    if (ranking) {
      if (ranking.average_duration_ms <= threshold) {
        met.push(`${operation}: ${ranking.average_duration_ms.toFixed(0)}ms <= ${threshold}ms`);
      } else {
        not_met.push(`${operation}: ${ranking.average_duration_ms.toFixed(0)}ms > ${threshold}ms`);
      }
    }
  }

  // Check max contribution
  const maxContribution = Math.max(...report.rankings.map(r => r.percent_of_total_load_time));
  if (maxContribution <= thresholds.max_operation_contribution_percent) {
    met.push(`Max contribution: ${maxContribution.toFixed(1)}% <= ${thresholds.max_operation_contribution_percent}%`);
  } else {
    not_met.push(`Max contribution: ${maxContribution.toFixed(1)}% > ${thresholds.max_operation_contribution_percent}%`);
  }

  // Warnings for insufficient sample count
  for (const ranking of report.rankings) {
    if (ranking.count < thresholds.min_sample_count) {
      warnings.push(`${ranking.operation}: only ${ranking.count} samples (need ${thresholds.min_sample_count}+)`);
    }
  }

  return { met, not_met, warnings };
}

/**
 * Get memory usage (if available)
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  limit?: number;
} | null {
  if ('memory' in performance && (performance as any).memory) {
    const mem = (performance as any).memory();
    return {
      used: mem.usedJSHeapSize,
      total: mem.totalJSHeapSize,
      limit: mem.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * Format bytes as human-readable size
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)}${units[unitIndex]}`;
}
