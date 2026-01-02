"""
Firebase Admin SDK initialization and token verification.

This module handles Firebase Admin SDK initialization and provides
token verification for the authentication middleware.

IMPORTANT: This must be initialized during app startup (see main.py).
"""
import os
import json
import logging
from typing import Dict, Any
import firebase_admin
from firebase_admin import auth, credentials
from firebase_admin.exceptions import FirebaseError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Track if Firebase has been initialized
_firebase_initialized = False


def initialize_firebase() -> None:
    """
    Initialize Firebase Admin SDK from environment variable.

    Reads FIREBASE_SERVICE_ACCOUNT_KEY from environment (base64-encoded JSON).
    Should be called once during app startup.

    Raises:
        ValueError: If service account key is missing or invalid
        Exception: If Firebase initialization fails
    """
    global _firebase_initialized

    if _firebase_initialized:
        logger.debug("Firebase Admin SDK already initialized")
        return

    try:
        # Get service account key from environment (base64-encoded JSON)
        service_account_key_str = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
        if not service_account_key_str:
            raise ValueError(
                "FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. "
                "Please set it to a base64-encoded service account JSON."
            )

        # Decode base64 if needed (some deployments base64-encode the JSON)
        try:
            # Try to parse as base64 first
            import base64
            decoded = base64.b64decode(service_account_key_str).decode('utf-8')
            service_account_info = json.loads(decoded)
        except (json.JSONDecodeError, ValueError):
            # Not base64, try direct JSON parse
            try:
                service_account_info = json.loads(service_account_key_str)
            except json.JSONDecodeError:
                raise ValueError(
                    "FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON "
                    "(or base64-encoded JSON)"
                )

        # Validate required fields
        required_fields = ['type', 'project_id', 'private_key_id', 'private_key']
        missing = [f for f in required_fields if f not in service_account_info]
        if missing:
            raise ValueError(
                f"Service account key missing required fields: {', '.join(missing)}"
            )

        # Initialize Firebase Admin SDK
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)

        _firebase_initialized = True
        project_id = service_account_info.get('project_id', 'unknown')
        logger.info(f"Firebase Admin SDK initialized for project: {project_id}")

    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        raise


import asyncio
from concurrent.futures import ThreadPoolExecutor

_thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="firebase_")


async def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """
    Verify Firebase ID token and return decoded claims.

    Args:
        id_token: Firebase ID token from Authorization header

    Returns:
        Decoded token claims including:
            - uid: Firebase user ID
            - email: User email address
            - email_verified: Boolean
            - iss: Token issuer
            - exp: Expiration timestamp

    Raises:
        ValueError: If token is invalid, expired, or verification fails
    """
    if not _firebase_initialized:
        raise ValueError("Firebase Admin SDK not initialized")

    def _verify_token() -> Dict[str, Any]:
        """Synchronous token verification in thread pool."""
        return auth.verify_id_token(
            id_token,
            clock_skew_seconds=60  # Max allowed by Firebase (1 minute)
        )

    try:
        # Run synchronous Firebase SDK call in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        decoded_token = await loop.run_in_executor(_thread_pool, _verify_token)
        return decoded_token

    except auth.ExpiredIdTokenError:
        logger.warning("Token verification failed: Token expired")
        raise ValueError("Token expired")

    except auth.InvalidIdTokenError:
        logger.warning("Token verification failed: Invalid token")
        raise ValueError("Invalid token")

    except auth.RevokedIdTokenError:
        logger.warning("Token verification failed: Token revoked")
        raise ValueError("Token revoked")

    except FirebaseError as e:
        logger.warning(f"Token verification failed: {e}")
        raise ValueError("Authentication failed")

    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}")
        raise ValueError("Authentication failed")


def get_firebase_project_id() -> str:
    """Get Firebase project ID from environment."""
    return os.environ.get('FIREBASE_PROJECT_ID', '')


def is_firebase_initialized() -> bool:
    """Check if Firebase Admin SDK has been initialized."""
    return _firebase_initialized
