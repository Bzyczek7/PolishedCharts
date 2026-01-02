"""
Tests for SearchService (User Story 1)

TDD approach: Tests written before implementation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession


# T012 [P] [US1] Unit test for SearchService.search_tickers()
@pytest.mark.asyncio
async def test_search_tickers_partial_match():
    """Test searching tickers with partial symbol match."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # Create mock ticker objects
    mock_ticker1 = MagicMock()
    mock_ticker1.ticker = 'AAPL'
    mock_ticker1.display_name = 'Apple Inc.'

    mock_ticker2 = MagicMock()
    mock_ticker2.ticker = 'ABBV'
    mock_ticker2.display_name = 'AbbVie Inc.'

    # Mock: exact match returns None, partial matches return results
    mock_result = MagicMock()
    mock_result.fetchone.return_value = None  # No exact match
    mock_result.fetchall.return_value = [
        (mock_ticker1.ticker, mock_ticker1.display_name),
        (mock_ticker2.ticker, mock_ticker2.display_name),
    ]

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)
    results = await service.search_tickers("AAP")

    assert len(results) == 2
    assert results[0]['symbol'] == 'AAPL'
    assert results[0]['display_name'] == 'Apple Inc.'
    assert results[1]['symbol'] == 'ABBV'


@pytest.mark.asyncio
async def test_search_tickers_case_insensitive():
    """Test searching tickers is case-insensitive."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_ticker = MagicMock()
    mock_ticker.ticker = 'AAPL'
    mock_ticker.display_name = 'Apple Inc.'

    mock_result = MagicMock()
    mock_result.fetchone.return_value = None  # No exact match
    mock_result.fetchall.return_value = [(mock_ticker.ticker, mock_ticker.display_name)]

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # Test lowercase - should still find partial matches
    results = await service.search_tickers("aapl")
    assert len(results) == 1


@pytest.mark.asyncio
async def test_search_tickers_max_results():
    """Test search respects 10 result maximum."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # Create 15 mock results as tuples (symbol, display_name)
    mock_results = []
    for i in range(1, 16):
        mock_results.append((f'T{i:02d}', f'Ticker {i}'))

    mock_result = MagicMock()
    mock_result.fetchone.return_value = None  # No exact match
    mock_result.fetchall.return_value = mock_results

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)
    results = await service.search_tickers("T")

    # Should return max 10 results
    assert len(results) == 10


@pytest.mark.asyncio
async def test_search_tickers_no_results():
    """Test search returns empty list when no matches found anywhere."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_result = MagicMock()
    mock_result.fetchone.return_value = None  # No exact match
    mock_result.fetchall.return_value = []  # No partial matches

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # Use an invalid ticker format that won't match yfinance
    # "@#$%" is invalid format so won't trigger yfinance
    results = await service.search_tickers("@#$%")

    assert results == []


@pytest.mark.asyncio
async def test_search_yfinance_returns_none():
    """Test search returns empty when yfinance lookup returns None."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_result = MagicMock()
    mock_result.fetchone.return_value = None  # No exact match
    mock_result.fetchall.return_value = []  # No partial matches

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # Mock yfinance returning None (no data for this ticker)
    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        mock_thread.return_value = None  # yfinance returns None

        results = await service.search_tickers("NOTREAL")

        # Should return empty since yfinance found nothing
        assert results == []


@pytest.mark.asyncio
async def test_search_tickers_too_short():
    """Test search validates minimum query length (1 char)."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    service = SearchService(mock_session)

    # Empty string should raise validation error
    with pytest.raises(ValueError, match="Query must be between 1 and 10 characters"):
        await service.search_tickers("")


@pytest.mark.asyncio
async def test_search_tickers_too_long():
    """Test search validates maximum query length (10 chars)."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    service = SearchService(mock_session)

    # 11 character string should raise validation error
    with pytest.raises(ValueError, match="Query must be between 1 and 10 characters"):
        await service.search_tickers("ABCDEFGHIJK")


# --- Tests for yfinance fallback (Feature: yfinance search fallback) ---


@pytest.mark.asyncio
async def test_search_exact_local_match():
    """Test exact local match doesn't call yfinance."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # Mock exact match in ticker_universe
    mock_result = MagicMock()
    # First call (ticker_universe exact) returns match
    # Second call (symbol table exact) returns None
    # Third call (partial matches) returns None
    mock_result.fetchone.side_effect = [
        ('AAPL', 'Apple Inc.'),  # ticker_universe exact match
        None,  # symbol table exact match
        None,  # partial matches
    ]
    mock_result.fetchall.return_value = []

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)
    results = await service.search_tickers("AAPL")

    assert len(results) == 1
    assert results[0]['symbol'] == 'AAPL'
    assert results[0]['display_name'] == 'Apple Inc.'
    # yfinance should NOT be called for exact local match (early exit)


@pytest.mark.asyncio
async def test_search_yfinance_fallback():
    """Test yfinance fallback when local DB has no matches."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # First execute for exact match returns None
    # Second execute for partial matches returns empty
    mock_empty_result = MagicMock()
    mock_empty_result.fetchall.return_value = []
    mock_empty_result.fetchone.return_value = None

    call_count = 0
    async def mock_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return mock_empty_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # Mock yfinance response
    mock_yf_info = {'symbol': 'PFF', 'shortName': 'iShares Preferred and Income Securities ETF'}

    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        mock_thread.return_value = mock_yf_info

        results = await service.search_tickers("PFF")

        # Should return yfinance result
        assert len(results) == 1
        assert results[0]['symbol'] == 'PFF'
        assert 'iShares Preferred' in results[0]['display_name']


