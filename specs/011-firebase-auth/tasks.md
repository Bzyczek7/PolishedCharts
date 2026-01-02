# Tasks: Firebase Authentication

**Feature**: 011-firebase-auth
**Branch**: `011-firebase-auth`
**Input**: Design documents from `/specs/011-firebase-auth/`

**Tests**: TDD required for core logic (merge utility, auth middleware, localStorage migrations) per constitution requirement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app structure**: `backend/app/` for backend code, `frontend/src/` for frontend code
- **Backend tests**: `backend/tests/`
- **Frontend tests**: `frontend/tests/`

---

## Phase 0: Setup

**Purpose**: Project initialization and dependency installation

- [X] T001 Install backend dependencies: `pip install "firebase-admin>=6.0.0"` in backend/requirements.txt
- [X] T002 [P] Install frontend dependencies: `npm install "firebase@^10.0.0"` in frontend/package.json
- [X] T003 [P] Create backend environment variable template in backend/.env.example (FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_PROJECT_ID)
- [X] T004 [P] Create frontend environment variable template in frontend/.env.example (VITE_FIREBASE_*)
- [X] T005 [P] Create Firebase project at https://console.firebase.google.com (disable Analytics per constitution) - **MANUAL**: User must create project
- [X] T006 [P] Enable Email/Password and Google OAuth providers in Firebase Console - **MANUAL**: User must enable providers
- [X] T007 [P] Generate Firebase service account key and save securely (never commit to git) - **MANUAL**: User must generate key

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

### Database Schema & Models

- [X] T008 Create Alembic migration for users table and UUID/timestamp columns in backend/alembic/versions/XXX_add_firebase_auth.py
- [X] T009 [P] Create User SQLAlchemy model in backend/app/models/user.py
  - **Model attributes**: firebase_uid (PK), email, display_name, photo_url (nullable), email_verified (bool), created_at, last_sign_in_at, is_active
  - **Naming mapping** (critical for consistency):
    - Database/model column: `photo_url` (snake_case, Python convention) ← **canonical backend field**
    - API response (backend-api.yaml): `photourl` (existing contract - do not change)
    - Frontend TypeScript: `photoURL` (camelCase, TS/Firebase convention)
  - **Implementation**: Pydantic schema maps `photo_url` → `photourl` for API responses; frontend consumes `photoURL`
- [X] T010 [P] Modify Alert model: add user_id FK, uuid, timestamps in backend/app/models/alert.py
- [X] T011 [P] Create UserWatchlist SQLAlchemy model in backend/app/models/user_watchlist.py
- [X] T012 [P] Create Layout SQLAlchemy model in backend/app/models/layout.py

### Core Services (TDD - Test Driven)

- [X] T013 [P] Write test for auth_middleware (email verification enforcement) in backend/tests/services/test_auth_middleware.py
  - **Test 1**: Verified user token (email_verified=True) passes through
  - **Test 2**: Unverified user token (email_verified=False) is rejected with HTTP 403
  - **Test 3**: Token missing email_verified claim defaults to False and is rejected
  - **Test 4**: 403 error message matches: "Email address must be verified before accessing this resource"
  - **Test 5**: Expired/invalid tokens return 401 with generic message (FR-031)
- [X] T013a [P] Write test for error message constants (standardized patterns) in backend/tests/services/test_error_messages.py
  - Verify AUTHENTICATION_FAILED matches FR-031 pattern
  - Verify EMAIL_SENT_GENERIC matches FR-034 pattern
  - Verify all password reset/verification use same generic message
  - Verify get_firebase_error_message() maps correctly
- [X] T014 [P] Implement route classification mechanism and coverage test in backend/tests/services/test_auth_middleware_coverage.py
  - Create `backend/app/api/decorators.py` with @public_endpoint marker
  - Apply @public_endpoint to: /auth/sign-in, /auth/register, /auth/password-reset, /health, /candles
  - Write test that FAILS any route neither marked @public nor using get_current_user
  - Test must NOT hardcode endpoint lists - use dynamic route inspection
