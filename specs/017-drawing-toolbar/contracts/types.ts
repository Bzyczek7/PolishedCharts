/**
 * Type Definitions for Drawing Toolbar
 *
 * Central type definitions for the drawing toolbar feature.
 * These types are used throughout the frontend codebase.
 */

/**
 * Tool Identifier
 *
 * All 29 drawing tools + 3 action buttons
 */
export type ToolId =
  // Basic (5)
  | 'cursor'
  | 'trend_line'
  | 'horizontal_line'
  | 'crosshair'
  // Lines (7)
  | 'ray'
  | 'info_line'
  | 'extended_line'
  | 'trend_angle'
  | 'horizontal_ray'
  | 'vertical_line'
  | 'cross_line'
  // Annotations (3)
  | 'brush'
  | 'text'
  | 'rectangle'
  // Channels (4)
  | 'parallel_channel'
  | 'regression_trend'
  | 'flat_top_bottom'
  | 'disjoint_channel'
  // Pitchforks (4)
  | 'pitchfork'
  | 'schiff_pitchfork'
  | 'modified_schiff_pitchfork'
  | 'inside_pitchfork'
  // Projections (3)
  | 'fib_retracement'
  | 'fib_extension'
  | 'trend_based_fib_extension'
  // Advanced (1)
  | 'measurement'
  // Actions (3)
  | 'lock_unlock'
  | 'show_hide_all'
  | 'delete_all';

/**
 * Drawing Type (alias for ToolId)
 *
 * Kept for backwards compatibility with existing code
 */
export type DrawingType = ToolId;

/**
 * Tool Category
 *
 * Used for grouping tools in the toolbar and flyout menus
 */
export type ToolCategory =
  | 'basic'      // Cursor, Crosshair
  | 'lines'      // All line tools
  | 'annotation' // Brush, Text, Rectangle
  | 'channels'   // Channel tools
  | 'pitchforks' // Pitchfork tools
  | 'projections' // Fib tools
  | 'advanced'   // Measurement
  | 'actions';   // Lock/Unlock, Show/Hide, Delete

/**
 * Drawing State
 *
 * Represents the lifecycle state of a drawing
 */
export type DrawingState =
  | 'draft'     // Currently being created
  | 'complete'  // Finished, can be edited
  | 'locked'    // Immutable
  | 'hidden';   // Not rendered

/**
 * Line Style
 *
 * Visual style for line drawings
 */
export type LineStyle = 'solid' | 'dotted' | 'dashed';

/**
 * Drawing Tool Configuration
 *
 * Configuration for a single drawing tool type
 */
export interface DrawingToolConfig {
  // Identity
  id: ToolId;
  label: string;
  category: ToolCategory;

  // UI
  icon: string;                 // Lucide icon name (e.g., 'MousePointer', 'Minus')
  iconName: string;             // Alias for icon (for clarity in code)
  cursor: CSSCursor;

  // Keyboard
  keyboardShortcut?: string;    // e.g., 'Alt+T'

  // Geometry
  minPoints: number;            // Minimum clicks to create (1-5)
  maxPoints: number;            // Maximum control points (1-5)

  // Flyout
  flyout?: string;              // Parent flyout menu ID (if sub-tool)
  flyoutIndex?: number;         // Order within flyout

  // Defaults
  defaultStyle: Partial<DrawingStyle>;

  // Metadata
  enabled: boolean;
}

/**
 * CSS Cursor Type
 */
export type CSSCursor =
  | 'crosshair'
  | 'pointer'
  | 'text'
  | 'move'
  | 'nwse-resize'
  | 'nesw-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'default'
  | 'grab'
  | 'grabbing';

/**
 * Drawing Point (data coordinates)
 *
 * A point can have time, price, or both
 */
export interface DrawingPoint {
  time?: number | null;        // Unix timestamp (ms) or null for price-only
  price?: number | null;       // Price or null for time-only
}

/**
 * Drawing Style
 *
 * Visual appearance of a drawing
 */
export interface DrawingStyle {
  color: string;               // Hex color (default: #ffff00)
  lineWidth: number;           // 1-4px
  lineStyle?: LineStyle;        // 'solid' | 'dotted' | 'dashed'
  fillOpacity?: number;        // 0-100 for rectangles/channels
  fontSize?: number;           // For text (default: 12)
  locked?: boolean;            // If true, style cannot be changed
}

/**
 * Drawing Entity
 *
 * Represents a single drawing annotation on the chart
 */
export interface Drawing {
  // Identity
  id: string;                  // UUID v4
  symbol: string;              // Stock symbol (e.g., 'AAPL')
  toolId: ToolId;              // Tool type

  // Geometry
  points: DrawingPoint[];      // 1-5 control points

  // Styling
  style: DrawingStyle;

  // State
  state: DrawingState;
  locked: boolean;
  hidden: boolean;

  // Metadata
  createdAt: number;           // Unix timestamp (ms)
  updatedAt: number;           // Unix timestamp (ms)

  // Tool-specific extension
  extension?: ToolExtension;
}

/**
 * Tool Extension Types
 *
 * Additional data for specific tool types
 */
