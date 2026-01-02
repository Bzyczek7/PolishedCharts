/**
 * Indicator-related TypeScript types
 * Feature: 002-supercharts-visuals, 003-advanced-indicators
 */

/**
 * Indicator category: overlay (on main chart) or oscillator (separate pane)
 */
export type IndicatorCategory = 'overlay' | 'oscillator';

/**
 * Indicator display type
 */
export type IndicatorDisplayType = 'overlay' | 'pane';

/**
 * Color mode for indicator rendering
 */
export type ColorMode = 'single' | 'gradient' | 'threshold' | 'trend';

/**
 * Line style for series
 */
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dashdot';

/**
 * Thresholds configuration for threshold-based coloring
 */
export interface ThresholdsConfig {
  upper?: number;
  lower?: number;
  high?: number;
  low?: number;
  zero?: number;
}

/**
 * Scale ranges configuration
 */
export interface ScaleRangesConfig {
  min?: number;
  max?: number;
  auto?: boolean;
}

/**
 * Metadata for a single series (line) in an indicator
 */
export interface SeriesMetadata {
  field: string;
  role: 'main' | 'signal' | 'band' | 'histogram';
  label: string;
  line_color: string;
  line_style: LineStyle;
  line_width: number;
  display_type?: 'line' | 'histogram' | 'area';
  price_scale?: string;
}

/**
 * Reference level (horizontal line on chart)
 */
export interface ReferenceLevel {
  value: number;
  line_color: string;
  line_label: string;
  line_style: LineStyle;
}

/**
 * Complete metadata for an indicator
 */
export interface IndicatorMetadata {
  display_type: IndicatorDisplayType;
  color_mode: ColorMode;
  color_schemes: Record<string, string>;
  thresholds?: ThresholdsConfig;
  scale_ranges?: ScaleRangesConfig;
  series_metadata: SeriesMetadata[];
  reference_levels?: ReferenceLevel[];
}

/**
 * Parameter definition for indicator configuration
 */
export interface ParameterDefinition {
  name: string;
  type: 'int' | 'integer' | 'float' | 'str';
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  description: string;
}

/**
 * Alert template for indicator-based alerts
 */
export interface AlertTemplate {
  condition: string;
  description: string;
  default_params?: Record<string, number | string>;
}

/**
 * Info about an available indicator
 */
export interface IndicatorInfo {
  name: string;
  description: string;
  category: IndicatorCategory;
  parameters: ParameterDefinition[] | Record<string, ParameterDefinition>;
  alert_templates?: AlertTemplate[];
  metadata?: IndicatorMetadata;
}

/**
 * Standardized output from indicator calculation
 */
export interface IndicatorOutput {
  symbol: string;
  interval: string;
  timestamps: number[];
  data: Record<string, (number | null)[]>;
  metadata: IndicatorMetadata;
  calculated_at: string;
  data_points: number;
}

/**
 * Indicator type with parameters (legacy)
 */
export interface IndicatorType {
  category: IndicatorCategory;
  name: string;                // 'sma', 'ema', 'tdfi', 'crsi', etc.
  params: Record<string, number | string>;
}

/**
 * Indicator pane state and configuration
 */
export interface IndicatorPane {
  id: string;                  // UUID
  indicatorType: IndicatorType;
  name: string;                // Display name (e.g., "SMA 20")
  displaySettings: {
    visible: boolean;          // true - USE THIS for visibility (not isVisible)
    height: number;            // Percentage of chart height (default 25)
    position: number;          // Order in pane stack (1 = top indicator)
  };
  scaleRange?: {
    min: number;               // Fixed minimum (e.g., 0 for RSI)
    max: number;               // Fixed maximum (e.g., 100 for RSI)
    auto: boolean;             // true for auto-scale
  };
  focusState: 'focused' | 'active' | 'inactive';
  // Phase 1: Visual styling (same as IndicatorInstance.style)
  // Uses existing displaySettings.visible for visibility - DO NOT add isVisible field
  style?: IndicatorStyle;
}

/**
 * Common indicator presets
 * Note: Uses 'length' for pandas-ta indicators (rsi, atr, sma, ema, bbands)
 * crsi uses 'period' as it's a custom indicator with different param names
 */
