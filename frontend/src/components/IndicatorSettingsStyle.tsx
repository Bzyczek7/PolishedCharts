/**
 * IndicatorSettingsStyle component - Style tab for indicator customization
 * Feature: 008-overlay-indicator-rendering
 * Task: T021 [P] [US2]
 *
 * Provides UI for customizing indicator visual appearance:
 * - Color selection with native color picker and presets
 * - Per-series color customization for multi-series indicators (cRSI, etc.)
 * - Trend-based color customization for indicators with signal fields (ADXVMA, etc.)
 * - Line width selection (1-4 pixels)
 * - Show/hide last value on price scale
 *
 * All changes apply immediately without confirmation (per T024/US2 requirements).
 */

import { useCallback, useMemo } from 'react';
import { ColorPicker, ColorPickerWithPresets } from './ColorPicker';
import type { IndicatorInstance, IndicatorStyle } from './types/indicators';
import type { IndicatorMetadata } from './types/indicators';

/** Series metadata from backend indicator metadata */
export interface SeriesMetadata {
  field: string;
  label: string;
  line_color: string;
  role: string;
}

interface IndicatorSettingsStyleProps {
  /** The indicator instance being edited */
  instance: IndicatorInstance;
  /** Callback when style changes - receives updated style object */
  onStyleChange: (style: Partial<IndicatorStyle>) => void;
  /** Disable all inputs (e.g., while loading) */
  disabled?: boolean;
  /** Show label headers for each control group */
  showLabels?: boolean;
  /** CSS class name for styling */
  className?: string;
  /** Series metadata from backend for multi-series color customization */
  seriesMetadata?: SeriesMetadata[];
  /** Full indicator metadata for trend mode detection */
  indicatorMetadata?: IndicatorMetadata;
}

/**
 * Line width options (1-4 pixels as per spec)
 */
const LINE_WIDTH_OPTIONS = [1, 2, 3, 4] as const;

/**
 * Get displayable series for color customization
 * Filter out signal series (except for single-color mode) and sort: main first, then bands, then others
 */
function useDisplayableSeries(
  metadata?: SeriesMetadata[],
  colorMode?: string  // Pass color_mode to determine signal handling
) {
  return useMemo(() => {
    if (!metadata || metadata.length <= 1) return null;

    // Filter signal series based on color mode:
    // - For single-color mode (MACD): signal lines are visible and customizable
    // - For threshold/trend modes: signal is internal use only, not displayed
    const filtered = metadata.filter(m => {
      if (m.role === 'signal') {
        return colorMode === 'single';  // Keep signal only for single-color mode
      }
      return true;
    });

    // Sort: main first, then bands, then histograms, then others
    const sorted = filtered.sort((a, b) => {
      const getOrder = (role: string) => {
        if (role === 'main') return 0;
        if (role === 'band') return 1;
        if (role === 'histogram') return 2;
        return 3;
      };
      return getOrder(a.role) - getOrder(b.role);
    });

    return sorted.length > 0 ? sorted : null;
  }, [metadata, colorMode]);
}

/**
 * IndicatorSettingsStyle component
 * T021 [P] [US2]: Style tab for color, lineWidth, showLastValue customization
 */
