"""
Route classification decorators for per-endpoint security configuration.

Per FR-035a: All endpoints must be either explicitly marked @public or use auth middleware.
The route enumeration test will FAIL any route that is neither.

Usage:
    @router.post("/auth/sign-in")
    @public_endpoint
    async def sign_in(credentials: SignInRequest):
        ...

    @router.get("/api/v1/alerts")
    async def get_alerts(current_user: dict = Depends(get_current_user)):
        # Implicitly protected by get_current_user dependency
        ...
"""
from functools import wraps
from typing import Callable


# Registry of public endpoints (no authentication required)
_PUBLIC_ENDPOINTS = set()


def public_endpoint(func: Callable) -> Callable:
    """
    Mark an endpoint as public (no authentication required).

    Any endpoint NOT marked @public_endpoint MUST use get_current_user middleware,
    as verified by the route enumeration test (test_auth_middleware_coverage.py).

    Args:
        func: The endpoint function to mark as public

    Returns:
        The same function, registered as public
    """
    _PUBLIC_ENDPOINTS.add(func)
    return func


def is_public_endpoint(func: Callable) -> bool:
    """
    Check if a route function is marked as public.

    Args:
        func: The endpoint function to check

    Returns:
        True if the function is marked as public, False otherwise
    """
    return func in _PUBLIC_ENDPOINTS


def get_public_endpoints() -> set:
    """
    Get all registered public endpoints.

    Returns:
        Set of endpoint functions marked as public
    """
    return _PUBLIC_ENDPOINTS.copy()
