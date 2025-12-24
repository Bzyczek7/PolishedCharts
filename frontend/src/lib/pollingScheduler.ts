/**
 * Polling Scheduler Utility
 *
 * Feature: 004-candle-data-refresh
 * Purpose: Centralized polling timer management for React hooks
 *
 * Provides cancelable timer functions for periodic data fetching.
 * Uses setTimeout with recursion for better control than setInterval.
 */

/**
 * Market schedule configuration for US equities.
 * Market hours: 9:30 AM - 4:00 PM ET, Monday through Friday
 */
const MARKET_OPEN_HOUR_ET = 9;
const MARKET_OPEN_MINUTE_ET = 30;
const MARKET_CLOSE_HOUR_ET = 16;
const MARKET_CLOSE_MINUTE_ET = 0;
const CLOSED_MARKET_MULTIPLIER = 4; // Poll 4x less frequently when market is closed

/**
 * Poll timer handle with cancel functionality
 */
export interface PollTimer {
  id: number;
  interval: number;
  callback: () => void;
  cancel: () => void;
}

/**
 * Refresh intervals per spec clarification (in milliseconds):
 * - 1m, 5m: 5000ms (5 seconds)
 * - 15m, 1h: 15000ms (15 seconds)
 * - 1d: 60000ms (60 seconds)
 * - 1w: 300000ms (5 minutes)
 */
const POLL_INTERVALS_MS: Record<string, number> = {
  '1m': 5000,
  '5m': 5000,
  '15m': 15000,
  '1h': 15000,
  '1d': 60000,
  '1w': 300000,
  '1wk': 300000,
};

/**
 * Creates a cancelable polling timer.
 *
 * Uses setTimeout with recursion for better control over timer lifecycle.
 * The timer will automatically recur until cancelled.
 *
 * @param callback - Function to execute on each poll interval
 * @param intervalMs - Poll interval in milliseconds
 * @returns PollTimer object with cancel method
 *
 * @example
 * ```ts
 * const timer = createPollTimer(() => {
 *   console.log('Polling...');
 * }, 5000);
 *
 * // Later, to cancel:
 * timer.cancel();
 * ```
 */
export function createPollTimer(
  callback: () => void,
  intervalMs: number
): PollTimer {
  let currentTimerId: number | undefined;

  const scheduleNext = () => {
    const id = window.setTimeout(() => {
      callback();
      // Recursively schedule next poll
      const nextId = window.setTimeout(scheduleNext, intervalMs);
      currentTimerId = nextId;
    }, intervalMs);
    currentTimerId = id;
  };

  scheduleNext();

  return {
    id: currentTimerId ?? 0,
    interval: intervalMs,
    callback,
    cancel: () => {
      if (currentTimerId !== undefined) {
        clearTimeout(currentTimerId);
      }
    },
  };
}

/**
 * Clears a poll timer.
 *
 * Safe to call with null or undefined.
 *
 * @param timer - PollTimer to clear, or null/undefined
 */
export function clearPollTimer(timer: PollTimer | null): void {
  if (timer) {
    timer.cancel();
  }
}

/**
 * Get the poll interval in milliseconds for a given time interval string.
 *
 * @param interval - Time interval string (e.g., '1m', '5m', '1h', '1d', '1w')
 * @returns Poll interval in milliseconds (default: 60000ms for unknown intervals)
 */
export function getPollIntervalMs(interval: string): number {
  const normalized = interval.toLowerCase().replace('wk', 'w');
  return POLL_INTERVALS_MS[normalized] ?? 60000; // Default 1 minute
}

/**
 * Get the poll interval in seconds for a given time interval string.
 *
 * Convenience function for logging/debugging.
 *
 * @param interval - Time interval string
 * @returns Poll interval in seconds
 */
export function getPollIntervalSec(interval: string): number {
  return getPollIntervalMs(interval) / 1000;
}

/**
 * Check if the US stock market is currently open.
 *
 * Market hours: 9:30 AM - 4:00 PM ET, Monday through Friday
 *
 * @returns true if market is open, false otherwise
 *
 * T073: Market schedule polling throttle
 */
export function isMarketOpen(): boolean {
  const now = new Date();

  // Convert to ET (UTC-5 or UTC-4 depending on DST)
  // For simplicity, we use UTC offset logic
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcDay = now.getUTCDay();

  // ET is UTC-5 (EST) or UTC-4 (EDT)
  // We'll use EST (UTC-5) for simplicity - market opens at 14:30 UTC, closes at 21:00 UTC
  // This is conservative and may show closed during EDT periods, but that's acceptable
  const etHour = (utcHour - 5 + 24) % 24; // Adjust for UTC-5

  // Check if weekend (Saturday = 6, Sunday = 0 in UTC)
  if (utcDay === 0 || utcDay === 6) {
    return false;
  }

  // Check if within market hours (9:30 AM - 4:00 PM ET)
  const openMinutes = MARKET_OPEN_HOUR_ET * 60 + MARKET_OPEN_MINUTE_ET;
  const closeMinutes = MARKET_CLOSE_HOUR_ET * 60 + MARKET_CLOSE_MINUTE_ET;
  const currentMinutes = etHour * 60 + utcMinute;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Get the adjusted poll interval based on market status.
 *
 * When market is closed, returns a longer interval (4x) to reduce API load.
 *
 * @param interval - Time interval string (e.g., '1m', '5m', '1h', '1d', '1w')
 * @returns Adjusted poll interval in milliseconds
 *
 * T073: Market schedule polling throttle
 */
export function getAdjustedPollIntervalMs(interval: string): number {
  const baseInterval = getPollIntervalMs(interval);

  if (!isMarketOpen()) {
    return baseInterval * CLOSED_MARKET_MULTIPLIER;
  }

  return baseInterval;
}
