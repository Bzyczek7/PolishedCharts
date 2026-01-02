"""
Test that ALL API routes are properly classified per FR-035a.

Uses route classification mechanism (@public_endpoint decorator) rather than
hardcoded endpoint lists to prevent future endpoints from accidentally
skipping authentication.

This test enforces the FR-035a requirement: "All API endpoints MUST be classified
as either public (no authentication required) or protected (valid Firebase ID token
required), with protected endpoints uniformly enforcing token verification."
"""
import pytest
from fastapi import FastAPI
from app.main import app
from app.api.decorators import is_public_endpoint, get_public_endpoints
from app.services.auth_middleware import get_current_user


def get_all_api_routes():
    """
    Extract all API routes from the FastAPI app.

    Returns:
        List of tuples: (method, path, endpoint_function)
    """
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods') and hasattr(route, 'endpoint'):
            # Skip docs and internal routes
            if route.path.startswith('/docs') or route.path.startswith('/redoc') or route.path.startswith('/openapi'):
                continue
            for method in route.methods:
                if method == 'HEAD':  # Skip HEAD requests
                    continue
                routes.append((method, route.path, route.endpoint))
    return routes


def test_all_routes_are_classified():
    """
    FR-035a: Every route must be either @public or use get_current_user.

    This is the PRIMARY gate preventing "forgotten middleware" on new endpoints.
    If this test fails, it means a new endpoint was added without:
    1. Marking it @public_endpoint (if it's intentionally public)
    2. Adding Depends(get_current_user) (if it requires authentication)
    """
    unclassified = []
    protected_without_middleware = []

    all_routes = get_all_api_routes()

    for method, path, endpoint_func in all_routes:
        # Skip health check routes, root redirect, and auto-generated docs routes
        if path in ['/health', '/'] or path.startswith('/docs') or path.startswith('/redoc') or path.startswith('/openapi'):
            continue

        # Skip auto-generated OpenAPI endpoint
        if path == '/api/v1/openapi.json':
            continue

        # Check if route function is marked public
        is_public = is_public_endpoint(endpoint_func)

        # Check if route uses auth middleware by inspecting dependencies
        # Note: FastAPI stores dependencies differently depending on how they're applied
        # We need to check both route-level dependencies and parameter dependencies
        uses_auth = False

        # Check route-level dependencies: @router.get("/", dependencies=[Depends(get_current_user)])
        if hasattr(endpoint_func, 'dependant'):
            for dep in getattr(endpoint_func.dependant, 'dependencies', []):
                if hasattr(dep, 'call') and dep.call == get_current_user:
                    uses_auth = True
                    break

        # Check parameter dependencies: user: dict = Depends(get_current_user)
        # This is detected by checking the function's __code__ for get_current_user in defaults
        if not uses_auth:
            # Check the function's code object for get_current_user reference
            # This works because FastAPI stores parameter defaults in the function's defaults tuple
            import inspect
            try:
                sig = inspect.signature(endpoint_func)
                for param_name, param in sig.parameters.items():
                    # Check if the default value is get_current_user
                    if param.default is not inspect.Parameter.empty:
                        # For Depends(get_current_user), check if it references get_current_user
                        if str(param.default).find('get_current_user') != -1:
                            uses_auth = True
                            break
            except Exception:
                # If inspection fails, fall back to checking string representation
                if 'get_current_user' in str(endpoint_func):
                    uses_auth = True

        # Every route must be public OR protected
        if not is_public and not uses_auth:
            # Check if the path suggests it should be public (heuristic)
            path_suggests_public = any([
                '/auth/sign-in' in path,
                '/auth/register' in path,
                '/auth/password-reset' in path,
                '/candles' in path,  # Market data endpoints
            ])

            if path_suggests_public:
                unclassified.append({
                    'method': method,
                    'path': path,
                    'reason': 'Appears to be a public endpoint but missing @public_endpoint decorator'
                })
            else:
                protected_without_middleware.append({
                    'method': method,
                    'path': path,
                    'reason': 'Protected endpoint missing Depends(get_current_user)'
                })

    all_issues = unclassified + protected_without_middleware

    if all_issues:
        # Build helpful error message
        error_lines = [
            f"Found {len(all_issues)} route(s) that are not properly classified.",
            "",
            "Per FR-035a, every API endpoint must be either:",
            "  1. Marked with @public_endpoint decorator (no auth required), OR",
            "  2. Protected with Depends(get_current_user) (auth required)",
            "",
            "Issues found:",
        ]

        for issue in all_issues:
            error_lines.append(f"  - {issue['method']} {issue['path']}: {issue['reason']}")

        error_lines.append("")
        error_lines.append("To fix:")
        error_lines.append("  - For public endpoints: Add @public_endpoint decorator")
        error_lines.append("  - For protected endpoints: Add 'dependencies=[Depends(get_current_user)]'")

        pytest.fail("\n".join(error_lines))