export function IndicatorSettingsStyle({
  instance,
  onStyleChange,
  disabled = false,
  showLabels = true,
  className = '',
  seriesMetadata,
  indicatorMetadata,
}: IndicatorSettingsStyleProps) {
  const { style } = instance;
  const displayableSeries = useDisplayableSeries(seriesMetadata, indicatorMetadata?.color_mode);

  // Detect if this is a trend mode indicator (has signal field)
  const isTrendMode = useMemo(() => {
    return indicatorMetadata?.color_mode === 'trend' &&
           seriesMetadata?.some(s => s.role === 'signal');
  }, [indicatorMetadata, seriesMetadata]);

  /**
   * Handle color change for a specific series
   * Applies immediately (no confirmation per T024)
   */
  const handleSeriesColorChange = useCallback(
    (field: string, isMain: boolean, color: string) => {
      const styleUpdate = isMain
        ? { color }
        : {
            seriesColors: {
              ...(style.seriesColors || {}),
              [field]: color,
            },
          };

      onStyleChange(styleUpdate);
    },
    [onStyleChange, style.seriesColors]
  );

  /**
   * Handle trend color change (bullish/neutral/bearish)
   * Applies immediately (no confirmation per T024)
   */
  const handleTrendColorChange = useCallback(
    (trendType: 'bullish' | 'neutral' | 'bearish', color: string) => {
      onStyleChange({
        seriesColors: {
          ...(style.seriesColors || {}),
          [trendType]: color,
        },
      });
    },
    [onStyleChange, style.seriesColors]
  );

  /**
   * Handle primary color change (fallback for single-series or main)
   * Applies immediately (no confirmation per T024)
   */
  const handleColorChange = useCallback(
    (color: string) => {
      onStyleChange({ color });
    },
    [onStyleChange]
  );

  /**
   * Handle line width change
   * Applies immediately (no confirmation per T024)
   */
  const handleLineWidthChange = useCallback(
    (lineWidth: number) => {
      onStyleChange({ lineWidth });
    },
    [onStyleChange]
  );

  /**
   * Handle show last value toggle
   * Applies immediately (no confirmation per T024)
   */
  const handleShowLastValueChange = useCallback(
    (showLastValue: boolean) => {
      onStyleChange({ showLastValue });
    },
    [onStyleChange]
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Trend Mode Color Selection (ADXVMA, etc.) */}
      {isTrendMode ? (
        <div className="space-y-4">
          {showLabels && (
            <label className="text-sm font-medium text-slate-300">
              Trend Colors
            </label>
          )}
          <div className="space-y-3">
            {[
              { key: 'bullish', label: 'Bullish (Up)', default: '#00FF00' },
              { key: 'neutral', label: 'Neutral (Flat)', default: '#FFFF00' },
              { key: 'bearish', label: 'Bearish (Down)', default: '#ef5350' },
            ].map(({ key, label, default: defaultColor }) => {
              const currentColor = style.seriesColors?.[key] ||
                indicatorMetadata?.color_schemes?.[key] ||
                defaultColor;

              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: currentColor }}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-slate-300">
                      {label}
                    </span>
                  </div>
                  <ColorPicker
                    value={currentColor}
                    onChange={(color) => handleTrendColorChange(key as 'bullish' | 'neutral' | 'bearish', color)}
                    disabled={disabled}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            Colors for uptrend, neutral, and downtrend states
          </p>
        </div>
      ) : displayableSeries ? (
        /* Multi-Series Color Selection (non-trend) */
        <div className="space-y-4">
          {showLabels && (
            <label className="text-sm font-medium text-slate-300">
              Series Colors
            </label>
          )}
          <div className="space-y-3">
            {displayableSeries.map((series) => {
              const isMain = series.role === 'main';
              // Use seriesColors override if available, otherwise use metadata default
              const currentColor = isMain
                ? style.color
                : (style.seriesColors?.[series.field] || series.line_color);

              return (
                <div key={series.field} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: currentColor }}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-slate-300">
                      {series.label}
                    </span>
                    {isMain && (
                      <span className="text-xs text-slate-500">(main)</span>
                    )}
                  </div>
                  <ColorPicker
                    value={currentColor}
                    onChange={(color) => handleSeriesColorChange(series.field, isMain, color)}
                    disabled={disabled}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            Customize color for each series
          </p>
        </div>
      ) : (
        /* Single Color Selection */
        <div className="space-y-3">
          {showLabels && (
            <label className="text-sm font-medium text-slate-300">
              Line Color
            </label>
          )}
          <ColorPickerWithPresets
            value={style.color}
            onChange={handleColorChange}
            disabled={disabled}
            showPresets={true}
          />
        </div>
      )}

      {/* Line Width Selection */}
      <div className="space-y-3">
        {showLabels && (
          <label className="text-sm font-medium text-slate-300">
            Line Width
          </label>
        )}
        <div className="flex items-center gap-2">
          {LINE_WIDTH_OPTIONS.map((width) => (
            <button
              key={width}
              type="button"
              onClick={() => handleLineWidthChange(width)}
              disabled={disabled}
              className={`
                relative w-12 h-12 rounded-lg border-2 transition-all
                ${disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:border-slate-400 active:scale-95'
                }
                ${
                  style.lineWidth === width
                    ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                    : 'border-slate-600 bg-slate-800'
                }
              `}
              aria-label={`Line width ${width} pixel${width !== 1 ? 's' : ''}`}
              aria-pressed={style.lineWidth === width}
            >
              {/* Preview line */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="bg-current"
                  style={{
                    width: '70%',
                    height: `${width}px`,
                    backgroundColor: style.color,
                  }}
                />
              </div>
              {/* Width label */}
              <span className="absolute bottom-1 right-1 text-xs font-mono text-slate-400">
                {width}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Line width in pixels (1-4)
        </p>
      </div>

      {/* Show Last Value Toggle */}
      <div className="space-y-3">
        {showLabels && (
          <label className="text-sm font-medium text-slate-300">
            Last Value Label
          </label>
        )}
        <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-600">
          <div className="flex-1">
            <p className="text-sm text-slate-200">
              Show price value on chart
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Display the last value on the price scale
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleShowLastValueChange(!style.showLastValue)}
            disabled={disabled}
            role="switch"
            aria-checked={style.showLastValue}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${disabled
                ? 'opacity-50 cursor-not-allowed bg-slate-700'
                : style.showLastValue
                  ? 'bg-blue-600'
                  : 'bg-slate-600 hover:bg-slate-500'
              }
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${style.showLastValue ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="space-y-2 pt-4 border-t border-slate-700">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Preview
        </p>
        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
          <svg
            width="100%"
            height="60"
            className="overflow-visible"
          >
            {/* Grid lines */}
            <line
              x1="0"
              y1="15"
              x2="100"
              y2="15"
              stroke="#334155"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1="30"
              x2="100"
              y2="30"
              stroke="#334155"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1="45"
              x2="100"
              y2="45"
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Preview line with current style */}
            <polyline
              points="0,45 20,35 40,40 60,20 80,25 100,15"
              fill="none"
              stroke={style.color}
              strokeWidth={style.lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Last value label if enabled */}
            {style.showLastValue && (
              <text
                x="100%"
                y="10"
                textAnchor="end"
                fill={style.color}
                fontSize="12"
                fontWeight="600"
              >
                150.25
              </text>
            )}
          </svg>
        </div>
        <p className="text-xs text-slate-500 text-center">
          Changes apply immediately
        </p>
      </div>
    </div>
  );
}

/**
 * Compact variant for use in smaller dialogs
 * Hides labels and reduces spacing
 */
export function IndicatorSettingsStyleCompact({
  instance,
  onStyleChange,
  disabled = false,
  className = '',
  seriesMetadata,
}: Omit<IndicatorSettingsStyleProps, 'showLabels'>) {
  return (
    <IndicatorSettingsStyle
      instance={instance}
      onStyleChange={onStyleChange}
      disabled={disabled}
      showLabels={false}
      className={className}
      seriesMetadata={seriesMetadata}
    />
  );
}

export default IndicatorSettingsStyle;
