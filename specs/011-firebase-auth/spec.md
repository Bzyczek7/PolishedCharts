# Feature Specification: Firebase Authentication

**Feature Branch**: `011-firebase-auth`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "I would like to implement logging in using FireBase Auth"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Email and Password Registration (Priority: P1)

A new user wants to create an account using their email address and password so they can save their alerts, watchlist, and chart layouts across devices.

**Why this priority**: Essential for user acquisition and data persistence. Without email/password signup, users without Google accounts cannot use the application.

**Independent Test**: Can be tested by registering a new email account, verifying the email, and confirming the user can log in with those credentials.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they click "Email login" and enter a new email/password, **Then** they should receive a verification email and see a confirmation message
2. **Given** a user who just registered, **When** they click the verification link in their email, **Then** their email should be marked as verified and they should be automatically signed in via Firebase's email verification link flow (this is the ONLY exception where unverified users get signed in without password login)
3. **Given** a registered user with verified email, **When** they enter their email and correct password, **Then** they should be signed in (Firebase authenticated) and redirected to the chart interface
4. **Given** a registered user with unverified email, **When** they enter their email and correct password, **Then** the login attempt must be blocked with options to "Resend verification email" or "Continue as guest" (no Firebase authentication occurs; no temporary session workaround)
5. **Given** a user entering credentials, **When** they enter an incorrect password, **Then** they should see a generic error message "Authentication failed. If an account exists, check your email for verification or password reset options"
6. **Given** a user requesting to resend verification email, **When** they enter their email, **Then** the system should always display "If an account exists with this email, we sent a verification email" (regardless of whether the email exists)

---

### User Story 2 - Google OAuth Sign-In (Priority: P1)

A user wants to sign in quickly using their existing Google account so they can start using the application without creating another password.

**Why this priority**: Reduces friction for new users. Google sign-in is often preferred by users and has higher conversion rates than email/password registration.

**Independent Test**: Can be tested by clicking "Sign in with Google", authenticating with Google, and confirming the user is signed in with their Google account information.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they click "Sign in with Google", **Then** a Google authentication popup should appear
2. **Given** a user authenticating with Google, **When** they select their Google account and approve permissions, **Then** they should be signed in (Firebase authenticated) and redirected to the chart interface
3. **Given** a first-time Google sign-in, **When** authentication completes, **Then** a new user account should be created using their Google email and profile information
4. **Given** a returning Google user, **When** they sign in again, **Then** they should access their existing account with all saved data intact
5. **Given** a user during Google sign-in, **When** they cancel the authentication popup, **Then** they should return to the landing page without an error

---

### User Story 3 - Guest Access with Optional Sign-In (Priority: P1)

A user wants to explore the application's features without being forced to create an account, but can choose to sign in later to save their data.

**Why this priority**: Removes barrier to entry. Users can try before committing, which increases conversion rates. Essential for user acquisition.

**Independent Test**: Can be tested by accessing the application without signing in, using features, then signing in and verifying data syncs correctly.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they click "OPEN THE CHART" without signing in, **Then** they should access the chart interface as a guest user
2. **Given** a guest user using the application, **When** they create alerts or modify watchlist, **Then** those changes should be stored in browser localStorage
3. **Given** a guest user with local data, **When** they click a sign-in button, **Then** they should see sign-in options and their local data should be preserved
4. **Given** a guest user signing in, **When** authentication completes successfully, **Then** their localStorage data should merge with their cloud data
5. **Given** a signed-in user, **When** they sign out, **Then** they should return to guest access mode with their data preserved in localStorage

---

### User Story 4 - Password Reset (Priority: P2)

A user who forgot their password wants to reset it so they can regain access to their account and saved data.

**Why this priority**: Important for user support and account recovery. Not blocking for MVP since users can use Google sign-in as backup.

**Independent Test**: Can be tested by requesting a password reset, receiving the email, clicking the reset link, and setting a new password.

**Acceptance Scenarios**:

