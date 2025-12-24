/**
 * Drawing geometry utilities
 * Feature: 002-supercharts-visuals
 *
 * Provides coordinate conversion, hit detection, and bounds calculation
 * for drawing tools using lightweight-charts coordinate APIs.
 */

import type { Drawing } from '../components/types/drawings';

/**
 * Bounding box for a drawing
 */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate distance from a point to a line segment
 * Used for trendline hit detection
 */
export function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is inside a rectangle
 */
export function pointInRectangle(point: Point, rect: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): boolean {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Calculate bounding box for a drawing
 */
export function getDrawingBounds(drawing: Drawing, coordinates: {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}): Bounds | null {
  const { x1, y1, x2, y2 } = coordinates;

  if (x1 !== undefined && y1 !== undefined) {
    if (drawing.type === 'horizontal_line') {
      // Horizontal line extends infinitely in x direction
      // For hit detection, use a tolerance around y
      return {
        minX: 0,
        maxX: Number.MAX_VALUE,
        minY: y1 - 5,
        maxY: y1 + 5,
      };
    } else if (drawing.type === 'rectangle') {
      if (x2 !== undefined && y2 !== undefined) {
        return {
          minX: Math.min(x1, x2),
          maxX: Math.max(x1, x2),
          minY: Math.min(y1, y2),
          maxY: Math.max(y1, y2),
        };
      }
    } else if (drawing.type === 'trendline') {
      if (x2 !== undefined && y2 !== undefined) {
        // Add padding for line thickness
        const padding = drawing.lineWidth + 2;
        return {
          minX: Math.min(x1, x2) - padding,
          maxX: Math.max(x1, x2) + padding,
          minY: Math.min(y1, y2) - padding,
          maxY: Math.max(y1, y2) + padding,
        };
      }
    }
  }

  return null;
}

/**
 * Check if a point hits a drawing (for selection/hover)
 */
export function hitTestDrawing(
  point: Point,
  drawing: Drawing,
  screenCoordinates: {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }
): boolean {
  const bounds = getDrawingBounds(drawing, screenCoordinates);
  if (!bounds) {
    return false;
  }

  if (drawing.type === 'rectangle') {
    return pointInRectangle(point, {
      x1: screenCoordinates.x1 || 0,
      y1: screenCoordinates.y1 || 0,
      x2: screenCoordinates.x2 || 0,
      y2: screenCoordinates.y2 || 0,
    });
  } else if (drawing.type === 'trendline') {
    if (screenCoordinates.x1 && screenCoordinates.y1 && screenCoordinates.x2 && screenCoordinates.y2) {
      const dist = pointToLineDistance(
        point,
        { x: screenCoordinates.x1, y: screenCoordinates.y1 },
        { x: screenCoordinates.x2, y: screenCoordinates.y2 }
      );
      return dist <= (drawing.lineWidth + 3);
    }
  } else if (drawing.type === 'horizontal_line') {
    if (screenCoordinates.y1 !== undefined) {
      return Math.abs(point.y - screenCoordinates.y1) <= (drawing.lineWidth + 3);
    }
  }

  return false;
}

/**
 * Check if point hits a drawing endpoint (for dragging handles)
 */
export function hitTestDrawingHandle(
  point: Point,
  screenX: number,
  screenY: number,
  handleRadius: number = 5
): boolean {
  return distance(point, { x: screenX, y: screenY }) <= handleRadius;
}

/**
 * Calculate handle positions for a drawing
 */
export function getDrawingHandles(drawing: Drawing, coordinates: {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}): Point[] {
  const handles: Point[] = [];

  if (drawing.type === 'trendline' || drawing.type === 'horizontal_line') {
    if (coordinates.x1 !== undefined && coordinates.y1 !== undefined) {
      handles.push({ x: coordinates.x1, y: coordinates.y1 });
    }
  }

  if (drawing.type === 'trendline' || drawing.type === 'rectangle') {
    if (coordinates.x2 !== undefined && coordinates.y2 !== undefined) {
      handles.push({ x: coordinates.x2, y: coordinates.y2 });
    }
  }

  return handles;
}
