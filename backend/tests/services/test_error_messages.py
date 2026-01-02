"""
Test that error message constants follow the two standardized patterns per FR-031/FR-034.

Ensures backend error messages match the required patterns for:
1. Generic login/credential failures (FR-031)
2. Email-triggered actions that prevent enumeration (FR-034)
"""
import pytest
from app.services.error_messages import (
    AUTHENTICATION_FAILED,
    EMAIL_SENT_GENERIC,
    PASSWORD_RESET_EMAIL_SENT,
    VERIFICATION_EMAIL_SENT,
    TOKEN_EXPIRED,
    TOKEN_INVALID,
    ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL,
    PASSWORD_TOO_SHORT,
    PASSWORD_REUSED,
    OAUTH_POPUP_CLOSED,
    OAUTH_ERROR,
    MERGE_FAILED,
    SYNC_FAILED,
    INVALID_EMAIL,
    EMAIL_ALREADY_IN_USE,
    get_firebase_error_message,
)


class TestErrorMessagePatterns:
    """Verify error messages follow the two standardized patterns from FR-031 and FR-034."""

    def test_login_failure_pattern_matches_fr031(self):
        """
        FR-031: Generic error message for login/credential failures.

        Must not reveal whether an account exists, password is correct, etc.
        """
        assert AUTHENTICATION_FAILED == (
            "Authentication failed. If an account exists, check your email "
            "for verification or password reset options"
        )

    def test_email_sent_pattern_matches_fr034(self):
        """
        FR-034: Generic message for email-triggered actions (prevents enumeration).

        Displayed regardless of whether the email exists.
        """
        assert EMAIL_SENT_GENERIC == "If an account exists with this email, we sent an email"

    def test_password_reset_uses_generic_pattern(self):
        """Password reset must use the same generic email message (FR-034)."""
        assert PASSWORD_RESET_EMAIL_SENT == EMAIL_SENT_GENERIC

    def test_verification_resend_uses_generic_pattern(self):
        """Verification resend must use the same generic email message (FR-034)."""
        assert VERIFICATION_EMAIL_SENT == EMAIL_SENT_GENERIC


class TestTokenErrors:
    """Verify token error messages are appropriately generic."""

    def test_token_expired_does_not_reveal_details(self):
        """FR-031: Token expired error should not reveal account details."""
        assert "expired" in TOKEN_EXPIRED.lower()
        assert "account" not in TOKEN_EXPIRED.lower()
        assert "user" not in TOKEN_EXPIRED.lower()
        assert TOKEN_EXPIRED == "Your session has expired. Please sign in again."

    def test_token_invalid_is_generic(self):
        """FR-031: Invalid token error should be generic."""
        assert TOKEN_INVALID == "Authentication failed. Please sign in again."

    def test_token_errors_do_not_reveal_email_exists(self):
        """FR-034: Token errors must not reveal whether email/account exists."""
        for msg in [TOKEN_EXPIRED, TOKEN_INVALID]:
            assert "email not found" not in msg.lower()
            assert "no account" not in msg.lower()
            assert "user not found" not in msg.lower()


class TestProviderLinking:
    """Verify provider linking error messages guide users to correct action."""

    def test_account_exists_error_is_descriptive(self):
        """
        FR-029: Account-exists-with-different-credential must guide user
        to sign in with existing method first.
        """
        assert "different sign-in method" in ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL.lower()
        assert "sign in with your existing method" in ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL.lower()

    def test_account_exists_does_not_reveal_provider(self):
        """FR-034: Should not reveal which provider is already linked."""
        # Should say "different sign-in method", not "Google" or "email"
        assert "google" not in ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL.lower()
        assert "facebook" not in ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL.lower()


class TestPasswordErrors:
    """Verify password-related error messages."""

    def test_password_too_short_message(self):
        """FR-019: Password too short error message."""
        assert PASSWORD_TOO_SHORT == "Password should be at least 8 characters."

    def test_password_reused_message(self):
        """FR-020: Password reuse error message."""
        assert PASSWORD_REUSED == "For security, you cannot reuse your current password."


