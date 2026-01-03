"""
Indicator Service - Unified indicator calculation for API and alerts.

This service provides a single code path for calculating technical indicators,
used by both:
- /api/v1/indicators endpoints (user-facing)
- Alert evaluation system (background polling)

Pattern: registry.get(indicator_name).calculate(df, **params)
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.orchestrator import DataOrchestrator
from app.services.indicator_registry import get_registry
from app.models.symbol import Symbol
from app.models.alert import Alert

logger = logging.getLogger(__name__)

# Baseline candle count to ensure sufficient historical data
# This is the minimum number of candles we load for any indicator calculation
BASELINE_CANDLE_COUNT = 500


class IndicatorService:
    """
    Unified service for calculating technical indicators.
    
    This service ensures both API endpoints and alert evaluation
    use the same calculation logic via the indicator registry.
    """
    
    def __init__(self, orchestrator: DataOrchestrator):
        self.orchestrator = orchestrator
    
    @staticmethod
    def _get_max_period_from_params(params: Dict[str, Any]) -> int:
        """
        Extract the maximum period/length/window from indicator parameters.
        
        This ensures we load enough candles for indicators with large periods.
        For example, EMA(200) needs at least 200+ candles for proper calculation.
        
        Args:
            params: Indicator parameters dictionary
            
        Returns:
            Maximum period value found, or 0 if none
        """
        period_keys = ['length', 'period', 'lookback', 'window', 'fast', 'slow',
                       'adxvma_period', 'domcycle', 'vibration', 'cyclicmemory']
        
        max_period = 0
        for key in period_keys:
            value = params.get(key)
            if isinstance(value, (int, float)):
                max_period = max(max_period, int(value))
        
        return max_period
    
    def _calculate_required_candle_count(self, params: Dict[str, Any]) -> int:
        """
        Calculate the required number of candles for indicator calculation.
        
        Formula: BASELINE + max_period_from_params
        - RSI(14): 500 + 14 = 514 candles
        - EMA(200): 500 + 200 = 700 candles  
        - EMA(500): 500 + 500 = 1000 candles
        
        Args:
            params: Indicator parameters dictionary
            
        Returns:
            Required number of candles
        """
        max_period = self._get_max_period_from_params(params)
        return BASELINE_CANDLE_COUNT + max_period
    
    @staticmethod
    def _candle_count_to_timedelta(interval: str, candle_count: int) -> timedelta:
        """
        Convert candle count to timedelta based on interval.
        
        Args:
            interval: Time interval (1m, 5m, 15m, 1h, 4h, 1d, 1wk)
            candle_count: Number of candles needed
            
        Returns:
            timedelta representing the time range
        """
        interval_map = {
            '1m': timedelta(minutes=1),
            '2m': timedelta(minutes=2),
            '5m': timedelta(minutes=5),
            '15m': timedelta(minutes=15),
            '30m': timedelta(minutes=30),
            '1h': timedelta(hours=1),
            '4h': timedelta(hours=4),
            '1d': timedelta(days=1),
            '1wk': timedelta(weeks=1),
            '1w': timedelta(weeks=1),
        }
        
        delta = interval_map.get(interval.lower(), timedelta(days=1))
        return delta * candle_count
    
    async def calculate(
        self,
        db: AsyncSession,
        symbol_id: int,
        ticker: str,
        interval: str,
        indicator_name: str,
        params: Dict[str, Any],
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> pd.DataFrame:
        """
        Calculate an indicator using the registry.
        
        This is the unified entry point for ALL indicator calculations,
        whether for API requests or alert evaluation.
        
        Args:
            db: Database session
            symbol_id: Symbol ID
            ticker: Symbol ticker
            interval: Time interval (1m, 5m, 15m, 1h, 4h, 1d)
            indicator_name: Name of indicator (e.g., 'crsi', 'adxvma')
            params: Indicator parameters
            start: Start datetime (optional)
            end: End datetime (optional)
            
        Returns:
            DataFrame with calculated indicator values
            
        Raises:
            ValueError: If indicator not found or parameters invalid
        """
        # Normalize interval first
        interval_norm = interval.lower()
        if interval_norm == "1w":
            interval_norm = "1wk"
        indicator_name = indicator_name.lower()
        
        # Default: calculate based on indicator params to ensure enough historical data
        if not end:
            end = datetime.now(timezone.utc)
        if not start:
            # Calculate required candle count based on indicator parameters
            required_candles = self._calculate_required_candle_count(params)
            time_delta = self._candle_count_to_timedelta(interval_norm, required_candles)
            start = end - time_delta
            logger.debug(
                f"Calculated time range for {indicator_name}: {required_candles} candles "
                f"({interval_norm}) = {time_delta.days} days"
            )
        
        # 1. Fetch candles
        candles_data = await self.orchestrator.get_candles(
            db=db,
            symbol_id=symbol_id,
            ticker=ticker,
            interval=interval_norm,
            start=start,
            end=end
        )
        
        if not candles_data:
            raise ValueError(f"No candles found for {ticker} ({interval})")
        
        # 2. Convert to DataFrame
        df = pd.DataFrame(candles_data)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp")
        df = df.drop_duplicates(subset=["timestamp"], keep="first")
        
        # 3. Get indicator from registry
        registry = get_registry()
        indicator = registry.get(indicator_name)
        if not indicator:
            indicator = registry.get_by_base_name(indicator_name)
        
        if not indicator:
            raise ValueError(
                f"Indicator '{indicator_name}' not found. "
                f"Available: {list(registry._indicators.keys())}"
            )
        
        # 4. Calculate via registry (UNIFIED PATH)
        df_result = indicator.calculate(df, **params)
        
        return df_result
    
    async def calculate_for_alert(
        self,
        db: AsyncSession,
        alert: Alert,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculate indicator data for alert evaluation.
        
        Returns a dict with current and previous values for alert conditions.
        Format matches what alert_engine.evaluate_symbol_alerts() expects.
        
        Args:
            db: Database session
            alert: Alert object with indicator_name, indicator_field, indicator_params
            start: Start datetime (optional)
            end: End datetime (optional)
            
        Returns:
            Dict with indicator data:
            {
                "value": 75.5,           # Current value (primary field)
                "prev_value": 72.3,       # Previous value (for cross detection)
                "upper_band": 80.0,       # Optional: from indicator
                "lower_band": 20.0,       # Optional: from indicator
                # ... any other field from indicator
            }
        """
        if not alert.indicator_name:
            raise ValueError("Alert must have indicator_name")
        
        # Get symbol
        result = await db.execute(
            select(Symbol).where(Symbol.id == alert.symbol_id)
        )
        symbol = result.scalars().first()
        if not symbol:
            raise ValueError(f"Symbol not found for alert {alert.id}")
        
        # Get indicator params from alert
        params = alert.indicator_params or {}
        
        # Calculate indicator
        df_result = await self.calculate(
            db=db,
            symbol_id=symbol.id,
            ticker=symbol.ticker,
            interval=alert.interval or "1d",
            indicator_name=alert.indicator_name,
            params=params,
            start=start,
            end=end
        )
        
        if df_result.empty or len(df_result) < 2:
            logger.warning(f"Insufficient data for {alert.indicator_name} on {symbol.ticker}")
            return {}
        
        # Get indicator metadata to understand the fields
        registry = get_registry()
        indicator = registry.get(alert.indicator_name)
        if not indicator:
            indicator = registry.get_by_base_name(alert.indicator_name)
        
        # Build indicator_data dict for alert evaluation
        indicator_data = {}
        
        # Add current and previous values for the requested field
        field = alert.indicator_field or "value"
        if field in df_result.columns:
            indicator_data["value"] = float(df_result[field].iloc[-1])
            if len(df_result) >= 2:
                indicator_data["prev_value"] = float(df_result[field].iloc[-2])
        
        # Add ALL numeric fields from the indicator output
        # This allows alerts to use any field the indicator produces
        for col in df_result.columns:
            if col != "timestamp" and col not in indicator_data:
                # Only process numeric columns
                if pd.api.types.is_numeric_dtype(df_result[col]):
                    if len(df_result) >= 2:
                        # Include both current and previous values
                        val = df_result[col].iloc[-1]
                        prev_val = df_result[col].iloc[-2]
                        # Handle NaN values
                        indicator_data[col] = None if pd.isna(val) else float(val)
                        indicator_data[f"prev_{col}"] = None if pd.isna(prev_val) else float(prev_val)
                    else:
                        val = df_result[col].iloc[-1]
                        indicator_data[col] = None if pd.isna(val) else float(val)
        
        logger.debug(
            f"Calculated {alert.indicator_name} for {symbol.ticker}: "
            f"{list(indicator_data.keys())}"
        )

        return indicator_data
