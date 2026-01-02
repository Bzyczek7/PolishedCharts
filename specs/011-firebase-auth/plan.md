# Implementation Plan: Firebase Authentication

**Branch**: `011-firebase-auth` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-firebase-auth/spec.md`

## Summary

Implement Firebase Authentication for PolishedCharts to enable user accounts, cross-device data synchronization, and persistent storage of alerts, watchlists, and chart layouts. The system supports email/password registration (with email verification), Google OAuth sign-in, and guest access with optional sign-in. All user-specific entities use UUIDs and idempotent upsert-by-UUID merge operations with deterministic timestamp comparison (±2 minute tolerance, prefer cloud).

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.104+, SQLAlchemy 2.0+, firebase-admin 6.0+, pydantic 2.0+
- Frontend: React 19, firebase 10.0+ (firebase/auth, firebase/app), TypeScript 5.9+
**Storage**:
- PostgreSQL (existing candles, alerts database via SQLAlchemy with asyncpg driver)
- Firebase Authentication (user accounts, tokens, verification emails)
- Browser localStorage (guest user data with schema versioning)
**Testing**: pytest (backend), Vitest/Jest (frontend), Firebase Auth Emulator for integration tests
**Target Platform**: Web browser (ES2020+), Linux server (backend API)
**Project Type**: Web application (backend + frontend)
**Performance Goals**:
- Sign-in complete within 2 seconds (email/password) or 30 seconds (Google OAuth)
- Token refresh within 500ms
- Guest→user data merge within 3 seconds
**Constraints**:
- Must stay within Firebase Spark Plan free tier (3,000 monthly active users)
- No telemetry or data upload without explicit consent (constitution requirement)
- Must work offline for guest users (constitution: local-first)
**Scale/Scope**:
- 3,000 monthly active users (Firebase free tier)
- Unlimited alerts, watchlists, layouts per user (constitution: unlimited alerts)
- 3 user entities: Alert, Watchlist, Layout (all with UUIDs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] N/A - This feature does not modify chart interactions or UI rendering
- [x] N/A - No chart UI changes in this feature
- [x] N/A - No impact on chart rendering performance

### Correctness Over Cleverness

- [x] **Timestamp handling**: All `updated_at` timestamps normalized to UTC before merge comparison; deterministic tiebreaker via `MERGE_TIMESTAMP_TOLERANCE_MS` constant (±2 minutes, prefer cloud)
- [x] **Deduplication**: Upsert-by-UUID with database unique constraints on (user_id, uuid) pairs; idempotent merge utility ensures identical results on retry
- [x] **N/A** - No alert semantics changes in this feature
- [x] **N/A** - No candle data handling in this feature

### Unlimited Alerts Philosophy

- [x] **No hard caps**: Merge utility and data model impose no limits on alert/watchlist/layout counts
- [x] **Merge performance budgeted**: Guest→user merge must complete within 3 seconds (SC-005)
- [x] **N/A** - Alert evaluation unchanged

### Local-First and Offline-Tolerant

- [x] **Guest localStorage**: All guest data (alerts, watchlist, layouts) stored in browser localStorage with schema versioning and automatic migrations (FR-008a)
- [x] **Offline behavior**: Guest users can create/edit alerts and watchlists offline; signed-in users see cached data with sync on reconnect (SC-010)
- [x] **Provider error handling**: Firebase service errors handled gracefully with generic user feedback; token refresh failure switches to guest mode while preserving local data (FR-016)

### Testing and Quality Gates

- [x] **TDD for core logic**: Merge utility, token verification middleware, localStorage schema migrations MUST be test-driven
- [x] **Regression tests**: Every bug fix in auth/merge logic MUST include regression test
- [x] **CI**: lint, typecheck, unit tests, integration tests with Firebase Auth Emulator

### Performance Budgets

- [x] **Initial chart load**: N/A - no impact on chart loading
- [x] **Price update latency**: N/A - no impact on data polling
- [x] **Alert evaluation**: N/A - no impact on alert engine
- [x] **UI panning**: N/A - no chart rendering changes
- [x] **Memory**: Guest localStorage data cached in browser; backend memory impact minimal (PostgreSQL queries with user_id filtering)

### Architecture for Extensibility

- [x] **Indicators**: N/A - no indicator changes in this feature
- [x] **Data providers**: N/A - no provider changes in this feature
- [x] **Auth middleware**: Single shared authentication middleware/decorator (FR-035a) that can be extended to new protected endpoints

### Security & Privacy

- [x] **No telemetry**: Firebase Analytics disabled by default; no user tracking without consent
- [x] **API keys stored securely**: Firebase config via environment variables (FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_API_KEY)
- [x] **Local data treated as sensitive**: localStorage data (alerts, watchlist, layouts) never uploaded without explicit user sign-in action

### Governance

- [x] **No violations**: This feature aligns with all constitution principles
- [x] **N/A** - No conflicts between constitution and spec

## Project Structure

### Documentation (this feature)

```text
specs/011-firebase-auth/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── backend-api.yaml # OpenAPI spec for backend auth endpoints
│   └── frontend-types.ts# TypeScript types for auth context
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (existing project)
backend/
├── app/
│   ├── models/
│   │   ├── user.py              # NEW: User SQLAlchemy model
│   │   ├── alert.py             # MODIFY: Add user_id FK, UUID, updated_at
│   │   └── watchlist.py         # MODIFY: Add user_id FK, UUID, updated_at
│   ├── services/
│   │   ├── auth_middleware.py   # NEW: Shared Firebase token verification middleware
│   │   ├── merge_util.py        # NEW: Shared upsert-by-UUID merge utility
│   │   └── local_storage.py     # NEW: LocalStorage schema versioning utilities
│   └── api/
│       ├── v1/
│       │   ├── auth.py          # NEW: Auth endpoints (register, sign-in, sign-out, token-refresh)
│       │   └── user_data.py     # MODIFY: Add user context to existing endpoints
│       └── dependencies.py      # MODIFY: Add auth middleware dependency
├── tests/
│   ├── services/
│   │   ├── test_auth_middleware.py
│   │   ├── test_merge_util.py
│   │   └── test_local_storage.py
│   └── api/
│       └── test_auth.py
├── alembic/
│   └── versions/
│       └── XXX_add_firebase_auth.py  # NEW: Migration for users table, UUIDs, timestamps
└── requirements.txt                    # MODIFY: Add firebase-admin

frontend/
├── src/
│   ├── lib/
│   │   └── firebase.ts           # NEW: Firebase Auth initialization and config
│   ├── contexts/
│   │   └── AuthContext.tsx       # NEW: React context for auth state
│   ├── hooks/
│   │   ├── useAuth.ts            # NEW: Hook for auth operations
│   │   └── useLocalStorage.ts    # NEW: Hook for localStorage with schema migrations
│   ├── services/
│   │   ├── authService.ts        # NEW: API calls for auth endpoints
│   │   └── mergeService.ts       # NEW: Merge API calls
│   ├── components/
│   │   ├── AuthDialog.tsx        # NEW: Sign-in/register modal
│   │   └── UserMenu.tsx          # NEW: User menu with sign-out
│   └── types/
│       └── auth.ts               # NEW: TypeScript types for auth entities
└── tests/
    ├── services/
    │   └── authService.test.ts
    └── hooks/
        └── useAuth.test.ts
```

**Structure Decision**: Web application structure (backend + frontend) matches existing project layout. Backend uses FastAPI with SQLAlchemy; frontend uses React with TypeScript. New auth code isolated in dedicated modules to avoid coupling with existing chart/indicator logic.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| N/A | N/A | No constitution violations; this feature aligns with all core principles |
