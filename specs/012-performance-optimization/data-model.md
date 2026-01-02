# Data Model: Performance Optimization

**Feature**: 012-performance-optimization
**Date**: 2025-12-31

## Overview

This feature introduces performance logging infrastructure without adding new database entities. Performance data is collected in-memory and exported as reports.

## Performance Log Entry

### Frontend PerformanceLog

A single performance measurement recorded during application operation.

```typescript
interface PerformanceLog {
  // Unique identifier for this log entry
  id: string;

  // When the operation started
  timestamp: Date;

  // Category of operation (for grouping/filtering)
  category: 'data_fetch' | 'calculation' | 'rendering' | 'ui_interaction';

  // Specific operation name
  operation: string;

  // Duration in milliseconds
  duration_ms: number;

  // Additional context for the operation
  context: PerformanceContext;
}

interface PerformanceContext {
  // For data_fetch: symbol, interval, data_size
  // For calculation: indicator_type, params, data_points
  // For rendering: component_name, props
  // For ui_interaction: action_name, target
  [key: string]: string | number | boolean | undefined;
}
```

### Backend PerformanceLog

Backend performance logging uses Python's logging module with structured JSON output.

```python
@dataclass
class PerformanceLogEntry:
    """A single performance measurement."""
    timestamp: datetime
    category: Literal["data_fetch", "calculation", "database", "api"]
    operation: str
    duration_ms: float
    context: dict[str, Any]
```

## Performance Report

### PerformanceReport

Aggregated analysis of performance logs identifying bottlenecks.

```typescript
interface PerformanceReport {
  // When the report was generated
  generated_at: Date;

  // Time range covered by the report
  start_time: Date;
  end_time: Date;

  // Total operations measured
  total_operations: number;

  // Operations grouped by category
  by_category: CategoryReport;

  // Bottlenecks (operations exceeding thresholds or contributing disproportionately)
  bottlenecks: Bottleneck[];

  // Operations ranked by total duration
  rankings: OperationRanking[];
}

interface CategoryReport {
  data_fetch: CategoryStats;
  calculation: CategoryStats;
  rendering: CategoryStats;
  ui_interaction: CategoryStats;
}

interface CategoryStats {
  total_duration_ms: number;
  operation_count: number;
  average_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
}

interface Bottleneck {
  operation: string;
  category: string;
  reason: 'threshold_exceeded' | 'high_contribution' | 'outlier';
  total_duration_ms: number;
  percent_of_total: number;
  impact: 'critical' | 'high' | 'medium';
}

interface OperationRanking {
  operation: string;
  category: string;
  total_duration_ms: number;
  count: number;
  average_duration_ms: number;
  percent_of_total_load_time: number;
}
```

## Performance Thresholds

### ThresholdConfig

Configurable thresholds for identifying performance issues.

```typescript
interface ThresholdConfig {
  // Maximum acceptable duration per operation type
  operation_thresholds: Record<string, number>;

  // Maximum percentage of total load time any single operation should contribute
  max_operation_contribution_percent: number;

  // Minimum count for an operation to be considered in bottleneck analysis
  min_sample_count: number;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  operation_thresholds: {
    'fetch_candles': 3000,      // 3 seconds - Constitution VI
    'calculate_indicator': 1000, // 1 second - FR-012
    'render_chart': 3000,        // 3 seconds - SC-003
    'symbol_switch_cached': 1000,// 1 second - SC-005
    'ui_response': 200,          // 200ms - FR-013
  },
  max_operation_contribution_percent: 20, // SC-008
  min_sample_count: 3,
};
```

## In-Memory Store

### PerformanceStore

Frontend in-memory storage for performance logs.

```typescript
class PerformanceStore {
  private logs: PerformanceLog[] = [];
  private max_logs: number = 10000; // Prevent unbounded growth

  // Record a performance measurement
  record(log: PerformanceLog): void;

  // Get all logs within a time range
  getLogs(start?: Date, end?: Date): PerformanceLog[];

  // Get logs for a specific operation
  getLogsByOperation(operation: string): PerformanceLog[];

  // Clear all logs
  clear(): void;

  // Generate a performance report
  generateReport(thresholds?: ThresholdConfig): PerformanceReport;
}
```

## Cache Entities

### IndicatorCacheEntry

Cached indicator calculation result.

```typescript
interface IndicatorCacheEntry {
  // Cache key: {symbol}:{interval}:{indicator_name}:{param_hash}
  key: string;

  // Cached indicator output
  data: IndicatorOutput;

  // When this entry was cached
  cached_at: Date;

  // Timestamp of the newest candle used in calculation
  data_timestamp: Date;

  // Cache key components
  symbol: string;
  interval: string;
  indicator_name: string;
  params: Record<string, number>;
}
```

### CandleCacheEntry

Cached candle data (frontend only, for quick symbol switching).

```typescript
interface CandleCacheEntry {
  // Cache key: {symbol}:{interval}
  key: string;

  // Cached candle data
  candles: Candle[];

  // When this entry was cached
  cached_at: Date;

  // Timestamp of the newest candle
  latest_timestamp: Date;
}
```

## State Management

### PerformanceState

React state for performance monitoring UI.

```typescript
interface PerformanceState {
  // Whether performance monitoring is enabled
  is_enabled: boolean;

  // Current performance logs
  logs: PerformanceLog[];

  // Most recent report
  current_report: PerformanceReport | null;

  // Whether a report is being generated
  is_generating_report: boolean;
}
```

## Validation Rules

1. **Log Entry Validation**:
   - `duration_ms` must be >= 0
   - `category` must be one of the allowed values
   - `operation` must be non-empty

2. **Cache Key Validation**:
   - Cache keys must be unique (handled by store)
   - Symbol validation uses existing `isValidSymbol()` function

3. **Report Generation**:
   - At least 3 data points required for percentile calculations
   - Operations with < 3 samples are flagged as "insufficient_data"

## State Transitions

```
[No Monitoring] --> [Monitoring Enabled] --> [Collecting Logs] --> [Report Generated]
                        ^                             |
                        |-----------------------------|
                              [Export/Clear Logs]
```

## Relationships

```
PerformanceLog (many) --> PerformanceReport (one)
PerformanceLog --> PerformanceContext (one)
IndicatorCacheEntry (many) --> PerformanceLog (optional, for cache hit logging)
CandleCacheEntry (many) --> PerformanceLog (optional, for cache hit logging)
```

## No Database Changes

**Note**: This feature does not add any database tables or migrations. All performance data is stored in-memory and can be exported as JSON for analysis. This aligns with the single-user context and keeps the feature lightweight.
