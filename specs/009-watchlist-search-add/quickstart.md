# Quickstart Guide: Feature 009 - Watchlist Search, Add, and Historical Data Backfill

**Feature**: 009-watchlist-search-add
**Branch**: `009-watchlist-search-add`
**Last Updated**: 2025-12-27

---

## Overview

This guide covers setting up and testing the watchlist search, add, and historical data backfill functionality.

---

## Prerequisites

### Required Software
- **Python**: 3.11+
- **Node.js**: 18+
- **PostgreSQL**: 14+
- **Git**: For cloning the repository

### Required Python Packages
```bash
pip install fastapi sqlalchemy[asyncio] asyncpg yfinance pandas-market-calendars pytz tenacity beautifulsoup4
```

### Required NPM Packages
```bash
npm install lucide-react
```

---

## 1. Backend Setup

### 1.1 Database Migration

Create the new tables:

```bash
cd backend

# Run Alembic migrations
alembic upgrade head

# Verify tables created
psql -U your_user -d tradingalert -c "\dt ticker_universe"
psql -U your_user -d tradingalert -c "\dt watchlist"
```

Expected output:
```
          List of relations
 Schema |     Name      | Type  |   Owner
--------+--------------+-------+----------
 public | ticker_universe | table | your_user
 public | watchlist       | table | your_user
```

### 1.2 Seed Ticker Universe

Populate the `ticker_universe` table with US equity symbols:

```bash
cd backend
python -m app.scripts.seed_ticker_universe
```

Expected output:
```
Fetching US stock symbols from Wikipedia...
Found 503 symbols. Validating with yfinance...
Validating 1/500: AAPL
Validating 2/500: MSFT
...
Seeded 497 valid tickers
```

Verify seeding:
```bash
psql -U your_user -d tradingalert -c "SELECT COUNT(*) FROM ticker_universe;"
```

Expected: ~500 rows (S&P 500 companies)

### 1.3 Verify Backend Services

Check that the new services exist:

```bash
ls backend/app/services/watchlist.py
ls backend/app/services/backfill.py
ls backend/app/services/search.py
ls backend/app/services/market_hours.py
```

---

## 2. Frontend Setup

### 2.1 Install Dependencies

```bash
cd frontend
npm install
```

### 2.2 Verify Components

Check that the new components exist:

```bash
ls frontend/src/components/WatchlistSearch.tsx
ls frontend/src/components/WatchlistAdd.tsx
ls frontend/src/api/watchlist.ts
ls frontend/src/hooks/useWatchlist.ts
```

---

## 3. Running the Application

### 3.1 Start PostgreSQL

```bash
# Using systemd (Linux)
sudo systemctl start postgresql

# Using Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:14
```

### 3.2 Start Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 3.3 Start Frontend

```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 4. Testing the Feature

### 4.1 Test Search API

```bash
# Test search endpoint
curl "http://localhost:8000/api/v1/symbols/search?q=AAP"

# Expected response
[
  {"symbol":"AAPL","display_name":"Apple Inc."},
  {"symbol":"ABBV","display_name":"AbbVie Inc."}
]
```

### 4.2 Test Watchlist Add

```bash
# Add a ticker to watchlist
curl -X POST "http://localhost:8000/api/v1/watchlist" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL"}'

# Expected response (first add)
{
  "status": "added",
  "symbol": "AAPL",
  "candles_backfilled": 1253
}

# Expected response (duplicate add)
{
  "status": "already_present",
  "symbol": "AAPL"
}
```

### 4.3 Test Watchlist List

```bash
# List watchlist entries
curl "http://localhost:8000/api/v1/watchlist"

