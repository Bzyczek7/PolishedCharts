# Quickstart Guide: Parameterized Indicator Instances

This guide helps you implement parameterized indicator instances in ~30 minutes.

## Prerequisites

- Backend: Python 3.11+, FastAPI, SQLAlchemy
- Frontend: TypeScript 5.9+, React 19
- All tests passing before starting

## Implementation Checklist

### Step 1: Update Base Indicator Class (10 minutes)

**File**: `backend/app/services/indicator_registry/registry.py`

1. Add `__init__()` method to store default parameters:

```python
class Indicator(ABC):
    def __init__(self, **default_params):
        """Initialize indicator with optional default parameters."""
        self._default_params = default_params

    @property
    @abstractmethod
    def base_name(self) -> str:
        """Return the base indicator name (e.g., 'sma', 'ema')."""
        pass

    @property
    def name(self) -> str:
        """Generate unique name based on base_name and parameters."""
        if not self._default_params:
            return self.base_name

        # Check for primary length parameter
        length_params = ['period', 'length', 'lookback', 'window']
        for param in length_params:
            if param in self._default_params:
                return f"{self.base_name}_{self._default_params[param]}"

        # Fallback: use all parameters
        param_str = "_".join(f"{k}{v}" for k, v in self._default_params.items())
        return f"{self.base_name}_{param_str}"
```

2. Remove `name` property from all indicator classes (will be replaced with `base_name`)

### Step 2: Update Individual Indicators (15 minutes)

**File**: `backend/app/services/indicator_registry/registry.py`

For each indicator class (SMA, EMA, TDFI, cRSI, ADXVMA):

**Pattern**:

```python
# BEFORE
class SMAIndicator(Indicator):
    @property
    def name(self) -> str:
        return "sma"

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        period = kwargs.get('period', 20)  # hardcoded default
        # ...

# AFTER
class SMAIndicator(Indicator):
    def __init__(self, period: int = 20):
        """Initialize SMA with optional period override."""
        super().__init__(period=period)
        self._period = period

    @property
    def base_name(self) -> str:
        return "sma"

    @property
    def description(self) -> str:
        return f"Simple Moving Average (period={self._period})"

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        # Use instance default, but allow override
        period = kwargs.get('period', self._period)
        # ... (rest of method unchanged)
```

**Apply this pattern to**:
- `SMAIndicator(period=20)`
- `EMAIndicator(period=20)`
- `TDFIIndicator(lookback=13)`
- `cRSIIndicator(domcycle=20, vibration=14, leveling=11.0, cyclicmemory=40)`
- `ADXVMAIndicator(adxvma_period=15)`

### Step 3: Create Initialization Module (10 minutes)

**File**: `backend/app/services/indicator_registry/initialization.py` (NEW)

```python
"""Indicator registry initialization with standard variants."""

from app.services.indicator_registry.registry import (
    get_registry,
    SMAIndicator,
    EMAIndicator,
    TDFIIndicator,
    cRSIIndicator,
    ADXVMAIndicator,
)

def initialize_standard_indicators():
    """Register all standard indicator variants."""
    registry = get_registry()

    # SMA variants
    registry.register(SMAIndicator())      # "sma" (default: 20)
    registry.register(SMAIndicator(5))     # "sma_5"
    registry.register(SMAIndicator(10))    # "sma_10"
    registry.register(SMAIndicator(50))    # "sma_50"
    registry.register(SMAIndicator(200))   # "sma_200"

    # EMA variants
    registry.register(EMAIndicator())      # "ema" (default: 20)
    registry.register(EMAIndicator(9))     # "ema_9"
    registry.register(EMAIndicator(12))    # "ema_12"
    registry.register(EMAIndicator(26))    # "ema_26"
    registry.register(EMAIndicator(50))    # "ema_50"
    registry.register(EMAIndicator(200))   # "ema_200"

    # TDFI (single standard variant)
    registry.register(TDFIIndicator())     # "tdfi" (default: lookback=13)

    # cRSI (single standard variant)
    registry.register(cRSIIndicator())     # "crsi" (default params)

    # ADXVMA (single standard variant)
    registry.register(ADXVMAIndicator())   # "adxvma" (default: 15)
```

### Step 4: Update App Startup (5 minutes)

**File**: `backend/app/main.py`