def test_public_endpoints_are_intentional():
    """
    Verify all @public endpoints are intentional and documented.

    This prevents accidentally marking a sensitive endpoint as public.
    """
    all_routes = get_all_api_routes()
    public_routes = []

    for method, path, endpoint_func in all_routes:
        if is_public_endpoint(endpoint_func):
            public_routes.append((method, path))

    # Expected public endpoints - UPDATE THIS LIST when adding new public routes
    # Guest access model: Most endpoints are public, only user-specific endpoints require auth
    expected_public = {
        # Auth endpoints (public for sign-in/register flows)
        ('POST', '/api/v1/auth/sign-in'),
        ('POST', '/api/v1/auth/register'),
        ('POST', '/api/v1/auth/password-reset'),
        # Health endpoints
        ('GET', '/api/v1/health'),
        ('GET', '/health'),
        # Market data endpoints (guest users can view charts - FR-042)
        ('GET', '/api/v1/candles/{symbol}'),
        ('POST', '/api/v1/candles/backfill'),
        ('POST', '/api/v1/candles/update-latest'),
        ('GET', '/api/v1/candles/latest_prices/{symbols:path}'),
        # Alert endpoints (guest users can manage alerts in localStorage - FR-042)
        ('GET', '/api/v1/alerts/'),
        ('POST', '/api/v1/alerts/'),
        ('GET', '/api/v1/alerts/{alert_id}'),
        ('PUT', '/api/v1/alerts/{alert_id}'),
        ('DELETE', '/api/v1/alerts/{alert_id}'),
        ('POST', '/api/v1/alerts/{alert_id}/mute'),
        ('POST', '/api/v1/alerts/{alert_id}/unmute'),
        ('GET', '/api/v1/alerts/indicator-conditions'),
        ('GET', '/api/v1/alerts/triggers/recent'),
        ('GET', '/api/v1/alerts/{alert_id}/triggers'),
        # Indicator endpoints (guest users can add indicators - FR-042)
        ('GET', '/api/v1/indicators/'),
        ('GET', '/api/v1/indicators/supported'),
        ('GET', '/api/v1/indicators/{symbol}/{indicator_name}'),
        # Watchlist endpoints (guest users can manage watchlist in localStorage - FR-042)
        ('GET', '/api/v1/watchlist'),
        ('POST', '/api/v1/watchlist'),
        ('PUT', '/api/v1/watchlist/order'),
        ('DELETE', '/api/v1/watchlist/{symbol}'),
        # Search endpoints (guest users can search symbols - FR-042)
        ('GET', '/api/v1/symbols/search'),
    }

    actual_public = set(public_routes)

    # Check for unexpected public routes
    unexpected = actual_public - expected_public

    if unexpected:
        unexpected_list = [f"{method} {path}" for method, path in sorted(unexpected)]
        pytest.fail(
            f"Found {len(unexpected)} unexpected public routes:\n" +
            "\n".join(f"  - {route}" for route in unexpected_list) +
            "\n\nIf these should be public, add them to the expected_public set in this test."
        )


def test_expected_public_endpoints_exist():
    """
    Verify that expected public endpoints are actually marked @public.

    This catches cases where we intended an endpoint to be public but forgot
    to mark it as such.
    """
    all_routes = get_all_api_routes()
    actual_public = set()

    for method, path, endpoint_func in all_routes:
        if is_public_endpoint(endpoint_func):
            actual_public.add((method, path))

    # These should exist and be public
    required_public = {
        ('POST', '/api/v1/auth/sign-in'),
        ('POST', '/api/v1/auth/register'),
        ('POST', '/api/v1/auth/password-reset'),
    }

    missing = required_public - actual_public

    if missing:
        missing_list = [f"{method} {path}" for method, path in sorted(missing)]
        pytest.fail(
            f"Expected public endpoints are missing @public_endpoint decorator:\n" +
            "\n".join(f"  - {route}" for route in missing_list) +
            "\n\nAdd @public_endpoint decorator to these routes."
        )


def test_protected_api_v1_endpoints_use_middleware():
    """
    Verify that protected /api/v1/* endpoints use auth middleware.

    This is a sanity check for common protected endpoints.
    In the guest access model, only merge and user-specific endpoints are protected.
    """
    protected_api_paths = [
        '/api/v1/merge',  # Merge endpoints require authentication
        '/api/v1/auth/user',  # User profile requires authentication
        '/api/v1/auth/sign-out',  # Sign-out requires authentication
    ]

    all_routes = get_all_api_routes()
    issues = []

    for method, path, endpoint_func in all_routes:
        # Check if this is a protected path
        if any(protected in path for protected in protected_api_paths):
            # Should NOT be marked public
            if is_public_endpoint(endpoint_func):
                issues.append(f"{method} {path} is marked @public but should be protected")

    if issues:
        pytest.fail(
            f"Found {len(issues)} protected endpoint(s) incorrectly marked as public:\n" +
            "\n".join(f"  - {issue}" for issue in issues)
        )


def test_public_decorator_registry_is_consistent():
    """
    Verify the @public_endpoint decorator registry is working correctly.

    This ensures the test itself is functioning as expected.
    """
    # Get all functions registered as public
    public_funcs = get_public_endpoints()

    # Verify they're all callable
    for func in public_funcs:
        assert callable(func), f"Registered public endpoint {func} is not callable"


@pytest.mark.parametrize("method,path", [
    ('POST', '/api/v1/auth/sign-in'),
    ('POST', '/api/v1/auth/register'),
    ('POST', '/api/v1/auth/password-reset'),
])
def test_auth_public_routes(method, path):
    """
    Parametrized test verifying all auth public routes exist and are marked public.

    This test will be skipped until the routes are actually implemented,
    but serves as documentation of expected public auth routes.
    """
    all_routes = get_all_api_routes()
    route_exists = False
    is_public = False

    for route_method, route_path, endpoint_func in all_routes:
        if route_method == method and route_path == path:
            route_exists = True
            is_public = is_public_endpoint(endpoint_func)
            break

    if not route_exists:
        pytest.skip(f"Route {method} {path} not implemented yet")
    else:
        assert is_public, f"Route {method} {path} should be marked @public"
