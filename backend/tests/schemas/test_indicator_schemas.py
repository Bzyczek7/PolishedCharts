import pytest
from pydantic import ValidationError
from app.schemas.indicator import IndicatorMetadata, SeriesMetadata

def test_series_metadata_validation():
    # Should work with defaults
    sm = SeriesMetadata(
        field="tdfi",
        role="main",
        label="TDFI",
        line_color="#E91E63"
    )
    assert sm.line_style == "solid"
    assert sm.line_width == 2
    assert sm.display_type == "line"

def test_indicator_metadata_extended():
    metadata = IndicatorMetadata(
        display_type="pane",
        color_schemes={"line": "#2196F3"},
        color_mode="threshold",
        thresholds={"high": 0.05, "low": -0.05},
        series_metadata=[
            {
                "field": "tdfi",
                "role": "main",
                "label": "TDFI",
                "line_color": "#E91E63",
                "line_style": "solid"
            }
        ]
    )
    assert metadata.color_mode == "threshold"
    assert metadata.thresholds["high"] == 0.05
    assert metadata.series_metadata[0].line_style == "solid"