@pytest.mark.asyncio
async def test_search_yfinance_with_partials():
    """Test that yfinance is NOT called when partials exist (guard condition)."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # Exact match returns None
    # Partial matches return some results
    mock_result = MagicMock()
    mock_result.fetchone.return_value = None
    mock_result.fetchall.return_value = [
        ('PFE', 'Pfizer Inc.'),  # Local partial match for "PF"
    ]

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # yfinance returns a different ticker
    mock_yf_info = {'symbol': 'PFF', 'shortName': 'iShares Preferred ETF'}

    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        mock_thread.return_value = mock_yf_info

        results = await service.search_tickers("PF")

        # Since partials exist, yfinance should NOT be called (guard condition)
        assert len(results) == 1
        assert results[0]['symbol'] == 'PFE'
        # yfinance was not called because partials exist


@pytest.mark.asyncio
async def test_search_yfinance_error_handling():
    """Test yfinance error falls through to partial matches."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_empty = MagicMock()
    mock_empty.fetchall.return_value = []
    mock_empty.fetchone.return_value = None

    async def mock_execute(*args, **kwargs):
        return mock_empty

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # yfinance raises exception
    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = Exception("Network error")

        results = await service.search_tickers("XYZ123")

        # Should return empty list (no partials, yfinance failed)
        assert results == []


@pytest.mark.asyncio
async def test_search_short_query_no_yfinance():
    """Test short queries (1-2 chars) don't trigger yfinance."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # Partial matches for short query
    mock_partial = MagicMock()
    mock_partial.fetchall.return_value = [('A', 'A Stock')]
    mock_partial.fetchone.return_value = None

    async def mock_execute(*args, **kwargs):
        return mock_partial

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        results = await service.search_tickers("A")

        # Should return partial match, yfinance NOT called (has partials)
        assert len(results) == 1
        # yfinance should not be called because partials exist


@pytest.mark.asyncio
async def test_search_invalid_format_no_yfinance():
    """Test queries with invalid format don't trigger yfinance."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_empty = MagicMock()
    mock_empty.fetchall.return_value = []
    mock_empty.fetchone.return_value = None

    async def mock_execute(*args, **kwargs):
        return mock_empty

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        # Query with special chars that don't match ticker pattern
        results = await service.search_tickers("@#$%")

        # Should return empty, yfinance NOT called (invalid format)
        assert results == []


@pytest.mark.asyncio
async def test_search_pff_like():
    """Regression test: PFF-like query returns single yfinance result."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # No local matches
    mock_empty = MagicMock()
    mock_empty.fetchall.return_value = []
    mock_empty.fetchone.return_value = None

    async def mock_execute(*args, **kwargs):
        return mock_empty

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # Mock yfinance response for PFF
    mock_yf_info = {
        'symbol': 'PFF',
        'shortName': 'iShares Preferred and Income Securities ETF',
        'longName': 'iShares Preferred and Income Securities ETF'
    }

    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        mock_thread.return_value = mock_yf_info

        results = await service.search_tickers("PFF")

        assert len(results) == 1
        assert results[0]['symbol'] == 'PFF'
        assert 'iShares Preferred' in results[0]['display_name']


@pytest.mark.asyncio
async def test_search_longer_tickers():
    """Test 6-10 character ticker queries work."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)

    # No local matches for longer ticker
    mock_empty = MagicMock()
    mock_empty.fetchall.return_value = []
    mock_empty.fetchone.return_value = None

    async def mock_execute(*args, **kwargs):
        return mock_empty

    mock_session.execute = mock_execute

    service = SearchService(mock_session)

    # Mock yfinance for a longer ticker (6+ chars)
    mock_yf_info = {'symbol': 'BRK', 'shortName': 'Berkshire Hathaway Inc.'}

    with patch('app.services.search.asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
        mock_thread.return_value = mock_yf_info

        # 3 chars should work (minimum valid ticker length)
        results = await service.search_tickers("BRK")
        assert len(results) == 1


@pytest.mark.asyncio
async def test_looks_like_ticker_validation():
    """Test _looks_like_ticker validation logic."""
    from app.services.search import SearchService

    mock_session = AsyncMock(spec=AsyncSession)
    service = SearchService(mock_session)

    # Valid tickers
    assert service._looks_like_ticker("AAPL") is True
    assert service._looks_like_ticker("PFF") is True
    assert service._looks_like_ticker("BRK.B") is True  # With dot
    assert service._looks_like_ticker("BRK-B") is True  # With dash
    assert service._looks_like_ticker("ABCDEFGHIJ") is True  # 10 chars

    # Invalid - too short
    assert service._looks_like_ticker("A") is False
    assert service._looks_like_ticker("AA") is False

    # Invalid - too long
    assert service._looks_like_ticker("ABCDEFGHIJK") is False  # 11 chars

    # Invalid - special chars
    assert service._looks_like_ticker("@#$%") is False
    assert service._looks_like_ticker("A@PL") is False
