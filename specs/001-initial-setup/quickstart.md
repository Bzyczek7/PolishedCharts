# Quickstart Guide: TradingAlert Development

**Feature**: 001-initial-setup
**Date**: 2025-12-23
**Purpose**: Get the development environment running and validate the vertical slice

## Prerequisites

- Python 3.11+
- Node.js 20+
- Git

## Initial Setup

### 1. Clone and Navigate

```bash
cd /path/to/TradingAlert
```

### 2. Backend Setup

```bash
# Create virtual environment
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Initialize database
alembic upgrade head

# Verify installation
pytest --version
python -c "import fastapi; import yfinance; import sqlalchemy"
```

### 3. Frontend Setup

```bash
# Navigate to frontend
cd ../frontend

# Install dependencies
npm install

# Verify installation
npm run lint
```

## Development Workflow

### Start Backend

```bash
# From backend directory
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Backend will be available at http://localhost:8000

API docs: http://localhost:8000/docs

### Start Frontend

```bash
# From frontend directory (separate terminal)
npm run dev
```

Frontend will be available at http://localhost:5173

### Start Both (Single Command)

From the repository root:

```bash
# Terminal 1: Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

## Validation Steps

### 1. Verify Backend API

```bash
# Check health (if endpoint exists)
curl http://localhost:8000/api/v1/health

# Get candles for a symbol
curl "http://localhost:8000/api/v1/candles/AAPL?interval=1h&limit=10"

# Create an alert
curl -X POST http://localhost:8000/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "symbol_id": 1,
    "condition": "crosses_up",
    "threshold": 200.0
  }'
```

### 2. Verify Frontend Chart

1. Open http://localhost:5173
2. Enter a symbol (e.g., "AAPL")
3. Select an interval (e.g., "1h")
4. Verify chart loads with candlesticks

### 3. Run Tests

```bash
# Backend tests (from backend/)
pytest tests/ -v
pytest tests/services/test_alert_engine.py -v  # Alert evaluation tests

# Frontend tests (from frontend/)
npm test
```

### 4. Verify Constitution Compliance

Run the constitution check:

```bash
# Verify alert semantics (above/below/crosses)
pytest tests/services/test_alert_engine.py::test_crosses_up -v
pytest tests/services/test_alert_engine.py::test_crosses_down -v
pytest tests/services/test_alert_engine.py::test_exact_price_trigger -v

# Verify UTC timestamp handling
pytest tests/services/test_candles.py::test_utc_normalization -v

# Verify deduplication
pytest tests/services/test_candles.py::test_idempotent_insert -v
```

## Common Issues

### Issue: "Module not found" errors

**Solution**: Ensure virtual environment is activated and dependencies installed:
```bash
source .venv/bin/activate
pip install -e .
```

### Issue: "Database locked" errors

**Solution**: SQLite doesn't support concurrent writes. Ensure only one backend instance is running:
```bash
ps aux | grep uvicorn  # Find running instances
kill <pid>  # Kill extra instances
```

### Issue: "yfinance rate limit" errors

**Solution**: The rate limiter should handle this automatically. If errors persist, increase the rate limit delay in `backend/app/services/providers.py`.

### Issue: Frontend can't connect to backend

**Solution**: Ensure CORS is configured in `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Development Tips

### Add a New Indicator

1. Create indicator class in `backend/app/services/indicators/`:
```python
class EMAIndicator(Indicator):
    def calculate(self, candles: List[Candle], params: IndicatorParams) -> List[float]:
        period = params.period
        # Calculate EMA
        return values
```

2. Register in `backend/app/services/indicators/__init__.py`:
```python
IndicatorRegistry.register("ema", EMAIndicator())
```

3. Add tests in `backend/tests/services/test_indicators.py`:
```python
def test_ema_calculation():
    # Test with known values
    assert ema.calculate(test_candles, params) == expected
```

### Add a New Alert Condition

1. Add condition type to `backend/app/models/alert.py` or enum:
```python
class AlertCondition(str, Enum):
    ABOVE = "above"
    BELOW = "below"
    CROSSES_UP = "crosses_up"
    CROSSES_DOWN = "crosses_down"
    YOUR_NEW_CONDITION = "your_new_condition"
```

2. Implement evaluation logic in `backend/app/services/alert_engine.py`

3. Add tests for edge cases:
```python
def test_your_new_condition_edge_cases():
    # Test exact price, gaps, rapid oscillations
    pass
```

## CI/CD

The project uses GitHub Actions for CI. The pipeline runs:

1. Lint: `ruff check .` (backend), `npm run lint` (frontend)
2. Type check: `mypy .` (backend), `tsc --noEmit` (frontend)
3. Unit tests: `pytest` (backend), `vitest` (frontend)
4. Integration tests: `pytest tests/integration/`

## Next Steps

After validating the vertical slice:

1. Implement additional indicators (EMA, RSI, MACD)
2. Add visual gap marking on charts
3. Implement alert trigger notifications in UI
4. Add performance benchmarking
5. Set up CI pipeline in GitHub Actions

## Support

For issues or questions:

- Check the constitution: `.specify/memory/constitution.md`
- Check the spec: `specs/001-initial-setup/spec.md`
- Check existing tests for examples: `backend/tests/`
