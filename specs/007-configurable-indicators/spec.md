# Feature Specification: Configurable Indicator Instances

**Feature Branch**: `007-configurable-indicators`
**Created**: 2025-12-25
**Status**: Draft
**Input**: User description: "Implement indicator instances to allow multiple instances of the same indicator type with different parameter values, each receiving a unique auto-generated name."

**Supported Indicators**: SMA, EMA, TDFI, cRSI, ADXVMA (all configurable via query parameters)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure SMA with Custom Period (Priority: P1)

As a trader, I want to request SMA indicator data with any period value so I can analyze short-term, medium-term, and long-term trends as needed.

**Why this priority**: This is the core value of the feature - enabling traders to analyze any time horizon without pre-registration.

**Independent Test**: Can be tested by requesting SMA with period=20, period=50, period=200 and verifying each returns correct calculated values.

**Acceptance Scenarios**:

1. **Given** the SMA indicator is available, **When** a user requests `/api/v1/indicators/AAPL/sma?period=50`, **Then** the system returns SMA values calculated with period=50
2. **Given** a user requests SMA with period=20 and later with period=50, **When** comparing results, **Then** each response uses the correct period independently
3. **Given** no period parameter is provided, **When** requesting SMA data, **Then** the system uses the default period (20)

---

### User Story 2 - Configure EMA with Custom Period (Priority: P1)

As a trader, I want to request EMA indicator data with any period value so I can analyze momentum across various timeframes.

**Why this priority**: EMA is a fundamental indicator for momentum analysis; dynamic configuration enables flexible multi-timeframe analysis.

**Independent Test**: Can be tested by requesting EMA with periods 9, 12, 20, 26, 50, 200 and verifying each returns correct calculated values.

**Acceptance Scenarios**:

1. **Given** the EMA indicator is available, **When** a user requests `/api/v1/indicators/AAPL/ema?period=9`, **Then** the system returns EMA values calculated with period=9
2. **Given** a user requests EMA with different period values, **When** each request is processed, **Then** the correct period is used for calculation
3. **Given** no period parameter is provided, **When** requesting EMA data, **Then** the system uses the default period (20)

---

### User Story 3 - Configure Multi-Parameter Indicators (Priority: P2)

As a trader, I want to request indicators with multiple parameters (like cRSI) so I can customize indicator behavior to my trading strategy.

**Why this priority**: Important for advanced indicators that require multiple parameters for proper configuration.

**Independent Test**: Can be tested by requesting cRSI with different parameter combinations and verifying calculations.

**Acceptance Scenarios**:

1. **Given** the cRSI indicator is available, **When** a user requests `/api/v1/indicators/AAPL/crsi?dom_cycle=20&vibration=14`, **Then** the system returns cRSI values with those parameters
2. **Given** partial parameters are provided, **When** a request omits some parameters, **Then** the system uses default values for missing parameters
3. **Given** all required parameters are provided, **When** calculating cRSI, **Then** the custom values are used instead of defaults

---

### User Story 4 - Maintain Backward Compatibility (Priority: P1)

As an existing user, I want my current indicator configurations to continue working so that my analysis and integrations are not disrupted.

**Why this priority**: Critical for system stability - existing users must not lose their current setups during the upgrade.

**Independent Test**: Can be tested by requesting SMA and EMA without parameters and verifying they return the same results as before.

**Acceptance Scenarios**:

1. **Given** existing code requests `/api/v1/indicators/AAPL/sma` (no parameters), **When** the system processes the request, **Then** it returns SMA with default period=20 (same as before)
2. **Given** existing code requests `/api/v1/indicators/AAPL/ema` (no parameters), **When** the system processes the request, **Then** it returns EMA with default period=20 (same as before)
3. **Given** existing API consumers reference indicator names, **When** queries are made after upgrade, **Then** all endpoints work unchanged with no breaking changes

---

### User Story 5 - Discover Available Indicators (Priority: P2)

As a trader, I want to see all available indicators and their configurable parameters so I know what options I have.

