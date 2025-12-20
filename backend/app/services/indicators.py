import pandas as pd
import numpy as np
from typing import Optional

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
