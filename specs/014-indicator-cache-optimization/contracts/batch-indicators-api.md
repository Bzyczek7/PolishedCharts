# API Contract: Batch Indicators Endpoint

**Feature**: 014-indicator-cache-optimization
**Version**: 1.0.0
**Status**: Phase 1 - Design

## Endpoint Definition

### POST /api/v1/indicators/batch

Calculate multiple indicators in a single request with optimized caching.

**Authentication**: None required (public endpoint)
**Content-Type**: `application/json`
**Accept**: `application/json`

## Request Schema

### Method

`POST /api/v1/indicators/batch`

### Headers

```http
Content-Type: application/json
Accept: application/json
```

### Body

```json
{
    "requests": [
        {
            "symbol": "SPY",
            "indicator_name": "crsi",
            "interval": "1d",
            "params": {
                "domcycle": 10,
                "vibration": 8,
                "leveling": 3.0,
                "cyclicmemory": 30
            },
            "from": "2023-01-01T00:00:00Z",
            "to": "2024-01-01T00:00:00Z"
        },
        {
            "symbol": "SPY",
            "indicator_name": "sma",
            "interval": "1d",
            "params": {
                "period": 20
            },
            "from": "2023-01-01T00:00:00Z",
            "to": "2024-01-01T00:00:00Z"
        },
        {
            "symbol": "QQQ",
            "indicator_name": "tdfi",
            "interval": "1h",
            "params": {
                "lookback": 14,
                "filter_high": 0.05,
                "filter_low": -0.05
            }
        }
    ]
}
```

### Request Model

```python
class IndicatorRequest(BaseModel):
    symbol: str                      # Required: Stock symbol (e.g., "SPY")
    indicator_name: str              # Required: Indicator name (e.g., "crsi", "sma")
    interval: str = "1d"             # Optional: Timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1wk)
    params: Optional[Dict[str, Any]] = None  # Optional: Indicator-specific parameters
    from_ts: Optional[datetime] = None      # Optional: Start timestamp (alias: "from")
    to_ts: Optional[datetime] = None        # Optional: End timestamp (alias: "to")

class BatchIndicatorRequest(BaseModel):
    requests: List[IndicatorRequest] # Required: List of indicator requests
    # Constraints: min_length=1, max_length=10 (FR-010)
```

### Constraints

- `requests`: Must contain 1-10 items (FR-010)
- `symbol`: Must be a valid stock ticker (will be validated against database)
- `indicator_name`: Must exist in indicator registry
- `interval`: Must be one of: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1wk`
- `from_ts`: If provided, must be before `to_ts`
- `params`: If provided, must match indicator's parameter definitions

## Response Schema

### Success Response (200 OK)

```json
{
    "results": [
        {
            "symbol": "SPY",
            "interval": "1d",
            "timestamps": [946684800, 946771200, 946857600, ...],
            "data": {
                "crsi": [50.0, 52.3, 51.8, 53.1, ...],
                "upper_band": [70.0, 70.5, 70.2, 70.8, ...],
                "lower_band": [30.0, 29.5, 29.8, 29.2, ...]
            },
            "metadata": {
                "name": "crsi",
                "display_name": "cRSI",
                "description": "Composite Relative Strength Index",
                "category": "momentum",
                "series_metadata": [...]
            },
            "calculated_at": "2026-01-02T10:30:00Z",
            "data_points": 10000
        },
        {
            "symbol": "SPY",
            "interval": "1d",
            "timestamps": [946684800, 946771200, 946857600, ...],
            "data": {
                "sma": [450.2, 450.8, 451.3, ...]
            },
            "metadata": {...},
            "calculated_at": "2026-01-02T10:30:00Z",
            "data_points": 10000
        },
        {
            "symbol": "QQQ",
            "interval": "1h",
            "timestamps": [...],
            "data": {
                "tdfi": [...],
                "filter_high": [...],
                "filter_low": [...]
            },
            "metadata": {...},
            "calculated_at": "2026-01-02T10:30:00Z",
            "data_points": 5000
        }
    ],
    "errors": [],
    "total_duration_ms": 168.5,
    "cache_hits": 2,
    "cache_misses": 1
}
```

### Partial Success Response (200 OK with errors)

```json
{
    "results": [
        {
            "symbol": "SPY",
            "interval": "1d",
            "timestamps": [...],
            "data": {...},
            "metadata": {...},
            "calculated_at": "2026-01-02T10:30:00Z",
            "data_points": 10000
        }
    ],
    "errors": [
        {
            "index": 1,
            "symbol": "INVALID",
            "indicator_name": "sma",
            "error": "Symbol 'INVALID' not found"
        },
        {
            "index": 2,
            "symbol": "SPY",
            "indicator_name": "unknown_indicator",
            "error": "Indicator 'unknown_indicator' not found. Available: [crsi, sma, tdfi, ...]"
        }
    ],
    "total_duration_ms": 85.3,
    "cache_hits": 1,
    "cache_misses": 0
}
```

### Response Model

```python
class BatchIndicatorResponse(BaseModel):
    results: List[IndicatorOutput]  # Successful indicator calculations
    errors: List[ErrorDetail]        # Failed calculations (partial failure support)
    total_duration_ms: float         # Total processing time (milliseconds)
    cache_hits: int                  # Number of requests served from cache
    cache_misses: int                # Number of requests requiring calculation

