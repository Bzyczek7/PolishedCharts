"""Indicator registry initialization with standard variants.

This module registers standard indicator variants at application startup.
Standard variants are the most commonly used indicator configurations.
Also provides auto-registration for all pandas-ta indicators (Feature 010 Phase 2).
"""

import json
import logging
from typing import Dict, Any
from app.services.indicator_registry.registry import (
    get_registry,
    SMAIndicator,
    EMAIndicator,
    TDFIIndicator,
    cRSIIndicator,
    ADXVMAIndicator,
    RSIIndicator,
    MACDIndicator,
    BBANDSIndicator,
    ATRIndicator,
    Indicator,
)
from app.services.indicator_registry import pandas_ta_wrapper

logger = logging.getLogger(__name__)

# Flag to control auto-registration of pandas-ta indicators
# DISABLED: Causes serialization errors with numpy/pandas objects in JSON responses
_AUTO_REGISTER_PANDAS_TA = False


def initialize_standard_indicators() -> None:
    """Register all standard indicator variants.

    Standard variants are predefined indicator configurations that
    are most commonly used by traders. These are registered at
    application startup and available via the API.

    Variants registered:
    - SMA: default (20) - users can change length via parameters
    - EMA: default (20) - users can change length via parameters
    - TDFI: default (lookback=13)
    - cRSI: default (domcycle=20, vibration=14, leveling=11.0, cyclicmemory=40)
    - ADXVMA: default (period=15)
    """
    registry = get_registry()

    # SMA - single variant with configurable period
    registry.register(SMAIndicator())       # "sma" (default: 20)

    # EMA - single variant with configurable period
    registry.register(EMAIndicator())       # "ema" (default: 20)

    # TDFI - single standard variant
    registry.register(TDFIIndicator())      # "tdfi" (default: lookback=13)

    # cRSI - single standard variant
    registry.register(cRSIIndicator())      # "crsi" (default params)

    # ADXVMA - single standard variant
    registry.register(ADXVMAIndicator())    # "adxvma" (default: 15)

    # pandas-ta indicators - cornerstone indicators (Phase 1)
    registry.register(RSIIndicator())       # "rsi" (default: 14)
    registry.register(MACDIndicator())      # "macd" (default: 12, 26, 9)
    registry.register(BBANDSIndicator())    # "bbands" (default: 20, 2.0)
    registry.register(ATRIndicator())       # "atr" (default: 14)

    # Phase 2: Auto-register all remaining pandas-ta indicators
    if _AUTO_REGISTER_PANDAS_TA:
        auto_count = pandas_ta_wrapper.register_all_pandas_ta_indicators(registry)
        logger.info(f"Auto-registered {auto_count} pandas-ta indicators")

    logger.info(f"Registered {len(registry._indicators)} standard indicator variants")


def deserialize_indicator_params(serialized: str) -> Indicator:
    """Deserialize indicator from JSON string.

    Creates a new indicator instance from a serialized representation.
    Supports both manually-implemented indicators and auto-registered pandas-ta indicators.

    Args:
        serialized: JSON string containing base_name and parameters

    Returns:
        Indicator instance with the specified parameters

    Raises:
        ValueError: If base_name is unknown or parameters are invalid
    """
    data = json.loads(serialized)
    base_name = data["base_name"]
    params = data.get("parameters", {})

    # Map base_name to indicator class for manually-implemented indicators
    indicator_classes = {
        "sma": SMAIndicator,
        "ema": EMAIndicator,
        "tdfi": TDFIIndicator,
        "crsi": cRSIIndicator,
        "adxvma": ADXVMAIndicator,
        # pandas-ta cornerstones (explicit classes for full control)
        "rsi": RSIIndicator,
        "macd": MACDIndicator,
        "bbands": BBANDSIndicator,
        "atr": ATRIndicator,
    }

    if base_name in indicator_classes:
        indicator_class = indicator_classes[base_name]
        return indicator_class(**params)

    # Fall back to pandas-ta auto-wrapper for all other indicators
    # This handles both cornerstones (if not in explicit map) and all other pandas-ta indicators
    registry = get_registry()
    if base_name in registry._indicators:
        # Indicator exists in registry, use the pandas-ta wrapper factory
        return pandas_ta_wrapper.create_indicator_with_params(base_name, params)

    raise ValueError(f"Unknown indicator base_name: {base_name}")


# Default path for user-defined indicator configurations
_USER_INDICATORS_PATH = "app/services/indicator_registry/registered_indicators.json"


def save_registered_indicators(registry, filepath: str = None) -> None:
    """Save user-defined indicator configurations to JSON file.

    Args:
        registry: The IndicatorRegistry instance containing indicators to save
        filepath: Path to save file (defaults to USER_INDICATORS_PATH)

    Note:
        Only saves indicators that differ from standard variants.
        Standard variants are registered by initialize_standard_indicators().
    """
    if filepath is None:
        filepath = _USER_INDICATORS_PATH

    # Standard indicator names (from initialization.py)
    standard_indicators = {
        "sma",  # Single SMA with configurable period
        "ema",  # Single EMA with configurable period
        "tdfi", "crsi", "adxvma",
        "rsi", "macd", "bbands", "atr"  # pandas-ta indicators
    }

    # Collect user-defined indicators (non-standard)
    user_indicators = []
    for name, indicator in registry._indicators.items():
        if name not in standard_indicators:
            serialized = indicator.serialize_params()
            data = json.loads(serialized)
            data["name"] = name  # Include the generated name
            user_indicators.append(data)

    # Write to file
    with open(filepath, 'w') as f:
        json.dump({"indicators": user_indicators}, f, indent=2)

    logger.info(f"Saved {len(user_indicators)} user-defined indicators to {filepath}")


def load_registered_indicators(registry, filepath: str = None) -> None:
    """Load and register user-defined indicator configurations from JSON file.

    Args:
        registry: The IndicatorRegistry instance to register indicators into
        filepath: Path to load file from (defaults to USER_INDICATORS_PATH)

    Note:
        If file doesn't exist, this function does nothing (no error).
    """
    import os

    if filepath is None:
        filepath = _USER_INDICATORS_PATH

    # If file doesn't exist, nothing to load
    if not os.path.exists(filepath):
        logger.info(f"No user-defined indicators file at {filepath}")
        return

    # Load and deserialize indicators
    with open(filepath, 'r') as f:
        data = json.load(f)

    count = 0
    for item in data.get("indicators", []):
        try:
            # Reconstruct indicator from saved data
            serialized = json.dumps({
                "base_name": item["base_name"],
                "parameters": item["parameters"]
            })
            indicator = deserialize_indicator_params(serialized)
            registry.register(indicator)
            count += 1
        except Exception as e:
            logger.warning(f"Failed to load indicator '{item.get('name', 'unknown')}': {e}")

    logger.info(f"Loaded {count} user-defined indicators from {filepath}")