1. **Given** a user on the sign-in page, **When** they click "Forgot password" and enter their email, **Then** the system should always display "If an account exists with this email, we sent a password reset email" (regardless of whether the email exists)
2. **Given** a user who requested a reset, **When** they click the reset link in the email, **Then** they should be able to enter a new password
3. **Given** a user resetting their password, **When** they enter a valid new password, **Then** their password should be updated and they should be able to sign in with the new password
4. **Given** a user using an expired reset link, **When** they click the link, **Then** they should see a clear message that the link expired and an option to request a new one

---

### User Story 5 - Sign Out (Priority: P2)

A signed-in user wants to sign out of their account so their data isn't accessible on a shared device.

**Why this priority**: Basic security requirement. Important for users on shared or public computers.

**Independent Test**: Can be tested by signing out and confirming the user returns to guest mode and their session is cleared.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they click a sign-out button, **Then** they should be signed out and returned to guest mode
2. **Given** a user after signing out, **When** they try to access protected API endpoints, **Then** requests should fail with an authentication error
3. **Given** a user after signing out, **When** they refresh the page, **Then** they should remain signed out (session properly cleared)
4. **Given** a signed-out user, **When** they click sign-in again, **Then** they should see the sign-in options and be able to authenticate again

---

### User Story 6 - Cross-Device Data Sync (Priority: P2)

A user wants their alerts, watchlist, and chart layouts to be available on multiple devices (desktop, laptop, tablet) when they sign in with the same account.

**Why this priority**: Key value proposition of having user accounts. Enables users to work seamlessly across devices.

**Independent Test**: Can be tested by creating data on one device, signing in on another device, and confirming the data appears.

**Acceptance Scenarios**:

1. **Given** a signed-in user who created alerts on device A, **When** they sign in on device B, **Then** all their alerts should appear on device B
2. **Given** a signed-in user who modified their watchlist on device A, **When** they sign in on device B, **Then** their watchlist should match the changes from device A
3. **Given** a user with data on multiple devices, **When** they make changes simultaneously on both devices, **Then** the last change should persist (last-write-wins)
4. **Given** a signed-in user, **When** they have no internet connection, **Then** they should still see cached data and be able to use the application

---

### User Story 7 - Provider Linking (Priority: P2)

A user who initially signed up with email/password wants to link their Google account, or vice versa, so they can sign in using either method.

**Why this priority**: Improves user experience by allowing users to use multiple sign-in methods for the same account. Prevents support issues when users try different sign-in methods.

**Independent Test**: Can be tested by creating an account with one method, then attempting to sign in with another provider using the same email.

**Acceptance Scenarios**:

1. **Given** a user who signed up with email/password, **When** they try to sign in with Google using the same email, **Then** the system should detect the "account-exists-with-different-credential" error and prompt them to sign in with their existing method first, then link the new provider
2. **Given** a user prompted to link providers, **When** they complete the linking flow, **Then** both providers should be linked to their account and they can sign in with either method
3. **Given** a user with linked providers, **When** they sign in with either method, **Then** they access the same account and data
4. **Given** a guest user with local data attempting provider linking, **When** they go through the multi-step linking flow (sign in with existing provider → link new provider), **Then** their guest local data MUST persist in localStorage throughout the entire flow and only merge after the final successful sign-in is complete

---

### Edge Cases

- What happens when a user's Google account email changes after they've already created an account?
- What happens when Firebase service is temporarily unavailable or network fails during sign-in?
- What happens when a user deletes their account in Firebase but their data still exists in the backend database? (resolved: user.is_active = False when deletion detected, data retained 30 days then hard deleted. Detection via explicit Firebase signal in future; unknown auth failures treated as normal auth failure until implemented)
- What happens when localStorage is full or disabled in the browser?
- What happens when a user signs in, closes the browser immediately, and reopens (session persistence)?
- What happens when authentication token expires during an active user session?
- What happens when merge operation is interrupted (network failure, tab close)?
- What happens when a user tries to sign in with an email already linked to another account?
- What happens when clock skew causes `updated_at` timestamps from different devices to be equal or out of order? (resolved via `MERGE_TIMESTAMP_TOLERANCE_MS` constant preferring cloud)
- What happens when a returning guest user has localStorage data with an old schema version? (resolved via automatic schema migrations)

