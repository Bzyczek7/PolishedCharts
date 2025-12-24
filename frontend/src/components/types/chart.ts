/**
 * Chart-related TypeScript types
 * Feature: 002-supercharts-visuals
 */

// Chart interval types
export type Interval = '1m' | '5m' | '15m' | '1h' | '1D';

/**
 * Open-High-Low-Close-Volume data for a single candle
 */
export interface OHLCV {
  time: number;                // Unix timestamp (milliseconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Complete chart theme with TradingView Supercharts dark theme colors
 */
export interface ChartTheme {
  background: string;           // #131722 (default dark)
  grid: {
    color: string;              // #2a2e39
    opacity: number;            // 0-100
    visible: boolean;           // true
  };
  candle: {
    up: {
      body: string;             // #26a69a (green)
      border: string;           // #26a69a
      wick: string;             // #26a69a
    };
    down: {
      body: string;             // #ef5350 (red)
      border: string;           // #ef5350
      wick: string;             // #ef5350
    };
  };
  volume: {
    up: string;                 // #26a69a (semi-transparent)
    down: string;               // #ef5350 (semi-transparent)
  };
  text: {
    primary: string;            // #d1d4dc
    secondary: string;          // #787b86
  };
  crosshair: {
    color: string;              // #758696
    labelBackground: string;    // #4c525e
    labelColor: string;         // #ffffff
  };
  lastPrice: {
    line: string;               // #363c4e
    labelBackground: string;    // chart color (green or red)
    labelColor: string;         // #ffffff
  };
  indicator: {
    lineColors: string[];       // Indicator line colors
  };
  drawing: {
    defaultColor: string;       // #ffff00 (yellow)
    selectedColor: string;      // #ffffff (white border)
  };
}

/**
 * Current chart state
 */
export interface ChartState {
  symbol: string;
  interval: Interval;
  zoom: {
    level: number;             // Zoom factor (1 = default, >1 = zoomed in)
    maxLevel: number;          // Maximum zoom
  };
  scroll: {
    position: number;          // Scroll position (0 = rightmost, 1 = leftmost)
    offset: number;            // Pixel offset from right edge
  };
  visibleTimeRange?: {
    from: number;              // Unix timestamp (ms)
    to: number;                // Unix timestamp (ms)
  };
  activeTool: ToolType;
  theme: ChartTheme;
  focusedPaneId: string;
  dataAvailable: boolean;
  loading: boolean;
  error?: string;
}

/**
 * Drawing tool types
 */
export type ToolType =
  | 'cursor'
  | 'trendline'
  | 'horizontal_line'
  | 'rectangle'
  | 'text';