**Why this priority**: Important for usability - users need to discover what indicators are available and what parameters they accept.

**Independent Test**: Can be tested by querying the indicator list and verifying all indicators are displayed with their parameter definitions.

**Acceptance Scenarios**:

1. **Given** the system supports multiple indicators, **When** a user requests `/api/v1/indicators/supported`, **Then** all indicators (sma, ema, tdfi, crsi, adxvma) are listed with their parameter definitions
2. **Given** an indicator has configurable parameters, **When** viewing the indicator list, **Then** the parameters, types, and valid ranges are documented
3. **Given** default values exist, **When** viewing parameter definitions, **Then** default values are shown

---

### Edge Cases

- What happens when an invalid parameter value is provided?
  - **Resolved**: System returns 400 Bad Request with descriptive error message indicating the valid range for the parameter.
- What happens when a parameter is missing that has no default?
  - **Resolved**: System returns 400 Bad Request indicating which required parameter is missing.
- What happens when an unknown indicator is requested?
  - **Resolved**: System returns 404 Not Found with list of available indicators.
- What happens when parameter values are at boundary limits (e.g., period=1)?
  - **Resolved**: System accepts values at the boundary limits and calculates accordingly.
- What happens when multiple requests use different parameter values simultaneously?
  - **Resolved**: Each request is independent and stateless; the system calculates on-demand with the provided parameters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept indicator parameters via query string parameters
- **FR-002**: System MUST support SMA with configurable period parameter (default: 20)
- **FR-003**: System MUST support EMA with configurable period parameter (default: 20)
- **FR-004**: System MUST support TDFI with configurable lookback parameter (default: 13)
- **FR-005**: System MUST support cRSI with configurable parameters: dom_cycle (default: 20), vibration (default: 14), leveling (default: 11.0), cyclic_memory (default: 40)
- **FR-006**: System MUST support ADXVMA with configurable adxvma_period parameter (default: 15)
- **FR-007**: System MUST use default parameter values when not provided in request
- **FR-008**: System MUST validate parameter values against defined ranges
- **FR-009**: System MUST return 400 Bad Request for invalid parameter values with descriptive error message
- **FR-010**: System MUST maintain backward compatibility for requests without parameters (uses defaults)
- **FR-011**: System MUST provide endpoint to list all supported indicators with their parameter definitions

### Key Entities

- **Indicator Type**: The base indicator class/template (e.g., SMA, EMA, TDFI, cRSI, ADXVMA)
- **Parameter Definition**: The name, type, valid range, and default value for a configurable parameter
- **Indicator Request**: A request for indicator data including indicator type and parameter values
- **Default Parameters**: Pre-defined parameter values used when not specified in the request

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can request any supported indicator with custom parameter values without pre-registration
- **SC-002**: Indicator requests are processed and return results in under 100 milliseconds
- **SC-003**: 100% of existing indicator requests without parameters remain functional (backward compatibility)
- **SC-004**: Invalid parameter values are rejected with clear error messages indicating valid ranges
- **SC-005**: System can handle 100+ concurrent indicator requests with different parameters without performance degradation

## Assumptions

1. Default parameter values are defined for each indicator type
2. Indicator names are case-insensitive for lookups (sma, SMA, Sma all work)
3. Parameter values are limited to simple types (integers, floats, booleans, strings)
4. Indicator calculations are performed on-demand when data is requested
5. The system does not persist parameterized indicator instances - each request is stateless
6. Frontend can be updated to pass query parameters for custom indicator requests
7. Existing API endpoints that don't pass parameters will continue to work with defaults

## Dependencies

- Existing indicator base class architecture
- API endpoints for querying indicators with parameter support
- Frontend components for indicator selection and parameter input
- Indicator calculation logic that accepts parameter values

## API Contracts

### List Supported Indicators

**Endpoint**: `GET /api/v1/indicators/supported`

**Description**: Returns a list of all supported indicator types with their configurable parameters.

