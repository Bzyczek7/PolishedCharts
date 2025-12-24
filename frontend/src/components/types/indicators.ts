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
  type: 'int' | 'float' | 'str';
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
    visible: boolean;          // true
    height: number;            // Percentage of chart height (default 25)
    position: number;          // Order in pane stack (1 = top indicator)
  };
  scaleRange?: {
    min: number;               // Fixed minimum (e.g., 0 for RSI)
    max: number;               // Fixed maximum (e.g., 100 for RSI)
    auto: boolean;             // true for auto-scale
  };
  focusState: 'focused' | 'active' | 'inactive';
}

/**
 * Common indicator presets
 */
export const INDICATOR_PRESETS: IndicatorType[] = [
  { category: 'oscillator', name: 'crsi', params: { period: 14 } },
  { category: 'oscillator', name: 'tdfi', params: { period: 14 } },
  { category: 'overlay', name: 'sma', params: { period: 20 } },
  { category: 'overlay', name: 'ema', params: { period: 20 } },
  { category: 'overlay', name: 'adxvma', params: { period: 14 } },
];