- [X] T015 Implement shared auth middleware (get_current_user) in backend/app/services/auth_middleware.py
  - **Decode token**: Use firebase_admin.auth.verify_id_token()
  - **Extract claims**: Get email_verified from decoded token
  - **Enforce verification**: If email_verified == False, raise HTTPException 403 (FR-005a)
  - **Error messages**: Use constants from error_messages.py (FR-031, FR-034)
  - **Logging**: Log actual error for debugging; return generic message to user
- [X] T015a [P] Implement centralized error message constants in backend/app/services/error_messages.py
  - Define AUTHENTICATION_FAILED, EMAIL_SENT_GENERIC, TOKEN_EXPIRED, etc.
  - Implement get_firebase_error_message() helper for mapping Firebase error codes
- [X] T015b [P] Create frontend error copy module in frontend/src/lib/errorCopy.ts
  - Copy exact strings from backend error_messages.py
  - Implement getAuthErrorMessage() helper matching backend
  - Export formatAuthError() for consistent UI error display
- [X] T016 [P] Write test for merge utility (timestamp comparison, idempotency) in backend/tests/services/test_merge_util.py
  - Test timestamp comparison with MERGE_TIMESTAMP_TOLERANCE_MS (±2 minutes, prefer cloud)
  - Test upsert creates new record when UUID doesn't exist
  - Test upsert updates existing record when UUID exists and guest timestamp is newer
  - Test upsert ignores guest data when within tolerance (cloud wins)
- [X] T017 Implement shared merge utility (upsert_by_uuid with tolerance constant) in backend/app/services/merge_util.py
  - Define MERGE_TIMESTAMP_TOLERANCE_MS = 120000 (2 minutes)
  - Implement upsert_by_uuid(entity_type, user_id, guest_data) function
  - Handle alerts, watchlist, layouts with per-entity merge rules
- [X] T017a [P] Write integration test for merge idempotency in backend/tests/integration/test_merge_idempotency.py
  - **Test 1**: Calling upsert_by_uuid twice with same data produces identical database state
  - **Test 2**: Merging list of guest alerts twice produces identical final state
  - **Test 3**: MERGE_TIMESTAMP_TOLERANCE_MS tiebreaker is deterministic (cloud wins)
  - **Test 4**: Newer guest timestamp outside tolerance updates cloud
  - **Test 5**: Watchlist merge is idempotent
  - **Test 6**: Concurrent merge simulation (5 rapid identical requests)
  - **Use**: Real database session (integration test, not unit mock)
- [X] T018 [P] Write test for localStorage schema migrations in frontend/src/tests/hooks/test_useLocalStorage.test.ts
- [X] T019 Implement localStorage schema migration system in frontend/src/hooks/useLocalStorage.ts

### Backend API Foundation

- [X] T020 Initialize Firebase Admin SDK in backend/app/services/firebase_admin.py
- [X] T021 [P] Create auth API router in backend/app/api/v1/auth.py
  - Apply @public_endpoint to: /sign-in, /register, /password-reset (from decorators.py)
  - Protected endpoints use Depends(get_current_user) middleware
- [X] T022 [P] Create merge API router in backend/app/api/v1/merge.py
  - All endpoints protected with Depends(get_current_user)
- [X] T023 Register auth routes in backend/app/main.py (routes registered in api.py)

### Frontend Foundation

- [X] T024 [P] Initialize Firebase client SDK in frontend/src/lib/firebase.ts
- [X] T025 [P] Create TypeScript types for auth entities in frontend/src/types/auth.ts
- [X] T026 [P] Create authService for backend API calls in frontend/src/services/authService.ts
  - Import and use errorCopy.ts for all user-facing error messages
- [X] T027 [P] Create mergeService for merge operations in frontend/src/services/mergeService.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

**⚠️ CRITICAL GATE**: No user story work (Phases 2-8) can begin until this phase is complete. Verify all Phase 1 TDD tasks pass before proceeding: T013–T019 plus T013a/T014/T015a/T015b/T017a.

---

## Phase 2: User Story 1 - Email and Password Registration (Priority: P1) 🎯 MVP

**Goal**: Users can register with email/password, verify email, and sign in

**Independent Test**: Register new email → receive verification email → click link → auto-sign-in → can access chart

### Implementation for US1

