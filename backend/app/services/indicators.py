import pandas as pd
import numpy as np
from typing import Optional

# Removed: from stock_indicators import indicators # Import from stock_indicators

def calculate_tdfi(
    df: pd.DataFrame, 
    period: int = 6, 
    smoothing: int = 5, 
    tdfi_signal_period: int = 3
) -> pd.DataFrame:
    """
    Calculates the Trend Direction Force Index (TDFI) and its signal line.

    Based on the description of TDFI, which often involves:
    1. Calculating typical price.
    2. Calculating price changes.
    3. Applying a moving average (often EMA or WMA) to the price changes.
    4. Normalizing the result.

    This implementation assumes a typical TDFI calculation similar to what's
    found in various trading platforms (e.g., TradingView pinescript versions).
    It's a simplified version and might need adjustments based on the exact
    TDFI formula being used as there can be variations.
    
    Args:
        df (pd.DataFrame): DataFrame with 'high', 'low', 'close' columns.
        period (int): Lookback period for initial price change calculation.
        smoothing (int): Smoothing period for the force index.
        tdfi_signal_period (int): Period for the TDFI signal line.

    Returns:
        pd.DataFrame: Original DataFrame with 'TDFI' and 'TDFI_Signal' columns added.
    """

    # Ensure the DataFrame is sorted by index (time)
    df = df.sort_index()

    # Calculate Typical Price
    df['tp'] = (df['high'] + df['low'] + df['close']) / 3

    # Calculate TDFI (Simplified - there are many variations)
    # This version is inspired by common TDFI implementations that use price changes
    # and smoothing. A more precise Pine Script adaptation might be needed.
    
    # Calculate price change
    df['price_change'] = df['tp'].diff()

    # Absolute price change
    df['abs_price_change'] = df['price_change'].abs()

    # Sum of price changes over the period
    df['sum_pc'] = df['price_change'].rolling(window=period).sum()
    df['sum_abs_pc'] = df['abs_price_change'].rolling(window=period).sum()

    # Calculate Directional Index (DI)
    df['di'] = df['sum_pc'] / df['sum_abs_pc']
    df['di'] = df['di'].fillna(0) # Handle division by zero
    
    # Apply smoothing (EMA is common for such indicators)
    df['tdfi_raw'] = df['di'].ewm(span=smoothing, adjust=False).mean()
    
    # Scale TDFI to a range like -100 to 100
    df['TDFI'] = df['tdfi_raw'] * 100 # Example scaling

    # Calculate TDFI Signal Line
    df['TDFI_Signal'] = df['TDFI'].ewm(span=tdfi_signal_period, adjust=False).mean()
    
    # Clean up intermediate columns
    df = df.drop(columns=['tp', 'price_change', 'abs_price_change', 'sum_pc', 'sum_abs_pc', 'di', 'tdfi_raw'])

    return df

