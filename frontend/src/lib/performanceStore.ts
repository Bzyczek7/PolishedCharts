/**
 * PerformanceStore - In-memory storage for performance logs
 *
 * Feature: 012-performance-optimization
 * Provides centralized performance logging with report generation
 */

import type {
  PerformanceLog,
  PerformanceReport,
  CategoryReport,
  CategoryStats,
  Bottleneck,
  OperationRanking,
  ThresholdConfig,
  PerformanceCategory,
} from '../types/performance';

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  timestamp: Date;
  used_bytes: number;
  total_bytes: number;
  limit_bytes?: number;
}

/**
 * In-memory store for performance measurements
 */
export class PerformanceStore {
  private logs: PerformanceLog[] = [];
  private max_logs: number = 10000; // Prevent unbounded growth
  private memorySnapshots: MemorySnapshot[] = [];
  private max_memory_snapshots: number = 1000;

  /**
   * Record a performance measurement
   */
  record(log: PerformanceLog): void {
    this.logs.push(log);

    // Prevent unbounded growth
    if (this.logs.length > this.max_logs) {
      // Remove oldest logs (first 20% to avoid frequent shifts)
      this.logs = this.logs.slice(Math.floor(this.max_logs * 0.2));
    }
  }

  /**
   * Get all logs within a time range
   */
  getLogs(start?: Date, end?: Date): PerformanceLog[] {
    if (!start && !end) {
      return [...this.logs];
    }

    const startTime = start?.getTime() ?? 0;
    const endTime = end?.getTime() ?? Date.now();

    return this.logs.filter(log => {
      const logTime = log.timestamp.getTime();
      return logTime >= startTime && logTime <= endTime;
    });
  }

  /**
   * Get logs for a specific operation
   */
  getLogsByOperation(operation: string): PerformanceLog[] {
    return this.logs.filter(log => log.operation === operation);
  }

  /**
   * Get logs for a specific category
   */
  getLogsByCategory(category: PerformanceCategory): PerformanceLog[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get current log count
   */
  get size(): number {
    return this.logs.length;
  }

  /**
   * T045: Capture current memory usage snapshot
   * Only works in browsers that support performance.memory (Chrome-based)
   */
  captureMemorySnapshot(): MemorySnapshot | null {
    if ('memory' in performance && (performance as any).memory) {
      const mem = (performance as any).memory;
      const snapshot: MemorySnapshot = {
        timestamp: new Date(),
        used_bytes: mem.usedJSHeapSize,
        total_bytes: mem.totalJSHeapSize,
        limit_bytes: mem.jsHeapSizeLimit,
      };

      this.memorySnapshots.push(snapshot);

      // Prevent unbounded growth
      if (this.memorySnapshots.length > this.max_memory_snapshots) {
        this.memorySnapshots = this.memorySnapshots.slice(Math.floor(this.max_memory_snapshots * 0.2));
      }

      return snapshot;
    }
    return null;
  }

  /**
   * T045: Get all memory snapshots within a time range
   */
  getMemorySnapshots(start?: Date, end?: Date): MemorySnapshot[] {
    if (!start && !end) {
      return [...this.memorySnapshots];
    }

    const startTime = start?.getTime() ?? 0;
    const endTime = end?.getTime() ?? Date.now();

    return this.memorySnapshots.filter(snapshot => {
      const snapshotTime = snapshot.timestamp.getTime();
      return snapshotTime >= startTime && snapshotTime <= endTime;
    });
  }

  /**
   * T045: Get memory usage statistics
   */
  getMemoryStats(): {
    current_used_bytes: number;
    current_total_bytes: number;
    peak_used_bytes: number;
    average_used_bytes: number;
    snapshots_count: number;
  } | null {
    if (this.memorySnapshots.length === 0) {
      return null;
    }

    const usedBytes = this.memorySnapshots.map(s => s.used_bytes);
    const peakUsed = Math.max(...usedBytes);
    const avgUsed = usedBytes.reduce((sum, val) => sum + val, 0) / usedBytes.length;
    const latest = this.memorySnapshots[this.memorySnapshots.length - 1];

    return {
      current_used_bytes: latest.used_bytes,
      current_total_bytes: latest.total_bytes,
      peak_used_bytes: peakUsed,
      average_used_bytes: avgUsed,
      snapshots_count: this.memorySnapshots.length,
    };
  }

  /**
   * T045: Clear memory snapshots
   */
  clearMemorySnapshots(): void {
    this.memorySnapshots = [];
  }

  /**
   * Calculate percentile from array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate statistics for a category
   */
  private calculateCategoryStats(categoryLogs: PerformanceLog[]): CategoryStats {
    if (categoryLogs.length === 0) {
      return {
        total_duration_ms: 0,
        operation_count: 0,
        average_duration_ms: 0,
        p50_duration_ms: 0,
        p95_duration_ms: 0,
        p99_duration_ms: 0,
      };
    }

    const durations = categoryLogs.map(log => log.duration_ms);
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      total_duration_ms: total,
      operation_count: categoryLogs.length,
      average_duration_ms: total / categoryLogs.length,
      p50_duration_ms: this.calculatePercentile(durations, 50),
      p95_duration_ms: this.calculatePercentile(durations, 95),
      p99_duration_ms: this.calculatePercentile(durations, 99),
    };
  }