class ErrorDetail(BaseModel):
    index: int                       # Index in the original request array
    symbol: str                      # Symbol from the request
    indicator_name: str              # Indicator name from the request
    error: str                       # Human-readable error message
```

### Response Codes

| Status | Description |
|--------|-------------|
| 200 OK | Request processed successfully (may include partial failures) |
| 400 Bad Request | Invalid request body or parameters |
| 422 Unprocessable Entity | Validation errors (e.g., invalid interval format) |
| 500 Internal Server Error | Server error during processing |

## Behavior Specification

### Caching Behavior

1. **Cache-First Strategy**: Check cache before any database work
2. **Deduplication**: If multiple requests are identical, calculate once
3. **Shared Candle Cache**: Same symbol/interval uses cached candle data
4. **Cache Invalidation**: Not triggered by batch endpoint (relies on data updater)

### Processing Strategy

1. **Parallel Processing**: Use `asyncio.gather()` for independent requests
2. **Dependency Awareness**: Serial processing only for same symbol/interval (candle reuse)
3. **Timeout Protection**: Maximum 5 seconds for entire batch (FR-014)
4. **Partial Failure**: Continue processing other requests if one fails (FR-003 acceptance)

### Performance Targets

| Metric | Target | Measurement Point |
|--------|--------|-------------------|
| Total response time (3 cached) | <100ms | From request received to response sent |
| Total response time (3 uncached) | <200ms | From request received to response sent |
| Cache hit rate | >70% | Percentage of requests served from cache |
| Maximum batch size | 10 requests | Enforced at request validation |

### Error Handling

**Individual Request Errors** (partial failure):
- Symbol not found: Return error in `errors` array, continue processing
- Indicator not found: Return error in `errors` array, continue processing
- Invalid parameters: Return error in `errors` array, continue processing
- Calculation error: Return error in `errors` array, continue processing

**Batch-Level Errors** (fail entire request):
- Invalid request body format: Return 400
- Requests array empty or exceeds 10: Return 422
- All requests failed: Return 200 with empty `results`, all in `errors`

**Timeout Handling**:
- If batch exceeds 5 seconds: Cancel remaining requests, return partial results
- Include timeout information in error messages

## Query String Alternative

For compatibility with existing single-indicator endpoint, the batch endpoint also supports query string format for single requests:

### GET /api/v1/indicators/batch?symbol=SPY&indicator=crsi,sma,tdfi

**Parameters**:
- `symbol`: Stock symbol (required if using body)
- `indicator`: Comma-separated list of indicator names (alternative to body)
- `interval`: Timeframe (default: "1d")
- `from`: Start timestamp (optional)
- `to`: End timestamp (optional)
- Common `params` applied to all indicators (not recommended for mixed indicators)

**Note**: Query string format is discouraged for production use. Prefer POST body for clarity and type safety.

## Examples

### Example 1: Basic Batch Request

**Request**:
```bash
curl -X POST http://localhost:8000/api/v1/indicators/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"symbol": "SPY", "indicator_name": "crsi", "interval": "1d"},
      {"symbol": "SPY", "indicator_name": "sma", "interval": "1d", "params": {"period": 20}},
      {"symbol": "QQQ", "indicator_name": "tdfi", "interval": "1h"}
    ]
  }'
