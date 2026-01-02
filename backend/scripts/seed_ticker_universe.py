#!/usr/bin/env python3
"""
Seed Ticker Universe Script

Fetches US stock symbols from Wikipedia's S&P 500 page and populates
the ticker_universe table for symbol search functionality.

Usage:
    python scripts/seed_ticker_universe.py
"""

import asyncio
import sys
from pathlib import Path

import yfinance as yf
from bs4 import BeautifulSoup
import requests

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionLocal
from app.models.ticker_universe import TickerUniverse
from sqlalchemy import select


WIKIPEDIA_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
WIKIPEDIA_NASDAQ100_URL = "https://en.wikipedia.org/wiki/Nasdaq-100"
# Note: Wikipedia doesn't have a comprehensive Russell 2000 list, so we'll use alternative sources


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
            })

    return symbols


def fetch_russell_2000_stocks():
    """
    Fetch Russell 2000 stocks from alternative sources.
    Since Russell 2000 composition is proprietary, we'll use alternative methods
    to get small-cap stocks that would likely be in the index.
    """
    print("Fetching Russell 2000 approximation...")

    # Since Russell 2000 is proprietary, we'll use an alternative approach
    # by getting small-cap stocks from different sources

    # Get stocks from multiple sources to ensure comprehensive coverage
    stocks = []

    # Source 1: NASDAQ traded stocks
    try:
        print("Fetching NASDAQ traded stocks...")
        nasdaq_url = "http://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt"
        response = requests.get(nasdaq_url, timeout=30)

        if response.status_code == 200:
            lines = response.text.strip().split('\n')

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
                        })

                        if i > 0 and i % 5000 == 0:
                            print(f"Processed {i} NASDAQ symbols...")

            print(f"Found {len([s for s in stocks if s['ticker'] in lines])} NASDAQ traded stocks")
    except Exception as e:
        print(f"Error fetching NASDAQ stocks: {e}")

    # Source 2: Other listed stocks (NYSE, AMEX, etc.)
    try:
        print("Fetching other listed stocks...")
        other_url = "http://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
        response = requests.get(other_url, timeout=30)

        if response.status_code == 200:
            lines = response.text.strip().split('\n')

            for i, line in enumerate(lines[1:]):  # Skip header
                parts = line.split('|')
                if len(parts) >= 2:
                    symbol = parts[0].strip()
                    name = parts[1].strip()

                    # Skip if it's not a common stock
                    if '^' in symbol or '.' in symbol or '$' in symbol or 'W' in symbol[-1] or 'R' in symbol[-1]:
                        continue

                    if symbol and name and len(symbol) <= 6:
                        # Check if this symbol is not already in our list
                        if not any(s['ticker'] == symbol for s in stocks):
                            stocks.append({
                                'ticker': symbol,
                                'display_name': name,
                            })

                        if i > 0 and i % 5000 == 0:
                            print(f"Processed {i} other listed stocks...")

            print(f"Added other listed stocks, total now: {len(stocks)}")
    except Exception as e:
        print(f"Error fetching other listed stocks: {e}")

    # Source 3: Known small-cap stocks that should be included
    # This ensures important stocks like MARA are included
    known_small_caps = [
        'AVSD',   # Avantis Responsible International Equity ETF
        'ROG',   # Rogers Corporation
        'ROG.SW',   # Roche Holding AG (Swiss)
        'SDIV',   # Global X SuperDividend ETF
        'PATH',   # UiPath Inc.
        'TMO',   # Thermo Fisher Scientific Inc.
        'ADC',   # Agree Realty Corporation
        'AGNC',   # AGNC Investment Corp.
        'T',   # AT&T Inc.
        'MARA',   # Marathon Digital Holdings
        'SNDL',   # Sundial Growers Inc.
        'HOOD',   # Robinhood Markets, Inc.
        'RKT',   # Rocket Companies, Inc.
        'UPST',   # Upstart Holdings, Inc.
        'AFRM',   # Affirm Holdings, Inc.
        'COIN',   # Coinbase Global, Inc.
        'SNAP',   # Snap Inc.
        'TWTR',   # Twitter Inc. (now X)
        'PINS',   # Pinterest, Inc.
        'NET',   # Cloudflare, Inc.
        'DOCU',   # DocuSign, Inc.
        'OKTA',   # Okta, Inc.
        'CRWD',   # CrowdStrike Holdings, Inc.
        'ZS',   # Zscaler, Inc.
        'DDOG',   # Datadog, Inc.
        'MDB',   # MongoDB, Inc.
        'TEAM',   # Atlassian Corporation Plc
        'SNOW',   # Snowflake Inc.
        'CRSP',   # CRISPR Therapeutics AG
        'IONS',   # Ionis Pharmaceuticals, Inc.
        'VRTX',   # Vertex Pharmaceuticals Incorporated
        'REGN',   # Regeneron Pharmaceuticals, Inc.
        'GILD',   # Gilead Sciences, Inc.
        'BIIB',   # Biogen Inc.
        'CELG',   # Celgene Corporation (acquired by BMY)
        'ALNY',   # Alnylam Pharmaceuticals, Inc.
        'MNST',   # Monster Beverage Corporation
        'CPRT',   # Copart, Inc.
        'EXPE',   # Expedia Group, Inc.
        'ESRX',   # Express Scripts Holding Company (acquired by CI)
        'DLTR',   # Dollar Tree, Inc.
        'BBY',   # Best Buy Co., Inc.
        'AZO',   # AutoZone, Inc.
        'ROST',   # Ross Stores, Inc.
        'ULTA',   # Ulta Beauty, Inc.
        'LULU',   # lululemon athletica inc.
        'COST',   # Costco Wholesale Corporation
        'ORLY',   # O'Reilly Automotive, Inc.
        'BWA',   # BorgWarner Inc.
        'GPC',   # Genuine Parts Company
        'LKQ',   # LKQ Corporation
        'MIDD',   # The Middleby Corporation
        'TFX',   # Teleflex Incorporated
        'MAS',   # Masco Corporation
        'ROL',   # Rollins, Inc.
        'ALLE',   # Allegion plc
        'CRL',   # Charles River Laboratories International, Inc.
        'TMO',   # Thermo Fisher Scientific Inc.
        'DHR',   # Danaher Corporation
        'IDXX',   # IDEXX Laboratories, Inc.
        'IQV',   # IQVIA Holdings Inc.
        'PKI',   # PerkinElmer, Inc.
        'WAT',   # Waters Corporation
        'ZBRA',   # Zebra Technologies Corporation
        'CDNS',   # Cadence Design Systems, Inc.
        'CHKP',   # Check Point Software Technologies Ltd.
        'CTSH',   # Cognizant Technology Solutions Corporation
        'INTU',   # Intuit Inc.
        'PAYX',   # Paychex, Inc.
        'PYPL',   # PayPal Holdings, Inc.
        'ADBE',   # Adobe Inc.
        'ADSK',   # Autodesk, Inc.
        'ANSS',   # ANSYS, Inc.
        'CDAY',   # Ceridian HCM Holding Inc.
        'CG',   # CarGurus, Inc.
        'CHDN',   # Churchill Downs Incorporated
        'CZR',   # Caesars Entertainment, Inc.
        'EBAY',   # eBay Inc.
        'FOUR',   # Shift4 Payments, Inc.
        'GRUB',   # Grubhub Inc.
        'HD',   # The Home Depot, Inc.
        'IRBT',   # iRobot Corporation
        'JACK',   # Jack in the Box Inc.
        'JKHY',   # Jack Henry & Associates, Inc.
        'LITE',   # Lumentum Holdings, Inc.
        'LVS',   # Las Vegas Sands Corp.
        'MGM',   # MGM Resorts International
        'MPWR',   # Monolithic Power Systems, Inc.
        'NDAQ',   # Nasdaq, Inc.
        'NDSN',   # Nordson Corporation
        'NLSN',   # Nielsen Holdings plc
        'NWS',   # News Corporation
        'NWSA',   # News Corporation
        'ODFL',   # Old Dominion Freight Line, Inc.
        'OTIS',   # Otis Worldwide Corporation
        'PCAR',   # PACCAR Inc.
        'POOL',   # Pool Corporation
        'PPC',   # Pilgrim's Pride Corporation
        'PTC',   # PTC Inc.
        'PVH',   # PVH Corp.
        'QLYS',   # Qualys, Inc.
        'RCL',   # Royal Caribbean Cruises Ltd.
        'RTPY',   # Riptide Therapeutics, Inc.
        'RYAAY',   # Ryanair Holdings plc
        'SCHW',   # The Charles Schwab Corporation
        'STE',   # Steris plc
        'SWKS',   # Skyworks Solutions, Inc.
        'TTD',   # The Trade Desk, Inc.
        'TTWO',   # Take-Two Interactive Software, Inc.
        'VRSK',   # Verisk Analytics, Inc.
        'VRSN',   # VeriSign, Inc.
        'WDC',   # Western Digital Corporation
        'WLK',   # Westlake Corporation
        'WRB',   # W.R. Berkley Corporation
        'WST',   # West Pharmaceutical Services, Inc.
        'XRAY',   # DENTSPLY SIRONA Inc.
        'YUMC',   # Yum China Holdings, Inc.
        'ZBH',   # Zimmer Biomet Holdings, Inc.
        'ZION',   # Zions Bancorporation, National Association
        'ZTS',   # Zoetis Inc.
        'DPZ',   # Domino's Pizza, Inc.
        'ALK',   # Alaska Air Group, Inc.
        'LUV',   # Southwest Airlines Co.
        'UAL',   # United Airlines Holdings, Inc.
        'DAL',   # Delta Air Lines, Inc.
        'JBLU',   # JetBlue Airways Corporation
        'AAL',   # American Airlines Group Inc.
        'HAS',   # Hasbro, Inc.
        'MAT',   # Mattel, Inc.
        'DISCA',   # Discovery, Inc.
        'DISCK',   # Discovery, Inc.
        'DISH',   # Dish Network Corporation
        'SIRI',   # Sirius XM Holdings Inc.
        'NEU',   # NewMarket Corporation
        'IFF',   # International Flavors & Fragrances Inc.
        'ROP',   # Roper Technologies, Inc.
        'CAH',   # Cardinal Health, Inc.
        'COR',   # CoreSite Realty Corporation
        'DLR',   # Digital Realty Trust, Inc.
        'EQIX',   # Equinix, Inc.
        'IRM',   # Iron Mountain Incorporated
        'EXR',   # Extra Space Storage Inc.
        'O',   # Realty Income Corporation
        'PEAK',   # Healthpeak Properties, Inc.
        'KRC',   # Kilroy Realty Corporation
        'ESS',   # Essex Property Trust, Inc.
        'FRT',   # Federal Realty Investment Trust
        'REG',   # Regency Centers Corporation
        'UDR',   # UDR, Inc.
        'SLG',   # SL Green Realty Corp.
        'TIF',   # Tiffany & Co. (acquired by LVMH)
        'LXP',   # LXP Industrial Trust
        'HIW',   # Highwoods Properties, Inc.
        'DEI',   # Douglas Emmett, Inc.
        'CONE',   # CyrusOne Inc.
        'DLX',   # Deluxe Corporation
        'ACRE',   # Ares Commercial Real Estate Corporation
        'WPC',   # W.P. Carey Inc.
        'STAG',   # STAG Industrial, Inc.
        'GOOD',   # Gladstone Commercial Corporation
        'GPT',   # Gramercy Property Trust Inc.
    ]

    # Process the known small-cap stocks and add them to our list if they're not already there
    # and if they can be verified with yfinance
    import yfinance as yf
    for ticker in known_small_caps:
        if not any(s['ticker'] == ticker for s in stocks):
            try:
                # Verify the ticker exists with yfinance
                stock = yf.Ticker(ticker)
                info = stock.fast_info
                if info and 'currency' in info and info['currency']:
                    stocks.append({
                        'ticker': ticker,
                        'display_name': info.get('longName', ticker),
                    })
            except:
                continue

    print(f"Russell 2000 approximation contains {len(stocks)} stocks")
    return stocks


