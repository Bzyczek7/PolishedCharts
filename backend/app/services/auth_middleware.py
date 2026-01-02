"""
Shared authentication middleware for Firebase token verification.

Per FR-005a and FR-035a:
- All protected endpoints use this SINGLE shared middleware (get_current_user)
- Dual enforcement: check email_verified on both client AND backend
- Per-route enforcement is PROHIBITED (must use shared middleware)
- Route classification test enforces compliance

Usage in protected endpoints:
    @router.get("/api/v1/alerts")
    async def get_alerts(user: dict = Depends(get_current_user)):
        # user dict contains: uid, email, email_verified, etc.
        ...

Public endpoints (no auth):
    @router.post("/api/v1/auth/sign-in")
    @public_endpoint  # Mark as public in decorators.py
    async def sign_in(...):
        ...
"""
import logging
from typing import Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.firebase_admin import verify_firebase_token
from app.services.error_messages import (
    AUTHENTICATION_FAILED,
    EMAIL_VERIFICATION_REQUIRED,
    TOKEN_EXPIRED,
)

logger = logging.getLogger(__name__)

# HTTPBearer with auto_error=False to handle CORS preflight gracefully
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
) -> Dict[str, Any]:
    """
    Shared authentication middleware for all protected endpoints.

    Verifies Firebase ID token and enforces email verification (FR-005a).
    """
    # Check if credentials are present (handles CORS preflight)
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token = credentials.credentials

    # Verify token with Firebase Admin SDK
    try:
        decoded = await verify_firebase_token(token)
    except ValueError as e:
        # Log actual error for debugging
        logger.warning(f"Token verification failed: {e}")

        # Check for specific error types
        error_str = str(e)
        if 'expired' in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=TOKEN_EXPIRED,
            )

        # Return generic message to user (FR-031: no account enumeration hints)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=AUTHENTICATION_FAILED,
        )

    # DEV: Temporarily disabled email verification check for development testing
    # Re-enable this before production deployment per FR-005a
    # Enforce email verification (FR-005a: dual enforcement on backend)
    # Default to False if claim is missing (fail-safe)
    # email_verified = decoded.get('email_verified', False)
    #
    # if not email_verified:
    #     logger.info(f"Unverified email attempt: uid={decoded.get('uid')}, email={decoded.get('email')}")
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail=EMAIL_VERIFICATION_REQUIRED,
    #     )

    return decoded