- [X] T028 [P] [US1] Implement email sign-up mutation (Firebase createUser) in frontend/src/contexts/AuthContext.tsx (signUp function)
- [X] T029 [P] [US1] Implement email sign-in mutation (Firebase signInWithEmailAndPassword) in frontend/src/contexts/AuthContext.tsx (signIn function)
- [X] T030 [P] [US1] Implement resend verification email in frontend/src/contexts/AuthContext.tsx (resendVerificationEmail function)
- [X] T031 [US1] Create AuthContext provider with auth state management in frontend/src/contexts/AuthContext.tsx
- [X] T032 [US1] Create AuthDialog component with email/password form in frontend/src/components/AuthDialog.tsx
- [X] T033 [US1] Implement EmailVerificationPrompt component in frontend/src/components/EmailVerificationPrompt.tsx
- [X] T034 [US1] Implement GET /api/v1/auth/user endpoint in backend/app/api/v1/auth.py
- [X] T035 [US1] Implement POST /api/v1/auth/sign-out endpoint in backend/app/api/v1/auth.py
- [X] T036 [US1] Integrate AuthDialog with LandingPage in frontend/src/LandingPage.tsx
- [X] T037 [US1] Add auth state persistence (onAuthStateChanged listener) in frontend/src/contexts/AuthContext.tsx

**Checkpoint**: User can register with email, verify email, and sign in

---

## Phase 3: User Story 2 - Google OAuth Sign-In (Priority: P1) 🎯 MVP

**Goal**: Users can sign in quickly with Google account

**Independent Test**: Click "Sign in with Google" → select account → signed in with profile data

### Implementation for US2

- [X] T038 [P] [US2] Implement Google sign-in mutation (Firebase signInWithPopup) in frontend/src/lib/firebase.ts and AuthContext.tsx
- [X] T039 [US2] Handle Google auth popup cancelation in frontend/src/lib/firebase.ts
- [X] T040 [US2] Add Google sign-in button to AuthDialog in frontend/src/components/AuthDialog.tsx
- [X] T041 [US2] Implement user profile creation/update on first sign-in in backend/app/api/v1/auth.py

**Checkpoint**: User can sign in with Google OAuth

---

## Phase 4: User Story 3 - Guest Access with Optional Sign-In (Priority: P1) 🎯 MVP

**Goal**: Users can explore without signing in, data stored in localStorage, merge on sign-in

**Independent Test**: Visit site → create alerts as guest → sign in → data merged to cloud

### Implementation for US3

- [X] T042 [P] [US3] Implement localStorage load/save with schema migrations in frontend/src/hooks/useLocalStorage.ts
- [X] T043 [P] [US3] Create isGuest and isSignedIn derived state in frontend/src/contexts/AuthContext.tsx (isAuthenticated, isEmailVerified)
- [X] T044 [P] [US3] Implement "Continue as guest" flow in frontend/src/components/AuthDialog.tsx (guest mode exists via localStorage)
- [X] T045 [P] [US3] Integrate localStorage with existing alert creation in frontend/src/components/ (preserve on create)
- [X] T046 [P] [US3] Integrate localStorage with existing watchlist operations in frontend/src/components/ (preserve on modify)
- [X] T047 [US3] Implement POST /api/v1/merge/sync endpoint in backend/app/api/v1/merge.py
- [X] T048 [US3] Implement GET /api/v1/merge/status endpoint in backend/app/api/v1/merge.py
- [X] T049 [US3] Implement guest→user merge on sign-in in frontend/src/contexts/AuthContext.tsx (mergeGuestData function)
- [X] T050 [US3] Implement sign-out (switch to guest mode, preserve local data) in frontend/src/contexts/AuthContext.tsx (signOutUser function)

**Checkpoint**: Guest mode works, data persists locally, merges on sign-in

---

## Phase 5: User Story 4 - Password Reset (Priority: P2)

**Goal**: Users can reset forgotten password via email

**Independent Test**: Click "Forgot password" → enter email → receive reset email → set new password → sign in

### Implementation for US4

- [X] T051 [P] [US4] Implement password reset request (Firebase sendPasswordResetEmail) in frontend/src/contexts/AuthContext.tsx (resetPassword function)
- [X] T052 [P] [US4] Add "Forgot password" link to AuthDialog in frontend/src/components/AuthDialog.tsx
- [X] T053 [US4] Handle password reset email flow (oobCode in URL) in frontend/src/components/PasswordReset.tsx
- [X] T054 [US4] Implement reset link expiration handling in frontend/src/components/PasswordReset.tsx

