"""
Search Service for ticker universe (User Story 1)

Provides search functionality for stock symbols with yfinance fallback.
"""
import asyncio
import logging
import re
import traceback
from typing import Optional
import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.ticker_universe import TickerUniverse
from app.models.symbol import Symbol
from app.services.rate_limiter import rate_limit
from app.services.providers import yf_limiter

logger = logging.getLogger(__name__)


class SearchService:
    """Service for searching ticker symbols in the ticker universe and existing symbols."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _looks_like_ticker(self, query: str) -> bool:
        """Check if query looks like a complete ticker (not a partial search).

        Constraint: 1-10 chars to support single-letter tickers like 'O', 'F', 'T'.

        Args:
            query: The search query

        Returns:
            True if query looks like a complete ticker (1-10 chars, valid format)
        """
        # 1-10 chars, alphanumeric + dots/dashes only
        # Includes single-letter tickers like 'O' (Realty Income), 'F' (Ford), 'T' (AT&T)
        return bool(re.match(r'^[A-Za-z0-9.-]{1,10}$', query))

    async def _find_exact_ticker(self, query: str) -> Optional[dict]:
        """Find exact ticker match (case-insensitive, exact match only).

        Used for early exit before yfinance fallback.

        Args:
            query: The search query

        Returns:
            Dict with 'symbol', 'display_name', and 'exchange' or None if not found
        """
        normalized = query.upper()

        # First try ticker_universe (exact match on ticker)
        stmt_universe = (
            select(
                TickerUniverse.ticker.label('symbol'),
                TickerUniverse.display_name.label('display_name'),
                TickerUniverse.exchange.label('exchange')
            )
            .where(TickerUniverse.ticker == normalized)
            .limit(1)
        )
        result_universe = await self.db.execute(stmt_universe)
        ticker = result_universe.fetchone()
        if ticker:
            return {
                'symbol': ticker[0],
                'display_name': ticker[1] or ticker[0],
                'exchange': ticker[2]
            }

        # Then try symbol table (exact match on ticker)
        stmt_symbols = (
            select(Symbol.ticker.label('symbol'), Symbol.name.label('display_name'))
            .where(Symbol.ticker == normalized)
            .limit(1)
        )
        result_symbols = await self.db.execute(stmt_symbols)
        ticker = result_symbols.fetchone()
        if ticker:
            return {
                'symbol': ticker[0],
                'display_name': ticker[1] or ticker[0],
                'exchange': None  # Symbol table doesn't have exchange
            }

        return None

    async def _find_partial_matches(self, query: str) -> list[dict]:
        """Find partial matches in local database.

        Args:
            query: The search query for partial matching

        Returns:
            List of dicts with 'symbol', 'display_name', and 'exchange' keys
        """
        pattern = f"%{query.upper()}%"

        # Search in ticker_universe table (US equities)
        logger.debug(f"Searching ticker_universe for pattern: {pattern}")
        stmt_universe = (
            select(
                TickerUniverse.ticker.label('symbol'),
                TickerUniverse.display_name.label('display_name'),
                TickerUniverse.exchange.label('exchange')
            )
            .where(
                or_(
                    TickerUniverse.ticker.ilike(pattern),
                    TickerUniverse.display_name.ilike(pattern)
                )
            )
            .limit(10)
        )

        result_universe = await self.db.execute(stmt_universe)
        tickers_universe = result_universe.fetchall()
        logger.debug(f"ticker_universe returned {len(tickers_universe)} results")

        # Search in symbol table (includes international tickers added to watchlist)
        logger.debug(f"Searching symbol table for pattern: {pattern}")
        stmt_symbols = (
            select(Symbol.ticker.label('symbol'), Symbol.name.label('display_name'))
            .where(Symbol.ticker.ilike(pattern))
            .limit(10)
        )

        result_symbols = await self.db.execute(stmt_symbols)
        tickers_symbols = result_symbols.fetchall()
        logger.debug(f"symbol table returned {len(tickers_symbols)} results")

        # Combine results and deduplicate
        all_results = []
        seen_symbols = set()

        for ticker in tickers_universe:
            symbol = ticker[0]
            display_name = ticker[1] or f"{symbol} Stock"
            exchange = ticker[2]
            if symbol not in seen_symbols:
                all_results.append({
                    'symbol': symbol,
                    'display_name': display_name,
                    'exchange': exchange
                })
                seen_symbols.add(symbol)

        for ticker in tickers_symbols:
            symbol = ticker[0]
            display_name = ticker[1] or f"{symbol} Stock"
            if symbol not in seen_symbols:
                all_results.append({
                    'symbol': symbol,
                    'display_name': display_name,
                    'exchange': None  # Symbol table doesn't have exchange
                })
                seen_symbols.add(symbol)

        return all_results

    @rate_limit(yf_limiter)
    async def _fetch_yfinance_info(self, symbol: str) -> Optional[dict]:
        """Fetch ticker info from yfinance with rate limiting.

        Args:
            symbol: The ticker symbol to look up

        Returns:
            Dict with 'symbol', 'display_name', and 'exchange' or None if not found
        """
        try:
            # Standardized pattern: asyncio.to_thread + yf.Ticker(...).info
            info = await asyncio.to_thread(lambda: yf.Ticker(symbol).info)
            if info and info.get('symbol'):
                return {
                    'symbol': symbol.upper(),
                    'display_name': info.get('shortName') or info.get('longName') or symbol,
                    'exchange': info.get('exchange')  # Exchange code from yfinance
                }
            return None
        except Exception as e:
            logger.warning(f"yfinance lookup failed for {symbol}: {e}")
            return None

    async def search_tickers(self, query: str) -> list[dict]:
        """Search for ticker symbols.

        Searches local database first, then falls back to yfinance for exact
        ticker lookup if not found locally.

        Args:
            query: Search query (1-10 characters, case-insensitive)

        Returns:
            List of dicts with 'symbol' and 'display_name' keys

        Raises:
            ValueError: If query is invalid (empty or too long)
        """
        # Validate query length
        if not (1 <= len(query) <= 10):
            raise ValueError("Query must be between 1 and 10 characters")

        try:
            # 1. Check exact match in local DB FIRST (early exit)
            exact = await self._find_exact_ticker(query)
            if exact:
                logger.info(f"Exact match found for query='{query}': {exact['symbol']}")
                return [exact]

            # 2. Get partial matches from local DB
            partials = await self._find_partial_matches(query)

            # 3. Always check yfinance for exact ticker match (if query looks like a ticker)
            #    and prepend it to results if found (even if partials exist)
            if self._looks_like_ticker(query):
                logger.debug(f"Querying yfinance for exact match: '{query}'")
                yf_result = await self._fetch_yfinance_info(query.upper())
                if yf_result:
                    logger.info(f"yfinance exact match found: {yf_result['symbol']}")
                    # Only add if not already in partials (avoid duplicates)
                    if not any(p['symbol'] == yf_result['symbol'] for p in partials):
                        partials.insert(0, yf_result)

            logger.info(f"Search returned {len(partials)} results for query='{query}'")
            return partials[:10]

        except Exception as e:
            logger.error(f"Error during search for query='{query}': {e}")
            logger.error(f"Traceback:\n{traceback.format_exc()}")
            raise
