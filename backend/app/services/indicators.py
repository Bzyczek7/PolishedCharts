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
    ntdf = tdf / tdf.abs().rolling(window=lookback * 3).max()
    
    df['TDFI'] = ntdf.fillna(0) # Fill NaNs with 0 to handle initial calculations
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

    # Dynamic bands calculation
    lmax = crsi.rolling(window=cyclicmemory).max()
    lmin = crsi.rolling(window=cyclicmemory).min()
    mstep = (lmax - lmin) / 100
    aperc = leveling / 100

    # This part is complex to vectorize perfectly, but we can approximate
    # For now, let's use a simpler band calculation
    df['cRSI_UpperBand'] = lmax
    df['cRSI_LowerBand'] = lmin

    return df

def calculate_adxvma(df: pd.DataFrame, adxvma_period: int = 15) -> pd.DataFrame:

    df = df.copy()

    k = 1.0 / adxvma_period

    

    # Calculate ADX first (simplified version of what's in the original ADXVMA script)

    tr1 = df['high'] - df['low']

    tr2 = abs(df['high'] - df['close'].shift(1))

    tr3 = abs(df['low'] - df['close'].shift(1))

    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    atr = rma(tr, adxvma_period)



    up_move = df['high'].diff()

    down_move = df['low'].shift(1) - df['low']

    

    pDM = np.where((up_move > down_move) & (up_move > 0), up_move, 0)

    mDM = np.where((down_move > up_move) & (down_move > 0), down_move, 0)

    

    pDI = 100 * rma(pd.Series(pDM, index=df.index), adxvma_period) / atr

    mDI = 100 * rma(pd.Series(mDM, index=df.index), adxvma_period) / atr

    

    dx = 100 * abs(pDI - mDI) / (pDI + mDI)

    adx = rma(dx.fillna(0), adxvma_period)

    

    # ADXVMA Calculation

    index = adx

    hhp = index.rolling(window=adxvma_period).max().shift(1)

    llp = index.rolling(window=adxvma_period).min().shift(1)

    

    hhv = np.maximum(index, hhp)

    llv = np.minimum(index, llp)

    

    vIndex = (index - llv) / (hhv - llv)

    vIndex = vIndex.fillna(0) # Handle potential division by zero

    

    adxvma = pd.Series(index=df.index, dtype=float)

    adxvma.iloc[0] = df['close'].iloc[0]

    

    for i in range(1, len(df)):

        adxvma.iloc[i] = (1 - k * vIndex.iloc[i]) * adxvma.iloc[i-1] + k * vIndex.iloc[i] * df['close'].iloc[i]

        

    df['ADXVMA'] = adxvma

    return df