**Response**:
```json
{
  "indicators": [
    {
      "name": "sma",
      "display_name": "Simple Moving Average",
      "parameters": [
        {"name": "period", "type": "integer", "default": 20, "min": 1, "max": 500}
      ]
    },
    {
      "name": "ema",
      "display_name": "Exponential Moving Average",
      "parameters": [
        {"name": "period", "type": "integer", "default": 20, "min": 1, "max": 500}
      ]
    },
    {
      "name": "tdfi",
      "display_name": "Trend Direction & Force Index",
      "parameters": [
        {"name": "lookback", "type": "integer", "default": 13, "min": 1, "max": 100}
      ]
    },
    {
      "name": "crsi",
      "display_name": "Composite Relative Strength Index",
      "parameters": [
        {"name": "dom_cycle", "type": "integer", "default": 20, "min": 1, "max": 50},
        {"name": "vibration", "type": "integer", "default": 14, "min": 1, "max": 50},
        {"name": "leveling", "type": "float", "default": 11.0, "min": 1.0, "max": 50.0},
        {"name": "cyclic_memory", "type": "integer", "default": 40, "min": 1, "max": 100}
      ]
    },
    {
      "name": "adxvma",
      "display_name": "Average Directional Index Volatility Moving Average",
      "parameters": [
        {"name": "adxvma_period", "type": "integer", "default": 15, "min": 1, "max": 100}
      ]
    }
  ]
}
```

### Get Indicator Data with Parameters

**Endpoint**: `GET /api/v1/indicators/{symbol}/{indicator_name}?{parameters}`

**Description**: Returns calculated indicator values for a specific symbol with custom parameters.

**Examples**:
- `GET /api/v1/indicators/AAPL/sma?period=50`
- `GET /api/v1/indicators/AAPL/ema?period=9`
- `GET /api/v1/indicators/AAPL/crsi?dom_cycle=20&vibration=14`
- `GET /api/v1/indicators/AAPL/sma` (uses default period=20)

**Response**:
```json
{
  "symbol": "AAPL",
  "indicator": "sma",
  "parameters": {"period": 50},
  "data": [
    {"time": "2025-12-24T09:30:00Z", "value": 178.45},
    {"time": "2025-12-24T10:00:00Z", "value": 178.52},
    {"time": "2025-12-24T10:30:00Z", "value": 178.48}
  ]
}
```

### Error Responses

**Invalid Parameter Value**:
```json
{
  "error": "Invalid parameter value",
  "message": "SMA period must be between 1 and 500, got 1000",
  "parameter": "period",
  "provided": 1000,
  "valid_range": "1-500"
}
```

**Missing Required Parameter**:
```json
{
  "error": "Missing required parameter",
  "message": "Parameter 'dom_cycle' is required for cRSI indicator",
  "parameter": "dom_cycle"
}
```

**Unknown Indicator**:
```json
{
  "error": "Indicator not found",
  "message": "Indicator 'unknown_indicator' is not supported",
  "available_indicators": ["sma", "ema", "tdfi", "crsi", "adxvma"]
}
```

## Parameter Validation Rules

### SMA (Simple Moving Average)
- **period**: integer, 1 <= period <= 500, default: 20

### EMA (Exponential Moving Average)
- **period**: integer, 1 <= period <= 500, default: 20

### TDFI (Trend Direction & Force Index)
- **lookback**: integer, 1 <= lookback <= 100, default: 13

### cRSI (Composite Relative Strength Index)
- **dom_cycle**: integer, 1 <= dom_cycle <= 50, default: 20
- **vibration**: integer, 1 <= vibration <= 50, default: 14
- **leveling**: float, 1.0 <= leveling <= 50.0, default: 11.0
- **cyclic_memory**: integer, 1 <= cyclic_memory <= 100, default: 40

### ADXVMA (Average Directional Index Volatility Moving Average)
- **adxvma_period**: integer, 1 <= adxvma_period <= 100, default: 15

## Testing Strategy

### Unit Tests (pytest)

