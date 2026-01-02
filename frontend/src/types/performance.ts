/**
 * Performance Monitoring Type Definitions
 *
 * Feature: 012-performance-optimization
 * Defines types for performance logging, reporting, and caching
 */

/**
 * Operation categories for grouping performance measurements
 */
export type PerformanceCategory = 'data_fetch' | 'calculation' | 'rendering' | 'ui_interaction';

/**
 * Additional context for performance operations
 * Varies by category:
 * - data_fetch: symbol, interval, data_size, cached
 * - calculation: indicator_type, params, data_points
 * - rendering: component_name, props
 * - ui_interaction: action_name, target
 */
export interface PerformanceContext {
  [key: string]: string | number | boolean | undefined;
}

/**
 * A single performance measurement recorded during application operation
 */
export interface PerformanceLog {
  /** Unique identifier for this log entry */
  id: string;

  /** When the operation started */
  timestamp: Date;

  /** Category of operation (for grouping/filtering) */
  category: PerformanceCategory;

  /** Specific operation name (e.g., 'fetch_candles', 'calculate_rsi') */
  operation: string;

  /** Duration in milliseconds */
  duration_ms: number;

  /** Additional context for the operation */
  context: PerformanceContext;
}

/**
 * Statistics for a performance category
 */
export interface CategoryStats {
  /** Total duration across all operations in this category */
  total_duration_ms: number;

  /** Number of operations measured */
  operation_count: number;

  /** Average duration */
  average_duration_ms: number;

  /** 50th percentile (median) duration */
  p50_duration_ms: number;

  /** 95th percentile duration */
  p95_duration_ms: number;

  /** 99th percentile duration */
  p99_duration_ms: number;
}

/**
 * Statistics grouped by category
 */
export interface CategoryReport {
  data_fetch: CategoryStats;
  calculation: CategoryStats;
  rendering: CategoryStats;
  ui_interaction: CategoryStats;
}

/**
 * Bottleneck identification
 */
export interface Bottleneck {
  /** Operation name */
  operation: string;

  /** Category this operation belongs to */
  category: string;

  /** Reason this operation was flagged */
  reason: 'threshold_exceeded' | 'high_contribution' | 'outlier';

  /** Total duration for this operation */
  total_duration_ms: number;

  /** Percentage of total load time */
  percent_of_total: number;

  /** Impact level */
  impact: 'critical' | 'high' | 'medium';
}

/**
 * Operation ranking by duration
 */
export interface OperationRanking {
  /** Operation name */
  operation: string;

  /** Category this operation belongs to */
  category: string;

  /** Total duration for this operation */
  total_duration_ms: number;

  /** Number of times this operation was measured */
  count: number;

  /** Average duration */
  average_duration_ms: number;

  /** Percentage of total load time */
  percent_of_total_load_time: number;
}

/**
 * Aggregated performance report
 */
export interface PerformanceReport {
  /** When the report was generated */
  generated_at: Date;

  /** Start of time range covered by report */
  start_time: Date;

  /** End of time range covered by report */
  end_time: Date;

  /** Total operations measured */
  total_operations: number;

  /** Operations grouped by category */
  by_category: CategoryReport;

  /** Bottlenecks identified */
  bottlenecks: Bottleneck[];

  /** Operations ranked by total duration */
  rankings: OperationRanking[];
}

/**
 * Configurable thresholds for identifying performance issues
 */
export interface ThresholdConfig {
  /** Maximum acceptable duration per operation type (ms) */
  operation_thresholds: Record<string, number>;

  /** Max % of total load time any single operation should contribute */
  max_operation_contribution_percent: number;

  /** Minimum count for an operation to be considered in bottleneck analysis */
  min_sample_count: number;
}

/**
 * Default performance thresholds based on Constitution VI and spec requirements
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  operation_thresholds: {
    'fetch_candles': 3000,           // 3 seconds - SC-003
    'calculate_indicator': 1000,     // 1 second - SC-004
    'calculate_rsi': 1000,           // RSI calculation
    'calculate_macd': 1000,          // MACD calculation
    'calculate_ema': 1000,           // EMA calculation
    'render_chart': 3000,            // 3 seconds - SC-003
    'symbol_switch_cached': 1000,    // 1 second - SC-005
    'ui_response': 200,              // 200ms - SC-007
  },
  max_operation_contribution_percent: 20,  // SC-008
  min_sample_count: 3,
};

/**
 * Frontend performance state for React
 */
export interface PerformanceState {
  /** Whether performance monitoring is enabled */
  is_enabled: boolean;

  /** Current performance logs */
  logs: PerformanceLog[];

  /** Most recent report */
  current_report: PerformanceReport | null;

  /** Whether a report is being generated */
  is_generating_report: boolean;
}
