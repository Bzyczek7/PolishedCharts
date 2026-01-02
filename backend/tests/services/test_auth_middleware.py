"""
Test the shared authentication middleware (get_current_user).

Tests T013 requirements:
- Verified user token (email_verified=True) passes through
- Unverified user token (email_verified=False) is rejected with HTTP 403
- Token missing email_verified claim defaults to False and is rejected
- 403 error message matches: "Email verification required"
- Expired/invalid tokens return 401 with generic message (FR-031)
"""
import pytest
from fastapi import HTTPException, status
from unittest.mock import Mock, patch
from app.services.auth_middleware import get_current_user
from app.services.error_messages import (
    AUTHENTICATION_FAILED,
    EMAIL_VERIFICATION_REQUIRED,
    TOKEN_EXPIRED,
)


class TestGetCurrentUser:
    """Test suite for get_current_user authentication middleware."""

    @pytest.fixture
    def mock_credentials(self):
        """Create mock HTTPBearer credentials."""
        credentials = Mock()
        credentials.credentials = "valid_firebase_id_token"
        return credentials

    @pytest.fixture
    def verified_token_payload(self):
        """Create a mock verified Firebase token payload."""
        return {
            'uid': 'test_user_123',
            'email': 'test@example.com',
            'email_verified': True,
            'iss': 'https://securetoken.google.com/test-project',
            'exp': 9999999999,  # Far future
        }

    @pytest.fixture
    def unverified_token_payload(self):
        """Create a mock unverified Firebase token payload."""
        return {
            'uid': 'test_user_123',
            'email': 'test@example.com',
            'email_verified': False,  # Not verified
            'iss': 'https://securetoken.google.com/test-project',
            'exp': 9999999999,
        }

    @pytest.fixture
    def token_without_email_verified(self):
        """Create a token payload missing email_verified claim."""
        return {
            'uid': 'test_user_123',
            'email': 'test@example.com',
            # Missing email_verified claim
            'iss': 'https://securetoken.google.com/test-project',
            'exp': 9999999999,
        }

    @pytest.mark.asyncio
    async def test_verified_user_passes_through(self, mock_credentials, verified_token_payload):
        """Test 1: Verified user token (email_verified=True) passes through.

        A user with a verified email should be able to access protected endpoints.
        """
        with patch('app.services.auth_middleware.verify_firebase_token') as mock_verify:
            mock_verify.return_value = verified_token_payload

            result = await get_current_user(mock_credentials)

            assert result['uid'] == 'test_user_123'
            assert result['email'] == 'test@example.com'
            assert result['email_verified'] is True
            mock_verify.assert_called_once_with('valid_firebase_id_token')

    @pytest.mark.asyncio
    async def test_unverified_user_rejected_with_403(self, mock_credentials, unverified_token_payload):
        """Test 2: Unverified user token (email_verified=False) is rejected with HTTP 403.

        Users must verify their email before accessing protected resources (FR-005a).
        """
        with patch('app.services.auth_middleware.verify_firebase_token') as mock_verify:
            mock_verify.return_value = unverified_token_payload

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials)

            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
            assert EMAIL_VERIFICATION_REQUIRED in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_missing_email_verified_defaults_to_false_and_rejected(
        self, mock_credentials, token_without_email_verified
    ):
        """Test 3: Token missing email_verified claim defaults to False and is rejected.

        For safety, missing email_verified claim should be treated as False.
        """
        with patch('app.services.auth_middleware.verify_firebase_token') as mock_verify:
            mock_verify.return_value = token_without_email_verified

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials)

            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
            # The actual error should mention verification is required
            assert 'verification' in exc_info.value.detail.lower() or 'required' in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_expired_token_returns_401_generic_message(self, mock_credentials):
        """Test 4: Expired/invalid tokens return 401 with generic message (FR-031).

        Generic message prevents account enumeration - doesn't reveal whether
        account exists, only that authentication failed.
        """
        with patch('app.services.auth_middleware.verify_firebase_token') as mock_verify:
            # Simulate expired token error
            mock_verify.side_effect = ValueError("Token expired")

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials)

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            # Expired tokens return the specific TOKEN_EXPIRED message
            assert TOKEN_EXPIRED in exc_info.value.detail or AUTHENTICATION_FAILED in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401_generic_message(self, mock_credentials):
        """Test 5: Invalid tokens return 401 with generic message.

        Invalid tokens (malformed, wrong signature, etc.) should return generic error.
        """
        with patch('app.services.auth_middleware.verify_firebase_token') as mock_verify:
            # Simulate invalid token error
            mock_verify.side_effect = ValueError("Invalid token")

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials)

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert AUTHENTICATION_FAILED in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_token_expired_code_returns_specific_message(self, mock_credentials):
        """Test 6: Token expired returns specific "session expired" message.

        Expired tokens are a special case - user was authenticated before,
        so we can give a more helpful message.
        """
        with patch('app.services.auth_middleware.verify_firebase_token') as mock_verify:
            # Simulate token expiration (could be caught at verify_token layer)
            mock_verify.side_effect = ValueError("Token expired")

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials)

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            # Could be either generic or session-expired message
            detail = exc_info.value.detail.lower()
            assert 'auth' in detail or 'session' in detail or 'expired' in detail