class TestFirebaseErrorMapping:
    """Test that get_firebase_error_message() maps errors correctly."""

    def test_wrong_password_maps_to_generic(self):
        """auth/wrong-password should use generic authentication failed message."""
        assert get_firebase_error_message('auth/wrong-password') == AUTHENTICATION_FAILED

    def test_user_not_found_maps_to_generic(self):
        """auth/user-not-found should use generic authentication failed message."""
        assert get_firebase_error_message('auth/user-not-found') == AUTHENTICATION_FAILED

    def test_invalid_credential_maps_to_generic(self):
        """auth/invalid-credential should use generic authentication failed message."""
        assert get_firebase_error_message('auth/invalid-credential') == AUTHENTICATION_FAILED

    def test_email_already_in_use_message(self):
        """auth/email-already-in-use should indicate email conflict."""
        assert get_firebase_error_message('auth/email-already-in-use') == EMAIL_ALREADY_IN_USE

    def test_account_exists_with_different_credential_message(self):
        """auth/account-exists-with-different-credential should guide linking flow."""
        result = get_firebase_error_message('auth/account-exists-with-different-credential')
        assert result == ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL

    def test_expired_action_code_message(self):
        """auth/expired-action-code should indicate link expiration."""
        assert "expired" in get_firebase_error_message('auth/expired-action-code').lower()

    def test_invalid_action_code_message(self):
        """auth/invalid-action-code should indicate link is invalid."""
        assert "invalid" in get_firebase_error_message('auth/invalid-action-code').lower()

    def test_weak_password_message(self):
        """auth/weak-password should use the password too short message."""
        assert get_firebase_error_message('auth/weak-password') == PASSWORD_TOO_SHORT

    def test_oauth_popup_closed_message(self):
        """auth/popup-closed-by-user should indicate cancellation."""
        assert get_firebase_error_message('auth/popup-closed-by-user') == OAUTH_POPUP_CLOSED

    def test_id_token_expired_message(self):
        """auth/id-token-expired should use token expired message."""
        assert get_firebase_error_message('auth/id-token-expired') == TOKEN_EXPIRED

    def test_invalid_id_token_message(self):
        """auth/invalid-id-token should use generic authentication failed message."""
        assert get_firebase_error_message('auth/invalid-id-token') == TOKEN_INVALID

    def test_unknown_error_maps_to_generic(self):
        """Unknown error codes should default to generic authentication failed."""
        assert get_firebase_error_message('auth/unknown-error') == AUTHENTICATION_FAILED


class TestErrorMessageConsistency:
    """Verify all error messages are appropriately generic to prevent enumeration."""

    def test_no_error_reveals_account_exists(self):
        """
        FR-034: No error message should explicitly state that an account exists or doesn't exist.
        """
        messages = [
            AUTHENTICATION_FAILED,
            EMAIL_SENT_GENERIC,
            TOKEN_EXPIRED,
            TOKEN_INVALID,
            ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL,
            PASSWORD_TOO_SHORT,
            PASSWORD_REUSED,
            OAUTH_ERROR,
            MERGE_FAILED,
            SYNC_FAILED,
            INVALID_EMAIL,
            EMAIL_ALREADY_IN_USE,
        ]

        # These phrases would reveal whether an account exists
        forbidden_phrases = [
            "account does not exist",
            "no account found",
            "email not found",
            "user not found",
            "we couldn't find",
        ]

        for msg in messages:
            for phrase in forbidden_phrases:
                assert phrase not in msg.lower(), (
                    f"Error message '{msg}' contains phrase '{phrase}' "
                    f"which would reveal account existence (violates FR-034)"
                )

    def test_email_errors_do_not_reveal_if_email_registered(self):
        """
        FR-034: Email-related errors must not reveal whether the email is registered.
        """
        # Check specific email errors
        email_errors = [
            get_firebase_error_message('auth/user-not-found'),
            get_firebase_error_message('auth/wrong-password'),
            get_firebase_error_message('auth/invalid-credential'),
        ]

        for error in email_errors:
            # Should be the generic message
            assert error == AUTHENTICATION_FAILED