  /**
   * Calculate statistics by category
   */
  private calculateByCategory(): CategoryReport {
    const categories: PerformanceCategory[] = ['data_fetch', 'calculation', 'rendering', 'ui_interaction'];

    const result = {} as CategoryReport;
    for (const category of categories) {
      result[category] = this.calculateCategoryStats(this.getLogsByCategory(category));
    }

    return result;
  }

  /**
   * Identify bottlenecks based on thresholds and contribution
   */
  private identifyBottlenecks(
    byCategory: CategoryReport,
    thresholds: ThresholdConfig,
    totalDuration: number
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Group logs by operation
    const operationGroups = new Map<string, PerformanceLog[]>();
    for (const log of this.logs) {
      if (!operationGroups.has(log.operation)) {
        operationGroups.set(log.operation, []);
      }
      operationGroups.get(log.operation)!.push(log);
    }

    // Analyze each operation
    for (const [operation, logs] of operationGroups.entries()) {
      if (logs.length < thresholds.min_sample_count) continue;

      const category = logs[0].category;
      const duration = logs.reduce((sum, log) => sum + log.duration_ms, 0);
      const percentOfTotal = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;

      // Check threshold
      const threshold = thresholds.operation_thresholds[operation];
      if (threshold) {
        const avgDuration = duration / logs.length;
        if (avgDuration > threshold) {
          bottlenecks.push({
            operation,
            category,
            reason: 'threshold_exceeded',
            total_duration_ms: duration,
            percent_of_total: percentOfTotal,
            impact: avgDuration > threshold * 2 ? 'critical' : 'high',
          });
          continue;
        }
      }

      // Check high contribution
      if (percentOfTotal > thresholds.max_operation_contribution_percent) {
        bottlenecks.push({
          operation,
          category,
          reason: 'high_contribution',
          total_duration_ms: duration,
          percent_of_total: percentOfTotal,
          impact: percentOfTotal > thresholds.max_operation_contribution_percent * 2 ? 'critical' : 'high',
        });
        continue;
      }
    }

    // Sort by duration descending
    bottlenecks.sort((a, b) => b.total_duration_ms - a.total_duration_ms);

    return bottlenecks;
  }

  /**
   * Create operation rankings
   */
  private createRankings(byCategory: CategoryReport, totalDuration: number): OperationRanking[] {
    const operationGroups = new Map<string, { logs: PerformanceLog[]; category: PerformanceCategory }>();

    for (const log of this.logs) {
      if (!operationGroups.has(log.operation)) {
        operationGroups.set(log.operation, { logs: [], category: log.category });
      }
      operationGroups.get(log.operation)!.logs.push(log);
    }

    const rankings: OperationRanking[] = [];

    for (const [operation, { logs, category }] of operationGroups.entries()) {
      const duration = logs.reduce((sum, log) => sum + log.duration_ms, 0);
      rankings.push({
        operation,
        category,
        total_duration_ms: duration,
        count: logs.length,
        average_duration_ms: duration / logs.length,
        percent_of_total_load_time: totalDuration > 0 ? (duration / totalDuration) * 100 : 0,
      });
    }

    // Sort by total duration descending
    rankings.sort((a, b) => b.total_duration_ms - a.total_duration_ms);

    return rankings;
  }