```

**Response**: 200 OK with results for all 3 indicators

### Example 2: Request with Date Range

**Request**:
```bash
curl -X POST http://localhost:8000/api/v1/indicators/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "symbol": "SPY",
        "indicator_name": "crsi",
        "interval": "1d",
        "from": "2023-01-01T00:00:00Z",
        "to": "2024-01-01T00:00:00Z"
      }
    ]
  }'
```

**Response**: 200 OK with cRSI data for 2023 only

### Example 3: Batch with Partial Failure

**Request**:
```bash
curl -X POST http://localhost:8000/api/v1/indicators/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"symbol": "SPY", "indicator_name": "crsi"},
      {"symbol": "INVALID", "indicator_name": "sma"},
      {"symbol": "SPY", "indicator_name": "unknown_indicator"}
    ]
  }'
```

**Response**: 200 OK with 1 result + 2 errors

### Example 4: Duplicate Detection

**Request**:
```bash
curl -X POST http://localhost:8000/api/v1/indicators/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"symbol": "SPY", "indicator_name": "crsi", "interval": "1d"},
      {"symbol": "SPY", "indicator_name": "crsi", "interval": "1d"}
    ]
  }'
```

**Response**: 200 OK with 1 result (calculated once, returned twice) or 2 identical results

**Note**: Contract allows either behavior (deduplicate or return duplicates). Implementation should document choice.

## Implementation Notes

### Deduplication Strategy

**Option A**: Calculate once, return result for both positions
- More efficient
- Results array length may be less than requests array length

**Option B**: Return same result for both positions
- Simpler for client (results[i] corresponds to requests[i])
- Slightly less efficient (only in serialization)

**Recommendation**: Option B for client simplicity

### Cache Key Generation

For each request in batch:
```python
key = generate_indicator_cache_key(
    symbol=request.symbol,
    interval=request.interval,
    indicator_name=request.indicator_name,
    params=request.params or {}
)
```

### Parallel Processing Pattern

```python
async def process_batch_requests(requests: List[IndicatorRequest]) -> BatchResponse:
    # Group by symbol/interval for candle reuse
    groups = group_by_symbol_interval(requests)

    results = []
    errors = []

    for symbol, interval, group_requests in groups:
        # Fetch candles once per group
        candles = await get_or_fetch_candles(symbol, interval)

        # Process indicators in parallel
        tasks = [process_indicator(req, candles) for req in group_requests]
        group_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Separate results and errors
        for result in group_results:
            if isinstance(result, Exception):
                errors.append(result)
            else:
                results.append(result)

    return BatchResponse(results=results, errors=errors, ...)
```

### Performance Logging

Log for each batch request:
```python
logger.info(
    f"Batch request completed: "
    f"requests={len(requests)} "
    f"results={len(results)} "
    f"errors={len(errors)} "
    f"cache_hits={cache_hits} "
    f"cache_misses={cache_misses} "
    f"duration_ms={total_duration_ms}"
)
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-02 | Initial contract definition |

## Related Documents

- [Feature Specification](../spec.md)
- [Data Model](../data-model.md)
- [Research](../research.md)
- [Implementation Plan](../plan.md)
