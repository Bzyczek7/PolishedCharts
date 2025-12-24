#!/usr/bin/env python3
"""
Script to populate the database with extended IBM stock data from Yahoo Finance API
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

async def fetch_extended_ibm_data():
    print("Fetching extended IBM data from Yahoo Finance API...")
    
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
        
        # Define extended ranges for different intervals
        intervals_data = [
            {'interval': '1d', 'range': '5y'},  # 5 years of daily data
            {'interval': '1wk', 'range': '10y'},  # 10 years of weekly data
            {'interval': '1h', 'range': '6mo'},  # 6 months of hourly data
            {'interval': '30m', 'range': '1mo'},  # 1 month of 30min data
        ]
        
        for data_req in intervals_data:
            interval = data_req['interval']
            range_val = data_req['range']
            
            print(f"Fetching {interval} data for range {range_val}...")
            
            # Clear existing data for this interval to replace with extended data
            await session.execute(
                delete(Candle).where(
                    Candle.symbol_id == symbol_obj.id,
                    Candle.interval == data_req['interval']
                )
            )
            print(f"Cleared existing IBM {data_req['interval']} data")

            # Fetch data from Yahoo Finance
            symbol = 'IBM'
            url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
            params = {
                'interval': data_req['interval'],
                'range': data_req['range']
            }

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            time.sleep(1)  # Rate limiting
            
            try:
                response = requests.get(url, params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    if 'chart' in data and 'result' in data['chart'] and data['chart']['result']:
                        result_data = data['chart']['result'][0]
                        timestamps = result_data['timestamp']
                        quotes = result_data['indicators']['quote'][0]
                        
                        print(f"Received {len(timestamps)} {interval} data points from Yahoo Finance")
                        
                        # Create candle objects
                        candles_to_add = []
                        for i, ts in enumerate(timestamps):
                            timestamp = datetime.fromtimestamp(ts, tz=timezone.utc)
                            
                            # Only add if all required values are not None
                            if (quotes['open'][i] is not None and 
                                quotes['high'][i] is not None and 
                                quotes['low'][i] is not None and 
                                quotes['close'][i] is not None):
                                
                                candle = Candle(
                                    symbol_id=symbol_obj.id,
                                    timestamp=timestamp,
                                    interval=interval,
                                    open=quotes['open'][i],
                                    high=quotes['high'][i],
                                    low=quotes['low'][i],
                                    close=quotes['close'][i],
                                    volume=int(quotes['volume'][i]) if quotes['volume'][i] is not None else 0
                                )
                                candles_to_add.append(candle)
                        
                        if candles_to_add:
                            session.add_all(candles_to_add)
                            await session.commit()
                            print(f"Successfully added {len(candles_to_add)} {interval} IBM candles")
                        else:
                            print(f"No valid {interval} data to add after filtering")
                    else:
                        print(f"No chart data in API response for {interval}")
                else:
                    print(f"API request failed with status: {response.status_code} for {interval}")
            except Exception as e:
                print(f"Error fetching {interval} data: {e}")
                import traceback
                traceback.print_exc()
        
        print("Extended data fetch completed!")

if __name__ == "__main__":
    asyncio.run(fetch_extended_ibm_data())