  /**
   * Generate a performance report
   */
  generateReport(
    thresholds: ThresholdConfig = {
      operation_thresholds: {},
      max_operation_contribution_percent: 20,
      min_sample_count: 3,
    }
  ): PerformanceReport {
    const now = new Date();

    if (this.logs.length === 0) {
      return {
        generated_at: now,
        start_time: now,
        end_time: now,
        total_operations: 0,
        by_category: {
          data_fetch: { total_duration_ms: 0, operation_count: 0, average_duration_ms: 0, p50_duration_ms: 0, p95_duration_ms: 0, p99_duration_ms: 0 },
          calculation: { total_duration_ms: 0, operation_count: 0, average_duration_ms: 0, p50_duration_ms: 0, p95_duration_ms: 0, p99_duration_ms: 0 },
          rendering: { total_duration_ms: 0, operation_count: 0, average_duration_ms: 0, p50_duration_ms: 0, p95_duration_ms: 0, p99_duration_ms: 0 },
          ui_interaction: { total_duration_ms: 0, operation_count: 0, average_duration_ms: 0, p50_duration_ms: 0, p95_duration_ms: 0, p99_duration_ms: 0 },
        },
        bottlenecks: [],
        rankings: [],
      };
    }

    const byCategory = this.calculateByCategory();
    const totalDuration = Object.values(byCategory).reduce(
      (sum, stats) => sum + stats.total_duration_ms,
      0
    );

    const bottlenecks = this.identifyBottlenecks(byCategory, thresholds, totalDuration);
    const rankings = this.createRankings(byCategory, totalDuration);

    // Get time range
    const timestamps = this.logs.map(log => log.timestamp.getTime());
    const startTime = new Date(Math.min(...timestamps));
    const endTime = new Date(Math.max(...timestamps));

    return {
      generated_at: now,
      start_time: startTime,
      end_time: endTime,
      total_operations: this.logs.length,
      by_category: byCategory,
      bottlenecks,
      rankings,
    };
  }

  /**
   * Get before/after comparison for bottleneck analysis
   */
  compare(beforeLogs: PerformanceLog[], afterLogs: PerformanceLog[]): {
    before: CategoryReport;
    after: CategoryReport;
    improvement: Record<string, number>; // percent improvement per category
    regressions: string[]; // categories with degradation
  } {
    const beforeStore = new PerformanceStore();
    const afterStore = new PerformanceStore();

    for (const log of beforeLogs) {
      beforeStore.record(log);
    }
    for (const log of afterLogs) {
      afterStore.record(log);
    }

    const beforeReport = beforeStore.generateReport();
    const afterReport = afterStore.generateReport();

    const improvement: Record<string, number> = {};
    const regressions: string[] = [];

    for (const category of ['data_fetch', 'calculation', 'rendering', 'ui_interaction'] as const) {
      const before = beforeReport.by_category[category];
      const after = afterReport.by_category[category];

      if (before.p95_duration_ms > 0) {
        const change = ((before.p95_duration_ms - after.p95_duration_ms) / before.p95_duration_ms) * 100;
        improvement[category] = change;

        if (change < -10) {
          regressions.push(category);
        }
      }
    }

    return {
      before: beforeReport.by_category,
      after: afterReport.by_category,
      improvement,
      regressions,
    };
  }

  /**
   * Detect regressions between two sets of logs
   */
  detectRegressions(
    baselineLogs: PerformanceLog[],
    currentLogs: PerformanceLog[],
    threshold: number = 10 // percent degradation allowed
  ): string[] {
    const baselineStore = new PerformanceStore();
    const currentStore = new PerformanceStore();

    baselineStore['logs'] = baselineLogs;
    currentStore['logs'] = currentLogs;

    const baselineReport = baselineStore.generateReport();
    const currentReport = currentStore.generateReport();

    const regressions: string[] = [];

    for (const category of ['data_fetch', 'calculation', 'rendering', 'ui_interaction'] as const) {
      const baseline = baselineReport.by_category[category].p95_duration_ms;
      const current = currentReport.by_category[category].p95_duration_ms;

      if (baseline > 0) {
        const change = ((current - baseline) / baseline) * 100;
        if (change > threshold) {
          regressions.push(`${category}: +${change.toFixed(1)}%`);
        }
      }
    }

    return regressions;
  }
}

/**
 * Global performance store instance
 */
export const performanceStore = new PerformanceStore();