```python
# At top of file:
from app.services.indicator_registry.initialization import initialize_standard_indicators

# In startup_event():
@app.on_event("startup")
async def startup_event():
    # ... existing code ...

    # Initialize indicator registry with standard variants
    initialize_standard_indicators()
    print("✓ Indicator registry initialized with standard variants")

    # ... rest of startup ...
```

### Step 5: Update Module Import (5 minutes)

**File**: `backend/app/services/indicator_registry/__init__.py`

Remove the old inline registrations (lines 33-39) since they're now in `initialization.py`:

```python
# REMOVE these lines:
# _registry = get_registry()
# _registry.register(SMAIndicator())
# _registry.register(EMAIndicator())
# _registry.register(TDFIIndicator())
# _registry.register(cRSIIndicator())
# _registry.register(ADXVMAIndicator())
```

### Step 6: Update Tests (10 minutes)

**File**: `backend/tests/services/test_indicator_registry.py`

```python
def test_sma_default_name():
    """Test that default SMA gets 'sma' name."""
    indicator = SMAIndicator()
    assert indicator.name == "sma"

def test_sma_with_period_name():
    """Test that SMA(50) gets 'sma_50' name."""
    indicator = SMAIndicator(50)
    assert indicator.name == "sma_50"

def test_registry_no_overwrite():
    """Test that SMA(20) and SMA(50) don't overwrite."""
    registry = IndicatorRegistry()
    registry.register(SMAIndicator())      # "sma"
    registry.register(SMAIndicator(50))    # "sma_50"

    assert registry.get("sma") is not None
    assert registry.get("sma_50") is not None
    assert registry.get("sma") != registry.get("sma_50")
```

Run tests:

```bash
cd backend
pytest tests/services/test_indicator_registry.py -v
```

### Step 7: Verify API (5 minutes)

```bash
# Start the server
cd backend
python start_server.py

# In another terminal, test the API
curl http://localhost:8000/api/v1/indicators/supported

# Should return all variants:
# - sma, sma_5, sma_10, sma_50, sma_200
# - ema, ema_9, ema_12, ema_26, ema_50, ema_200
# - tdfi, crsi, adxvma

# Test calculating with a variant
curl http://localhost:8000/api/v1/indicators/AAPL/sma_50?interval=1d
```

### Step 8: Frontend Verification (No Code Changes)

The frontend will auto-discover the new variants via the existing API:

1. Open the frontend
2. Click "Add Indicator"
3. You should now see: `sma`, `sma_5`, `sma_10`, `sma_50`, `sma_200`, etc.
4. Select a variant and verify it calculates correctly

## What Changed vs. What Didn't

### Changed

| Component | Change |
|-----------|--------|
| `Indicator` base class | Added `__init__()`, made `name` computed property |
| All indicator classes | Renamed `name` → `base_name`, added `__init__()` |
| `__init__.py` | Removed inline registrations |
| `main.py` | Added call to `initialize_standard_indicators()` |

### Didn't Change

| Component | Reason |
|-----------|--------|
| `IndicatorRegistry` | Already works with any Indicator instance |
| API endpoints | Already dynamic, no hardcoding |
| Frontend components | Already auto-discover from API |
| Database schema | No persistence needed for indicator definitions |

## Verification Checklist

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] API returns all variants
- [ ] Can calculate with variant names (e.g., `sma_50`)
- [ ] Default names still work (backward compatibility)
- [ ] Frontend shows all indicators
- [ ] No console errors in browser

## Common Issues & Fixes

### Issue: "Indicator not found" error

**Fix**: Make sure `initialize_standard_indicators()` is called in `startup_event()`.

### Issue: Name collisions

**Fix**: If two instances have identical parameters, the last one wins. This is expected behavior.

### Issue: Test failures

**Fix**: Update tests to use `base_name` property instead of `name` property for comparisons.

### Issue: Frontend not showing new indicators

**Fix**: Hard refresh the browser (Ctrl+Shift+R) to clear API response caching.

## Next Steps

After completing this quickstart:

1. Add custom variants for specific use cases
2. Document any new variants in the API docs
3. Consider adding parameter validation (min/max) in `parameter_definitions`
4. Optional: Group variants in frontend dropdown by base indicator

## Support

If you encounter issues:

1. Check the research.md for design rationale
2. Review the data-model.md for entity relationships
3. Consult api.yaml for API contracts
4. Run tests to isolate the problem
