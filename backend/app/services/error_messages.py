"""
Centralized error message constants to prevent email enumeration and ensure consistent user feedback.

Per FR-031 and FR-034, these patterns MUST be used for all authentication-related errors.
Frontend MUST display these exact messages (see frontend/src/lib/errorCopy.ts).

When adding new auth-related error messages:
1. Add constant here (backend)
2. Copy the exact string to frontend/src/lib/errorCopy.ts
3. Update tests in test_error_messages.py
4. Document the change in this module's docstring
"""

# =============================================================================
# Pattern 1: Login/Credential Failures (FR-031)
# =============================================================================

# Generic error for login failures - used when email/password is wrong, account doesn't exist, etc.
# Prevents email enumeration by not revealing whether an account exists
AUTHENTICATION_FAILED = "Authentication failed. If an account exists, check your email for verification or password reset options"


# =============================================================================
# Pattern 2: Email-Triggered Actions (FR-034)
# =============================================================================

# Generic message for any action that sends an email (password reset, verification resend, etc.)
# Displayed regardless of whether the email exists to prevent enumeration
EMAIL_SENT_GENERIC = "If an account exists with this email, we sent an email"

# Specific sub-types use the same generic message
PASSWORD_RESET_EMAIL_SENT = EMAIL_SENT_GENERIC
VERIFICATION_EMAIL_SENT = EMAIL_SENT_GENERIC


# =============================================================================
# Token Errors
# =============================================================================

TOKEN_EXPIRED = "Your session has expired. Please sign in again."
TOKEN_INVALID = "Authentication failed. Please sign in again."


# =============================================================================
# Email Verification
# =============================================================================

EMAIL_VERIFICATION_REQUIRED = (
    "Email verification required. Please check your email for a verification link."
)


# =============================================================================
# Provider Linking (FR-029)
# =============================================================================

ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL = (
    "An account already exists with this email using a different sign-in method. "
    "Please sign in with your existing method first."
)


# =============================================================================
# Password Requirements (FR-019)
# =============================================================================

PASSWORD_TOO_SHORT = "Password should be at least 8 characters."
PASSWORD_REUSED = "For security, you cannot reuse your current password."


# =============================================================================
# OAuth / Social Sign-In
# =============================================================================

OAUTH_POPUP_CLOSED = "Sign-in was cancelled. You can close this window and try again."
OAUTH_ERROR = "An error occurred during sign-in. Please try again."


# =============================================================================
# Merge / Sync Errors
# =============================================================================

MERGE_FAILED = "Unable to sync your data. Please try signing in again."
SYNC_FAILED = "Unable to fetch your data. Please check your connection and try again."


# =============================================================================
# Validation Errors
# =============================================================================

INVALID_EMAIL = "Please enter a valid email address."
EMAIL_ALREADY_IN_USE = "An account with this email already exists."


# =============================================================================
# Helper Functions
# =============================================================================

def get_firebase_error_message(error_code: str) -> str:
    """
    Map Firebase Auth error codes to standardized user-facing messages.

    This ensures all Firebase errors return the appropriate generic message
    per FR-031 and FR-034.

    Args:
        error_code: Firebase Auth error code (e.g., 'auth/wrong-password')

    Returns:
        Standardized error message string
    """
    error_map = {
        # Credential errors (FR-031)
        'auth/invalid-credential': AUTHENTICATION_FAILED,
        'auth/user-not-found': AUTHENTICATION_FAILED,
        'auth/wrong-password': AUTHENTICATION_FAILED,
        'auth/invalid-email': INVALID_EMAIL,

        # Email conflicts
        'auth/email-already-in-use': EMAIL_ALREADY_IN_USE,
        'auth/account-exists-with-different-credential': ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL,

        # Password reset action codes
        'auth/expired-action-code': 'This link has expired. Please request a new one.',
        'auth/invalid-action-code': 'This link is invalid. Please request a new one.',
        'auth/weak-password': PASSWORD_TOO_SHORT,

        # OAuth errors
        'auth/popup-closed-by-user': OAUTH_POPUP_CLOSED,
        'auth/cancelled-popup-request': OAUTH_POPUP_CLOSED,

        # Token errors
        'auth/id-token-expired': TOKEN_EXPIRED,
        'auth/id-token-revoked': TOKEN_EXPIRED,
        'auth/invalid-id-token': TOKEN_INVALID,
        'auth/user-token-expired': TOKEN_EXPIRED,

        # Network errors
        'auth/network-request-failed': 'Network error. Please check your connection and try again.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
    }

    return error_map.get(error_code, AUTHENTICATION_FAILED)
