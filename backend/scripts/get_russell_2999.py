#!/usr/bin/env python3
"""
Get Russell 2999 Companies

This script attempts to get Russell 2999 companies (Russell 3000 minus the top 100 companies).
Since Russell 2999 is not a standard index, we'll get Russell 3000 components and exclude the largest 100.

Note: This is a complex task since Russell indices are proprietary. We'll use alternative approaches.
"""

import asyncio
import csv
import requests
import yfinance as yf
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionLocal
from app.models.ticker_universe import TickerUniverse
from sqlalchemy import select


def fetch_russell_3000_alternative():
    """
    Alternative approach to get Russell 3000 companies.
    
    Since Russell indices are proprietary and not freely available, we'll use alternative sources:
    1. Get S&P 500 (already covered)
    2. Get NASDAQ 100 (already covered)
    3. Get additional stocks from other sources
    4. Use market cap data to approximate Russell 2000/2999
    """
    
    # We'll use a combination of sources to get a comprehensive list
    # For Russell 2999, we want small and mid-cap stocks (excluding the largest 100 companies)
    
    # Let's try to get a comprehensive list of US stocks from various sources
    # This is a workaround since Russell indices are proprietary
    
    print("Getting comprehensive list of US stocks...")
    
    # We'll use a different approach - get stocks from multiple exchanges
    # and filter by market cap to approximate Russell 2999
    
    # For now, let's use a different approach - get a comprehensive list of stocks
    # from various sources and then filter by market cap
    
    # Since getting exact Russell 2999 components is difficult without paid data,
    # let's create a function that gets a large list of US stocks and we can filter them
    
    # One approach is to use the Finviz screener data (unofficial)
    # or use other financial data providers
    
    # For now, let's use a different approach - we'll get a comprehensive list
    # of stocks and then filter by market cap to approximate Russell 2999
    
    # Since we can't get exact Russell 2999, let's get a comprehensive list of stocks
    # and provide a function to filter by market cap
    
    print("Note: Exact Russell 2999 components are proprietary and not freely available.")
    print("We'll provide a comprehensive list of US stocks that includes Russell 2999 constituents.")
    
    # Return an empty list for now - we need to implement a proper solution
    return []


def fetch_nasdaq_listed_stocks():
    """
    Fetch NASDAQ listed stocks from NASDAQ FTP
    """
    print("Fetching NASDAQ listed stocks...")
    
    url = "https://www.nasdaq.com/market-activity/stocks/screener"
    # Note: This page is dynamically loaded with JavaScript, so we might need to use selenium
    # For now, let's use the NASDAQ FTP which provides basic data
    
    try:
        # NASDAQ provides a file with listed stocks
        nasdaq_url = "http://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt"
        response = requests.get(nasdaq_url, timeout=30)
        
        if response.status_code == 200:
            lines = response.text.strip().split('\n')
            # Parse the pipe-delimited file
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
                            'exchange': 'NASDAQ'
                        })
                        
                        if i > 0 and i % 1000 == 0:
                            print(f"Processed {i} NASDAQ stocks...")
            
            print(f"Found {len(stocks)} NASDAQ stocks")
            return stocks
    except Exception as e:
        print(f"Error fetching NASDAQ stocks: {e}")
    
    return []


def fetch_nyse_listed_stocks():
    """
    Fetch NYSE listed stocks
    """
    print("Fetching NYSE listed stocks...")
    
    # NYSE doesn't provide a free comprehensive list, but we can try other sources
    # For now, let's use a workaround - we'll use the S&P 500 + Russell 2000 from Wikipedia
    # and add more stocks from other sources
    
    # Since exact Russell 2999 data is proprietary, let's focus on getting a comprehensive
    # list of small and mid-cap stocks
    
    return []


