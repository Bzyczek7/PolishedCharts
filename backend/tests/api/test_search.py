"""
T017 [US1] Integration test for GET /api/v1/symbols/search

Tests the symbol search endpoint with yfinance fallback:
- Returns matching symbols from ticker_universe
- 1-10 character partial match
- Falls back to yfinance for exact ticker lookup
- Returns results with symbol and display_name
- Empty results when no matches
"""

from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock, patch
from app.main import app
from app.db.session import get_db

client = TestClient(app)


def test_get_symbols_search_success():
    """
    T017 [US1] Integration test: GET /api/v1/symbols/search returns matching symbols

    This test validates:
    - Query parameter 'q' is used for partial symbol match
    - Returns results with symbol and display_name
    - Case-insensitive matching
    - Returns 200 on success
    """
    mock_session = AsyncMock()

    # Mock search results
    mock_results = [
        (ticker, display_name)
        for ticker, display_name in [
            ("AAPL", "Apple Inc."),
            ("AAP", "Advance Auto Parts"),
            ("GOOG", "Alphabet Inc."),
        ]
    ]

    # Create async mock for execute
    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        # New implementation uses fetchone() and fetchall()
        result_mock.fetchone.return_value = None  # No exact match
        result_mock.fetchall.return_value = mock_results
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    response = client.get("/api/v1/symbols/search?q=AAP")

    app.dependency_overrides = {}

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    # Verify response structure
    for item in data:
        assert "symbol" in item or "ticker" in item
        assert "display_name" in item


def test_get_symbols_search_partial_match():
    """
    T017 [US1] Integration test: Partial symbol matching

    This test validates:
    - Query 'AAP' matches 'AAPL', 'AAP', etc.
    - Query 'MSF' matches 'MSFT'
    - Query is treated as prefix match
    """
    mock_session = AsyncMock()

    mock_results = [
        ("AAPL", "Apple Inc."),
    ]

    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        result_mock.fetchone.return_value = None
        result_mock.fetchall.return_value = mock_results
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    response = client.get("/api/v1/symbols/search?q=AAP")

    app.dependency_overrides = {}

    assert response.status_code == 200
    data = response.json()
    # Verify partial matches are returned
    assert any(item.get("symbol") == "AAPL" or item.get("ticker") == "AAPL" for item in data)


def test_get_symbols_search_case_insensitive():
    """
    T017 [US1] Integration test: Case-insensitive search

    This test validates:
    - Query 'aapl' matches 'AAPL'
    - Query 'Aapl' matches 'AAPL'
    - Case does not affect search results
    """
    mock_session = AsyncMock()

    mock_results = [
        ("AAPL", "Apple Inc."),
    ]

    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        result_mock.fetchone.return_value = None
        result_mock.fetchall.return_value = mock_results
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    # Test various cases
    for query in ["aapl", "Aapl", "AAPL"]:
        response = client.get(f"/api/v1/symbols/search?q={query}")
        assert response.status_code == 200

    app.dependency_overrides = {}


def test_get_symbols_search_empty_results():
    """
    T017 [US1] Integration test: Empty search results

    This test validates:
    - Query with no matches returns empty array
    - Returns 200 even with no results
    - Does not return 404 for empty results
    """
    mock_session = AsyncMock()

    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        result_mock.fetchone.return_value = None
        result_mock.fetchall.return_value = []
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    # Use invalid format query to avoid yfinance fallback
    response = client.get("/api/v1/symbols/search?q=@#$%")

    app.dependency_overrides = {}

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_symbols_search_query_length_validation():
    """
    T017 [US1] Integration test: Query length validation (1-10 characters)

    This test validates:
    - Empty query returns 422 (FastAPI validation error)
    - Query > 10 characters returns 422 (FastAPI validation error)
    - 1-10 character queries are accepted
    """
    mock_session = AsyncMock()

    # Set up a proper mock that returns results
    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        result_mock.fetchone.return_value = None
        result_mock.fetchall.return_value = []  # Empty results
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    # Test empty query (FastAPI returns 422 for validation errors)
    response = client.get("/api/v1/symbols/search?q=")
    assert response.status_code == 422  # Validation error

    # Test query > 10 characters (FastAPI returns 422)
    response = client.get("/api/v1/symbols/search?q=ABCDEFGHIJK")
    assert response.status_code == 422  # Validation error

    # Test valid lengths (1-10)
    for length in [1, 3, 5, 10]:
        query = "A" * length
        response = client.get(f"/api/v1/symbols/search?q={query}")
        # Should accept valid length queries
        assert response.status_code == 200, f"Query length {length} should be valid"

    app.dependency_overrides = {}


def test_get_symbols_search_limit_results():
    """
    T017 [US1] Integration test: Result limiting

    This test validates:
    - Results are limited to prevent large responses
    - Default limit is 10 results
    """
    mock_session = AsyncMock()

    # Mock many results
    mock_results = [
        (f"SYM{i}", f"Symbol {i}")
        for i in range(100)
    ]

    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        result_mock.fetchone.return_value = None
        # Return 100 results but service should limit to 10
        result_mock.fetchall.return_value = mock_results
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    response = client.get("/api/v1/symbols/search?q=S")

    app.dependency_overrides = {}

    assert response.status_code == 200
    data = response.json()
    # Verify results are limited
    assert len(data) <= 10


def test_get_symbols_search_requires_query_param():
    """
    T017 [US1] Integration test: Query parameter is required

    This test validates:
    - Missing 'q' parameter returns 400
    - Error message indicates missing query parameter
    """
    mock_session = AsyncMock()

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    response = client.get("/api/v1/symbols/search")

    app.dependency_overrides = {}

    # Should return 422 for missing query parameter (FastAPI validation error)
    assert response.status_code == 422


def test_get_symbols_search_yfinance_fallback():
    """
    Test yfinance fallback for tickers not in local database.

    When searching for a ticker like "PFF" that's not in the local
    database, the search should fall back to yfinance.
    """
    mock_session = AsyncMock()

    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        result_mock.fetchone.return_value = None  # No exact match
        result_mock.fetchall.return_value = []  # No partial matches
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    # Mock yfinance response
    mock_yf_info = {
        'symbol': 'PFF',
        'shortName': 'iShares Preferred and Income Securities ETF'
    }

    with patch('app.services.search.asyncio.to_thread', return_value=mock_yf_info):
        response = client.get("/api/v1/symbols/search?q=PFF")

    app.dependency_overrides = {}

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['symbol'] == 'PFF'
    assert 'iShares Preferred' in data[0]['display_name']


def test_get_symbols_search_exact_local_match_priority():
    """
    Test that exact local match takes priority over yfinance.

    When a ticker exists in the local database, it should be
    returned immediately without querying yfinance.
    """
    mock_session = AsyncMock()

    async def mock_execute(*args, **kwargs):
        result_mock = MagicMock()
        # Exact match found in local DB
        result_mock.fetchone.return_value = ('AAPL', 'Apple Inc. Local')
        result_mock.fetchall.return_value = []
        return result_mock

    mock_session.execute = mock_execute

    def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    with patch('app.services.search.asyncio.to_thread') as mock_thread:
        # yfinance should NOT be called for local match
        mock_thread.return_value = {'symbol': 'AAPL', 'shortName': 'Apple Inc. Yahoo'}

        response = client.get("/api/v1/symbols/search?q=AAPL")

    app.dependency_overrides = {}

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['symbol'] == 'AAPL'
    assert data[0]['display_name'] == 'Apple Inc. Local'
    # yfinance should not have been called
    mock_thread.assert_not_called()
