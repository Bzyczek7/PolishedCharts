"""
Symbol Search API endpoint (User Story 1)

Provides REST API for searching ticker symbols.
"""
import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.api.decorators import public_endpoint
from app.db.session import get_db
from app.services.search import SearchService

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Request/Response Schemas ---

class SymbolSearchResult(BaseModel):
    """Symbol search result schema."""
    symbol: str = Field(..., description="Ticker symbol (uppercase)")
    display_name: str = Field(..., description="Company name or description")
    exchange: str | None = Field(None, description="Exchange code (e.g., 'NMS', 'SIX')")


class ErrorResponse(BaseModel):
    """Error response schema."""
    detail: str


# --- API Endpoint ---

@router.get("/search", response_model=list[SymbolSearchResult], tags=["symbols"])
@public_endpoint
async def search_symbols(
    request: Request,
    q: str = Query(..., min_length=1, max_length=10, description="Search query (partial ticker symbol, company name, or full ticker)"),
    db: AsyncSession = Depends(get_db),
):
    """Search for ticker symbols.

    Searches the ticker_universe table and symbol table for matching ticker symbols.
    Falls back to yfinance for exact ticker lookup if not found locally.

    **Validation Rules**:
    - Query must be 1-10 characters
    - Returns partial matches on ticker symbol (e.g., "GOO" matches "GOOGL", "GOOG")
    - Falls back to yfinance for full ticker symbols not in local database
    - Maximum 10 results returned

    **Frontend Debouncing**: Client should debounce input at 300ms (per AC-001)
    """
    service = SearchService(db)

    try:
        logger.info(f"[{request.url.path}] Search request: query='{q}'")
        results = await service.search_tickers(q)
        logger.info(f"[{request.url.path}] Search returned {len(results)} results for query='{q}'")
        return results
    except ValueError as e:
        # Query validation error
        logger.warning(f"[{request.url.path}] Search validation error for query='{q}': {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Unexpected error - log full details for diagnosis
        logger.error(f"[{request.url.path}] Search failed for query='{q}': {e}")
        logger.error(f"[{request.url.path}] Traceback:\n{traceback.format_exc()}")
        # Re-raise so global handler can return proper 500 response
        raise
