/**
 * React context-related TypeScript types
 * Feature: 002-supercharts-visuals
 */

import type { ChartState, ToolType } from './chart';
import type { Drawing } from './drawings';

/**
 * Synchronized crosshair state across all panes
 */
export interface CrosshairState {
  visible: boolean;
  timeIndex?: number;          // Time index for vertical line position
  price?: number;              // Price for horizontal line position (main pane only)
  sourcePaneId?: string;       // Which pane triggered the crosshair
}

/**
 * Props for the main chart container component
 */
export interface IChartContainerProps {
  symbol: string;
  interval: string;
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
}

/**
 * Props for individual indicator panes
 */
export interface IIndicatorPaneProps {
  id: string;
  indicator: any;             // IndicatorType
  height: number;             // Percentage of chart height
  position: number;           // Order in pane stack
  onFocus: () => void;
  onClose: () => void;
  focusState: 'focused' | 'active' | 'inactive';
}

/**
 * Interface that all drawing tools must implement
 */
export interface IDrawingTool {
  type: string;                // Drawing type
  handleClick: (time: number, price: number, paneId: string) => void;
  handleMouseMove: (time: number, price: number, paneId: string) => void;
  handleDoubleClick?: () => void;
  renderPreview?: () => React.ReactNode | null;
  cancel?: () => void;
}