def fetch_all_symbols():
    """Fetch stock symbols from multiple sources (S&P 500, NASDAQ 100, Russell 2000).

    Returns:
        List of dicts with 'ticker', 'display_name', 'asset_class', 'exchange'
    """
    all_symbols = {}

    # S&P 500
    print("Fetching S&P 500 symbols...")
    sp500 = fetch_wikipedia_table(WIKIPEDIA_SP500_URL, table_id='constituents')
    for s in sp500:
        # Truncate display_name to 200 characters to fit in database
        display_name = s['display_name'][:200] if s['display_name'] else s['ticker']
        all_symbols[s['ticker']] = {
            'ticker': s['ticker'],
            'display_name': display_name,
            'asset_class': 'equity',
            'exchange': 'NYSE/NASDAQ'
        }
    print(f"  Found {len(sp500)} symbols")

    # NASDAQ 100
    # Note: Table 3 is the actual ticker list (tables 0-2 are milestones/historical data)
    print("Fetching NASDAQ 100 symbols...")
    ndx100 = fetch_wikipedia_table(WIKIPEDIA_NASDAQ100_URL, table_index=3)
    for s in ndx100:
        # Truncate display_name to 200 characters to fit in database
        display_name = s['display_name'][:200] if s['display_name'] else s['ticker']
        all_symbols[s['ticker']] = {
            'ticker': s['ticker'],
            'display_name': display_name,
            'asset_class': 'equity',
            'exchange': 'NASDAQ'
        }
    print(f"  Found {len(ndx100)} symbols")

    # Russell 2000 (small-cap index) - using market cap approximation
    print("Fetching Russell 2000 symbols (approximation)...")
    russell2000 = fetch_russell_2000_stocks()
    for s in russell2000:
        # Truncate display_name to 200 characters to fit in database
        display_name = s['display_name'][:200] if s['display_name'] else s['ticker']
        all_symbols[s['ticker']] = {
            'ticker': s['ticker'],
            'display_name': display_name,
            'asset_class': 'equity',
            'exchange': 'NYSE/NASDAQ'
        }
    print(f"  Found {len(russell2000)} Russell 2000 approximation symbols")

    symbols = list(all_symbols.values())
    print(f"Total unique symbols: {len(symbols)}")
    return symbols


def validate_symbols(symbols):
    """Validate symbols by checking if yfinance has data for them.

    Args:
        symbols: List of dicts with 'ticker' key

    Returns:
        List of validated symbols
    """
    validated = []

    for i, symbol_info in enumerate(symbols, 1):
        ticker = symbol_info['ticker']
        print(f"Validating {i}/{len(symbols)}: {ticker}", end='\r')

        try:
            # Quick check - try to get info
            yf_ticker = yf.Ticker(ticker)
            # Fast info check without full history fetch
            info = yf_ticker.fast_info

            # If we get here, ticker is valid
            if info and hasattr(info, 'last_price'):
                validated.append(symbol_info)
        except Exception:
            # Skip invalid tickers
            pass

    print(f"\nValidated {len(validated)} tickers")
    return validated


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
                    asset_class=symbol_info.get('asset_class'),
                    exchange=symbol_info.get('exchange')
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

    parser = argparse.ArgumentParser(description='Seed ticker_universe table with stock symbols')
    parser.add_argument('--force', action='store_true', help='Clear existing data before seeding')
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

    # Seed database
    await seed_database(validated_symbols, force=args.force)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
