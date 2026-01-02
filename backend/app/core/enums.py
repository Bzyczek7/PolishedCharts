"""Enumerations for the TradingAlert application."""

from enum import Enum


class AlertTriggerMode(str, Enum):
    """Alert trigger mode types.

    - once: Alert fires once and is automatically disabled
    - once_per_bar: Alert fires at most once per bar update
    - once_per_bar_close: Alert fires at most once per bar close (respects bar timestamps)
    """

    ONCE = "once"
    ONCE_PER_BAR = "once_per_bar"
    ONCE_PER_BAR_CLOSE = "once_per_bar_close"


class AlertCondition(str, Enum):
    """Alert condition types with clarified semantics.

    Price Conditions (existing):
    - above: Triggers when current > threshold AND previous <= threshold
    - below: Triggers when current < threshold AND previous >= threshold
    - crosses_up: Triggers when previous < threshold AND current >= threshold
    - crosses_down: Triggers when previous > threshold AND current <= threshold

    Indicator Conditions:
    - indicator_above_upper: Triggers when cRSI is above upper band (sell signal)
    - indicator_below_lower: Triggers when cRSI is below lower band (buy signal)
    - indicator_crosses_upper: Triggers when indicator crosses above threshold
    - indicator_crosses_lower: Triggers when indicator crosses below threshold
    - indicator_turns_positive: Triggers when indicator enters bullish zone (negative -> positive)
    - indicator_turns_negative: Triggers when indicator enters bearish zone (positive -> negative)
    - indicator_slope_bullish: Triggers when indicator slope changes from negative/flat to positive
    - indicator_slope_bearish: Triggers when indicator slope changes from positive/flat to negative
    - indicator_signal_change: Triggers when discrete signal value changes (e.g., 0 -> 1)
    """

    # Price conditions
    ABOVE = "above"
    BELOW = "below"
    CROSSES_UP = "crosses_up"
    CROSSES_DOWN = "crosses_down"

    # Indicator conditions
    INDICATOR_ABOVE_UPPER = "indicator_above_upper"
    INDICATOR_BELOW_LOWER = "indicator_below_lower"
    INDICATOR_CROSSES_UPPER = "indicator_crosses_upper"
    INDICATOR_CROSSES_LOWER = "indicator_crosses_lower"
    INDICATOR_TURNS_POSITIVE = "indicator_turns_positive"
    INDICATOR_TURNS_NEGATIVE = "indicator_turns_negative"
    INDICATOR_SLOPE_BULLISH = "indicator_slope_bullish"
    INDICATOR_SLOPE_BEARISH = "indicator_slope_bearish"
    INDICATOR_SIGNAL_CHANGE = "indicator_signal_change"

    @classmethod
    def price_conditions(cls) -> set:
        """Return set of price-based alert conditions."""
        return {
            cls.ABOVE,
            cls.BELOW,
            cls.CROSSES_UP,
            cls.CROSSES_DOWN,
        }

    @classmethod
    def indicator_conditions(cls) -> set:
        """Return set of indicator-based alert conditions."""
        return {
            cls.INDICATOR_ABOVE_UPPER,
            cls.INDICATOR_BELOW_LOWER,
            cls.INDICATOR_CROSSES_UPPER,
            cls.INDICATOR_CROSSES_LOWER,
            cls.INDICATOR_TURNS_POSITIVE,
            cls.INDICATOR_TURNS_NEGATIVE,
            cls.INDICATOR_SLOPE_BULLISH,
            cls.INDICATOR_SLOPE_BEARISH,
            cls.INDICATOR_SIGNAL_CHANGE,
        }
