/**
 * Drawing Tool Interface
 *
 * Defines the contract that all drawing tools must implement.
 * Tools are responsible for rendering themselves as SVG, detecting clicks/hover,
 * and providing drag handles for editing.
 */

/**
 * Drawing Tool - Main Interface
 *
 * Every drawing tool implements this interface to provide rendering,
 * hit detection, and interaction capabilities.
 */
export interface DrawingTool {
  /**
   * Render the drawing as SVG
   *
   * @param drawing - The drawing data to render
   * @param chartApi - Chart coordinate transformation API
   * @param isSelected - Whether this drawing is currently selected
   * @param isHovered - Whether this drawing is currently hovered
   * @returns React element (SVG)
   */
  render(
    drawing: Drawing,
    chartApi: ChartApi,
    isSelected: boolean,
    isHovered: boolean
  ): React.ReactNode;

  /**
   * Test if a point (e.g., mouse click) hits this drawing
   *
   * @param drawing - The drawing to test
   * @param point - The point to test (screen coordinates)
   * @param chartApi - Chart coordinate transformation API
   * @param tolerance - Hit detection tolerance in pixels (default: 5)
   * @returns true if the point hits the drawing
   */
  hitTest(
    drawing: Drawing,
    point: Point,
    chartApi: ChartApi,
    tolerance?: number
  ): boolean;

  /**
   * Get drag handles for this drawing
   *
   * Handles appear when a drawing is selected and allow resizing/moving.
   *
   * @param drawing - The drawing to get handles for
   * @param chartApi - Chart coordinate transformation API
   * @returns Array of handles (empty if no handles)
   */
  getHandles(
    drawing: Drawing,
    chartApi: ChartApi
  ): Handle[];

  /**
   * Calculate derived points for complex tools
   *
   * For tools like Fib retracement, channels, pitchforks that have
   * calculated points beyond the user's input points.
   *
   * @param drawing - The drawing to calculate for
   * @returns Array of calculated points with labels
   */
  calculatePoints?(drawing: Drawing): CalculatedPoint[];

  /**
   * Validate a point during creation
   *
   * Called as user clicks to add points. Allows tools to reject
   * invalid inputs (e.g., same point twice).
   *
   * @param drawing - The current drawing state
   * @param newPoint - The point being added
   * @returns true if the point is valid
   */
  validatePoint(drawing: Drawing, newPoint: Point): boolean;

  /**
   * Get default style for this tool type
   *
   * @returns Partial drawing style with defaults
   */
  getDefaultStyle(): Partial<DrawingStyle>;
}

/**
 * Chart API - Coordinate Transformation
 *
 * Abstraction over lightweight-charts coordinate system.
 * Provides bidirectional transformation between data coordinates
 * (time/price) and screen coordinates (x/y pixels).
 */
export interface ChartApi {
  /**
   * Convert time (Unix timestamp ms) to x-coordinate (pixels)
   */
  timeToX(time: number): number;

  /**
   * Convert price to y-coordinate (pixels)
   */
  priceToY(price: number): number;

  /**
   * Convert x-coordinate (pixels) to time
   * Returns null if x is outside chart bounds
   */
  xToTime(x: number): number | null;

  /**
   * Convert y-coordinate (pixels) to price
   * Returns null if y is outside chart bounds
   */
  yToPrice(y: number): number | null;

  /**
   * Get the currently visible time range
   */
  getVisibleTimeRange(): VisibleTimeRange;

  /**
   * Get the currently visible price range
   */
  getVisiblePriceRange(): VisiblePriceRange;

  /**
   * Get chart canvas width (pixels)
   */
  getWidth(): number;

  /**
   * Get chart canvas height (pixels)
   */
  getHeight(): number;

  /**
   * Subscribe to chart changes (zoom, pan)
   * @returns Unsubscribe function (call to remove listener)
   */
  subscribeToChanges(callback: () => void): () => void;
}

/**
 * Point in screen coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Point in data coordinates (optional time/price)
 */
export interface DataPoint {
  time?: number | null;
  price?: number | null;
}

/**
 * Drag handle for editing drawings
 */
export interface Handle {
  id: string;                  // 'start', 'end', 'control-1', etc.
  x: number;
  y: number;
  cursor: string;              // CSS cursor for this handle
  type: 'start' | 'end' | 'control';
}

/**
 * Calculated point (e.g., Fib level)
 */
export interface CalculatedPoint {
  time?: number | null;
  price?: number | null;
  x: number;
  y: number;
  label: string;               // e.g., "23.6%", "161.8%"
  isExtendable?: boolean;      // Whether this point extends to edge
}

/**
 * Visible time range
 */
export interface VisibleTimeRange {
  from: number;                // Unix timestamp (ms)
  to: number;                  // Unix timestamp (ms)
}

/**
 * Visible price range
 */
export interface VisiblePriceRange {
  min: number;
  max: number;
}

/**
 * Tool Identifier (imported from types.ts)
 * Re-imported here for convenience; actual definition is in types.ts
 */
export type ToolId =
  | 'cursor'
  | 'trend_line'
  | 'horizontal_line'
  | 'crosshair'
  | 'ray'
  | 'info_line'
  | 'extended_line'
  | 'trend_angle'
  | 'horizontal_ray'
  | 'vertical_line'
  | 'cross_line'
  | 'brush'
  | 'text'
  | 'rectangle'
  | 'parallel_channel'
  | 'regression_trend'
  | 'flat_top_bottom'
  | 'disjoint_channel'
  | 'pitchfork'
  | 'schiff_pitchfork'
  | 'modified_schiff_pitchfork'
  | 'inside_pitchfork'
  | 'fib_retracement'
  | 'fib_extension'
  | 'trend_based_fib_extension'
  | 'measurement'
  | 'lock_unlock'
  | 'show_hide_all'
  | 'delete_all';

/**
 * Drawing entity (simplified for contract)
 * See data-model.md for full definition
 */
export interface Drawing {
  id: string;
  symbol: string;
  toolId: ToolId;              // Type-safe tool identifier
  points: Array<DataPoint>;
  style: DrawingStyle;
  state: 'draft' | 'complete' | 'locked' | 'hidden';
  locked: boolean;
  hidden: boolean;
  createdAt: number;
  updatedAt: number;
  extension?: ToolExtension;
}

/**
 * Drawing style
 */
export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle?: 'solid' | 'dotted' | 'dashed';
  fillOpacity?: number;
  fontSize?: number;
}

/**
 * Tool extension (type discriminator)
 */
export type ToolExtension =
  | FibExtension
  | ChannelExtension
  | PitchforkExtension
  | BrushExtension
  | MeasurementExtension;

export interface FibExtension {
  levels: FibLevel[];
}

export interface FibLevel {
  ratio: number;
  price: number;
  label: string;
  showLabel: boolean;
}

export interface ChannelExtension {
  upperOffset: number;
  lowerOffset: number;
}

export interface PitchforkExtension {
  type: 'standard' | 'schiff' | 'modified_schiff' | 'inside';
  medianRatio: number;
}

export interface BrushExtension {
  simplifiedPoints: Point[];
  originalPointCount: number;
}

export interface MeasurementExtension {
  priceDelta: number;
  timeDelta: number;
  percentChange?: number;
  displayFormat: 'compact' | 'verbose';
}
