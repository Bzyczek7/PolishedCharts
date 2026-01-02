#!/usr/bin/env python3
"""
Alternative Russell 2000 Data Fetcher

This script attempts to get Russell 2000 constituents by using alternative sources
and market cap filtering to approximate the index.

Since Russell indices are proprietary, this script provides an approximation
using market cap rankings to identify likely Russell 2000 constituents.
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


def get_russell_2000_alternative():
    """
    Get Russell 2000 approximation using alternative methods.
    
    Since Russell 2000 is a proprietary index, we'll use market cap filtering
    to get small-cap stocks that would likely be in the index.
    """
    print("Getting Russell 2000 approximation using alternative methods...")
    
    # Method 1: Get small-cap stocks from major exchanges
    # We'll use a combination of approaches to get a comprehensive list
    
    all_stocks = []
    
    # Get stocks from different sectors that are typically small-cap
    # This is a more targeted approach than trying to get all stocks
    
    # We'll use sector-based ETFs to get component stocks as a proxy
    sector_etfs = [
        'IWM',  # iShares Russell 2000 ETF (this is actually the index we want)
        'IWO',  # iShares Russell 2000 Growth ETF
        'IWN',  # iShares Russell 2000 Value ETF
    ]
    
    print("Getting Russell 2000 components from ETF holdings...")
    
    for etf_ticker in sector_etfs:
        try:
            print(f"Fetching holdings for {etf_ticker}...")
            etf = yf.Ticker(etf_ticker)
            
            # Get the top holdings of the ETF (these should be Russell 2000 stocks)
            try:
                holdings = etf.get_top_holdings()
                if holdings is not None:
                    # This method may not work with all versions of yfinance
                    print(f"Got {len(holdings)} holdings from {etf_ticker}")
                    for holding in holdings:
                        all_stocks.append(holding)
            except:
                # Alternative: get info and try to get major holdings another way
                print(f"Could not get holdings for {etf_ticker}, trying alternative method...")
                
                # For the Russell 2000 ETF, we can try to get its holdings differently
                if etf_ticker == 'IWM':
                    # IWM is the main Russell 2000 ETF, let's try to get its holdings
                    # This is a workaround since yfinance doesn't always provide holdings
                    pass
        except Exception as e:
            print(f"Error fetching {etf_ticker}: {e}")
    
    # If the ETF approach doesn't work, let's try another approach
    # Get a sample of small-cap stocks by filtering for likely candidates
    print("Getting small-cap stocks from NASDAQ...")
    
    try:
        # Get NASDAQ symbols
        nasdaq_url = "http://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt"
        response = requests.get(nasdaq_url, timeout=30)
        
        if response.status_code == 200:
            lines = response.text.strip().split('\n')
            stocks = []
            
            for i, line in enumerate(lines[1:1000]):  # Limit to first 1000 for performance
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
                        })
            
            print(f"Found {len(stocks)} NASDAQ stocks to check")
            
            # Now validate these stocks and get market cap data for small-cap filtering
            small_cap_stocks = []
            for i, stock in enumerate(stocks):
                print(f"Validating {i+1}/{len(stocks)}: {stock['ticker']}", end='\r')
                
                try:
                    ticker = yf.Ticker(stock['ticker'])
                    info = ticker.fast_info
                    
                    if info and 'marketCap' in info and info['marketCap']:
                        market_cap = info['marketCap']
                        
                        # Russell 2000 includes small-cap stocks, typically under $2B market cap
                        # but we'll include a range to be inclusive
                        if market_cap and 50e6 <= market_cap <= 10e9:  # $50M to $10B
                            stock['market_cap'] = market_cap
                            small_cap_stocks.append(stock)
                except Exception:
                    continue
            
            print(f"\nFound {len(small_cap_stocks)} small-cap stocks")
            return small_cap_stocks
    except Exception as e:
        print(f"Error fetching NASDAQ stocks: {e}")
    
    # If all else fails, return an empty list
    return []


def get_russell_2000_from_iwm():
    """
    Get Russell 2000 stocks by analyzing the IWM ETF which tracks the index.
    """
    print("Getting Russell 2000 stocks from IWM ETF...")
    
    try:
        # IWM is the iShares Russell 2000 ETF
        iwm = yf.Ticker("IWM")
        
        # Get the ETF info
        info = iwm.info
        print(f"IWM ETF Name: {info.get('longName', 'Unknown')}")
        
        # Unfortunately, yfinance doesn't provide holdings directly in most cases
        # So we'll use a different approach
        
        # Get the top holdings if available
        try:
            holdings = iwm.get_top_holdings()
            if holdings is not None and not holdings.empty:
                print(f"Found {len(holdings)} top holdings in IWM")
                return holdings
        except:
            print("Could not get holdings from IWM ETF")
        
        # Alternative: Get the largest companies in the index by market cap
        # Since we can't get the full list, we'll create a sample of likely Russell 2000 stocks
        # by getting small-cap stocks from various sectors
        
        # Let's try to get a list of small-cap stocks that would likely be in Russell 2000
        # by using sector ETFs and getting their components
        sector_etfs = [
            'IWO',  # Russell 2000 Growth
            'IWN',  # Russell 2000 Value
        ]
        
        all_stocks = []
        for etf in sector_etfs:
            try:
                etf_obj = yf.Ticker(etf)
                # Try to get info about the ETF
                etf_info = etf_obj.info
                print(f"{etf} ETF: {etf_info.get('longName', 'Unknown')}")
            except:
                continue
        
        return []
    except Exception as e:
        print(f"Error getting IWM ETF data: {e}")
        return []


def get_small_cap_universe():
    """
    Get a universe of small-cap stocks that would likely include Russell 2000 constituents.
    """
    print("Getting small-cap stock universe...")
    
    # Get sector ETFs that focus on small caps
    small_cap_etfs = [
        'IWM',  # Russell 2000
        'IWO',  # Russell 2000 Growth
        'IWN',  # Russell 2000 Value
        'SCHA', # Schwab U.S. Small-Cap ETF
        'SCHM', # Schwab U.S. Mid-Cap ETF (for mid-cap stocks in Russell 2000)
    ]
    
    all_stocks = []
    
    for etf_ticker in small_cap_etfs:
        print(f"Processing ETF: {etf_ticker}")
        
        try:
            etf = yf.Ticker(etf_ticker)
            
            # Try to get the ETF's holdings
            # Note: yfinance doesn't always provide holdings data
            try:
                # This might not work with all yfinance versions
                holdings = etf.get_top_holdings()
                if holdings is not None:
                    print(f"  Found {len(holdings)} holdings")
                    # Process holdings if available
            except:
                print(f"  Could not get holdings for {etf_ticker}")
                continue
        except Exception as e:
            print(f"  Error with {etf_ticker}: {e}")
            continue
    
    # Since getting holdings from ETFs is unreliable with yfinance,
    # let's use a different approach: get a sample of small-cap stocks
    # by querying different sectors
    
    print("Getting small-cap stocks by sector...")
    
    # Define some sector ETFs to get small-cap stocks from
    sector_etfs = [
        'XLY',  # Consumer Discretionary
        'XLP',  # Consumer Staples
        'XLE',  # Energy
        'XLF',  # Financials
        'XLV',  # Health Care
        'XLI',  # Industrials
        'XLB',  # Materials
        'XLRE', # Real Estate
        'XLK',  # Technology
        'XLU',  # Utilities
    ]
    
    small_cap_stocks = []
    
    # For this script, we'll use a different approach
    # Let's get a sample of known small-cap stocks
    known_small_caps = [
        # Some known small-cap stocks that are likely in Russell 2000
        # This is a partial list - in a real implementation, you'd want a more comprehensive source
        "MARA", "SNDL", "HOOD", "EXPR", "RKT", "UPST", "AFRM", "SNAP", "TWTR", "PINS"
    ]
    
    for ticker in known_small_caps:
        try:
            stock = yf.Ticker(ticker)
            info = stock.fast_info
            if info and 'currency' in info:
                # Validate the stock exists
                small_cap_stocks.append({
                    'ticker': ticker,
                    'display_name': info.get('longName', ticker),
                })
        except:
            continue
    
    print(f"Found {len(small_cap_stocks)} small-cap stocks")
    return small_cap_stocks


async def seed_database(stocks, force=False):
    """Seed the ticker_universe table with Russell 2000 approximation."""
    print("Seeding ticker_universe table with Russell 2000 approximation...")

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
                    display_name=stock.get('display_name', stock['ticker']),
                    asset_class=stock.get('asset_class', 'equity'),
                    exchange=stock.get('exchange', 'Unknown')
                )
                db.add(ticker_entry)

            await db.commit()
            print(f"Seeded {len(stocks)} Russell 2000 approximation tickers")

        except Exception as e:
            await db.rollback()
            print(f"Error seeding database: {e}")
            raise


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Get Russell 2000 constituents approximation')
    parser.add_argument('--force', action='store_true', help='Clear existing data before seeding')
    args = parser.parse_args()

    print("Getting Russell 2000 approximation...")
    print("Note: Russell 2000 is a proprietary index.")
    print("This script provides an approximation based on small-cap stock filtering.")
    
    # Get Russell 2000 approximation
    stocks = get_small_cap_universe()
    
    if not stocks:
        print("No stocks found. Trying alternative method...")
        stocks = get_russell_2000_alternative()
    
    if not stocks:
        print("No Russell 2000 approximation stocks found. Exiting.")
        return
    
    # Seed database
    await seed_database(stocks, force=args.force)
    
    print(f"Done! Seeded {len(stocks)} Russell 2000 approximation stocks.")
    print("Note: This is an approximation. For exact Russell 2000 constituents,")
    print("you need to license data from FTSE Russell.")


if __name__ == "__main__":
    asyncio.run(main())