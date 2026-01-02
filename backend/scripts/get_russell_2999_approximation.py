#!/usr/bin/env python3
"""
Russell 2999 Data Fetcher

This script attempts to get Russell 2999 constituents by using market cap data
to approximate the index. Russell 2999 would be Russell 3000 minus the largest 100 companies.

Since Russell indices are proprietary, this script provides an approximation
using market cap rankings to identify likely Russell 2999 constituents.
"""

import asyncio
import sys
import yfinance as yf
import pandas as pd
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import time

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionLocal
from app.models.ticker_universe import TickerUniverse
from sqlalchemy import select


def get_comprehensive_us_stocks():
    """
    Get a comprehensive list of US stocks from multiple sources
    to approximate Russell 2999 constituents.
    """
    print("Getting comprehensive list of US stocks...")
    
    all_stocks = []
    
    # 1. Get S&P 500 stocks
    print("Fetching S&P 500 stocks...")
    sp500_stocks = get_sp500_stocks()
    all_stocks.extend(sp500_stocks)
    
    # 2. Get NASDAQ traded stocks
    print("Fetching NASDAQ traded stocks...")
    nasdaq_stocks = get_nasdaq_traded_stocks()
    all_stocks.extend(nasdaq_stocks)
    
    # 3. Get NYSE traded stocks
    print("Fetching NYSE traded stocks...")
    nyse_stocks = get_nyse_traded_stocks()
    all_stocks.extend(nyse_stocks)
    
    # Remove duplicates
    unique_stocks = {}
    for stock in all_stocks:
        ticker = stock['ticker']
        if ticker not in unique_stocks:
            unique_stocks[ticker] = stock
    
    print(f"Total unique stocks from all sources: {len(unique_stocks)}")
    return list(unique_stocks.values())


def get_sp500_stocks():
    """Get S&P 500 stocks from Wikipedia."""
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    table = soup.find('table', {'id': 'constituents'})
    stocks = []
    
    if table:
        rows = table.find_all('tr')[1:]  # Skip header
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) >= 2:
                ticker = cells[0].text.strip().replace('.', '-')
                name = cells[1].text.strip()
                
                if ticker and name:
                    stocks.append({
                        'ticker': ticker,
                        'display_name': name,
                        'exchange': 'NYSE/NASDAQ',
                        'asset_class': 'equity'
                    })
    
    return stocks


def get_nasdaq_traded_stocks():
    """Get all NASDAQ traded stocks from NASDAQ FTP."""
    print("Fetching NASDAQ traded stocks from NASDAQ FTP...")
    
    try:
        # NASDAQ provides a file with all traded symbols
        url = "http://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            lines = response.text.strip().split('\n')
            stocks = []
            
            for i, line in enumerate(lines[1:], 1):  # Skip header
                parts = line.split('|')
                if len(parts) >= 2:
                    symbol = parts[0].strip()
                    name = parts[1].strip()
                    
                    # Skip non-common stocks
                    if (symbol and name and 
                        len(symbol) <= 6 and 
                        '^' not in symbol and  # Preferred stock
                        '.' not in symbol and  # Class shares
                        '$' not in symbol and  # Warrants
                        not symbol.endswith('W') and  # Warrants
                        not symbol.endswith('R')):  # Rights
                        stocks.append({
                            'ticker': symbol,
                            'display_name': name,
                            'exchange': parts[2].strip() if len(parts) > 2 else 'NASDAQ',
                            'asset_class': 'equity'
                        })
                
                if i % 5000 == 0:
                    print(f"Processed {i} NASDAQ symbols...")
            
            print(f"Found {len(stocks)} NASDAQ traded stocks")
            return stocks
    except Exception as e:
        print(f"Error fetching NASDAQ stocks: {e}")
    
    return []


def get_nyse_traded_stocks():
    """Get NYSE traded stocks from NYSE data."""
    print("Fetching NYSE traded stocks...")
    
    # NYSE doesn't provide a free comprehensive list, so we'll use alternative sources
    # For now, we'll rely on the NASDAQ file which includes NYSE stocks too
    
    # Alternative: Use other sources or APIs
    # This is a placeholder - in practice, you'd need to use a paid data provider
    # or academic data source
    
    return []


