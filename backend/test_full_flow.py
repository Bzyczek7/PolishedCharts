import asyncio
import logging
from datetime import datetime, timezone
from app.db.session import AsyncSessionLocal
from app.models.symbol import Symbol
from app.services.orchestrator import DataOrchestrator
from app.services.candles import CandleService
from app.services.providers import YFinanceProvider, AlphaVantageProvider
from app.core.config import settings
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)

async def test():
    async with AsyncSessionLocal() as db:
        # Find Symbol
        result = await db.execute(select(Symbol).filter(Symbol.ticker == "IBM"))
        symbol_obj = result.scalars().first()
        
        if not symbol_obj:
            print("IBM not found")
            return
        
        # Initialize services and orchestrator
        candle_service = CandleService()
        yf_provider = YFinanceProvider()
        av_provider = AlphaVantageProvider(api_key=settings.ALPHA_VANTAGE_API_KEY)
        orchestrator = DataOrchestrator(candle_service, yf_provider, av_provider)

        print("Calling orchestrator.get_candles...")
        try:
            candles_data = await orchestrator.get_candles(
                db=db,
                symbol_id=symbol_obj.id,
                ticker=symbol_obj.ticker,
                interval="1d"
            )
            print(f"Success! Found {len(candles_data)} candles")
        except Exception as e:
            print(f"Failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