**Checkpoint**: User can reset password via email

---

## Phase 6: User Story 5 - Sign Out (Priority: P2)

**Goal**: Users can sign out securely, session cleared

**Independent Test**: Click sign-out → redirected to landing page → protected endpoints fail → refresh → still signed out

### Implementation for US5

- [X] T055 [P] [US5] Create UserMenu component with sign-out button in frontend/src/components/UserMenu.tsx
- [X] T056 [US5] Implement Firebase signOut (clears client session) in frontend/src/contexts/AuthContext.tsx (signOutUser function)
- [X] T057 [US5] Clear local auth state and token on sign-out in frontend/src/contexts/AuthContext.tsx (signOutUser clears user and userProfile)
- [X] T058 [US5] Ensure sign-out preserves localStorage data in frontend/src/contexts/AuthContext.tsx (signOutUser does NOT call localStorage.clear())

**Checkpoint**: User can sign out, session cleared, local data preserved

---

## Phase 7: User Story 6 - Cross-Device Data Sync (Priority: P2)

**Goal**: User data (alerts, watchlists, layouts) sync across devices

**Independent Test**: Create alert on device A → sign in on device B → alert appears

### Implementation for US6

- [X] T059 [P] [US6] Implement fetch user alerts endpoint in frontend/src/hooks/useAlertData.ts
- [X] T060 [P] [US6] Implement fetch user watchlist endpoint in frontend/src/hooks/useWatchlist.ts
- [X] T061 [P] [US6] Implement fetch user layouts endpoint in frontend/src/hooks/useIndicatorInstances.ts
- [X] T062 [US6] Add token refresh mechanism (onIdTokenChanged) in frontend/src/lib/firebase.ts
- [X] T063 [US6] Handle token refresh failure (switch to guest mode, preserve data) in frontend/src/contexts/AuthContext.tsx

**Checkpoint**: Data syncs across devices when signed in

---

## Phase 8: User Story 7 - Provider Linking (Priority: P2)

**Goal**: Users can link email/password and Google accounts to same email

**Independent Test**: Sign up with email → try Google sign-in with same email → prompt to sign in with email → link accounts → can use either method

### Implementation for US7

- [X] T064 [P] [US7] Handle "account-exists-with-different-credential" error in frontend/src/contexts/AuthContext.tsx
- [X] T065 [P] [US7] Create provider linking prompt UI in frontend/src/components/ProviderLinkingPrompt.tsx
- [X] T066 [US7] Implement explicit linking flow (sign in with existing provider → link new provider) in frontend/src/contexts/AuthContext.tsx (linkProvider function)
- [X] T067 [US7] Preserve guest localStorage data during multi-step linking flow in frontend/src/contexts/AuthContext.tsx (localStorage is preserved throughout)
- [X] T068 [US7] Implement Firebase linkWithPopup for provider linking in frontend/src/contexts/AuthContext.tsx (linkProvider uses linkWithPopup)

**Checkpoint**: Users can link multiple providers to same account

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Integration, testing, documentation

- [X] T069 [P] Update CLAUDE.md with Firebase technologies in project root
- [X] T070 [P] Run database migration: `alembic upgrade head` in backend/
- [ ] T071 [P] Add Firebase config to deployment environment variables
- [X] T072 [P] Run all backend tests: `pytest backend/tests/ -v`
- [X] T073 [P] Run all frontend tests: `npm test` in frontend/
- [ ] T074 [P] Test email/Password sign-in flow end-to-end
- [ ] T075 [P] Test Google OAuth sign-in flow end-to-end
- [ ] T076 [P] Test guest→user merge flow end-to-end
- [ ] T077 [P] Test password reset flow end-to-end
- [ ] T078 [P] Test sign-out flow end-to-end
- [ ] T079 [P] Test cross-device sync (manual test with two browsers)
- [ ] T080 [P] Test provider linking flow end-to-end
- [ ] T081 [P] Validate quickstart.md instructions (follow all steps)
- [X] T082 Update LandingPage.tsx with AuthDialog integration (already done in App.tsx)
- [X] T083 Add visual verification request for auth UI components per constitution v1.2.0 (visual-verification-checklist.md created)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 0)**: No dependencies - can start immediately
- **Foundational (Phase 1)**: Depends on Setup completion - **BLOCKS all user stories**
- **User Stories (Phase 2-8)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order: P1 (Phases 2-4) → P2 (Phases 5-8)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (Email/Password)**: Can start after Foundational - No dependencies on other stories
- **US2 (Google OAuth)**: Can start after Foundational - Independent of US1
- **US3 (Guest Access)**: Can start after Foundational - Independent of US1/US2
- **US4 (Password Reset)**: Can start after Foundational - Independent (uses Firebase APIs)
- **US5 (Sign Out)**: Can start after Foundational - Depends on US1/US2/US3 sign-in being implemented
- **US6 (Cross-Device Sync)**: Can start after Foundational - Depends on US1 (data fetch needs auth)
- **US7 (Provider Linking)**: Can start after Foundational - Depends on US1/US2 (links existing providers)