def get_market_cap_data(stocks, batch_size=100):
    """
    Get market cap data for stocks to rank by market cap.
    This helps identify Russell 2999 constituents (Russell 3000 minus largest 100).
    """
    print(f"Getting market cap data for {len(stocks)} stocks...")
    
    stocks_with_market_cap = []
    
    # Process in batches to avoid rate limiting
    for i in range(0, len(stocks), batch_size):
        batch = stocks[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(stocks)-1)//batch_size + 1}")
        
        for stock in batch:
            try:
                ticker = yf.Ticker(stock['ticker'])
                info = ticker.fast_info
                
                if info and 'marketCap' in info and info['marketCap'] and info['marketCap'] > 0:
                    stock_with_cap = stock.copy()
                    stock_with_cap['market_cap'] = info['marketCap']
                    stocks_with_market_cap.append(stock_with_cap)
            except Exception:
                continue
            
            # Small delay to avoid rate limiting
            time.sleep(0.1)
    
    # Sort by market cap (descending)
    stocks_with_market_cap.sort(key=lambda x: x['market_cap'], reverse=True)
    
    print(f"Got market cap data for {len(stocks_with_market_cap)} stocks")
    return stocks_with_market_cap


def get_russell_2999_approximation(stocks_with_market_cap, exclude_top_n=100):
    """
    Get Russell 2999 approximation by excluding the top N companies by market cap.
    
    Russell 2999 = Russell 3000 minus largest 100 companies
    """
    print(f"Creating Russell 2999 approximation by excluding top {exclude_top_n} companies...")
    
    # Exclude the top N companies by market cap
    russell_2999_stocks = stocks_with_market_cap[exclude_top_n:]
    
    print(f"Russell 2999 approximation contains {len(russell_2999_stocks)} stocks")
    print(f"Market cap range: ${russell_2999_stocks[-1]['market_cap']:,.0f} to ${russell_2999_stocks[0]['market_cap']:,.0f}")
    
    return russell_2999_stocks


def validate_stocks(stocks):
    """Validate stocks by checking if they're still active."""
    print(f"Validating {len(stocks)} stocks...")
    
    validated_stocks = []
    
    for i, stock in enumerate(stocks):
        print(f"Validating {i+1}/{len(stocks)}: {stock['ticker']}", end='\r')
        
        try:
            ticker = yf.Ticker(stock['ticker'])
            info = ticker.fast_info
            
            # Check if stock is still active and has valid data
            if info and 'currency' in info and info['currency']:
                validated_stocks.append(stock)
        except Exception:
            continue
    
    print(f"\nValidated {len(validated_stocks)} stocks")
    return validated_stocks


async def seed_database(stocks, force=False):
    """Seed the ticker_universe table with Russell 2999 approximation."""
    print("Seeding ticker_universe table with Russell 2999 approximation...")

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
            for stock in stocks:
                ticker_entry = TickerUniverse(
                    ticker=stock['ticker'],
                    display_name=stock['display_name'],
                    asset_class=stock.get('asset_class', 'equity'),
                    exchange=stock.get('exchange', 'Unknown'),
                    market_cap=stock.get('market_cap')
                )
                db.add(ticker_entry)

            await db.commit()
            print(f"Seeded {len(stocks)} Russell 2999 approximation tickers")

        except Exception as e:
            await db.rollback()
            print(f"Error seeding database: {e}")
            raise


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Get Russell 2999 constituents approximation')
    parser.add_argument('--force', action='store_true', help='Clear existing data before seeding')
    parser.add_argument('--exclude-top', type=int, default=100, help='Number of largest companies to exclude (default: 100 for Russell 2999)')
    parser.add_argument('--output', type=str, help='Output file to save the list')
    args = parser.parse_args()

    print("Getting Russell 2999 approximation...")
    print("Note: Russell 2999 is Russell 3000 minus the largest 100 companies.")
    print("Since Russell indices are proprietary, this is an approximation based on market cap.")
    
    # Get comprehensive list of US stocks
    all_stocks = get_comprehensive_us_stocks()
    
    if not all_stocks:
        print("No stocks found. Exiting.")
        return
    
    # Get market cap data to rank by size
    stocks_with_market_cap = get_market_cap_data(all_stocks)
    
    if not stocks_with_market_cap:
        print("No stocks with market cap data. Exiting.")
        return
    
    # Get Russell 2999 approximation
    russell_2999_stocks = get_russell_2999_approximation(stocks_with_market_cap, args.exclude_top)
    
    # Validate the stocks
    validated_stocks = validate_stocks(russell_2999_stocks)
    
    if not validated_stocks:
        print("No validated Russell 2999 approximation stocks. Exiting.")
        return
    
    # Save to file if requested
    if args.output:
        df = pd.DataFrame(validated_stocks)
        df.to_csv(args.output, index=False)
        print(f"Saved Russell 2999 approximation to {args.output}")
    
    # Seed database
    await seed_database(validated_stocks, force=args.force)
    
    print(f"Done! Russell 2999 approximation contains {len(validated_stocks)} stocks.")
    print("Note: This is an approximation. For exact Russell 2999 constituents,")
    print("you need to license data from FTSE Russell.")


if __name__ == "__main__":
    asyncio.run(main())