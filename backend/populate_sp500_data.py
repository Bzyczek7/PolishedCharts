#!/usr/bin/env python3
"""
Script to populate the database with extended S&P 500 stock data from Yahoo Finance API
"""

import asyncio
import requests
import time
import csv
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.core.config import settings

# Read S&P 500 tickers from CSV file
import csv
import os

SP500_TICKERS = []
csv_file_path = "/home/marek/DQN/TradingAlert/sp500_tickers.csv"

if os.path.exists(csv_file_path):
    with open(csv_file_path, 'r') as file:
        reader = csv.reader(file)
        SP500_TICKERS = [row[0] for row in reader if row]  # Get first column from each row

    # Remove header if it exists
    if SP500_TICKERS and SP500_TICKERS[0] == "Symbol":
        SP500_TICKERS = SP500_TICKERS[1:]

    print(f"Loaded {len(SP500_TICKERS)} tickers from CSV file")
else:
    print(f"CSV file not found at {csv_file_path}")
    # Fallback to a smaller sample
    SP500_TICKERS = [
        "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "TSLA", "META", "NFLX", "GOOG", "BRK-B",
        "JPM", "JNJ", "V", "PG", "UNH", "HD", "MA", "DIS", "PYPL", "ADBE"
    ]

async def populate_sp500_data():
    print(f"Fetching extended data for {len(SP500_TICKERS)} S&P 500 stocks...")
    
    # Create async engine and session
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Define intervals and ranges for different data
        intervals_data = [
            {'interval': '1d', 'range': '2y'},  # 2 years of daily data
            {'interval': '1wk', 'range': '5y'},  # 5 years of weekly data
            {'interval': '1h', 'range': '1mo'},  # 1 month of hourly data
        ]
        
        for ticker in SP500_TICKERS:
            print(f"Processing {ticker}...")
            
            # Get or create symbol
            result = await session.execute(select(Symbol).filter(Symbol.ticker == ticker))
            symbol_obj = result.scalars().first()
            
            if not symbol_obj:
                # Create symbol if it doesn't exist
                symbol_obj = Symbol(ticker=ticker, name=f"{ticker} Stock")
                session.add(symbol_obj)
                await session.flush()  # Get the ID without committing
                print(f"Created new symbol for {ticker}")
            else:
                print(f"Found existing symbol for {ticker} (ID: {symbol_obj.id})")
            
            # Fetch data for each interval
            for data_req in intervals_data:
                interval = data_req['interval']
                range_val = data_req['range']
                
                print(f"  Fetching {ticker} {interval} data for range {range_val}...")
                
                # Clear existing data for this ticker and interval
                await session.execute(
                    delete(Candle).where(
                        Candle.symbol_id == symbol_obj.id,
                        Candle.interval == interval
                    )
                )
                
                # Fetch data from Yahoo Finance
                url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}'
                params = {
                    'interval': interval,
                    'range': range_val
                }

                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }

                time.sleep(2)  # Rate limiting - be gentle with API
                
                try:
                    response = requests.get(url, params=params, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        if 'chart' in data and 'result' in data['chart'] and data['chart']['result']:
                            result_data = data['chart']['result'][0]

                            # Check if timestamp exists in result_data
                            if 'timestamp' not in result_data:
                                print(f"    No timestamp data in API response for {ticker} {interval}")
                                continue

                            timestamps = result_data['timestamp']
                            quotes = result_data['indicators']['quote'][0]

                            print(f"    Received {len(timestamps)} {interval} data points from Yahoo Finance")

                            # Create candle objects
                            candles_to_add = []
                            for i, ts in enumerate(timestamps):
                                timestamp = datetime.fromtimestamp(ts, tz=timezone.utc)

                                # Only add if all required values are not None
                                if (quotes['open'][i] is not None and
                                    quotes['high'][i] is not None and
                                    quotes['low'][i] is not None and
                                    quotes['close'][i] is not None):

                                    # Handle large volume values that might exceed int32 range
                                    volume_value = 0
                                    if quotes['volume'][i] is not None:
                                        # Cap volume at int32 max to avoid overflow
                                        volume_value = min(int(quotes['volume'][i]), 2147483647)

                                    candle = Candle(
                                        symbol_id=symbol_obj.id,
                                        timestamp=timestamp,
                                        interval=interval,
                                        open=quotes['open'][i],
                                        high=quotes['high'][i],
                                        low=quotes['low'][i],
                                        close=quotes['close'][i],
                                        volume=volume_value
                                    )
                                    candles_to_add.append(candle)

                            if candles_to_add:
                                session.add_all(candles_to_add)
                                await session.commit()
                                print(f"    Successfully added {len(candles_to_add)} {interval} {ticker} candles")
                            else:
                                print(f"    No valid {interval} data to add after filtering for {ticker}")
                        else:
                            print(f"    No chart data in API response for {ticker} {interval}")
                    else:
                        print(f"    API request failed with status: {response.status_code} for {ticker} {interval}")
                        print(f"    Response: {response.text[:200]}...")
                except Exception as e:
                    print(f"    Error fetching {ticker} {interval} data: {e}")
                    import traceback
                    traceback.print_exc()
                    # Rollback session to avoid transaction issues
                    await session.rollback()
            
            print(f"Completed {ticker}")
        
        print("S&P 500 data fetch completed!")

if __name__ == "__main__":
    asyncio.run(populate_sp500_data())