export type ToolExtension =
  | FibExtension
  | ChannelExtension
  | PitchforkExtension
  | BrushExtension
  | MeasurementExtension;

/**
 * Fibonacci Extension
 */
export interface FibExtension {
  levels: FibLevel[];
  customLevels?: number[];      // Future: custom Fib ratios
}

/**
 * Fibonacci Level
 */
export interface FibLevel {
  ratio: number;               // e.g., 0.236, 0.382, 0.5, 0.618
  price: number;               // Calculated price
  label: string;               // e.g., "23.6%"
  showLabel: boolean;          // Whether to display label
}

/**
 * Channel Extension
 */
export interface ChannelExtension {
  upperOffset: number;         // Price offset for upper line
  lowerOffset: number;         // Price offset for lower line
}

/**
 * Pitchfork Extension
 */
export interface PitchforkExtension {
  type: 'standard' | 'schiff' | 'modified_schiff' | 'inside';
  medianRatio: number;         // Schiff uses 0.5, others use 1.0
}

/**
 * Brush Extension
 */
export interface BrushExtension {
  simplifiedPoints: Point[];   // After Douglas-Peucker simplification
  originalPointCount: number;  // For reference
}

/**
 * Measurement Extension
 */
export interface MeasurementExtension {
  priceDelta: number;          // Price difference
  timeDelta: number;           // Time difference (ms)
  percentChange?: number;      // Percentage change (if applicable)
  displayFormat: 'compact' | 'verbose';
}

/**
 * Point (screen coordinates)
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Flyout Menu Configuration
 */
export interface FlyoutMenuConfig {
  id: string;                  // e.g., 'lines', 'channels'
  label: string;               // For accessibility
  tools: ToolId[];             // Tools in this flyout
  icon?: string;               // Lucide icon name for parent button
  keyboardShortcut?: string;   // Shortcut for primary tool
}

/**
 * Drawing State Context
 *
 * React Context value for managing drawing state
 */
export interface DrawingStateContextValue {
  // Tool selection
  selectedTool: ToolId;
  setSelectedTool: (tool: ToolId) => void;

  // Active drawing (being created)
  activeDrawing: Drawing | null;
  setActiveDrawing: (drawing: Drawing | null) => void;

  // All drawings for current symbol
  drawings: Drawing[];

  // CRUD operations
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;

  // Selection/hover state
  selectedDrawing: Drawing | null;
  setSelectedDrawing: (drawing: Drawing | null) => void;
  hoveredDrawing: Drawing | null;
  setHoveredDrawing: (drawing: Drawing | null) => void;

  // Bulk actions
  lockAllDrawings: () => void;
  unlockAllDrawings: () => void;
  hideAllDrawings: () => void;
  showAllDrawings: () => void;
  deleteAllDrawings: () => void;

  // Symbol management
  loadDrawingsForSymbol: (symbol: string) => void;
  clearDrawings: () => void;

  // Chart API reference
  chartApi: ChartApi | null;
  setChartApi: (api: ChartApi | null) => void;
}

/**
 * Chart API (coordinate transformation)
 *
 * Abstraction over lightweight-charts
 */
export interface ChartApi {
  timeToX(time: number): number;
  priceToY(price: number): number;
  xToTime(x: number): number | null;
  yToPrice(y: number): number | null;
  getVisibleTimeRange(): VisibleTimeRange;
  getVisiblePriceRange(): VisiblePriceRange;
  getWidth(): number;
  getHeight(): number;
  /**
   * Subscribe to chart changes (zoom, pan)
   * @returns Unsubscribe function (call to remove listener)
   */
  subscribeToChanges(callback: () => void): () => void;
}

/**
 * Visible Time Range
 */
export interface VisibleTimeRange {
  from: number;
  to: number;
}

/**
 * Visible Price Range
 */
export interface VisiblePriceRange {
  min: number;
  max: number;
}

/**
 * Drag Handle
 *
 * Handle for resizing/moving drawings
 */
export interface Handle {
  id: string;                  // 'start', 'end', 'control-1', etc.
  x: number;
  y: number;
  cursor: string;
  type: 'start' | 'end' | 'control';
}

/**
 * Calculated Point
 *
 * Derived point (e.g., Fib level)
 */
export interface CalculatedPoint {
  time?: number | null;
  price?: number | null;
  x: number;
  y: number;
  label: string;
  isExtendable?: boolean;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Keyboard Shortcut Map
 *
 * Maps keyboard shortcuts to tool IDs
 */
export interface KeyboardShortcutMap {
  [shortcut: string]: ToolId;  // e.g., 'Alt+T': 'trend_line'
}

/**
 * Tool Button Props
 *
 * Props for the reusable ToolButton component
 */
export interface ToolButtonProps {
  tool: DrawingToolConfig;
  isSelected: boolean;
  isFlyoutParent?: boolean;
  onClick: () => void;
  onLongPress?: () => void;
}

/**
 * Flyout Menu Props
 */
export interface FlyoutMenuProps {
  config: FlyoutMenuConfig;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTool: (toolId: ToolId) => void;
  selectedTool: ToolId;
}