export const INDICATOR_PRESETS: IndicatorType[] = [
  { category: 'oscillator', name: 'crsi', params: { period: 14 } },
  { category: 'oscillator', name: 'tdfi', params: { lookback: 5, filter_high: 0.5, filter_low: -0.5 } },
  { category: 'overlay', name: 'sma', params: { length: 20 } },
  { category: 'overlay', name: 'ema', params: { length: 20 } },
  { category: 'overlay', name: 'adxvma', params: { adxvma_period: 15 } },
  { category: 'oscillator', name: 'rsi', params: { length: 14 } },
  { category: 'oscillator', name: 'atr', params: { length: 14 } },
  { category: 'oscillator', name: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
  { category: 'oscillator', name: 'bbands', params: { length: 20, std: 2.0 } },
];

// ============================================================================
// Feature 008: Overlay Indicator Rendering & Configuration UI
// TypeScript type definitions for indicator instance management and styling
// ============================================================================

/**
 * Visual styling properties for an indicator instance
 * Feature 008 - Data Model Entity 2
 */
export interface IndicatorStyle {
  /** Primary line color (hex format #RRGGBB) - used for single-series or as fallback */
  color: string;
  /** Line width in pixels (1-4) */
  lineWidth: number;
  /** Show the last value label on the price scale */
  showLastValue: boolean;
  /** Per-series color overrides (field name -> color) for multi-series indicators */
  seriesColors?: Record<string, string>;
  /** Reserved for future: dashed/dotted line styles (deferred to future enhancement) */
  // lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/**
 * Default indicator style (TradingView blue)
 * Feature 008 - Data Model
 */
export const DEFAULT_INDICATOR_STYLE: IndicatorStyle = {
  color: '#2962ff',
  lineWidth: 2,
  showLastValue: true,
} as const;

/**
 * Default color mapping by indicator type
 * Feature 008 - Data Model
 */
export const INDICATOR_DEFAULT_COLORS: Record<string, string> = {
  sma: '#ff6d00',      // orange
  ema: '#2962ff',      // blue
  tdfi: '#9e9e9e',     // gray
  adxvma: '#ff6d00',   // orange
  crsi: '#00bcd4',     // cyan
} as const;

/**
 * Indicator instance for per-instance styling and persistence
 * Feature 008 - Data Model Entity 1
 *
 * This extends the concept of IndicatorPane with additional styling capabilities
 * and uses the new localStorage schema (indicator_instance:${id})
 */
export interface IndicatorInstance {
  /** Unique identifier (UUID v4 format) */
  id: string;
  /** Symbol field removed - indicators are now global (not per-symbol) */
  /** Indicator type definition */
  indicatorType: {
    /** Only overlay indicators supported in Feature 008 */
    category: 'overlay';
    /** Indicator name: 'sma', 'ema', 'tdfi', 'adxvma' */
    name: string;
    /** Parameter values */
    params: Record<string, number | string>;
  };
  /** Human-readable display name (e.g., "SMA (20)", "EMA (50)") */
  displayName: string;
  /** Visual styling configuration */
  style: IndicatorStyle;
  /** Visibility state (hide without removing) */
  isVisible: boolean;
  /** Creation timestamp (ISO 8601 string) */
  createdAt: string;
}

/**
 * Maintains ordered list of indicator instances for a symbol
 * Feature 008 - Data Model Entity 3
 *
 * Storage: localStorage key `indicator_list:${symbol}`
 */
export interface IndicatorListIndex {
  /** Ordered list of instance IDs */
  instances: string[];
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Transient UI state for the settings dialog
 * Feature 008 - Data Model Entity 4
 *
 * Lifecycle: Component state only; not persisted to localStorage
 */
export interface IndicatorSettingsState {
  /** Currently editing instance ID */
  activeInstanceId: string | null;
  /** Currently active tab */
  activeTab: 'inputs' | 'style' | 'visibility';
  /** Pending parameter changes (not yet applied) */
  pendingParams: Record<string, number | string>;
  /** Pending style changes (not yet applied) */
  pendingStyle: Partial<IndicatorStyle>;
  /** Form validation errors */
  errors: Record<string, string>;
}

/**
 * Migration helper: Ensure IndicatorPane has default style
 * Phase 1: Provides default styling for existing indicators without style field
 *
 * @param pane - IndicatorPane to check/migrate
 * @returns IndicatorPane with guaranteed style field
 */
export function ensureIndicatorPaneStyle(pane: IndicatorPane): IndicatorPane {
  if (!pane.style) {
    const defaultColor = INDICATOR_DEFAULT_COLORS?.[pane.indicatorType.name.toLowerCase()]
      || DEFAULT_INDICATOR_STYLE.color;
    return {
      ...pane,
      style: { ...DEFAULT_INDICATOR_STYLE, color: defaultColor },
    };
  }
  return pane;
}