def calculate_crsi(
    df: pd.DataFrame, 
    rsi_period: int = 14, 
    stoch_period: int = 9, 
    fast_k_period: int = 3, 
    slow_k_period: int = 3
) -> pd.DataFrame:
    """
    Calculates the cRSI (Connors RSI) manually.
    Connors RSI is typically composed of 3 components:
    1. A 3-period RSI of Close price.
    2. A 2-period RSI of Up/Down streaks.
    3. A Rate of Change (%R) ranking.
    These three components are then usually averaged and scaled.
    
    This is a simplified manual implementation focusing on the core concept.
    For more accuracy, a full implementation of each component would be needed.

    Args:
        df (pd.DataFrame): DataFrame with 'close' column.
        rsi_period (int): Period for RSI calculations.
        stoch_period (int): Period for Stochastic Oscillator used in Up/Down streaks.
        fast_k_period (int): Period for Fast %K in Stochastic.
        slow_k_period (int): Period for Slow %K in Stochastic.

    Returns:
        pd.DataFrame: Original DataFrame with 'cRSI', 'cRSI_UpperBand', 'cRSI_LowerBand' columns added.
    """
    df = df.copy() # Work on a copy to avoid modifying original

    # Component 1: RSI of Close Price
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)

    avg_gain = gain.ewm(span=rsi_period, adjust=False).mean()
    avg_loss = loss.ewm(span=rsi_period, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    df['RSI'] = rsi

    # Component 2: Up/Down Streaks RSI
    # This involves calculating consecutive up/down days and then taking an RSI of that.
    # Simplified for now: just use a direct RSI of changes, not true streaks.
    df['change'] = df['close'].diff()
    df.loc[df['change'] > 0, 'streak_direction'] = 1
    df.loc[df['change'] < 0, 'streak_direction'] = -1
    df.loc[df['change'] == 0, 'streak_direction'] = 0
    df['streak'] = df['streak_direction'].replace(0, np.nan).groupby((df['streak_direction'] != df['streak_direction'].shift()).cumsum()).cumcount() + 1
    df['streak'] = df.apply(lambda row: row['streak'] if row['streak_direction'] == 1 else -row['streak'], axis=1)
    df['streak'] = df['streak'].fillna(0) # Fill NaN from initial calculation

    delta_streak = df['streak'].diff()
    gain_streak = delta_streak.where(delta_streak > 0, 0)
    loss_streak = -delta_streak.where(delta_streak < 0, 0)

    avg_gain_streak = gain_streak.ewm(span=2, adjust=False).mean() # typically 2-period RSI
    avg_loss_streak = loss_streak.ewm(span=2, adjust=False).mean()

    rs_streak = avg_gain_streak / avg_loss_streak
    rsi_streak = 100 - (100 / (1 + rs_streak))
    df['RSI_Streak'] = rsi_streak
    
    # Component 3: Rate of Change Ranking
    # This is more complex and often uses percentile ranks of the Rate of Change.
    # We will use a simple ROC for now.
    df['ROC'] = ((df['close'] - df['close'].shift(1)) / df['close'].shift(1)) * 100
    df['ROC_Rank'] = df['ROC'].rank(pct=True) * 100 # Simple percentile rank approximation

    # cRSI is typically an average of these three components, then scaled.
    # Connors RSI = (RSI(Close, 3) + RSI(Streak, 2) + PercentRank(ROC, 10)) / 3
    # For now, let's average the available components (using rsi_period for consistency where applicable)
    df['cRSI'] = (df['RSI'].rolling(window=rsi_period).mean() + df['RSI_Streak'].rolling(window=2).mean() + df['ROC_Rank'].rolling(window=10).mean()) / 3
    
    # Define dynamic bands (example: based on standard deviation or fixed levels)
    df['cRSI_UpperBand'] = df['cRSI'].rolling(window=rsi_period).mean() + df['cRSI'].rolling(window=rsi_period).std() * 2
    df['cRSI_LowerBand'] = df['cRSI'].rolling(window=rsi_period).mean() - df['cRSI'].rolling(window=rsi_period).std() * 2

    # Fill NaN values that result from initial calculations
    df['cRSI'] = df['cRSI'].fillna(method='bfill').fillna(method='ffill')
    df['cRSI_UpperBand'] = df['cRSI_UpperBand'].fillna(method='bfill').fillna(method='ffill')
    df['cRSI_LowerBand'] = df['cRSI_LowerBand'].fillna(method='bfill').fillna(method='ffill')

    # Drop intermediate columns
    df = df.drop(columns=[col for col in df.columns if col not in ['high', 'low', 'open', 'close', 'cRSI', 'cRSI_UpperBand', 'cRSI_LowerBand']], errors='ignore')

    return df

def calculate_adxvma(df: pd.DataFrame, period: int = 14, adx_period: int = 14) -> pd.DataFrame:
    """
    Calculates the Adaptive Moving Average (ADXVMA).
    This is a simplified version, as ADXVMA variations can be complex.
    It generally uses ADX to adapt the smoothing period of a moving average.

    Args:
        df (pd.DataFrame): DataFrame with 'high', 'low', 'close' columns.
        period (int): Period for the VMA.
        adx_period (int): Period for ADX calculation.

    Returns:
        pd.DataFrame: Original DataFrame with 'ADXVMA' column added.
    """
    df = df.copy()

    # Calculate True Range (TR)
    df['tr1'] = df['high'] - df['low']
    df['tr2'] = abs(df['high'] - df['close'].shift(1))
    df['tr3'] = abs(df['low'] - df['close'].shift(1))
    df['TR'] = df[['tr1', 'tr2', 'tr3']].max(axis=1)

    # Calculate Directional Movement (+DM and -DM)
    df['up_move'] = df['high'] - df['high'].shift(1)
    df['down_move'] = df['low'].shift(1) - df['low']

    df['+DM'] = np.where((df['up_move'] > df['down_move']) & (df['up_move'] > 0), df['up_move'], 0)
    df['-DM'] = np.where((df['down_move'] > df['up_move']) & (df['down_move'] > 0), df['down_move'], 0)

    # Calculate Smoothed True Range (ATR)
    df['ATR'] = df['TR'].ewm(span=adx_period, adjust=False).mean()

    # Calculate Smoothed Directional Movement (+DM and -DM)
    df['+DMs'] = df['+DM'].ewm(span=adx_period, adjust=False).mean()
    df['-DMs'] = df['-DM'].ewm(span=adx_period, adjust=False).mean()

    # Calculate Directional Indicators (+DI and -DI)
    df['+DI'] = (df['+DMs'] / df['ATR']) * 100
    df['-DI'] = (df['-DMs'] / df['ATR']) * 100

    # Calculate Directional Movement Index (DX)
    df['DX'] = (abs(df['+DI'] - df['-DI']) / (df['+DI'] + df['-DI'])) * 100
    df['DX'] = df['DX'].fillna(0)

    # Calculate Average Directional Index (ADX)
    df['ADX'] = df['DX'].ewm(span=adx_period, adjust=False).mean()
    df['ADX'] = df['ADX'].fillna(0)

    # Calculate Volatility Index (often related to ADX) for VMA's smoothing factor
    # This is a key part of ADXVMA - making the MA adaptive
    # A common approach is to use ADX to determine the efficiency ratio or smoothing factor
    
    # Example adaptation based on ADX (simplified):
    # Higher ADX means stronger trend, less smoothing (faster MA)
    # Lower ADX means weaker trend, more smoothing (slower MA)
    # Scale ADX to a range, e.g., 0 to 1, then use it to adjust EMA alpha.
    max_adx = 60 # Typical max ADX for strong trend
    min_adx = 10 # Typical min ADX for weak trend
    df['scaled_adx'] = (df['ADX'] - min_adx) / (max_adx - min_adx)
    df['scaled_adx'] = df['scaled_adx'].clip(0, 1) # Clip between 0 and 1

    # Apply adaptation to an EMA (or another MA)
    # If ADXVMA is based on a specific VMA type (e.g., KAMA), it would go here.
    # For now, let's use a simple EMA with an adaptive alpha.
    
    # Traditional EMA alpha = 2 / (period + 1)
    # Adaptive alpha = scaled_adx * alpha_fast + (1 - scaled_adx) * alpha_slow
    # Or, adaptive period based on ADX:
    df['adx_vma'] = np.nan
    alpha = 2 / (period + 1)

    for i in range(1, len(df)):
        if pd.notna(df['close'].iloc[i]) and pd.notna(df['scaled_adx'].iloc[i]):
            current_alpha = alpha * df['scaled_adx'].iloc[i]
            if pd.isna(df['adx_vma'].iloc[i-1]):
                df.loc[df.index[i], 'adx_vma'] = df['close'].iloc[i]
            else:
                df.loc[df.index[i], 'adx_vma'] = current_alpha * df['close'].iloc[i] + (1 - current_alpha) * df['adx_vma'].iloc[i-1]

    df['ADXVMA'] = df['adx_vma'].fillna(method='ffill').fillna(method='bfill') # Fill NaNs at start

    # Drop intermediate columns
    df = df.drop(columns=[col for col in df.columns if col not in ['high', 'low', 'open', 'close', 'ADXVMA']], errors='ignore')

    return df