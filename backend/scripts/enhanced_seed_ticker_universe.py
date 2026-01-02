#!/usr/bin/env python3
"""
Enhanced Seed Ticker Universe Script

This script enhances the original to include more comprehensive stock data
that would include Russell 2999 constituents by using multiple data sources.

Note: Russell 2999 is not a standard index (it would be Russell 3000 minus largest 100).
Russell 2000 is the small-cap portion of Russell 3000, so we'll focus on getting
small and mid-cap stocks that would be in Russell 2999.
"""

import asyncio
import sys
from pathlib import Path
import yfinance as yf
from bs4 import BeautifulSoup
import requests
import pandas as pd

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionLocal
from app.models.ticker_universe import TickerUniverse
from sqlalchemy import select


WIKIPEDIA_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
WIKIPEDIA_NASDAQ100_URL = "https://en.wikipedia.org/wiki/Nasdaq-100"
WIKIPEDIA_RUSSELL2000_URL = "https://en.wikipedia.org/wiki/Russell_2000"


def fetch_wikipedia_table(url, table_id=None, table_index=0, ticker_col=0, name_col=1):
    """Generic function to fetch ticker symbols from a Wikipedia table.

    Args:
        url: Wikipedia page URL
        table_id: Optional table HTML id attribute
        table_index: Fallback to nth table if id not found
        ticker_col: Column index containing ticker symbol (default: 0)
        name_col: Column index containing display name (default: 1)

    Returns:
        List of dicts with 'ticker', 'display_name'
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')

    # Try to find table by id first
    table = soup.find('table', {'id': table_id}) if table_id else None

    # Fallback to table index
    if not table:
        tables = soup.find_all('table', class_='wikitable')
        if table_index < len(tables):
            table = tables[table_index]

    if not table:
        return []

    symbols = []
    rows = table.find_all('tr')[1:]  # Skip header row

    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) >= max(ticker_col, name_col) + 1:
            ticker = cells[ticker_col].text.strip()
            display_name = cells[name_col].text.strip()

            # Clean up ticker - remove . and replace with - for yfinance
            ticker = ticker.replace('.', '-')

            # Skip obvious non-ticker rows
            if not ticker or len(ticker) > 6 or ticker.isdigit():
                continue

            symbols.append({
                'ticker': ticker,
                'display_name': display_name,
                'asset_class': 'equity',
                'exchange': 'NYSE/NASDAQ'  # Will be updated later
            })

    return symbols


def fetch_nasdaq_symbols():
    """Fetch all NASDAQ traded symbols from NASDAQ website."""
    print("Fetching NASDAQ symbols...")
    
    try:
        # NASDAQ provides a file with listed stocks
        nasdaq_url = "http://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt"
        response = requests.get(nasdaq_url, timeout=30)
        
        if response.status_code == 200:
            lines = response.text.strip().split('\n')
            stocks = []
            for i, line in enumerate(lines[1:]):  # Skip header
                parts = line.split('|')
                if len(parts) >= 2:
                    symbol = parts[0].strip()
                    name = parts[1].strip()
                    
                    # Skip if it's not a common stock
                    if '^' in symbol or '.' in symbol or '$' in symbol or 'W' in symbol[-1] or 'R' in symbol[-1]:
                        continue
                    
                    if symbol and name and len(symbol) <= 6:
                        stocks.append({
                            'ticker': symbol,
                            'display_name': name,
                            'asset_class': 'equity',
                            'exchange': 'NASDAQ'
                        })
                        
                        if i > 0 and i % 1000 == 0:
                            print(f"Processed {i} NASDAQ stocks...")
            
            print(f"Found {len(stocks)} NASDAQ stocks")
            return stocks
    except Exception as e:
        print(f"Error fetching NASDAQ symbols: {e}")
    
    return []


def fetch_nyse_amex_symbols():
    """Fetch NYSE and AMEX symbols from alternative sources."""
    print("Fetching NYSE/AMEX symbols...")
    
    # For NYSE/AMEX, we can try to get data from other sources
    # Since the NASDAQ file includes all US exchanges, we might already have this
    
    # Alternative: Use a different source or API
    # For now, we'll rely on the NASDAQ file which includes all US exchanges
    
    return []


def fetch_all_symbols():
    """Fetch stock symbols from multiple sources (S&P 500, NASDAQ 100, Russell 2000, and more).

    Returns:
        List of dicts with 'ticker', 'display_name', 'asset_class', 'exchange'
    """
    all_symbols = {}

    # S&P 500
    print("Fetching S&P 500 symbols...")
    sp500 = fetch_wikipedia_table(WIKIPEDIA_SP500_URL, table_id='constituents')
    for s in sp500:
        all_symbols[s['ticker']] = s
    print(f"  Found {len(sp500)} symbols")

    # NASDAQ 100
    print("Fetching NASDAQ 100 symbols...")
    ndx100 = fetch_wikipedia_table(WIKIPEDIA_NASDAQ100_URL, table_index=1)
    for s in ndx100:
        all_symbols[s['ticker']] = s
    print(f"  Found {len(ndx100)} symbols")

    # Russell 2000 (smaller cap, includes many stocks like MARA)
    # Note: Russell 2000 Wikipedia page has reversed columns (Name, Symbol) vs (Symbol, Name)
    print("Fetching Russell 2000 symbols...")
    russell2000 = fetch_wikipedia_table(WIKIPEDIA_RUSSELL2000_URL, table_index=0, ticker_col=1, name_col=0)
    for s in russell2000:
        all_symbols[s['ticker']] = s
    print(f"  Found {len(russell2000)} symbols")

    # Get additional symbols from NASDAQ file (includes all US exchanges)
    print("Fetching additional symbols from NASDAQ...")
    additional_symbols = fetch_nasdaq_symbols()
    for s in additional_symbols:
        if s['ticker'] not in all_symbols:
            all_symbols[s['ticker']] = s
    print(f"  Found {len(additional_symbols)} additional symbols")

    symbols = list(all_symbols.values())
    print(f"Total unique symbols: {len(symbols)}")
    return symbols


def validate_symbols(symbols, max_symbols=5000):  # Limit for performance
    """Validate symbols by checking if yfinance has data for them.

    Args:
        symbols: List of dicts with 'ticker' key
        max_symbols: Maximum number of symbols to validate (for performance)

    Returns:
        List of validated symbols
    """
    print(f"Validating up to {max_symbols} symbols...")
    validated = []

    symbols_to_check = symbols[:max_symbols]
    
    for i, symbol_info in enumerate(symbols_to_check, 1):
        ticker = symbol_info['ticker']
        print(f"Validating {i}/{len(symbols_to_check)}: {ticker}", end='\r')

        try:
            # Quick check - try to get info
            yf_ticker = yf.Ticker(ticker)
            # Fast info check without full history fetch
            info = yf_ticker.fast_info

            # If we get here, ticker is valid
            if info and 'currency' in info:  # Basic validation
                validated.append(symbol_info)
        except Exception:
            # Skip invalid tickers
            pass

    print(f"\nValidated {len(validated)} out of {len(symbols_to_check)} tickers")
    return validated


def get_small_cap_stocks(symbols, market_cap_threshold=2e9):  # Under $2B market cap
    """
    Filter to get small and mid-cap stocks that would likely be in Russell 2999.
    
    Russell 2999 would be Russell 3000 minus the largest 100 companies.
    Since Russell 1000 is large-cap and Russell 2000 is small-cap,
    Russell 2999 would include most of Russell 2000 plus mid-cap stocks.
    """
    print(f"Filtering for stocks with market cap under ${market_cap_threshold/1e9}B...")
    
    small_cap_stocks = []
    
    for i, symbol_info in enumerate(symbols):
        ticker = symbol_info['ticker']
        print(f"Checking market cap {i+1}/{len(symbols)}: {ticker}", end='\r')
        
        try:
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.fast_info
            
            if info and 'marketCap' in info and info['marketCap']:
                market_cap = info['marketCap']
                
                # Include if market cap is under threshold (likely Russell 2999 constituents)
                if market_cap < market_cap_threshold:
                    symbol_info['market_cap'] = market_cap
                    small_cap_stocks.append(symbol_info)
        except Exception:
            continue
    
    print(f"\nFound {len(small_cap_stocks)} stocks under ${market_cap_threshold/1e9}B market cap")
    return small_cap_stocks


async def seed_database(symbols, force=False):
    """Seed the ticker_universe table with validated symbols.

    Args:
        symbols: List of dicts with symbol data
        force: If True, clear existing data before seeding
    """
    print("Seeding ticker_universe table...")

    async with AsyncSessionLocal() as db:
        try:
            # Check if already seeded
            result = await db.execute(select(TickerUniverse))
            existing = result.scalars().all()
            existing_count = len(existing)

            if existing_count > 0:
                if force:
                    print(f"Clearing {existing_count} existing entries...")
                    # Delete all existing entries
                    for entry in existing:
                        await db.delete(entry)
                    await db.commit()
                else:
                    print(f"Table already has {existing_count} entries. Use --force to re-seed.")
                    return

            # Bulk insert
            for symbol_info in symbols:
                ticker_entry = TickerUniverse(
                    ticker=symbol_info['ticker'],
                    display_name=symbol_info['display_name'],
                    asset_class=symbol_info.get('asset_class', 'equity'),
                    exchange=symbol_info.get('exchange', 'Unknown')
                )
                db.add(ticker_entry)

            await db.commit()
            print(f"Seeded {len(symbols)} valid tickers")

        except Exception as e:
            await db.rollback()
            print(f"Error seeding database: {e}")
            raise


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Enhanced seed ticker_universe table with comprehensive stock symbols including Russell 2999 approximation')
    parser.add_argument('--force', action='store_true', help='Clear existing data before seeding')
    parser.add_argument('--small-cap-only', action='store_true', help='Only include small-cap stocks (Russell 2999 approximation)')
    args = parser.parse_args()

    # Fetch symbols from multiple sources
    symbols = fetch_all_symbols()

    if not symbols:
        print("No symbols found. Exiting.")
        return

    # Validate symbols with yfinance
    validated_symbols = validate_symbols(symbols)

    if not validated_symbols:
        print("No validated symbols. Exiting.")
        return

    # If --small-cap-only flag is set, filter for small-cap stocks (Russell 2999 approximation)
    if args.small_cap_only:
        print("Filtering for Russell 2999 approximation (small and mid-cap stocks)...")
        validated_symbols = get_small_cap_stocks(validated_symbols)

    # Seed database
    await seed_database(validated_symbols, force=args.force)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())