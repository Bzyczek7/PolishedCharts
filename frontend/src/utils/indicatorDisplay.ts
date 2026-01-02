/**
 * Shared indicator display formatting utilities
 * Feature: 010-pandas-ta-indicators (Phase 2 UI fixes)
 *
 * Provides consistent formatting for indicator names and parameters
 * across all UI components (IndicatorDialog, IndicatorToolbar, IndicatorSearch, etc.)
 */

import type { IndicatorInfo, IndicatorPane, IndicatorInstance } from '@/components/types/indicators';

/**
 * Parameter value types for formatting
 */
type ParamValue = number | string | null | undefined;

/**
 * Parameters record type
 */
type ParamsRecord = Record<string, ParamValue>;

/**
 * Get the display title for an indicator
 * Priority: metadata.series_metadata[0].label > base_name.toUpperCase() > indicator.name
 *
 * @param indicator - Indicator info from API or local state
 * @returns Human-readable display name
 */
export function getIndicatorTitle(indicator: IndicatorInfo | IndicatorPane | IndicatorInstance): string {
  // Check if indicator has metadata with series_metadata
  const metadata = 'metadata' in indicator ? (indicator as any).metadata : null;

  if (metadata && metadata.series_metadata && metadata.series_metadata.length > 0) {
    const firstSeries = metadata.series_metadata[0];
    if (firstSeries?.label) {
      return firstSeries.label;
    }
  }

  // Fallback: use base_name from indicatorType or name uppercase
  let name: string;
  if ('indicatorType' in indicator) {
    // IndicatorPane
    name = (indicator as IndicatorPane).indicatorType.name;
  } else if ('name' in indicator) {
    // IndicatorInfo has direct 'name' property
    name = (indicator as IndicatorInfo).name;
  } else {
    // IndicatorInstance - use displayName
    name = (indicator as IndicatorInstance).displayName || 'INDICATOR';
  }

  return name.toUpperCase();
}

/**
 * Get display name for an indicator pane (e.g., "SMA 20")
 * Combines indicator type name with period parameter if present
 *
 * @param pane - IndicatorPane from context
 * @returns Human-readable display name
 */
export function getIndicatorPaneDisplayName(pane: IndicatorPane): string {
  const { name, indicatorType } = pane;
  const { params } = indicatorType;

  // Extract period if present
  const period = params.period || params.length || null;

  if (period) {
    return `${name.toUpperCase()} ${period}`;
  }

  // For indicators without period, just return the name
  return name.toUpperCase();
}

/**
 * Format indicator parameters for display
 * Filters out null, undefined, and default/zero values
 *
 * @param params - Parameter record
 * @returns Formatted parameter string (e.g., "(period=14)" or empty string)
 */
export function formatIndicatorParams(params: ParamsRecord): string {
  // Filter out null, undefined, and zero/empty values
  const meaningfulParams = Object.entries(params).filter(([key, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    // Filter out common defaults
    if (typeof value === 'number') {
      // Filter out zero values and common defaults
      if (value === 0) return false;
      // Filter common default values for specific keys
      const defaultZeroKeys = ['offset', 'drift', 'signal'];
      if (defaultZeroKeys.includes(key) && value === 0) return false;
    }
    if (typeof value === 'string' && value === '') {
      return false;
    }
    return true;
  });

  if (meaningfulParams.length === 0) {
    return '';
  }

  const formatted = meaningfulParams
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  return `(${formatted})`;
}

/**
 * Get a compact display string for an indicator (title + params)
 * Used in tight spaces like toolbar buttons
 *
 * @param indicator - Indicator info
 * @returns Compact display string
 */
export function getCompactIndicatorDisplay(indicator: IndicatorInfo | IndicatorPane): string {
  const title = getIndicatorTitle(indicator);
  let params = '';
  if ('indicatorType' in indicator) {
    params = formatIndicatorParams((indicator as IndicatorPane).indicatorType.params);
  } else {
    // IndicatorInfo - extract values from parameter definitions
    params = formatIndicatorParams(extractParameterValues(indicator.parameters as any));
  }
  return `${title} ${params}`.trim();
}

/**
 * Check if a parameter should be shown in display
 * Helper for filtering out default/null parameters
 *
 * @param key - Parameter name
 * @param value - Parameter value
 * @returns true if parameter should be displayed
 */
export function shouldShowParameter(key: string, value: ParamValue): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number' && value === 0) {
    // Filter out common offset/drift defaults
    const defaultZeroKeys = ['offset', 'drift', 'signal', 'anchor'];
    if (defaultZeroKeys.includes(key)) {
      return false;
    }
  }
  return true;
}

/**
 * Get parameter display value (formatted for UI)
 *
 * @param value - Parameter value
 * @returns Formatted value string
 */
export function formatParameterValue(value: ParamValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    // Format numbers nicely (no decimals for integers)
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

/**
 * Parse parameter definitions from API response
 * Handles both array and object formats
 *
 * @param params - Parameters from API (either array or record)
 * @returns Record of parameter name -> value
 */
export function extractParameterValues(
  params: Array<{ name: string; default: ParamValue }> | Record<string, any> | undefined
): ParamsRecord {
  if (!params) {
    return {};
  }

  if (Array.isArray(params)) {
    const result: ParamsRecord = {};
    for (const param of params) {
      result[param.name] = param.default;
    }
    return result;
  }

  // Handle object format: { "period": { "default": 14, ... }, ... }
  const result: ParamsRecord = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'object' && value !== null && 'default' in value) {
      result[key] = (value as any).default;
    } else {
      result[key] = value as ParamValue;
    }
  }
  return result;
}
