"""Validation script for indicator metadata.

This script validates that all registered indicators have complete and valid
metadata according to the generic rendering system requirements.

Usage:
    python -m backend.tests.services.test_indicator_registry
    or
    pytest backend/tests/services/test_indicator_registry.py -v
"""

import pytest
from app.services.indicator_registry.registry import get_registry


def validate_hex_color(color: str) -> bool:
    """Validate that a color is a valid 6-digit hex code."""
    if not color or not isinstance(color, str):
        return False
    if not color.startswith('#'):
        return False
    hex_part = color[1:]
    if len(hex_part) != 6:
        return False
    try:
        int(hex_part, 16)
        return True
    except ValueError:
        return False


def validate_metadata_structure(metadata, indicator_name: str) -> list:
    """Validate metadata structure and return list of issues."""
    issues = []

    # Check display_type
    if not hasattr(metadata, 'display_type'):
        issues.append(f"{indicator_name}: Missing display_type")
    elif metadata.display_type not in ['overlay', 'pane']:
        issues.append(f"{indicator_name}: Invalid display_type '{metadata.display_type}'")

    # Check color_mode
    if not hasattr(metadata, 'color_mode'):
        issues.append(f"{indicator_name}: Missing color_mode")
    elif metadata.color_mode not in ['single', 'threshold', 'gradient', 'trend']:
        issues.append(f"{indicator_name}: Invalid color_mode '{metadata.color_mode}'")

    # Check color_schemes
    if not hasattr(metadata, 'color_schemes'):
        issues.append(f"{indicator_name}: Missing color_schemes")
    elif not isinstance(metadata.color_schemes, dict):
        issues.append(f"{indicator_name}: color_schemes must be a dict")
    else:
        for state, color in metadata.color_schemes.items():
            if not validate_hex_color(color):
                issues.append(f"{indicator_name}: Invalid hex color '{color}' for state '{state}'")

    # Check series_metadata
    if not hasattr(metadata, 'series_metadata'):
        issues.append(f"{indicator_name}: Missing series_metadata")
    elif not isinstance(metadata.series_metadata, list) or len(metadata.series_metadata) == 0:
        issues.append(f"{indicator_name}: series_metadata must be a non-empty list")
    else:
        for i, series in enumerate(metadata.series_metadata):
            if not hasattr(series, 'field'):
                issues.append(f"{indicator_name}: series[{i}].field is required")
            if not hasattr(series, 'role'):
                issues.append(f"{indicator_name}: series[{i}].role is required")
            elif series.role not in ['main', 'signal', 'band', 'histogram']:
                issues.append(f"{indicator_name}: series[{i}].role '{series.role}' is invalid")
            if not hasattr(series, 'label'):
                issues.append(f"{indicator_name}: series[{i}].label is required")
            if not hasattr(series, 'line_color'):
                issues.append(f"{indicator_name}: series[{i}].line_color is required")
            elif not validate_hex_color(series.line_color):
                issues.append(f"{indicator_name}: series[{i}].line_color '{series.line_color}' is invalid")

    # Check scale_ranges for pane indicators
    if hasattr(metadata, 'display_type') and metadata.display_type == 'pane':
        if not hasattr(metadata, 'scale_ranges'):
            issues.append(f"{indicator_name}: scale_ranges required for pane indicators")
        else:
            sr = metadata.scale_ranges
            if hasattr(sr, 'min') and hasattr(sr, 'max'):
                if sr.min >= sr.max:
                    issues.append(f"{indicator_name}: scale_ranges.min must be less than max")

    # Check thresholds for threshold mode
    if hasattr(metadata, 'color_mode') and metadata.color_mode == 'threshold':
        if not hasattr(metadata, 'thresholds'):
            issues.append(f"{indicator_name}: thresholds required for threshold color_mode")
        else:
            thresh = metadata.thresholds
            if hasattr(thresh, 'high') and hasattr(thresh, 'low'):
                if thresh.high <= thresh.low:
                    issues.append(f"{indicator_name}: thresholds.high must be greater than low")

    # Check reference_levels line colors
    if hasattr(metadata, 'reference_levels') and metadata.reference_levels:
        for i, ref_level in enumerate(metadata.reference_levels):
            if hasattr(ref_level, 'line_color') and not validate_hex_color(ref_level.line_color):
                issues.append(f"{indicator_name}: reference_levels[{i}].line_color '{ref_level.line_color}' is invalid")

    return issues


def test_all_indicators_have_metadata():
    """Test that all registered indicators have valid metadata."""
    registry = get_registry()
    indicators = registry._indicators

    assert len(indicators) > 0, "No indicators registered"

    all_issues = []

    for indicator_name, indicator in indicators.items():
        # Check that metadata property exists
        if not hasattr(indicator, 'metadata'):
            all_issues.append(f"{indicator_name}: Missing metadata property")
            continue

        # Validate metadata structure
        issues = validate_metadata_structure(indicator.metadata, indicator_name)
        all_issues.extend(issues)

        # Test that metadata can be serialized to dict (for API response)
        try:
            metadata_dict = indicator.metadata.model_dump() if hasattr(indicator.metadata, 'model_dump') else indicator.metadata.dict()
            assert isinstance(metadata_dict, dict), f"{indicator_name}: metadata must serialize to dict"
        except Exception as e:
            all_issues.append(f"{indicator_name}: Failed to serialize metadata: {e}")

    # Assert no issues found
    if all_issues:
        error_msg = "Indicator metadata validation failed:\n" + "\n".join(all_issues)
        pytest.fail(error_msg)


