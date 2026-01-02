# Research Document: Feature 009 - Watchlist Search, Add, and Historical Data Backfill

**Feature**: 009-watchlist-search-add
**Date**: 2025-12-27
**Status**: Complete

## Overview

This document consolidates research findings for implementing watchlist search, ticker add with transactional historical data backfill, and dynamic poller with market-hours gating.

---

## 1. PostgreSQL Unique Constraints for Deduplication

### Decision: Use Existing UniqueConstraint Pattern

**Rationale**: The existing `Candle` model already implements proper deduplication via a unique constraint on `(symbol_id, timestamp, interval)`. Follow this pattern for new tables.

### Implementation Pattern

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class WatchlistEntry(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, ForeignKey("symbol.id"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('symbol_id', name='uix_watchlist_symbol'),
    )
```

**Key Points**:
- Use `__table_args__` with `UniqueConstraint` for multi-column constraints
- For single-column uniqueness, use `unique=True` on the column definition
- PostgreSQL ON CONFLICT DO UPDATE for idempotent upserts

### Alternatives Considered
1. **Application-level locking**: Rejected because database constraints are more reliable
2. **Separate deduplication table**: Rejected as unnecessary overhead
3. **Hash-based deduplication**: Rejected as over-engineering for this use case

---

## 2. yfinance Rate Limiting and Error Handling

### Decision: yfinance Raises Python Exceptions, Not HTTP Codes

**Finding**: yfinance does not return HTTP status codes directly. Instead, it raises Python exceptions when rate-limited:
- `YFRateLimitError`: "Too Many Requests. Rate limited."
- `YFPricesError`: General data fetching errors
- `YFErrors`: Various network/parsing errors

### Detection Pattern

```python
import yfinance as yf
from yfinance.exceptions import YFRateLimitError

try:
    ticker = yf.Ticker(symbol)
    df = ticker.history(period="max", interval="1d")
except YFRateLimitError as e:
    # Handle rate limit - implement exponential backoff
    logger.warning(f"Rate limited: {e}")
except Exception as e:
    # Handle other errors (invalid ticker, network error, etc.)
    logger.error(f"Error fetching {symbol}: {e}")
```

### Exponential Backoff Implementation

**Recommended Pattern (using tenacity library already in project):**

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
    retry_if_exception_type
)
import yfinance as yf
from yfinance.exceptions import YFRateLimitError

@retry(
    stop=stop_after_attempt(3),  # Max 3 retries
    wait=wait_random_exponential(multiplier=1, max=4),  # 1s, 2s, 4s
    retry=retry_if_exception_type((YFRateLimitError,)),
    reraise=True
)
async def fetch_with_retry(symbol: str, interval: str):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: yf.Ticker(symbol).history(period="max", interval=interval)
    )
```

**Wait times**: 1 second, then 2 seconds, then 4 seconds (total ~7 seconds max retry overhead)

### Alternatives Considered
1. **HTTP 429 detection**: Not applicable - yfinance doesn't expose HTTP codes
2. **Custom rate limiter**: Already exists in `YFinanceProvider` - continue using it
3. **Circuit breaker**: Rejected as over-engineering for MVP

---

## 3. pandas_market_calendars NYSE Calendar Usage

### Decision: Use pandas_market_calendars with NYSE Calendar

**Rationale**: Purpose-built library with official NYSE calendar, already mentioned in spec as the chosen solution.

### Implementation Pattern

```python
import pandas_market_calendars as mcal
from datetime import datetime, timezone
import pytz

# Get NYSE calendar
nyse = mcal.get_calendar('NYSE')

# Check if a specific datetime is a market holiday
def is_market_closed(dt: datetime) -> bool:
    """
    Returns True if the given datetime is outside market hours or on a holiday.
    dt: datetime (preferably in UTC or system local time)
    """
    # Convert to Eastern Time for NYSE
    et_tz = pytz.timezone('US/Eastern')
    if dt.tzinfo is None:
        dt = et_tz.localize(dt)
    else:
        dt = dt.astimezone(et_tz)

    # Get valid trading days for the date range
    # We check just the date in question
    date_str = dt.strftime('%Y-%m-%d')
    schedule = nyse.schedule(start_date=date_str, end_date=date_str)

    # If schedule is empty, it's a holiday/weekend
    if schedule.empty:
        return True

    # Check if current time is within market hours (9:30 AM - 4:00 PM ET)
    market_open = schedule.iloc[0]['market_open'].tz_convert(et_tz)
    market_close = schedule.iloc[0]['market_close'].tz_convert(et_tz)

    # The schedule times are in UTC, convert to ET
    return not (market_open <= dt <= market_close)

def is_market_day(dt: datetime) -> bool:
    """Check if a date is a trading day (ignoring time)"""
    date_str = dt.strftime('%Y-%m-%d')
    schedule = nyse.schedule(start_date=date_str, end_date=date_str)
    return not schedule.empty

def should_skip_equity_polling() -> tuple[bool, str]:
    """
    Returns (should_skip, reason).
    Call this in the poller to decide whether to fetch equity data.
    """
    now = datetime.now(timezone.utc)

    # Check if today is a trading day
    if not is_market_day(now):
        return True, "weekend_or_holiday"

    # Check if current time is within market hours
    if is_market_closed(now):
        return True, "outside_market_hours"

    return False, ""
```

### Installation

```bash
pip install pandas_market_calendars pytz
```

### Key Points
- NYSE calendar includes holidays and weekends
- Market hours: 9:30 AM - 4:00 PM Eastern Time
- Must handle timezone conversion (UTC ↔ ET)
- Crypto assets (24/7) should bypass this check

### Alternatives Considered
1. **yfinance built-in calendar**: Less reliable, incomplete holiday data
2. **Hardcoded holiday list**: High maintenance, error-prone
3. **pandas.tseries.CustomBusinessDay**: More complex setup for this use case

---

## 4. FastAPI Timeout Configuration

### Decision: Use asyncio.wait_for for Request Timeout

**Rationale**: FastAPI doesn't have built-in request timeout. Use `asyncio.wait_for()` to wrap long-running operations.

### Implementation Pattern

```python
from fastapi import HTTPException
import asyncio

async def backfill_with_timeout(symbol: str, timeout: int = 60):
    """
    Fetch historical data with 60-second timeout.
    Raises asyncio.TimeoutError if timeout exceeded.
    """
    try:
        # Wrap the long-running operation
        df = await asyncio.wait_for(
            fetch_with_retry(symbol, "1d"),  # From section 2
            timeout=timeout
        )
        return df
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,  # Request Timeout
            detail=f"Backfill for {symbol} exceeded {timeout} second timeout"
        )

# In the API endpoint
@router.post("/watchlist")
async def add_to_watchlist(ticker: str):
    try:
        await backfill_with_timeout(ticker, timeout=60)
        # ... create watchlist entry
    except HTTPException as e:
        # Re-raise HTTP exceptions (including our timeout)
        raise e
    except Exception as e:
        # Handle other errors
        raise HTTPException(status_code=500, detail=str(e))
```

### Alternative: Using httpx Timeout (if using async HTTP client)

```python
import httpx

# If you're using an async HTTP client instead of yfinance directly
async with httpx.AsyncClient(timeout=60.0) as client:
    response = await client.get(...)
```

### Key Points
- `asyncio.wait_for()` raises `asyncio.TimeoutError` after timeout
- Catch and convert to HTTPException with status 408
- Timeout is per-request, not global
- For blocking operations (yfinance), run in executor with timeout

### Alternatives Considered
1. **Starlette middleware timeout**: More complex, affects all routes
2. **Background tasks**: Not appropriate - user needs immediate feedback
3. **Client-side timeout**: Less reliable, server-side enforcement needed

---

## 5. Ticker Universe Data Source

### Decision: Use yfinance Ticker().info with Static List as Fallback

**Rationale**: Yahoo Finance doesn't provide a complete API endpoint for listing all US stocks. Use a hybrid approach: fetch from a known source (Wikipedia/Nasdaq) with yfinance validation.

### Implementation Pattern

**Option A: Fetch from Wikipedia (simpler, recommended for MVP)**

```python
import requests
from bs4 import BeautifulSoup
import yfinance as yf

def fetch_us_stocks_from_wikipedia():
    """
    Scrape S&P 500 companies from Wikipedia as a base list.
    Returns list of (ticker, company_name) tuples.
    """
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    # Find the table
    table = soup.find('table', {'id': 'constituents'})
    tickers = []

    for row in table.find_all('tr')[1:]:  # Skip header
        cells = row.find_all('td')
        if cells:
            ticker = cells[0].text.strip()
            name = cells[1].text.strip()
            tickers.append((ticker, name))

    return tickers

async def seed_ticker_universe(db: AsyncSession):
    """Populate ticker_universe table"""
    print("Fetching US stock symbols from Wikipedia...")
    ticker_data = fetch_us_stocks_from_wikipedia()

    print(f"Found {len(ticker_data)} symbols. Validating with yfinance...")

    for ticker, name in ticker_data[:500]:  # Limit for initial seed
        try:
            # Validate with yfinance
            t = yf.Ticker(ticker)
            info = t.info
            if info and 'regularMarketPrice' in info:
                # Valid ticker
                entry = TickerUniverse(
                    ticker=ticker,
                    display_name=name,
                    asset_class='equity'
                )
                db.add(entry)
        except Exception as e:
            logger.warning(f"Skipping {ticker}: {e}")

    await db.commit()
    print(f"Seeded {count} valid tickers")
```

**Option B: Use yfinance to discover (more comprehensive, slower)**

```python
# Known NYSE/NASDAQ prefixes - iterate through them
# Not recommended due to rate limiting
```

**Recommended Approach**: Use Option A for MVP, then expand via periodic refresh.

### Data Source Recommendations

1. **Wikipedia S&P 500**: ~500 companies, high quality
2. **NasdaqTrader.com**: Full listing, requires parsing
3. **Finnhub API**: Comprehensive, requires free API key
4. **IEX Cloud**: Paid API, comprehensive

### Seed Script Structure

```python
# backend/app/scripts/seed_ticker_universe.py
import asyncio
from app.database import AsyncSessionLocal
from app.models.ticker_universe import TickerUniverse

async def main():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(TickerUniverse).limit(1))
        if result.scalars().first():
            print("Ticker universe already seeded. Skipping.")
            return

        # Seed
        await seed_ticker_universe(db)

if __name__ == "__main__":
    asyncio.run(main())
```

### Alternatives Considered
1. **Yahoo Finance API endpoint**: Doesn't exist for listing symbols
2. **Hardcoded static file**: Would require manual updates
3. **Paid data provider**: Overkill for MVP

---

## 6. React Search Dropdown Best Practices

### Decision: Use shadcn/ui Command Component with Custom Debounce

**Rationale**: The project already uses shadcn/ui. The `Command` component provides accessible search with keyboard navigation out of the box.

### Implementation Pattern

```typescript
import React, { useState, useEffect, useCallback } from 'react'
import { Command, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command'
import { Search } from 'lucide-react'

interface SearchResult {
  symbol: string
  display_name: string
}

interface WatchlistSearchProps {
  onSelect: (symbol: string) => void
}

export const WatchlistSearch: React.FC<WatchlistSearchProps> = ({ onSelect }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce input (300ms as per spec AC-001)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch results when debounced query changes
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery || debouncedQuery.length < 1 || debouncedQuery.length > 5) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/v1/symbols/search?q=${debouncedQuery}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data)
        }
      } catch (error) {
        console.error('Search failed:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [debouncedQuery])

  const handleSelect = useCallback((symbol: string) => {
    onSelect(symbol)
    setOpen(false)
    setQuery('')
    setResults([])
  }, [onSelect])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput
          placeholder="Search symbols (e.g., AAPL)..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && <div className="p-2 text-sm text-muted-foreground">Searching...</div>}
          {!loading && results.length === 0 && query && (
            <div className="p-2 text-sm text-muted-foreground">No results found</div>
          )}
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={result.symbol}
                onSelect={() => handleSelect(result.symbol)}
              >
                <span className="font-bold">{result.symbol}</span>
                <span className="ml-2 text-muted-foreground">{result.display_name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
```

### Keyboard Navigation

The `Command` component automatically provides:
- **Arrow Up/Down**: Navigate results
- **Enter**: Select highlighted result
- **Escape**: Close dialog
- **Type to filter**: Built-in search filtering

### Accessibility

- `Command` component uses ARIA roles (combobox, listbox, option)
- Keyboard navigation works out of the box
- Focus management handled automatically
- Screen reader announcements included

### Debounce Timing

**300ms** is the sweet spot (per spec AC-001):
- Too fast (<200ms): Too many API calls
- Too slow (>500ms): Feels laggy
- 300ms: Balanced for search-as-you-type

### Alternatives Considered
1. **react-select**: Popular but heavy, shadcn/ui already available
2. **downshift**: Unstyled, more manual work
3. **Custom implementation**: Reimplementing accessibility is error-prone

---

## 7. Alembic Migration Pattern for New Tables

### Decision: Use Alembic Autogenerate with Manual Review

**Rationale**: The project uses Alembic for migrations. Autogenerate works well for simple table creation.

### Migration File Structure

```bash
# Create new migration
alembic revision --autogenerate -m "Add watchlist and ticker_universe tables"
```

**Generated migration (edit as needed)**:

```python
# alembic/versions/XXXX_add_watchlist_and_ticker_universe.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = '0001'
down_revision = None  # Or the previous migration ID
branch_labels = None
depends_on = None

def upgrade():
    # Create ticker_universe table
    op.create_table(
        'ticker_universe',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ticker', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('asset_class', sa.String(), nullable=True),
        sa.Column('exchange', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticker', name='uix_ticker_universe_ticker')
    )
    op.create_index('ix_ticker_universe_ticker', 'ticker_universe', ['ticker'])
    op.create_index('ix_ticker_universe_display_name', 'ticker_universe', ['display_name'])

    # Create watchlist table
    op.create_table(
        'watchlist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['symbol_id'], ['symbol.id'], name=op.f('fk_watchlist_symbol_id_symbol')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_watchlist_symbol_id', 'watchlist', ['symbol_id'])
    op.create_unique_constraint('uix_watchlist_symbol_id', 'watchlist', ['symbol_id'])

def downgrade():
    op.drop_table('watchlist')
    op.drop_table('ticker_universe')
```

### Running Migrations

```bash
# Upgrade to latest
alembic upgrade head

# Downgrade one step
alembic downgrade -1

# View migration history
alembic history
```

### Key Points
- Always review autogenerate output before committing
- Add indexes for frequently queried columns
- Use `server_default=sa.text('NOW()')` for timestamp defaults
- Foreign keys must reference existing tables
- Run migrations in test environment before production

### Alternatives Considered
1. **Manual SQL only**: More control, but harder to maintain
2. **Separate migration files per table**: More granular, but more churn
3. **No migrations (drop/create)**: Data loss, not acceptable

---

## 8. Summary of Technology Choices

| Area | Decision | Rationale |
|------|----------|-----------|
| Deduplication | UniqueConstraint + ON CONFLICT | Follows existing Candle model pattern |
| Rate Limit Detection | Catch YFRateLimitError | yfinance raises exceptions, not HTTP codes |
| Retry Strategy | tenacity: 3 retries, exponential backoff (1s, 2s, 4s) | Specified in clarifications, battle-tested |
| Market Hours | pandas_market_calendars (NYSE) | Specified in clarifications, official calendar |
| Timeout | asyncio.wait_for(60s) | Simple, works with FastAPI async |
| Ticker Source | Wikipedia S&P 500 + yfinance validation | No official Yahoo API, adequate for MVP |
| Search UI | shadcn/ui Command | Already in project, accessible |
| Debounce | 300ms | Specified in AC-001, balanced UX |
| Migrations | Alembic autogenerate | Existing project pattern |

---

## 9. Dependencies to Add

### Backend
```bash
# Already in project (verify)
pip install yfinance
pip install pandas_market_calendars
pip install pytz
pip install tenacity
pip install beautifulsoup4  # For Wikipedia scraping
```

### Frontend
```bash
# Already in project (verify)
npm install lucide-react  # Icons
```

---

## 10. Open Questions Resolved

All questions from Phase 0 have been answered:
1. ✅ PostgreSQL unique constraints - Use `UniqueConstraint`
2. ✅ yfinance rate limiting - Catch `YFRateLimitError`
3. ✅ pandas_market_calendars usage - `mcal.get_calendar('NYSE')`
4. ✅ FastAPI timeout - `asyncio.wait_for()`
5. ✅ Ticker universe source - Wikipedia + yfinance validation
6. ✅ React search dropdown - shadcn/ui Command with 300ms debounce
7. ✅ Alembic migrations - Autogenerate with review

---

**Next Steps**: Proceed to Phase 1 - Generate data-model.md, API contracts, and quickstart.md.
