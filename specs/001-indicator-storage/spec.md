# Feature Specification: Indicator Database Storage

**Feature Branch**: `001-indicator-storage`
**Created**: 2025-01-04
**Status**: Draft
**Input**: Migrate indicator configurations from browser localStorage to a PostgreSQL database, enabling multi-device access, data persistence across browser cache clearing, and seamless guest-to-authenticated user transitions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Device Indicator Sync (Priority: P1)

A trader sets up technical indicators (SMA, EMA, TDFI) on their desktop computer with custom parameters and colors. Later, when opening the application on their mobile device or a different computer, all their indicator configurations appear exactly as configured on the desktop.

**Why this priority**: This is the core user value proposition - users expect their settings to follow them across devices, similar to how watchlists and alerts already work.

**Independent Test**: Can be fully tested by creating indicators on one device, logging in on a second device, and verifying all indicators appear with correct settings.

**Acceptance Scenarios**:

1. **Given** a user has created 3 indicators (SMA 20, EMA 50, TDFI) on desktop with specific colors, **When** the user signs in on mobile, **Then** all 3 indicators appear with identical parameters and styling
2. **Given** a user updates an indicator's color from orange to blue on desktop, **When** the user refreshes on mobile, **Then** the indicator color is updated to blue
3. **Given** a user deletes an indicator on desktop, **When** the user loads the application on mobile, **Then** that indicator no longer appears

---

### User Story 2 - Persistent Indicator Configuration (Priority: P2)

A trader has carefully configured multiple indicators for their charts. When they clear their browser cache or switch to a different browser, all their indicator configurations are preserved and automatically restored when they sign back in. Even when the database is temporarily unavailable, the system gracefully handles the situation and ensures no data is lost.

**Why this priority**: Data loss is a critical user pain point - users lose trust when their settings disappear due to routine browser maintenance or transient system issues.

**Independent Test**: Can be fully tested by configuring indicators, clearing browser cache, reopening the application, and verifying indicators are restored from the database. Can also test database unavailability scenarios.

**Acceptance Scenarios**:

1. **Given** a user has 5 configured indicators, **When** the user clears browser cache and refreshes the page, **Then** all indicators are restored from the database
2. **Given** a user switches from Chrome to Firefox, **When** the user signs in, **Then** their indicator configurations are available
3. **Given** a user's browser automatically clears cache after 30 days, **When** the user returns after 40 days, **Then** their indicators are preserved
4. **Given** the database is temporarily unavailable when a user creates an indicator, **When** the database becomes available again, **Then** the system automatically retries and saves the indicator within 30 seconds
5. **Given** the database is unavailable when a user loads the application, **When** the system falls back to localStorage, **Then** the user sees their last known indicator configuration with a visible indicator that sync is pending

---

### User Story 3 - Guest to Authenticated User Transition (Priority: P3)

A guest user configures indicators while exploring the application. When they later create an account or sign in, their existing indicator configurations are merged with their account, preserving their work.

**Why this priority**: Provides a smooth onboarding experience - users don't lose their exploration work when they commit to creating an account.

**Independent Test**: Can be fully tested by configuring indicators as a guest, then signing in, and verifying indicators are preserved and associated with the account.

**Acceptance Scenarios**:

1. **Given** a guest user has created 2 indicators, **When** the guest user signs in with an existing account, **Then** the guest indicators are added to their account's indicator list
2. **Given** a guest user has indicators and the account already has 3 indicators, **When** the guest signs in, **Then** all indicators are visible (guest + account indicators combined)
3. **Given** a guest user creates an account, **When** account creation completes, **Then** their guest indicators are now associated with their new account

---

### Edge Cases

- What happens when a user creates more than 50 indicators (performance concern)?
- How does the system handle concurrent updates from multiple devices (last write wins)?
- What happens when a user's indicator configuration exceeds size limits?
- How does the system handle migration when a user has both localStorage indicators and database indicators?
- What happens when indicator data becomes corrupted or invalid?
- How does the system behave when the database is temporarily unavailable?
- What happens to indicators when a user deletes their account? **Indicators are hard-deleted along with the user account** (no retention for privacy, consistent with GDPR and data minimization)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store all indicator configurations in the database associated with the authenticated user's account
- **FR-002**: System MUST retrieve and display user's saved indicators when they sign in on any device
- **FR-003**: System MUST persist indicator changes (create, update, delete) to the database immediately
- **FR-004**: System MUST support the following indicator attributes: name (e.g., SMA, EMA, TDFI), parameters (e.g., period=20), display name, styling (color, line width, visibility state)
- **FR-005**: System MUST maintain unique identifiers for each indicator instance to prevent duplicates during sync
- **FR-006**: System MUST merge guest user's localStorage indicators with authenticated user's database indicators during sign-in using timestamp-based conflict resolution: update existing indicator only if guest version's updated_at > cloud version's updated_at + 2 minutes; otherwise keep existing version (prefer cloud, deterministic)
- **FR-007**: System MUST handle indicator creation, update, and deletion operations for authenticated users
- **FR-008**: System MUST provide fallback to localStorage when database is temporarily unavailable
- **FR-009**: System MUST support batch retrieval of all indicators for a user (no pagination for small datasets)
- **FR-010**: System MUST validate indicator parameters before saving to database
- **FR-011**: System MUST skip invalid or corrupted indicator configurations during load operations and log errors for debugging (reject entire batch only for critical schema errors; individual indicator corruption should not block loading of valid indicators)

### Key Entities

- **Indicator Configuration**: Represents a single indicator instance with its type, parameters, visual styling, and visibility state; associated with a user account; uniquely identified; includes creation and modification timestamps
- **User Account**: Represents an authenticated user; owns multiple indicator configurations; indicators are isolated per user (users cannot see each other's indicators)
- **Guest Session**: Represents an unauthenticated user session; indicators stored temporarily in localStorage; merged into user account when guest signs in

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access their exact same indicator configurations on any device within 2 seconds of completing Firebase authentication (measured from successful token validation to first indicator data render)
- **SC-002**: 100% of indicator configurations are preserved when users clear browser cache or switch browsers
- **SC-003**: Indicator data sync completes in under 1 second for typical configurations (10 or fewer indicators)
- **SC-004**: 100% of users successfully transition from guest to authenticated user without losing indicator configurations (merge logic is deterministic: deduplicate by unique identifier, transactional operations ensure atomicity)
- **SC-005**: Zero indicator data loss occurs during database migration from localStorage
