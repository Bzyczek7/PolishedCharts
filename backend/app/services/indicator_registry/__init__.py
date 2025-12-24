"""Technical indicators registry package.

This package provides a plugin-based architecture for technical indicators.
New indicators can be added by:
1. Creating a class that extends Indicator
2. Implementing the calculate() method
3. Implementing the metadata property
4. (Optional) Implementing alert_templates
5. Registering with register_indicator()
"""

from app.services.indicator_registry.registry import (
    Indicator,
    IndicatorRegistry,
    SMAIndicator,
    EMAIndicator,
    TDFIIndicator,
    cRSIIndicator,
    ADXVMAIndicator,
    AlertTemplate,
    get_registry,
    register_indicator,
)

# Import calculation functions from the standalone indicators.py module for backward compatibility
from app.services import indicators as indicators_module

calculate_sma = indicators_module.calculate_sma
calculate_tdfi = indicators_module.calculate_tdfi
calculate_crsi = indicators_module.calculate_crsi
calculate_adxvma = indicators_module.calculate_adxvma

# Register built-in indicators
_registry = get_registry()
_registry.register(SMAIndicator())
_registry.register(EMAIndicator())
_registry.register(TDFIIndicator())
_registry.register(cRSIIndicator())
_registry.register(ADXVMAIndicator())

__all__ = [
    'Indicator',
    'IndicatorRegistry',
    'SMAIndicator',
    'EMAIndicator',
    'TDFIIndicator',
    'cRSIIndicator',
    'ADXVMAIndicator',
    'AlertTemplate',
    'get_registry',
    'register_indicator',
    'calculate_sma',
    'calculate_tdfi',
    'calculate_crsi',
    'calculate_adxvma',
]
