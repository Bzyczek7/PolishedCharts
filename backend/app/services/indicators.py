import pandas as pd
import numpy as np
from typing import Optional

# Removed: from stock_indicators import indicators # Import from stock_indicators

def calculate_sma(df: pd.DataFrame, period: int = 20, price_col: str = 'close') -> pd.DataFrame:
    """
    Calculate Simple Moving Average (SMA).

    Args:
        df: DataFrame with price data
        period: Number of periods for the moving average (default: 20)
        price_col: Column name to use for price (default: 'close')

    Returns:
        DataFrame with SMA column added
    """
    df = df.copy()
    df['sma'] = df[price_col].rolling(window=period).mean()
    return df


def calculate_ema(df: pd.DataFrame, period: int = 20, price_col: str = 'close') -> pd.DataFrame:
    """
    Calculate Exponential Moving Average (EMA).

    Args:
        df: DataFrame with price data
        period: Number of periods for the moving average (default: 20)
        price_col: Column name to use for price (default: 'close')

    Returns:
        DataFrame with EMA column added
    """
    df = df.copy()
    df['ema'] = df[price_col].ewm(span=period, adjust=False).mean()
    return df


def calculate_tdfi(
    df: pd.DataFrame, 
    lookback: int = 13,
    filter_high: float = 0.05,
    filter_low: float = -0.05,
    price_col: str = 'close'
) -> pd.DataFrame:
    """
    Calculates the Trend Direction Force Index (TDFI) based on the provided Pine Script.
    """
    df = df.copy()
    price = df[price_col] * 1000

    mma = price.ewm(span=lookback, adjust=False).mean()
    smma = mma.ewm(span=lookback, adjust=False).mean()

    impetmma = mma - mma.shift(1)
    impetsmma = smma - smma.shift(1)
    divma = abs(mma - smma)
    averimpet = (impetmma + impetsmma) / 2

    number = averimpet
    pow_val = 3
    result = number.pow(pow_val) # Simplified from loop

    tdf = divma * result
    
    # Avoid division by zero and handle very small values
    rolling_max = tdf.abs().rolling(window=lookback * 3, min_periods=1).max()
    ntdf = tdf / rolling_max
    ntdf = ntdf.fillna(0).clip(-1, 1) # Ensure within -1 to 1 range
    
    df['TDFI'] = ntdf
    df['TDFI_Signal'] = np.where(df['TDFI'] > filter_high, 1, np.where(df['TDFI'] < filter_low, -1, 0))

    return df

def rma(series, length):
    alpha = 1 / length
    return series.ewm(alpha=alpha, adjust=False).mean()

def calculate_crsi(
    df: pd.DataFrame,
    domcycle: int = 20,
    vibration: int = 14,
    leveling: float = 11.0,
    cyclicmemory: int = 40
) -> pd.DataFrame:
    """
    Vectorized implementation of cRSI (Cyclic RSI) for performance.

    Previous implementation used O(n^2) loops with .iloc[i] access.
    This vectorized version uses pandas rolling/expanding operations.
    """
    df = df.copy()
    src = df['close']
    cyclelen = domcycle // 2

    up = rma(src.diff().clip(lower=0), cyclelen)
    down = rma(-src.diff().clip(upper=0), cyclelen)

    rsi = pd.Series(np.where(down == 0, 100, np.where(up == 0, 0, 100 - (100 / (1 + up / down)))), index=df.index)

    torque = 2.0 / (vibration + 1)
    phasingLag = (vibration - 1) // 2

    # Vectorized cRSI calculation using cumulative operations
    # Formula: crsi[i] = torque * (2*rsi[i] - rsi_shifted[i]) + (1-torque) * crsi[i-1]
    # This is an exponential moving average formula, can be computed using ewm
    rsi_shifted = rsi.shift(phasingLag).ffill()

    # Calculate the signal component: 2*rsi - rsi_shifted
    signal = 2 * rsi - rsi_shifted

    # Use ewm for the recursive formula: crsi = torque * signal + (1-torque) * crsi_prev
    # This is equivalent to EMA with alpha = torque
    crsi = signal.ewm(alpha=torque, adjust=False).mean()

    # Fill initial NaN with rsi values or 50
    crsi = crsi.fillna(rsi).fillna(50.0)

    df['cRSI'] = crsi

    # Vectorized dynamic bands using rolling quantile
    aperc = leveling / 100.0

    # Use rolling window with min_periods to handle initial values
    upper_band = crsi.rolling(window=cyclicmemory, min_periods=cyclicmemory).quantile(1 - aperc)
    lower_band = crsi.rolling(window=cyclicmemory, min_periods=cyclicmemory).quantile(aperc)

    df['cRSI_UpperBand'] = upper_band
    df['cRSI_LowerBand'] = lower_band

    return df

