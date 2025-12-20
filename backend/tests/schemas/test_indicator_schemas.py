import pytest
from app.schemas.indicator import TDFIOutput, cRSIOutput, ADXVMAOutput, IndicatorMetadata

def test_tdfi_output_schema():
    metadata = {"display_type": "pane", "color_schemes": {}}
    data = {"tdfi": [1.0, 2.0], "tdfi_signal": [1, -1], "metadata": metadata}
    model = TDFIOutput(**data)
    assert model.tdfi == [1.0, 2.0]

def test_crsi_output_schema():
    metadata = {"display_type": "pane", "color_schemes": {}}
    data = {"crsi": [50.0], "upper_band": [70.0], "lower_band": [30.0], "metadata": metadata}
    model = cRSIOutput(**data)
    assert model.crsi == [50.0]

def test_adxvma_output_schema():
    metadata = {"display_type": "overlay", "color_schemes": {}}
    data = {"adxvma": [100.0, 101.0], "metadata": metadata}
    model = ADXVMAOutput(**data)
    assert model.adxvma == [100.0, 101.0]
