/**
 * API Contracts for TradingView Supercharts Dark Theme UI
 *
 * These TypeScript interfaces define the contracts between:
 * - Frontend components (props and context interfaces)
 * - Backend API (request/response schemas)
 *
 * Feature: 002-supercharts-visuals
 * Date: 2025-12-23
 */

// ============================================================================
// FRONTEND-INTERNAL CONTRACTS
// ============================================================================

/**
 * Props for the main ChartContainer component
 */
export interface IChartContainerProps {
  symbol: string;
  interval: Interval;
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: Interval) => void;
}

/**
 * Props for individual indicator panes
 */
export interface IIndicatorPaneProps {
  id: string;
  indicator: IndicatorType;
  height: number; // Percentage of chart height
  position: number; // Order in pane stack
  onFocus: () => void;
  onClose: () => void;
  focusState: 'focused' | 'active' | 'inactive';
}

/**
 * Interface that all drawing tools must implement
 */
export interface IDrawingTool {
  type: DrawingType;
  handleClick: (time: number, price: number, paneId: string) => void;
  handleMouseMove: (time: number, price: number, paneId: string) => void;
  handleDoubleClick?: () => void;
  renderPreview?: () => JSX.Element | null;
  cancel?: () => void;
}

/**
 * Theme settings interface
 */
export interface IThemeSettings {
  backgroundBrightness: number; // 0-100
  grid: {
    visible: boolean;
    opacity: number; // 0-100
  };
  candleColors: {
    up: string; // Hex
    down: string; // Hex
  };
  scaleSettings: {
    showLastPriceLine: boolean;
    showLastPriceLabel: boolean;
    showTimeLabels: boolean;
    showPriceLabels: boolean;
  };
}

// ============================================================================
// BACKEND API CONTRACTS
// ============================================================================

/**
 * Request: GET /api/v1/candles/{symbol}
 * Query params: interval, local_only
 */
export interface ICandlesRequest {
  symbol: string;
  interval: Interval;
  local_only?: boolean; // If true, only return cached data
}

/**
 * Response: GET /api/v1/candles/{symbol}
 */
export interface ICandlesResponse {
  symbol: string;
  interval: Interval;
  candles: ICandleData[];
  metadata: {
    from: number; // Unix timestamp (ms)
    to: number; // Unix timestamp (ms)
    count: number;
    has_gaps: boolean;
  };
}

/**
 * Single candle data point
 */
export interface ICandleData {
  time: number; // Unix timestamp (ms) for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Request: GET /api/v1/indicators/{symbol}/{indicator_name}
 * Query params: interval, indicator-specific params
 */
export interface IIndicatorRequest {
  symbol: string;
  indicatorName: string; // 'rsi', 'macd', 'sma', etc.
  interval: Interval;
  params?: Record<string, number | string>; // e.g., { period: 14 }
}

/**
 * Response: GET /api/v1/indicators/{symbol}/{indicator_name}
 */
export interface IIndicatorResponse {
  symbol: string;
  indicatorName: string;
  interval: Interval;
  data: IIndicatorDataPoint[];
  metadata: {
    params: Record<string, number | string>;
    from: number;
    to: number;
    count: number;
  };
}

/**
 * Single indicator data point
 * Format varies by indicator type
 */
export interface IIndicatorDataPoint {
  time: number; // Unix timestamp (ms) - aligned to candle times

  // RSI: { value }
  // MACD: { macd, signal, histogram }
  // SMA/EMA: { value }
  // Stochastic: { k, d }
  // BB: { upper, middle, lower }
  [key: string]: number | undefined;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Supported chart intervals
 */
export type Interval = '1m' | '5m' | '15m' | '1h' | '1D';

/**
 * Drawing types
 */
export type DrawingType =
  | 'trendline'
  | 'horizontal_line'
  | 'rectangle'
  | 'text';

/**
 * Tool types (toolbar selection)
 */
export type ToolType =
  | 'cursor'
  | 'trendline'
  | 'horizontal_line'
  | 'rectangle'
  | 'text';

/**
 * Indicator categories
 */
export type IndicatorCategory = 'overlay' | 'oscillator';

/**
 * Indicator type definition
 */
export interface IndicatorType {
  category: IndicatorCategory;
  name: string;
  params: Record<string, number | string>;
}

/**
 * Drawing entity
 */
export interface Drawing {
  id: string;
  type: DrawingType;
  time1?: number;
  price1?: number;
  time2?: number;
  price2?: number;
  color: string;
  lineWidth: number;
  fillOpacity?: number;
  zIndex?: number;
  text?: string;
  fontSize?: number;
  paneId: string;
}

/**
 * Chart theme colors
 */
export interface ChartTheme {
  background: string;
  grid: {
    color: string;
    opacity: number;
    visible: boolean;
  };
  candle: {
    up: { body: string; border: string; wick: string };
    down: { body: string; border: string; wick: string };
  };
  volume: {
    up: string;
    down: string;
  };
  text: {
    primary: string;
    secondary: string;
  };
  crosshair: {
    color: string;
    labelBackground: string;
    labelColor: string;
  };
  lastPrice: {
    line: string;
    labelBackground: string;
    labelColor: string;
  };
  indicator: {
    lineColors: string[];
  };
  drawing: {
    defaultColor: string;
    selectedColor: string;
  };
}

/**
 * Chart state
 */
export interface ChartState {
  symbol: string;
  interval: Interval;
  zoom: { level: number; maxLevel: number };
  scroll: { position: number; offset: number };
  visibleTimeRange?: { from: number; to: number };
  activeTool: ToolType;
  theme: ChartTheme;
  focusedPaneId: string;
  dataAvailable: boolean;
  loading: boolean;
  error?: string;
}

/**
 * Crosshair state (synchronized across panes)
 */
export interface CrosshairState {
  visible: boolean;
  timeIndex?: number;
  price?: number;
  sourcePaneId?: string;
}

/**
 * Drawing state
 */
export interface DrawingState {
  selectedTool: ToolType;
  activeDrawing: {
    type: DrawingType;
    step: number;
    tempData?: Partial<Drawing>;
  };
  drawings: Drawing[];
  hoveredDrawing?: Drawing;
  selectedDrawing?: Drawing;
}

/**
 * Indicator pane state
 */
export interface IndicatorPane {
  id: string;
  indicatorType: IndicatorType;
  name: string;
  displaySettings: {
    visible: boolean;
    height: number;
    position: number;
  };
  scaleRange?: {
    min: number;
    max: number;
    auto: boolean;
  };
  focusState: 'focused' | 'active' | 'inactive';
}
