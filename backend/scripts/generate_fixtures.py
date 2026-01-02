#!/usr/bin/env python3
"""
Fixture Generator for Indicator Parity Validation

Generates golden fixture JSON files containing:
- OHLCV candle data from yfinance
- Computed indicator values (cRSI, TDFI, ADXVMA, EMA, SMA)
- Frozen indicator parameters for reproducible testing

Usage:
    python generate_fixtures.py --symbol AAPL --interval 1d --count 100 --output fixture-aapl-1d-100.json
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.indicators import calculate_crsi, calculate_tdfi, calculate_adxvma, calculate_ema, calculate_sma


def fetch_candles(symbol: str, interval: str, count: int) -> pd.DataFrame:
    """
    Fetch OHLCV candles from yfinance.

    Args:
        symbol: Stock symbol (e.g., AAPL)
        interval: Candle interval (1m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        count: Number of candles to fetch

    Returns:
        DataFrame with columns: time, open, high, low, close, volume
    """
    period_map = {
        '1m': '1d', '5m': '5d', '15m': '15d', '30m': '1mo', '60m': '2mo',
        '90m': '3mo', '1h': '3mo', '1d': '6mo', '5d': '1y', '1wk': '2y', '1mo': '5y'
    }
    period = period_map.get(interval, '1mo')

    ticker = yf.Ticker(symbol)
    data = ticker.history(period=period, interval=interval)

    if data.empty:
        raise ValueError(f"No data returned for {symbol} with interval {interval}")

    # Take the most recent `count` candles
    data = data.tail(count).copy()

    # Rename columns to match our schema
    data.rename(columns={
        'Open': 'open',
        'High': 'high',
        'Low': 'low',
        'Close': 'close',
        'Volume': 'volume'
    }, inplace=True)

    # Convert index to ISO-8601 timestamps
    data.reset_index(inplace=True)
    # Handle both yfinance 0.2.x ('Date') and 1.0+ (index name or 'date' column)
    date_col = None
    for col in data.columns:
        if col.lower() in ['date', 'datetime', 'time']:
            date_col = col
            break
    if date_col is None and 'Date' in data.columns:
        date_col = 'Date'

    if date_col:
        data['time'] = data[date_col].dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        data.drop(columns=[date_col, 'Dividends', 'Stock Splits'], errors='ignore', inplace=True)
    else:
        # Fallback: use the first column (should be the date index)
        data['time'] = data.iloc[:, 0].dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        data.drop(columns=['Dividends', 'Stock Splits'], errors='ignore', inplace=True)

    # Select and order columns
    data = data[['time', 'open', 'high', 'low', 'close', 'volume']]

    return data


def compute_indicators(df: pd.DataFrame) -> dict:
    """
    Compute all indicator values for the given candles.

    Uses frozen parameters per spec:
    - cRSI: period=14, upper=70, lower=30
    - EMA: period=20
    - SMA: period=50
    - TDFI: defaults (lookback=13, thresholds=±0.05)
    - ADXVMA: defaults (period=15)

    Args:
        df: DataFrame with OHLCV data

    Returns:
        Dictionary with computed indicator values
    """
    indicators = {}

    # cRSI (Connors RSI)
    df_crsi = calculate_crsi(df, domcycle=20, vibration=14, leveling=11.0, cyclicmemory=40)
    crsi_values = df_crsi['cRSI'].tolist()
    # Convert to None for null values
    indicators['crsi'] = {
        'values': [None if pd.isna(v) else round(float(v), 2) for v in crsi_values],
        'upper_band': 70,
        'lower_band': 30,
        'params': {'period': 14, 'source': 'close'}
    }

    # TDFI (Trend Direction Force Index)
    df_tdfi = calculate_tdfi(df, lookback=13, filter_high=0.05, filter_low=-0.05)
    tdfi_values = df_tdfi['TDFI'].tolist()
    indicators['tdfi'] = {
        'values': [None if pd.isna(v) else round(float(v), 3) for v in tdfi_values],
        'thresholds': {'upper': 0.05, 'lower': -0.05},
        'params': {'rsi_period': 13, 'band_period': 13}
    }

    # ADXVMA (Average Directional Index Volatility Moving Average)
    df_adxvma = calculate_adxvma(df, adxvma_period=15)
    adxvma_values = df_adxvma['ADXVMA'].tolist()
    indicators['adxvma'] = {
        'values': [None if pd.isna(v) else round(float(v), 2) for v in adxvma_values],
        'params': {'period': 15, 'threshold': 0}
    }

    # EMA (Exponential Moving Average)
    df_ema = calculate_ema(df, period=20)
    ema_values = df_ema['ema'].tolist()
    indicators['ema_20'] = {
        'values': [None if pd.isna(v) else round(float(v), 2) for v in ema_values],
        'params': {'period': 20, 'source': 'close'}
    }

    # SMA (Simple Moving Average)
    df_sma = calculate_sma(df, period=50)
    sma_values = df_sma['sma'].tolist()
    indicators['sma_50'] = {
        'values': [None if pd.isna(v) else round(float(v), 2) for v in sma_values],
        'params': {'period': 50, 'source': 'close'}
    }

    return indicators


def generate_fixture(
    symbol: str,
    interval: str,
    count: int,
    output_path: str
) -> None:
    """
    Generate a fixture JSON file.

    Args:
        symbol: Stock symbol
        interval: Candle interval
        count: Number of candles
        output_path: Output file path
    """
    print(f"Fetching {count} candles for {symbol} ({interval})...")
    df = fetch_candles(symbol, interval, count)

    print(f"Computing indicators...")
    indicators = compute_indicators(df)

    # Get timestamp range
    start_time = df['time'].iloc[0]
    end_time = df['time'].iloc[-1]

    # Convert DataFrame to list of dicts
    candles = []
    for _, row in df.iterrows():
        candles.append({
            'time': row['time'],
            'open': round(float(row['open']), 2),
            'high': round(float(row['high']), 2),
            'low': round(float(row['low']), 2),
            'close': round(float(row['close']), 2),
            'volume': int(row['volume'])
        })

    # Generate fixture ID
    fixture_id = f"fixture-{symbol.lower()}-{interval}-{count}"

    fixture = {
        'fixture_id': fixture_id,
        'symbol': symbol.upper(),
        'interval': interval,
        'timestamp_range': {
            'start': start_time,
            'end': end_time
        },
        'candles': candles,
        'indicators': indicators,
        'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }

    # Write to file
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, 'w') as f:
        json.dump(fixture, f, indent=2)

    print(f"Fixture saved to: {output}")
    print(f"  - {len(candles)} candles")
    print(f"  - Timestamp range: {start_time} to {end_time}")


def main():
    parser = argparse.ArgumentParser(
        description='Generate golden fixtures for indicator parity validation',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate 100 daily candles for AAPL
  python generate_fixtures.py --symbol AAPL --interval 1d --count 100 --output fixture-aapl-1d-100.json

  # Generate 200 hourly candles for TSLA
  python generate_fixtures.py --symbol TSLA --interval 1h --count 200 --output fixture-tsla-1h-200.json

  # Generate 150 5-minute candles for SPY
  python generate_fixtures.py --symbol SPY --interval 5m --count 150 --output fixture-spy-5m-150.json
        """
    )

    parser.add_argument('--symbol', required=True, help='Stock symbol (e.g., AAPL)')
    parser.add_argument('--interval', required=True, help='Candle interval (1m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo)')
    parser.add_argument('--count', type=int, required=True, help='Number of candles to fetch')
    parser.add_argument('--output', required=True, help='Output JSON file path')

    args = parser.parse_args()

    # Validate arguments
    if args.count <= 0:
        parser.error("--count must be positive")

    if args.count < 50:
        print(f"Warning: Small candle count ({args.count}) may not produce valid indicator values for all periods")

    try:
        generate_fixture(args.symbol, args.interval, args.count, args.output)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