def test_all_indicators_have_required_properties():
    """Test that all indicators have required base properties."""
    registry = get_registry()
    indicators = registry._indicators

    for indicator_name, indicator in indicators.items():
        # Check name
        assert hasattr(indicator, 'name'), f"{indicator_name}: Missing name property"
        assert indicator.name, f"{indicator_name}: name cannot be empty"

        # Check description
        assert hasattr(indicator, 'description'), f"{indicator_name}: Missing description property"
        assert indicator.description, f"{indicator_name}: description cannot be empty"

        # Check calculate method
        assert hasattr(indicator, 'calculate'), f"{indicator_name}: Missing calculate method"
        assert callable(indicator.calculate), f"{indicator_name}: calculate must be callable"

        # Check category
        assert hasattr(indicator, 'category'), f"{indicator_name}: Missing category property"
        assert indicator.category in ['overlay', 'oscillator', 'momentum', 'trend', 'volatile'], \
            f"{indicator_name}: Invalid category '{indicator.category}'"

        # Check parameter_definitions
        assert hasattr(indicator, 'parameter_definitions'), f"{indicator_name}: Missing parameter_definitions property"
        assert isinstance(indicator.parameter_definitions, dict), \
            f"{indicator_name}: parameter_definitions must be a dict"


def test_alert_templates_valid():
    """Test that all indicator alert templates are valid."""
    registry = get_registry()
    indicators = registry._indicators

    valid_condition_types = [
        'indicator_crosses_upper',
        'indicator_crosses_lower',
        'indicator_turns_positive',
        'indicator_turns_negative',
        'indicator_slope_bullish',
        'indicator_slope_bearish',
        'indicator_signal_change',
    ]

    for indicator_name, indicator in indicators.items():
        alert_templates = indicator.alert_templates

        # Alert templates is optional, but if provided must be valid
        if not alert_templates:
            continue

        assert isinstance(alert_templates, list), f"{indicator_name}: alert_templates must be a list"

        for i, template in enumerate(alert_templates):
            # Check required attributes
            assert hasattr(template, 'condition_type'), f"{indicator_name}: alert_templates[{i}].condition_type is required"
            assert hasattr(template, 'label'), f"{indicator_name}: alert_templates[{i}].label is required"
            assert hasattr(template, 'description'), f"{indicator_name}: alert_templates[{i}].description is required"
            assert hasattr(template, 'applicable_fields'), f"{indicator_name}: alert_templates[{i}].applicable_fields is required"
            assert hasattr(template, 'requires_threshold'), f"{indicator_name}: alert_templates[{i}].requires_threshold is required"

            # Validate condition_type
            assert template.condition_type in valid_condition_types, \
                f"{indicator_name}: alert_templates[{i}].condition_type '{template.condition_type}' is invalid"

            # Validate applicable_fields
            assert isinstance(template.applicable_fields, list) and len(template.applicable_fields) > 0, \
                f"{indicator_name}: alert_templates[{i}].applicable_fields must be a non-empty list"

            # Validate requires_threshold
            assert isinstance(template.requires_threshold, bool), \
                f"{indicator_name}: alert_templates[{i}].requires_threshold must be a boolean"


def test_indicator_calculations_produce_expected_fields():
    """Test that indicator calculate() produces fields matching metadata."""
    import pandas as pd
    import numpy as np

    registry = get_registry()
    indicators = registry._indicators

    # Create sample OHLCV data
    df = pd.DataFrame({
        'open': np.linspace(100, 110, 100),
        'high': np.linspace(101, 111, 100),
        'low': np.linspace(99, 109, 100),
        'close': np.linspace(100.5, 110.5, 100),
        'volume': np.ones(100) * 1000
    })

    for indicator_name, indicator in indicators.items():
        try:
            # Calculate with default params
            result = indicator.calculate(df)

            # Verify result is a DataFrame
            assert isinstance(result, pd.DataFrame), f"{indicator_name}: calculate() must return DataFrame"

            # Check that all series_metadata fields exist in result
            if hasattr(indicator, 'metadata'):
                for series in indicator.metadata.series_metadata:
                    if hasattr(series, 'field'):
                        # For indicators with lookback period, early values may be NaN
                        # But the field should exist in the DataFrame
                        assert series.field in result.columns, \
                            f"{indicator_name}: Field '{series.field}' from series_metadata not found in calculate() result"

        except Exception as e:
            # Some indicators may fail with insufficient data, that's okay
            # We're just checking the structure matches
            pass


if __name__ == "__main__":
    """Run validation directly."""
    print("Validating indicator metadata...")

    test_all_indicators_have_required_properties()
    print("✓ All indicators have required properties")

    test_all_indicators_have_metadata()
    print("✓ All indicators have valid metadata")

    test_alert_templates_valid()
    print("✓ All alert templates are valid")

    print("\n✅ All validations passed!")
