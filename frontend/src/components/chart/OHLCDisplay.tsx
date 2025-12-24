/**
 * OHLCDisplay - Shows OHLCV data for crosshair position
 * Feature: 002-supercharts-visuals
 */

import React, { useMemo } from 'react';
import type { Candle } from '../../api/candles';

interface OHLCDisplayProps {
  candle?: Candle | null;
  className?: string;
}

/**
 * Format date for display based on interval
 * Daily: "Wed 27 Aug '25"
 * Intraday: "Wed 27 Aug '25 14:30"
 */
function formatTime(timestamp: string, interval: string = '1d'): string {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  };

  const dateStr = date.toLocaleDateString('en-US', options).replace(',', '');

  // For intraday intervals, add time
  if (interval !== '1d' && interval !== '1wk' && interval !== '1M') {
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit' as const,
      minute: '2-digit' as const,
      hour12: false,
    };
    const timeStr = date.toLocaleTimeString('en-US', timeOptions);
    return `${dateStr} ${timeStr}`;
  }

  return dateStr;
}

/**
 * OHLCDisplay component
 * Shows Open, High, Low, Close, Volume values for the candle under crosshair
 *
 * @example
 * ```tsx
 * <OHLCDisplay candle={hoveredCandle} />
 * ```
 */
export function OHLCDisplay({ candle, className = '' }: OHLCDisplayProps) {
  const content = useMemo(() => {
    if (!candle) {
      return (
        <div className={`flex gap-4 text-xs ${className}`}>
          <span className="text-slate-500">O</span>
          <span className="text-slate-500">H</span>
          <span className="text-slate-500">L</span>
          <span className="text-slate-500">C</span>
          <span className="text-slate-500">V</span>
        </div>
      );
    }

    const isUp = candle.close >= candle.open;
    const closeColor = isUp ? 'text-[#26a69a]' : 'text-[#ef5350]';

    return (
      <div className={`flex gap-4 text-xs ${className}`}>
        <span className="text-slate-400">
          O <span className="text-white ml-1">{candle.open.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          H <span className="text-white ml-1">{candle.high.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          L <span className="text-white ml-1">{candle.low.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          C <span className={`${closeColor} ml-1`}>{candle.close.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          V <span className="text-white ml-1">{candle.volume.toLocaleString()}</span>
        </span>
      </div>
    );
  }, [candle, className]);

  return content;
}

interface OHLCDisplayWithTimeProps {
  candle?: Candle | null;
  interval?: string;
  className?: string;
}

/**
 * OHLCDisplayWithTime component
 * Shows time label followed by OHLCV values
 *
 * @example
 * ```tsx
 * <OHLCDisplayWithTime candle={hoveredCandle} interval="1d" />
 * ```
 */
export function OHLCDisplayWithTime({ candle, interval = '1d', className = '' }: OHLCDisplayWithTimeProps) {
  const content = useMemo(() => {
    const timeStr = candle ? formatTime(candle.timestamp, interval) : '';

    if (!candle) {
      return (
        <div className={`flex gap-4 text-xs ${className}`}>
          <span className="text-slate-500 w-32">{timeStr || '---'}</span>
          <span className="text-slate-500">O</span>
          <span className="text-slate-500">H</span>
          <span className="text-slate-500">L</span>
          <span className="text-slate-500">C</span>
          <span className="text-slate-500">V</span>
        </div>
      );
    }

    const isUp = candle.close >= candle.open;
    const closeColor = isUp ? 'text-[#26a69a]' : 'text-[#ef5350]';

    return (
      <div className={`flex gap-4 text-xs ${className}`}>
        <span className="text-slate-300 w-32">{timeStr}</span>
        <span className="text-slate-400">
          O <span className="text-white ml-1">{candle.open.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          H <span className="text-white ml-1">{candle.high.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          L <span className="text-white ml-1">{candle.low.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          C <span className={`${closeColor} ml-1`}>{candle.close.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          V <span className="text-white ml-1">{candle.volume.toLocaleString()}</span>
        </span>
      </div>
    );
  }, [candle, interval, className]);

  return content;
}

export default OHLCDisplay;