**Parameter Processing Tests**:
- `test_sma_default_period()` - Verify SMA uses period=20 when no parameter provided
- `test_sma_custom_period()` - Verify SMA uses provided period value
- `test_ema_custom_period()` - Verify EMA uses provided period value
- `test_crsi_multiple_parameters()` - Verify cRSI uses all provided parameters

**Validation Tests**:
- `test_sma_period_too_low()` - Verify period=0 returns 400 error
- `test_sma_period_too_high()` - Verify period=1000 returns 400 error
- `test_tdfi_lookback_validation()` - Verify lookback bounds enforced
- `test_crsi_missing_parameter()` - Verify missing required parameter returns 400 error

**Calculation Tests**:
- `test_sma_calculation_with_period_50()` - Verify correct values calculated
- `test_ema_calculation_with_period_9()` - Verify correct values calculated
- `test_crsi_calculation_custom_params()` - Verify correct values with custom parameters

**Performance Tests**:
- `test_request_processing_under_100ms()` - Benchmark indicator request performance
- `test_concurrent_requests_under_load()` - Verify 100+ concurrent requests handled

### Integration Tests

**API Endpoint Tests**:
- `test_api_supported_endpoint()` - Verify /api/v1/indicators/supported returns all indicators with parameters
- `test_api_indicator_with_query_params()` - Verify GET /indicators/AAPL/sma?period=50 works
- `test_api_indicator_without_params_uses_default()` - Verify GET /indicators/AAPL/sma uses default
- `test_api_invalid_parameter_error()` - Verify proper error for invalid parameter
- `test_api_unknown_indicator_error()` - Verify proper error for unknown indicator

**Backward Compatibility Tests**:
- `test_backward_compatibility_sma_no_params()` - Verify /indicators/AAPL/sma works with default period=20
- `test_backward_compatibility_ema_no_params()` - Verify /indicators/AAPL/ema works with default period=20
- `test_existing_endpoints_unchanged()` - Verify all existing endpoints work

**Multi-Parameter Tests**:
- `test_crsi_partial_parameters()` - Verify partial parameters use defaults for missing ones
- `test_crsi_all_parameters()` - Verify all parameters passed correctly
- `test_multiple_indicators_different_params()` - Verify multiple simultaneous requests work

### Test Fixtures

**Mock API Client**:
```python
@pytest.fixture
def api_client():
    """Provides a test API client for making indicator requests."""
    return TestClient(app)
```

**Sample Data Fixture**:
```python
@pytest.fixture
def sample_ohlc_data():
    """Provides sample OHLCV data for indicator calculation tests."""
    return pd.DataFrame({
        "open": [100.0, 101.0, 102.0],
        "high": [102.0, 103.0, 104.0],
        "low": [99.0, 100.0, 101.0],
        "close": [101.5, 102.5, 103.5],
        "volume": [1000, 1100, 1200]
    })
```

**Parameter Validation Fixture**:
```python
@pytest.fixture
def parameter_bounds():
    """Provides parameter validation rules for testing."""
    return {
        "sma": {"period": {"min": 1, "max": 500, "default": 20}},
        "ema": {"period": {"min": 1, "max": 500, "default": 20}},
        "tdfi": {"lookback": {"min": 1, "max": 100, "default": 13}},
        "crsi": {
            "dom_cycle": {"min": 1, "max": 50, "default": 20},
            "vibration": {"min": 1, "max": 50, "default": 14},
            "leveling": {"min": 1.0, "max": 50.0, "default": 11.0},
            "cyclic_memory": {"min": 1, "max": 100, "default": 40}
        },
        "adxvma": {"adxvma_period": {"min": 1, "max": 100, "default": 15}}
    }
```

## Out of Scope

- Persisting user's favorite parameter configurations
- UI for creating/saving custom indicator presets
- Dynamic parameter changes during real-time data streaming
- Sharing custom configurations between users
- Visual comparison tools for multiple parameter sets
- Automatic parameter optimization or suggestions
