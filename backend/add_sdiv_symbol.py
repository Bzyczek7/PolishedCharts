#!/usr/bin/env python3
"""
Script to add SDIV symbol to the database and populate it with data from Yahoo Finance API
"""

import asyncio
import requests
import time
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.core.config import settings

async def add_sdiv_symbol():
    print("Adding SDIV symbol to database and fetching data...")

    # Create async engine and session
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check if SDIV symbol already exists
        result = await session.execute(select(Symbol).filter(Symbol.ticker == 'SDIV'))
        symbol_obj = result.scalars().first()

        if not symbol_obj:
            # Create SDIV symbol
            symbol_obj = Symbol(ticker='SDIV', name='Global X SuperDividend ETF')
            session.add(symbol_obj)
            await session.flush()  # Get the ID without committing
            print(f"Created new symbol for SDIV (ID: {symbol_obj.id})")
        else:
            print(f"Found existing symbol for SDIV (ID: {symbol_obj.id})")

        # Define intervals and ranges for data
        intervals_data = [
            {'interval': '1d', 'range': '2y'},  # 2 years of daily data
            {'interval': '1wk', 'range': '5y'},  # 5 years of weekly data
            {'interval': '1h', 'range': '1mo'},  # 1 month of hourly data
        ]

        # Fetch data for each interval
        for data_req in intervals_data:
            interval = data_req['interval']
            range_val = data_req['range']

            print(f"  Fetching SDIV {interval} data for range {range_val}...")

            # Clear existing data for this ticker and interval
            await session.execute(
                delete(Candle).where(
                    Candle.symbol_id == symbol_obj.id,
                    Candle.interval == interval
                )
            )

            # Fetch data from Yahoo Finance
            url = f'https://query1.finance.yahoo.com/v8/finance/chart/SDIV'
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
                            print(f"    No timestamp data in API response for SDIV {interval}")
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
                            print(f"    Successfully added {len(candles_to_add)} {interval} SDIV candles")
                        else:
                            print(f"    No valid {interval} data to add after filtering for SDIV")
                    else:
                        print(f"    No chart data in API response for SDIV {interval}")
                else:
                    print(f"    API request failed with status: {response.status_code} for SDIV {interval}")
                    print(f"    Response: {response.text[:200]}...")
            except Exception as e:
                print(f"    Error fetching SDIV {interval} data: {e}")
                import traceback
                traceback.print_exc()
                # Rollback session to avoid transaction issues
                await session.rollback()

        print("SDIV data fetch completed!")

if __name__ == "__main__":
    asyncio.run(add_sdiv_symbol())