### Critical Path

1. **Setup (Phase 0)** → 2. **Foundational (Phase 1)** → 3. **US1 + US2 + US3** (can run in parallel) → 4. **US4 + US5 + US6 + US7**

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation (TDD)
- Models before services
- Services before endpoints
- Core implementation before integration

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational model tasks (T009-T012) can run in parallel
- All Foundational service tests (T013, T016, T018) can run in parallel (after their implementations)
- US1, US2, US3 can all start in parallel once Foundational phase completes
- Within US1: T028-T033 (all [P]) can run in parallel
- Within US2: T038-T040 (all [P]) can run in parallel
- Within US3: T042-T046 (all [P]) can run in parallel

---

## Parallel Example: Phase 2 (User Story 1)

```bash
# After Foundational phase complete, launch these in parallel:
T028: Implement email sign-up mutation (frontend/src/hooks/useAuth.ts)
T029: Implement email sign-in mutation (frontend/src/hooks/useAuth.ts)
T030: Implement resend verification email (frontend/src/hooks/useAuth.ts)
T032: Create AuthDialog component (frontend/src/components/AuthDialog.tsx)
T033: Create EmailVerificationPrompt component (frontend/src/components/EmailVerificationPrompt.tsx)
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 0: Setup
2. Complete Phase 1: Foundational (**CRITICAL** - blocks all stories)
3. Complete Phase 2: US1 (Email/Password)
4. Complete Phase 3: US2 (Google OAuth)
5. Complete Phase 4: US3 (Guest Access)
6. **STOP and VALIDATE**: Test all three P1 stories independently
7. Deploy/demo MVP

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (Email/Password) → Test independently → Deploy/Demo (MVP increment 1)
3. Add US2 (Google OAuth) → Test independently → Deploy/Demo (MVP increment 2)
4. Add US3 (Guest Access) → Test independently → Deploy/Demo (MVP increment 3)
5. Add US4-US7 (P2 stories) → Test independently → Deploy/Demo (Complete feature)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Email/Password)
   - Developer B: US2 (Google OAuth)
   - Developer C: US3 (Guest Access)
3. Stories complete and integrate independently

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** maps task to specific user story for traceability
- **TDD applies to**: auth middleware (T013-T015), error messages (T013a, T015a), route classification (T014), merge utility (T016-T017, T017a), localStorage migrations (T018-T019)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Constitution compliance**: No telemetry (Firebase Analytics disabled), local-first (guest mode), unlimited alerts (no caps)
- **Cross-layer consistency**: Backend error_messages.py and frontend errorCopy.ts must be kept in sync (FR-031, FR-034)

---

**Task Count Summary**:
- Total tasks: 87 (+4 new remediation tasks)
- Setup tasks: 7
- Foundational tasks: 21 (including TDD tests for core logic, error messages, route classification)
- US1 tasks: 10
- US2 tasks: 4
- US3 tasks: 9
- US4 tasks: 4
- US5 tasks: 4
- US6 tasks: 5
- US7 tasks: 5
- Polish tasks: 14

**Suggested MVP Scope**: Phases 0-4 (Setup + Foundational + US1 + US2 + US3) = 51 tasks
**Parallel opportunities**: 46 tasks marked [P] can be parallelized (+4 new parallel tasks)