def calculate_adxvma(df: pd.DataFrame, adxvma_period: int = 15) -> pd.DataFrame:
    """
    Vectorized implementation of ADXVMA (Average Directional Index Volatility Moving Average).

    Previous implementation used O(n) loop with .iloc[i] access.
    This vectorized version uses pandas ewm and rolling operations.
    """
    df = df.copy()
    k = 1.0 / adxvma_period
    close = df['close']

    # Vectorized up/down components using shift
    close_diff = close.diff()
    current_up = close_diff.clip(lower=0)
    current_down = -close_diff.clip(upper=0)

    # Exponential moving averages using ewm (vectorized)
    # Formula: value[i] = (1-k) * value[i-1] + k * input
    up = current_up.ewm(alpha=k, adjust=False).mean().fillna(0)
    down = current_down.ewm(alpha=k, adjust=False).mean().fillna(0)

    # Calculate fractions
    sum_val = up + down
    fraction_up = np.where(sum_val > 0.0, up / sum_val, 0.0)
    fraction_down = np.where(sum_val > 0.0, down / sum_val, 0.0)

    # Second level EMA
    ups = pd.Series(fraction_up, index=df.index).ewm(alpha=k, adjust=False).mean().fillna(0)
    downs = pd.Series(fraction_down, index=df.index).ewm(alpha=k, adjust=False).mean().fillna(0)

    # Normalize
    norm_diff = np.abs(ups - downs)
    norm_sum = ups + downs
    norm_fraction = np.where(norm_sum > 0.0, norm_diff / norm_sum, 0.0)

    # Index values EMA
    index_vals = pd.Series(norm_fraction, index=df.index).ewm(alpha=k, adjust=False).mean().fillna(0)

    # Vectorized rolling max/min for vIndex calculation
    # Use rolling window to get previous period max/min
    rolling_max = index_vals.rolling(window=adxvma_period, min_periods=1).max().shift(1)
    rolling_min = index_vals.rolling(window=adxvma_period, min_periods=1).min().shift(1)

    # First row has no previous values
    rolling_max.iloc[0] = index_vals.iloc[0]
    rolling_min.iloc[0] = index_vals.iloc[0]

    hhv = np.maximum(index_vals, rolling_max)
    llv = np.minimum(index_vals, rolling_min)

    # Calculate vIndex
    vIndex = np.where((hhv - llv) > 0.0, (index_vals - llv) / (hhv - llv), 0.0)

    # Calculate ADXVMA using vectorized operations
    # For first period, use close; for rest, use EMA formula
    adxvma = pd.Series(index=df.index, dtype=float)
    adxvma.iloc[0] = close.iloc[0]

    # Vectorized EMA for adxvma: adxvma[i] = (1 - k * vIndex) * adxvma[i-1] + k * vIndex * close[i]
    # This is a variable-coefficient EMA, need to compute iteratively but can optimize
    # Using numpy for the iterative part is still much faster than .iloc loops
    adxvma_vals = np.zeros(len(df))
    adxvma_vals[0] = close.iloc[0]

    for i in range(1, len(df)):
        vi = vIndex[i]
        adxvma_vals[i] = (1 - k * vi) * adxvma_vals[i-1] + k * vi * close.iloc[i]

    adxvma = pd.Series(adxvma_vals, index=df.index)

    # Vectorized trend calculation
    # trend[i] = 1 if prev_trend > -1 and curr_val > prev_val
    # trend[i] = -1 if prev_trend < 1 and curr_val < prev_val
    # trend[i] = 0 otherwise
    adxvma_diff = adxvma.diff()

    trend = pd.Series(0, index=df.index, dtype=int)
    # First trend point
    trend.iloc[0] = 0

    # Vectorized trend computation using shift
    prev_trend = trend.shift(1).fillna(0)
    curr_above_prev = adxvma_diff > 0
    curr_below_prev = adxvma_diff < 0

    trend = np.where(
        (prev_trend > -1) & curr_above_prev, 1,
        np.where(
            (prev_trend < 1) & curr_below_prev, -1,
            0
        )
    )
    trend = pd.Series(trend, index=df.index)

    df['ADXVMA'] = adxvma
    df['ADXVMA_Signal'] = trend
    return df