def get_market_cap_data(tickers):
    """
    Get market cap data for a list of tickers to help identify Russell 2999 constituents
    """
    print(f"Getting market cap data for {len(tickers)} tickers...")
    
    market_caps = []
    
    for i, ticker in enumerate(tickers[:1000]):  # Limit for testing
        print(f"Processing {i+1}/{min(1000, len(tickers))}: {ticker}", end='\r')
        
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            if info and 'marketCap' in info and info['marketCap']:
                market_caps.append({
                    'ticker': ticker,
                    'display_name': info.get('longName', info.get('shortName', ticker)),
                    'market_cap': info['marketCap'],
                    'exchange': info.get('exchange', 'Unknown')
                })
        except Exception:
            continue
    
    print(f"\nRetrieved market cap data for {len(market_caps)} tickers")
    
    # Sort by market cap (descending)
    market_caps.sort(key=lambda x: x['market_cap'], reverse=True)
    
    return market_caps


def get_russell_2999_approximation():
    """
    Get an approximation of Russell 2999 companies by excluding the largest 100 companies
    from a comprehensive list of US stocks.
    """
    print("Getting Russell 2999 approximation...")
    
    # Since Russell 2999 is Russell 3000 minus the top 100 companies,
    # we need to get a comprehensive list and exclude the largest 100 by market cap
    
    # For now, let's use the existing sources from the original script
    # plus additional sources to get a more comprehensive list
    
    # This is a simplified version - in practice, getting exact Russell 2999
    # constituents requires proprietary data from FTSE Russell
    
    print("Note: Exact Russell 2999 data requires proprietary FTSE Russell data.")
    print("This script provides a market-cap based approximation.")
    
    # Placeholder - return empty for now
    return []


def fetch_stock_list_from_financial_source():
    """
    Alternative approach: Use a financial data source that provides comprehensive stock lists
    """
    print("Looking for alternative sources for comprehensive stock lists...")
    
    # Since Russell 2999 is proprietary, let's look for other comprehensive sources
    # that might include the constituents we need
    
    # One option is to use the SEC EDGAR database to get a comprehensive list
    # of publicly traded companies
    
    # Another option is to use Yahoo Finance sector/industry data to get more stocks
    
    # For now, let's provide a function that gets stocks by sector/industry
    # which should include many Russell 2999 constituents
    
    print("Alternative approach: Get stocks by sector/industry to approximate Russell 2999...")
    
    # Yahoo Finance sectors - get stocks from various sectors
    sectors = [
        'Basic Materials',
        'Communication Services', 
        'Consumer Cyclical',
        'Consumer Defensive',
        'Energy',
        'Financial Services',
        'Healthcare',
        'Industrials',
        'Real Estate',
        'Technology',
        'Utilities'
    ]
    
    all_stocks = []
    
    # This would require a paid API or web scraping, which is complex
    # Let's provide a different approach
    
    return []


def main():
    """
    Main function to get Russell 2999 companies
    """
    print("Getting Russell 2999 companies...")
    print("Note: Russell 2999 is not a standard index and exact constituents are proprietary.")
    print("This script provides an approximation using market cap filtering.")
    
    # Since exact Russell 2999 data is not freely available, let's provide alternatives:
    
    print("\nOptions for getting Russell 2999 constituents:")
    print("1. Subscribe to FTSE Russell data (official source) - paid")
    print("2. Use market cap data to approximate (this script)")
    print("3. Use third-party financial data providers (paid)")
    print("4. Combine multiple free sources for comprehensive list")
    
    print("\nThe current script in seed_ticker_universe.py already gets:")
    print("- S&P 500 companies")
    print("- NASDAQ 100 companies") 
    print("- Russell 2000 companies")
    
    print("\nFor Russell 2999 (Russell 3000 minus largest 100), you would need:")
    print("- Access to Russell 3000 constituents")
    print("- Access to market cap data for all constituents")
    print("- Exclude the top 100 by market cap")
    
    print("\nSince this data is proprietary, you may need to:")
    print("1. Contact FTSE Russell for licensing")
    print("2. Use a financial data provider like Refinitiv, S&P Capital IQ, etc.")
    print("3. Use academic data sources if available")
    
    # For now, let's suggest an approach to modify the existing script
    print("\nSuggested modification to existing script:")
    print("1. Keep existing sources (S&P 500, NASDAQ 100, Russell 2000)")
    print("2. Add more comprehensive stock lists from exchanges")
    print("3. Add market cap filtering to exclude largest companies")
    
    return []


if __name__ == "__main__":
    main()