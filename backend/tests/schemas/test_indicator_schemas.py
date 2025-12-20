import pytest
from app.schemas.indicator import TDFIOutput, cRSIOutput, ADXVMAOutput, IndicatorMetadata

def test_tdfi_output_schema():
    metadata = {"display_type": "pane", "color_schemes": {}}
    data = {
        "timestamps": ["2023-10-27T00:00:00"],
        "tdfi": [1.0, 2.0], 
        "tdfi_signal": [1, -1], 
        "metadata": metadata
    }
    model = TDFIOutput(**data)
    assert len(model.tdfi) == 2

def test_crsi_output_schema():
    metadata = {"display_type": "pane", "color_schemes": {}}
    data = {
        "timestamps": ["2023-10-27T00:00:00"],
        "crsi": [50.0], 
        "upper_band": [70.0], 
        "lower_band": [30.0], 
        "metadata": metadata
    }
    model = cRSIOutput(**data)
    assert model.crsi[0] == 50.0

def test_adxvma_output_schema():
    metadata = {"display_type": "overlay", "color_schemes": {}}
    data = {
        "timestamps": ["2023-10-27T00:00:00"],
        "adxvma": [100.0, 101.0], 
        "metadata": metadata
    }
    model = ADXVMAOutput(**data)
    assert len(model.adxvma) == 2
