import pandas as pd
import numpy as np
from typing import Optional

# Removed: from stock_indicators import indicators # Import from stock_indicators

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
    df = df.copy()
    src = df['close']
    cyclelen = domcycle / 2

    up = rma(src.diff().clip(lower=0), cyclelen)
    down = rma(-src.diff().clip(upper=0), cyclelen)
    
    rsi = pd.Series(np.where(down == 0, 100, np.where(up == 0, 0, 100 - (100 / (1 + up / down)))), index=df.index)

    torque = 2.0 / (vibration + 1)
    phasingLag = (vibration - 1) // 2
    
    # Initialize crsi series
    crsi = pd.Series(index=df.index, dtype=float)
    rsi_shifted = rsi.shift(phasingLag)
    
    # Iterative calculation for cRSI (emulating Pine Script's recursive nature)
    rsi_shifted = rsi.shift(phasingLag).ffill() # Use ffill to handle initial NaNs
    for i in range(len(df)):
        if i == 0:
            crsi.iloc[i] = rsi.iloc[i] if pd.notna(rsi.iloc[i]) else 50.0 # Start at 50 if RSI is NaN
        else:
            prev_crsi = crsi.iloc[i-1]
            if pd.notna(rsi.iloc[i]) and pd.notna(rsi_shifted.iloc[i]):
                crsi.iloc[i] = torque * (2 * rsi.iloc[i] - rsi_shifted.iloc[i]) + (1 - torque) * prev_crsi
            else:
                crsi.iloc[i] = prev_crsi

    df['cRSI'] = crsi

    # Dynamic bands calculation using percentiles
    upper_band = pd.Series(index=df.index, dtype=float)
    lower_band = pd.Series(index=df.index, dtype=float)
    
    aperc = leveling / 100.0
    
    for i in range(len(df)):
        if i < cyclicmemory:
            upper_band.iloc[i] = np.nan
            lower_band.iloc[i] = np.nan
        else:
            window = crsi.iloc[i-cyclicmemory+1:i+1]
            # Standard cRSI leveling uses percentiles
            upper_band.iloc[i] = window.quantile(1 - aperc)
            lower_band.iloc[i] = window.quantile(aperc)

    df['cRSI_UpperBand'] = upper_band
    df['cRSI_LowerBand'] = lower_band

    return df

def calculate_adxvma(df: pd.DataFrame, adxvma_period: int = 15) -> pd.DataFrame:
    df = df.copy()
    k = 1.0 / adxvma_period
    
    # Initialize series
    adxvma = pd.Series(0.0, index=df.index)
    up = pd.Series(0.0, index=df.index)
    down = pd.Series(0.0, index=df.index)
    ups = pd.Series(0.0, index=df.index)
    downs = pd.Series(0.0, index=df.index)
    index_vals = pd.Series(0.0, index=df.index)
    trend = pd.Series(0, index=df.index)
    
    close = df['close']
    
    for i in range(1, len(df)):
        # up/down components
        currentUp = max(close.iloc[i] - close.iloc[i-1], 0)
        currentDown = max(close.iloc[i-1] - close.iloc[i], 0)
        
        up.iloc[i] = (1-k) * up.iloc[i-1] + k * currentUp
        down.iloc[i] = (1-k) * down.iloc[i-1] + k * currentDown
        
        sum_val = up.iloc[i] + down.iloc[i]
        fractionUp = 0.0
        fractionDown = 0.0
        if sum_val > 0.0:
            fractionUp = up.iloc[i] / sum_val
            fractionDown = down.iloc[i] / sum_val
            
        ups.iloc[i] = (1-k) * ups.iloc[i-1] + k * fractionUp
        downs.iloc[i] = (1-k) * downs.iloc[i-1] + k * fractionDown
        
        normDiff = abs(ups.iloc[i] - downs.iloc[i])
        normSum = ups.iloc[i] + downs.iloc[i]
        
        normFraction = 0.0
        if normSum > 0.0:
            normFraction = normDiff / normSum
            
        index_vals.iloc[i] = (1-k) * index_vals.iloc[i-1] + k * normFraction
        
        # Calculate vIndex using rolling window of index_vals
        if i >= adxvma_period:
            # highest(index, adxvma_period)[1] -> max of previous period
            window = index_vals.iloc[max(0, i-adxvma_period):i]
            hhp = window.max()
            llp = window.min()
            
            hhv = max(index_vals.iloc[i], hhp)
            llv = min(index_vals.iloc[i], llp)
            
            vIndex = 0.0
            if (hhv - llv) > 0.0:
                vIndex = (index_vals.iloc[i] - llv) / (hhv - llv)
            
            adxvma.iloc[i] = (1 - k * vIndex) * adxvma.iloc[i-1] + k * vIndex * close.iloc[i]
        else:
            # Seed value
            adxvma.iloc[i] = close.iloc[i]

        # Trend logic from Pine Script
        prev_trend = trend.iloc[i-1]
        curr_val = adxvma.iloc[i]
        prev_val = adxvma.iloc[i-1]
        
        if prev_trend > -1 and curr_val > prev_val:
            trend.iloc[i] = 1
        elif prev_trend < 1 and curr_val < prev_val:
            trend.iloc[i] = -1
        else:
            trend.iloc[i] = 0

    df['ADXVMA'] = adxvma
    df['ADXVMA_Signal'] = trend
    return df