## Requirements *(mandatory)*

### Functional Requirements

**User Registration & Sign-In**
- **FR-001**: System MUST allow users to register using email and password
- **FR-002**: System MUST send a verification email when users register with email/password
- **FR-003**: Login attempts with unverified email MUST be blocked with options to "Resend verification email" or "Continue as guest" (no Firebase authentication session is created)
- **FR-004**: System MUST allow users to sign in using their Google account (OAuth)
- **FR-005**: System MUST allow users with verified email to sign in using existing email and password credentials
- **FR-005a**: System MUST enforce email verification status on BOTH client-side (after Firebase auth, check `user.emailVerified` before allowing access) AND backend-side (after token verification, check the decoded token's `email_verified` claim before processing protected requests) to prevent unverified users from accessing protected endpoints even if frontend validation is bypassed

**Guest Access**
- **FR-006**: System MUST allow users to access the application without authentication (guest mode)
- **FR-007**: System MUST store guest user data (alerts, watchlist, layouts) in browser localStorage
- **FR-008**: System MUST display sign-in prompts to guest users without blocking access to core features
- **FR-008a**: System MUST implement a localStorage schema with a version number and automatic migration on schema changes to prevent breaking existing guest users when the data structure evolves (e.g., `{"schemaVersion": 1, "alerts": [...], "watchlist": [...]}` with migrations run on app load to transform older schemas to current)

**Data Synchronization**
- **FR-009**: System MUST merge localStorage data with cloud data when a guest user signs in
- **FR-010**: System MUST handle merge conflicts by preferring the most recently updated item based on `updated_at` timestamp; if timestamps are equal within clock skew tolerance (±2 minutes defined as constant `MERGE_TIMESTAMP_TOLERANCE_MS`), prefer the cloud version to ensure deterministic repeatable merges
- **FR-011**: System MUST sync user data across all devices where the user is signed in
- **FR-012**: System MUST store user-specific data (alerts, watchlist, layouts) in the backend database
- **FR-013**: System MUST ensure merge operations are idempotent using upsert-by-UUID with `updated_at` comparison (no blind inserts, multiple attempts produce identical results)
- **FR-013a**: System MUST implement a single shared merge/upsert utility used by alerts, watchlist, and layouts to ensure consistent merge logic across all entities (no per-entity reimplementation)

**Session Management**
- **FR-014**: System MUST maintain user authentication session across page refreshes
- **FR-015**: System MUST automatically refresh authentication tokens before they expire
- **FR-016**: System MUST sign users out when authentication token becomes invalid and cannot be refreshed; when token refresh fails, the system MUST switch to guest mode while preserving all local data (alerts, watchlist, layouts) in localStorage
- **FR-017**: System MUST provide a sign-out button that clears the authentication session

**Password Management**
- **FR-018**: System MUST allow users to reset their password via email link
- **FR-019**: System MUST enforce minimum password requirements (at least 8 characters)
- **FR-020**: System MUST prevent users from reusing their current password during password reset

**User Profile**
- **FR-021**: System MUST store user's display name from Google OAuth or allow custom entry for email users
- **FR-022**: System MUST store user's profile photo URL from Google OAuth if available
- **FR-023**: System MUST track user's email verification status
- **FR-024**: System MUST record user's last sign-in timestamp
- **FR-024a**: System MUST set user.is_active = False when Firebase account deletion is detected, retain data for 30 days, then hard delete (GDPR compliance). Detection mechanism: explicit Firebase user-deletion signal (future implementation); until then, treat unknown auth failures as normal auth failure (no premature account deletion).

**Backend Integration**
- **FR-025**: Every protected API request MUST include a valid Firebase ID token in the Authorization header and the system MUST verify the token before processing the request
- **FR-026**: System MUST associate user-specific data (alerts, watchlist) with the authenticated user's ID
- **FR-027**: System MUST return user-specific data for authenticated users when querying API endpoints
- **FR-028**: System MUST create or update user profile in backend database on first sign-in

**Provider Linking**
- **FR-029**: System MUST support provider linking for same-email accounts via an explicit linking flow (when "account-exists-with-different-credential" error occurs, prompt user to sign in with existing provider first, then link the new provider)
- **FR-030**: System MUST allow users to sign in with any linked provider to access the same account

**Security**
- **FR-031**: System MUST reject expired or invalid tokens with appropriate generic error messages
- **FR-032**: System MUST not expose Firebase configuration secrets in client-side code
- **FR-033**: System MUST use HTTPS for all authentication-related API calls
- **FR-034**: System MUST use generic error messages to prevent email enumeration with two standardized patterns:
  - For login/credential failures: "Authentication failed. If an account exists, check your email for verification or password reset options"
  - For email-triggered actions (password reset, verification resend): "If an account exists with this email, we sent an email" (displayed regardless of whether the email exists)
- **FR-035**: All API endpoints MUST be classified as either public (no authentication required) or protected (valid Firebase ID token required), with protected endpoints uniformly enforcing token verification to prevent future unsecured endpoints
- **FR-035a**: System MUST implement a single shared authentication middleware/decorator for all protected endpoints (not per-endpoint implementations) and include an automated test that enumerates all API routes to verify that every protected endpoint uses this middleware, preventing future endpoints from accidentally skipping authentication

### Key Entities

**User Account**
- Represents an authenticated user in the system (Firebase authenticated with verified email)
- Attributes: unique Firebase user ID, email address, display name, profile photo URL, email verification status, account creation timestamp, last sign-in timestamp, active status
- Relationships: has many alerts, has one watchlist, has many saved layouts, has many authentication providers

**Guest User**
- Represents an unauthenticated user (no Firebase session, either never signed in or attempted login with unverified email)
- Attributes: none (transient, identified only by browser localStorage)
- Access: Can read public data and use client-side features, but cannot access protected API endpoints
- Lifecycle: Converted to User Account upon successful authentication with verified email; unverified login attempts are blocked with option to continue as guest

**User Session**
- Represents an active authentication session for a user
- Attributes: Firebase authentication token, token expiration timestamp, refresh token, last activity timestamp
- Lifecycle: created on sign-in, refreshed automatically before expiration, destroyed on sign-out

**Authentication Provider**
- Represents a sign-in method linked to a user account
- Attributes: provider type (email/password or google.com), provider-specific user ID, linked timestamp
- Relationships: belongs to a User Account
- Constraint: One user can have multiple providers, but one email can only belong to one user account

**Alert**
- Represents a trading alert configuration for a user
- Attributes: UUID (stable identifier), user_id, symbol, condition parameters, enabled status, created_at timestamp, updated_at timestamp
- Merge Rule: During guest→user merge, upsert by UUID (if exists, update only if new `updated_at` is more recent; otherwise insert as new)

**Watchlist**
- Represents a user's list of symbols to track
- Attributes: UUID, user_id, symbols array, sort_order array, created_at timestamp, updated_at timestamp
- Merge Rule: During guest→user merge, upsert by UUID; if watchlist exists for user, merge symbols arrays (deduplicate by symbol), preserve sort_order from most recently updated list, append any new symbols in insertion order

**Layout**
- Represents a saved chart layout with indicators and settings
- Attributes: UUID, user_id, layout name, indicator configurations, chart settings, created_at timestamp, updated_at timestamp
- Merge Rule: During guest→user merge, upsert by UUID (if exists, update only if new `updated_at` is more recent; otherwise insert as new)

**Local Guest Data**
- Represents data stored in browser localStorage for guest users
- Attributes: alerts array (with UUIDs), watchlist array (with UUIDs), saved layouts array (with UUIDs), last modified timestamp
- Lifecycle: persists in browser, merged into cloud account on sign-in using idempotent upsert-by-UUID operation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete email registration and sign-in in under 2 minutes
- **SC-002**: Users can complete Google OAuth sign-in in under 30 seconds
- **SC-003**: Guest users can access the chart interface within 5 seconds of landing on the page
- **SC-004**: 95% of sign-in attempts (email/password or Google) complete successfully without errors
- **SC-005**: Data synchronization completes within 3 seconds when signing in on a new device
- **SC-006**: Users can sign out and return to guest mode within 2 seconds
- **SC-007**: Authentication tokens refresh automatically without user awareness 99% of the time
- **SC-008**: 90% of users successfully complete password reset and sign in with new password on first attempt
- **SC-009**: Cross-device data sync works correctly for 100% of signed-in users
- **SC-010**: Application remains functional during temporary network issues (cached data available)
- **SC-011**: Merge operations produce identical results when retried (idempotency verified through automated testing)

### Assumptions

1. **Firebase Project**: A Firebase project has been or will be created with Authentication enabled
2. **Firebase Configuration**: Firebase project configuration (API keys, project ID, etc.) will be provided via environment variables
3. **Google OAuth**: Google OAuth provider is enabled in Firebase Console with correct callback URLs
4. **Email Templates**: Default Firebase email templates for verification and password reset are acceptable (may be customized later)
5. **Database Capacity**: PostgreSQL database can handle user data growth for expected user base
6. **Firebase Free Tier**: Usage will stay within Firebase Spark Plan free tier limits (3,000 monthly active users)
7. **No Email Server**: Using Firebase's built-in email service rather than running a custom email server
8. **Data Ownership**: Users own their data and can export it on request (future feature)
9. **Account Deletion**: If a user deletes their Firebase account, the backend user.is_active is set to False when deletion is detected; data is retained for 30 days then hard deleted (GDPR compliance). Detection requires explicit Firebase user-deletion signal (future); unknown auth failures treated as normal auth failure until implemented.
10. **Existing Data**: Current application-wide watchlist data will be migrated to a "demo" user or remain as fallback for unauthenticated users
11. **UUID Generation**: All user-specific entities (alerts, watchlist, layouts) will use UUIDs for stable identification across merge operations
12. **Timestamps**: All user-specific entities will have `created_at` and `updated_at` timestamps for merge conflict resolution
13. **Firebase Account-Exists-With-Different-Credential**: Firebase will throw this error when trying to sign in with a different provider for an existing email; the system must handle this with an explicit linking flow
14. **Shared Utilities**: Merge/upsert logic and authentication middleware will be implemented as shared utilities used consistently across all entities and endpoints to prevent code duplication and bugs
15. **LocalStorage Schema Migrations**: Guest localStorage schema will start at version 1 and future schema changes will include migration functions to transform older versions to current

## Dependencies

- **Firebase Project**: Requires Firebase project to be created and configured
- **Environment Variables**: Requires Firebase configuration secrets to be set in deployment environment
- **Backend Migration**: Requires database migration to add user foreign keys to existing tables and add UUIDs/timestamps
- **API Changes**: Requires updates to existing API endpoints to include user authentication
- **Testing**: Requires test Firebase project or Firebase Authentication emulator for integration testing

## Clarifications

### Session 2025-12-30

- Q: What is the immediate behavior when a user deletes their Firebase account, given the 30-day data retention grace period? → A: Mark user.is_active = False when deletion is detected via explicit Firebase signal (future implementation); until then, treat unknown auth failures as normal auth failure (no premature deletion). Data retained 30 days then hard deleted.

---

## Out of Scope

The following features are intentionally excluded from this initial authentication implementation:

- Social login providers other than Google (Facebook, Twitter, GitHub, etc.)
- Phone number authentication
- Multi-factor authentication (2FA/MFA)
- Email link authentication (passwordless sign-in)
- Anonymous user accounts (Firebase Anonymous Auth)
- User profile editing (display name, photo upload)
- User account deletion flow
- User data export functionality
- Admin user roles or permissions
- Session management UI (view active sessions, sign out from all devices)
- Authentication rate limiting
- Suspicious activity detection
- Email customization beyond Firebase defaults
