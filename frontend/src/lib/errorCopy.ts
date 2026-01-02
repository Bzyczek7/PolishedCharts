/**
 * Centralized error copy for authentication UX.
 *
 * CRITICAL: These MUST match backend/app/services/error_messages.py exactly.
 * Per FR-034, all email-triggered actions use the same generic message to prevent enumeration.
 *
 * When adding new auth-related error messages:
 * 1. Add to backend error_messages.py first
 * 2. Copy the exact string here
 * 3. Update tests in both backend and frontend
 * 4. Update this comment with the change date
 *
 * @lastUpdated 2025-12-30
 */

// =============================================================================
// Pattern 1: Login/Credential Failures (FR-031)
// =============================================================================

/**
 * Generic error for login failures - used when email/password is wrong, account
 * doesn't exist, etc. Prevents email enumeration by not revealing whether an
 * account exists.
 *
 * Matches backend: AUTHENTICATION_FAILED
 */
export const AUTHENTICATION_FAILED =
  "Authentication failed. If an account exists, check your email for verification or password reset options";

// =============================================================================
// Pattern 2: Email-Triggered Actions (FR-034)
// =============================================================================

/**
 * Generic message for any action that sends an email (password reset, verification
 * resend, etc.). Displayed regardless of whether the email exists to prevent
 * enumeration.
 *
 * Matches backend: EMAIL_SENT_GENERIC
 */
export const EMAIL_SENT_GENERIC = "If an account exists with this email, we sent an email";

/**
 * Sub-type: Password reset uses the same generic message.
 * Matches backend: PASSWORD_RESET_EMAIL_SENT
 */
export const PASSWORD_RESET_EMAIL_SENT = EMAIL_SENT_GENERIC;

/**
 * Sub-type: Verification resend uses the same generic message.
 * Matches backend: VERIFICATION_EMAIL_SENT
 */
export const VERIFICATION_EMAIL_SENT = EMAIL_SENT_GENERIC;

// =============================================================================
// Token Errors
// =============================================================================

/**
 * Matches backend: TOKEN_EXPIRED
 */
export const TOKEN_EXPIRED = "Your session has expired. Please sign in again.";

/**
 * Matches backend: TOKEN_INVALID
 */
export const TOKEN_INVALID = "Authentication failed. Please sign in again.";

// =============================================================================
// Provider Linking (FR-029)
// =============================================================================

/**
 * Matches backend: ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL
 */
export const ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL =
  "An account already exists with this email using a different sign-in method. Please sign in with your existing method first.";

// =============================================================================
// Password Requirements (FR-019)
// =============================================================================

/**
 * Matches backend: PASSWORD_TOO_SHORT
 */
export const PASSWORD_TOO_SHORT = "Password should be at least 8 characters.";

/**
 * Matches backend: PASSWORD_REUSED
 */
export const PASSWORD_REUSED = "For security, you cannot reuse your current password.";

// =============================================================================
// OAuth / Social Sign-In
// =============================================================================

/**
 * Matches backend: OAUTH_POPUP_CLOSED
 */
export const OAUTH_POPUP_CLOSED = "Sign-in was cancelled. You can close this window and try again.";

/**
 * Matches backend: OAUTH_ERROR
 */
export const OAUTH_ERROR = "An error occurred during sign-in. Please try again.";

// =============================================================================
// Merge / Sync Errors
// =============================================================================

/**
 * Matches backend: MERGE_FAILED
 */
export const MERGE_FAILED = "Unable to sync your data. Please try signing in again.";

/**
 * Matches backend: SYNC_FAILED
 */
export const SYNC_FAILED = "Unable to fetch your data. Please check your connection and try again.";

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Matches backend: INVALID_EMAIL
 */
export const INVALID_EMAIL = "Please enter a valid email address.";

/**
 * Matches backend: EMAIL_ALREADY_IN_USE
 */
export const EMAIL_ALREADY_IN_USE = "An account with this email already exists.";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map Firebase Auth error codes to standardized user-facing messages.
 *
 * This ensures all Firebase errors return the appropriate generic message
 * per FR-031 and FR-034. Must match backend get_firebase_error_message().
 *
 * @param errorCode - Firebase Auth error code (e.g., 'auth/wrong-password')
 * @returns Standardized error message string
 */
export function getAuthErrorMessage(errorCode: string): string {
  const errorMap: Record<string, string> = {
    // Credential errors (FR-031)
    'auth/invalid-credential': AUTHENTICATION_FAILED,
    'auth/user-not-found': AUTHENTICATION_FAILED,
    'auth/wrong-password': AUTHENTICATION_FAILED,
    'auth/invalid-email': INVALID_EMAIL,

    // Email conflicts
    'auth/email-already-in-use': EMAIL_ALREADY_IN_USE,
    'auth/account-exists-with-different-credential': ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL,

    // Password reset action codes
    'auth/expired-action-code': 'This link has expired. Please request a new one.',
    'auth/invalid-action-code': 'This link is invalid. Please request a new one.',
    'auth/weak-password': PASSWORD_TOO_SHORT,

    // OAuth errors
    'auth/popup-closed-by-user': OAUTH_POPUP_CLOSED,
    'auth/cancelled-popup-request': OAUTH_POPUP_CLOSED,

    // Token errors
    'auth/id-token-expired': TOKEN_EXPIRED,
    'auth/id-token-revoked': TOKEN_EXPIRED,
    'auth/invalid-id-token': TOKEN_INVALID,
    'auth/user-token-expired': TOKEN_EXPIRED,

    // Network errors
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
  };

  return errorMap[errorCode] || AUTHENTICATION_FAILED;
}

/**
 * Format an error for display in the UI.
 *
 * Ensures all auth errors use the standardized copy and provides fallback
 * for unexpected errors.
 *
 * @param error - Error object or error code string
 * @returns User-friendly error message
 */
export function formatAuthError(error: unknown): string {
  if (typeof error === 'string') {
    return getAuthErrorMessage(error);
  }

  if (error && typeof error === 'object' && 'code' in error) {
    return getAuthErrorMessage(String(error.code));
  }

  if (error instanceof Error) {
    // Check if it's a Firebase error with a code
    const firebaseError = error as { code?: string };
    if (firebaseError.code) {
      return getAuthErrorMessage(firebaseError.code);
    }
  }

  // Fallback for unknown errors
  return AUTHENTICATION_FAILED;
}

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Union type of all auth error codes that can be passed to getAuthErrorMessage()
 */
export type AuthErrorCode =
  | 'auth/invalid-credential'
  | 'auth/user-not-found'
  | 'auth/wrong-password'
  | 'auth/invalid-email'
  | 'auth/email-already-in-use'
  | 'auth/account-exists-with-different-credential'
  | 'auth/expired-action-code'
  | 'auth/invalid-action-code'
  | 'auth/weak-password'
  | 'auth/popup-closed-by-user'
  | 'auth/cancelled-popup-request'
  | 'auth/id-token-expired'
  | 'auth/id-token-revoked'
  | 'auth/invalid-id-token'
  | 'auth/user-token-expired'
  | 'auth/network-request-failed'
  | 'auth/too-many-requests';