# Expected response
[
  {
    "id": 1,
    "symbol": "AAPL",
    "added_at": "2025-12-27T10:30:00Z"
  }
]
```

### 4.4 Test Market Hours Gating

Check if poller correctly skips equity polling outside market hours:

```bash
# Check logs for market-hours gating
tail -f backend/logs/app.log | grep -i "market"
```

Expected log messages:
- `Skipping equity polling: weekend_or_holiday` (on weekends)
- `Skipping equity polling: outside_market_hours` (before 9:30 AM ET or after 4:00 PM ET)
- `Polling equities: ['AAPL', 'MSFT', ...]` (during market hours)

---

## 5. Manual Testing Checklist

### Search Functionality
- [ ] Typing "AAP" shows results including AAPL
- [ ] Typing "GOO" shows both GOOGL and GOOG
- [ ] Typing "INVALID" shows "No results found"
- [ ] Typing 6+ characters shows validation error
- [ ] Clearing search (0 chars) shows validation error
- [ ] Selecting a result populates search input

### Watchlist Add
- [ ] Clicking "+" on valid ticker shows loading state
- [ ] Successful add shows ticker in watchlist
- [ ] Adding duplicate shows "already present" message
- [ ] Invalid ticker shows clear error message
- [ ] Failed backfill (no data) shows error message
- [ ] Timeout (60s) shows timeout message
- [ ] No partial entries created on failure

### Historical Data Verification
```bash
# Verify candles were backfilled
psql -U your_user -d tradingalert -c "
  SELECT COUNT(*)
  FROM candle c
  JOIN symbol s ON c.symbol_id = s.id
  WHERE s.ticker = 'AAPL' AND c.interval = '1d';
"
```

Expected: 1000+ rows for established stocks

### Poller Integration
- [ ] Newly added ticker appears in poller within 30 seconds
- [ ] Poller skips equity polling on weekends
- [ ] Poller skips equity polling on holidays
- [ ] Poller fetches equity data during market hours (9:30 AM - 4:00 PM ET)
- [ ] Removing ticker stops poller from fetching that ticker

---

## 6. Troubleshooting

### Database Migration Fails

```bash
# Check current migration version
alembic current

# Check migration history
alembic history

# Force upgrade (use with caution)
alembic upgrade head --sql
```

### Seed Script Fails

```bash
# Check if ticker_universe table exists
psql -U your_user -d tradingalert -c "\d ticker_universe"

# Check if already seeded
psql -U your_user -d tradingalert -c "SELECT COUNT(*) FROM ticker_universe;"

# Re-run seed (will skip if already seeded)
python -m app.scripts.seed_ticker_universe
```

### yfinance Rate Limiting

```bash
# If you see "Too Many Requests" errors:
# 1. Wait a few minutes before retrying
# 2. Check your backfill retry logic (should have exponential backoff)
# 3. Reduce batch size in seed script

# Verify retry logic in logs
tail -f backend/logs/app.log | grep -i "retry"
```

### Frontend Not Connecting

```bash
# Check CORS settings
curl -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://localhost:8000/api/v1/watchlist

# Expected response includes CORS headers
```

---

## 7. Development Workflow

### Adding New Features

1. **Backend**:
   - Create/modify service in `backend/app/services/`
   - Create/modify endpoint in `backend/app/api/v1/`
   - Add tests in `backend/tests/`

2. **Frontend**:
   - Create component in `frontend/src/components/`
   - Add API client method in `frontend/src/api/`
   - Add tests in `frontend/tests/`

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

### Type Checking

```bash
# Backend (mypy)
cd backend
mypy app/

# Frontend (tsc)
cd frontend
npx tsc --noEmit
```

---

## 8. Configuration

### Backend Environment Variables

```bash
# .env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/tradingalert
API_V1_STR=/api/v1
LOG_LEVEL=INFO
```

### Frontend Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:8000/api/v1
```

---

## 9. Performance Monitoring

### Key Metrics to Monitor

1. **Search latency**: Should be <2 seconds (SC-002)
2. **Backfill duration**: Should be <60 seconds
3. **Poller cycle time**: Should be <5 seconds for 100 tickers
4. **Database size**: Monitor candle table growth

### Database Queries

```bash
# Monitor slow queries
psql -U your_user -d tradingalert -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  WHERE query LIKE '%watchlist%' OR query LIKE '%ticker_universe%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"
```

---

## 10. Next Steps

After setup is complete:

1. **Review**: Verify all acceptance criteria from `spec.md`
2. **Test**: Run integration tests and manual testing checklist
3. **Document**: Update any API documentation changes
4. **Deploy**: Follow deployment procedures for your environment

---

## Support

For issues or questions:
1. Check the spec: `/specs/009-watchlist-search-add/spec.md`
2. Check research doc: `/specs/009-watchlist-search-add/research.md`
3. Check data model: `/specs/009-watchlist-search-add/data-model.md`
4. Check API contracts: `/specs/009-watchlist-search-add/contracts/`
