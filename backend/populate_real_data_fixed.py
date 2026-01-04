#!/usr/bin/env python3
"""
Script to populate the database with real IBM stock data from Yahoo Finance API
Uses CandleService for proper timestamp normalization and upsert operations
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
from app.services.candles import CandleService
import json

async def fetch_real_ibm_data():
    print("Fetching real IBM data from Yahoo Finance API...")

    # Create async engine and session
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get IBM symbol
        result = await session.execute(select(Symbol).filter(Symbol.ticker == 'IBM'))
        symbol_obj = result.scalars().first()

        if not symbol_obj:
            print("IBM symbol not found in database")
            return

        print(f"Found IBM symbol with ID: {symbol_obj.id}")

        # Clear existing IBM daily data to replace with real data
        from sqlalchemy import delete
        await session.execute(
            delete(Candle).where(
                Candle.symbol_id == symbol_obj.id,
                Candle.interval == '1d'
            )
        )
        print("Cleared existing IBM daily data")

        # Fetch real data from Yahoo Finance
        symbol = 'IBM'
        url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
        params = {
            'interval': '1d',
            'range': '3mo'  # Last 3 months of daily data
        }

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        try:
            response = requests.get(url, params=params, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if 'chart' in data and 'result' in data['chart'] and data['chart']['result']:
                    result_data = data['chart']['result'][0]
                    timestamps = result_data['timestamp']
                    quotes = result_data['indicators']['quote'][0]

                    print(f"Received {len(timestamps)} data points from Yahoo Finance")

                    # Prepare candle data for CandleService
                    candles_data = []
                    for i, ts in enumerate(timestamps):
                        timestamp = datetime.fromtimestamp(ts, tz=timezone.utc)

                        candle_data = {
                            "timestamp": timestamp,
                            "open": quotes['open'][i],
                            "high": quotes['high'][i],
                            "low": quotes['low'][i],
                            "close": quotes['close'][i],
                            "volume": int(quotes['volume'][i]) if quotes['volume'][i] is not None else 0
                        }
                        candles_data.append(candle_data)

                    print(f"Preparing {len(candles_data)} real IBM daily candles for upsert")

                    # Use CandleService for proper timestamp normalization and upsert
                    candle_service = CandleService()
                    await candle_service.upsert_candles(session, symbol_obj.id, '1d', candles_data)
                    await session.commit()
                    print("Successfully added real IBM data to database using CandleService")

                    # Also fetch some shorter-term data for other intervals
                    for interval, range_val in [('1h', '5d'), ('30m', '1d')]:
                        print(f"Fetching {interval} data...")
                        params = {'interval': interval, 'range': range_val}
                        response = requests.get(url, params=params, headers=headers)

                        if response.status_code == 200:
                            data = response.json()
                            if 'chart' in data and 'result' in data['chart'] and data['chart']['result']:
                                result_data = data['chart']['result'][0]
                                timestamps = result_data['timestamp']
                                quotes = result_data['indicators']['quote'][0]

                                print(f"Received {len(timestamps)} {interval} data points")

                                # Clear existing interval data
                                await session.execute(
                                    delete(Candle).where(
                                        Candle.symbol_id == symbol_obj.id,
                                        Candle.interval == interval
                                    )
                                )

                                # Prepare candle data for CandleService
                                candles_data = []
                                for i, ts in enumerate(timestamps):
                                    timestamp = datetime.fromtimestamp(ts, tz=timezone.utc)

                                    candle_data = {
                                        "timestamp": timestamp,
                                        "open": quotes['open'][i],
                                        "high": quotes['high'][i],
                                        "low": quotes['low'][i],
                                        "close": quotes['close'][i],
                                        "volume": int(quotes['volume'][i]) if quotes['volume'][i] is not None else 0
                                    }
                                    candles_data.append(candle_data)

                                if candles_data:
                                    await candle_service.upsert_candles(session, symbol_obj.id, interval, candles_data)
                                    await session.commit()
                                    print(f"Successfully added {len(candles_data)} {interval} IBM candles using CandleService")
                        else:
                            print(f"Failed to fetch {interval} data, status: {response.status_code}")

                else:
                    print("No chart data in API response")
            else:
                print(f"API request failed with status: {response.status_code}")

        except Exception as e:
            print(f"Error fetching data: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(fetch_real_ibm_data())