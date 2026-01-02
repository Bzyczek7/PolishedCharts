# Research: Firebase Authentication

**Feature**: 011-firebase-auth
**Date**: 2025-12-30
**Phase**: Phase 0 - Research & Technology Decisions

## Overview

This document consolidates research findings for implementing Firebase Authentication in a Python FastAPI backend + React TypeScript frontend application. All decisions align with the constitution requirements (local-first, no telemetry, unlimited alerts).

---

## 1. Firebase Client SDK Integration (Frontend)

### Decision: Use Firebase JS SDK v10.0+ modular syntax

**Rationale**:
- Firebase v10+ offers tree-shakeable modular SDK, reducing bundle size
- React 19 compatible with Firebase v10+
- TypeScript first-party support with comprehensive types
- Built-in OAuth providers (Google) and email/password authentication
- Email verification links handled automatically by Firebase

**Implementation Pattern**:
```typescript
// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// Prevent duplicate initialization in React StrictMode
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

**Alternatives Considered**:
- **Firebase v9 namespaced API**: Older syntax, larger bundle size, not recommended
- **Direct REST API**: More complex, no built-in OAuth handling, reinventing wheel
- **Auth0/Clerk/NextAuth**: Third-party providers add cost/complexity; Firebase Spark Plan is free

**Best Practices**:
- Use `onAuthStateChanged` listener for persistent auth state across refreshes
- Store Firebase config in environment variables (never commit API keys)
- Disable Firebase Analytics to comply with constitution (no telemetry without consent)

---

## 2. Firebase Admin SDK Integration (Backend)

### Decision: Use firebase-admin Python SDK with service account

**Rationale**:
- Official Python SDK for server-side token verification
- Supports both development (service account JSON) and production (environment variable)
- Asynchronous token verification with `async/await` compatible with FastAPI
- Can verify ID tokens, check custom claims, and manage users

**Implementation Pattern**:
```python
# backend/app/services/firebase_admin.py
import firebase_admin
from firebase_admin import auth
from firebase_admin.credentials import Certificate
import os
import json

def initialize_firebase():
    """Initialize Firebase Admin SDK from environment variable."""
    if not firebase_admin._apps:
        service_account_info = json.loads(
            os.environ['FIREBASE_SERVICE_ACCOUNT_KEY']
        )
        cred = Certificate(service_account_info)
        firebase_admin.initialize_app(cred)

# Call during app startup
initialize_firebase()

async def verify_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded claims."""
    try:
        decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=300)
        return decoded_token
    except Exception as e:
        raise ValueError(f"Invalid token: {e}")
```

**Alternatives Considered**:
- **Direct HTTP API calls to Firebase**: More complex, error-prone, no built-in token caching
- **JWT verification without SDK**: Requires manual key rotation, RS256 verification, timing attack protection
- **Third-party auth services**: Adds cost, Firebase Spark Plan is free for 3,000 MAU

**Best Practices**:
- Initialize Firebase Admin SDK once at app startup (not per-request)
- Set `clock_skew_seconds=300` to handle minor clock differences
- Store service account key in environment variable (never commit to git)
- Use async endpoints to avoid blocking during token verification

---

## 3. Shared Authentication Middleware

### Decision: FastAPI dependency injection with singleton decorator

**Rationale**:
- FastAPI's `Depends()` provides middleware pattern with automatic OpenAPI documentation
- Single shared middleware prevents inconsistent token verification (FR-035a)
- Easy to add to specific endpoints (protected) while excluding public endpoints
- Automated test can enumerate all routes to verify middleware usage

**Implementation Pattern**:
```python
# backend/app/services/auth_middleware.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .firebase_admin import verify_token

security = HTTPBearer()  # Auto-extracts Bearer token from Authorization header

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Shared authentication middleware for all protected endpoints.

    Verifies Firebase ID token and enforces email verification.
    """
    token = credentials.credentials

    # Verify token with Firebase
    try:
        decoded = await verify_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

    # Enforce email verification (FR-005a)
    if not decoded.get('email_verified'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )

    return decoded

# Usage in protected endpoints:
# @router.get("/alerts")
# async def get_alerts(user: dict = Depends(get_current_user)):
#     ...

# Public endpoints (no middleware):
# @router.get("/candles")
# async def get_candles():
#     ...
```

**Automated Test for Route Enumeration**:
```python
# tests/services/test_auth_middleware_coverage.py
import pytest
from backend.app.main import app

def test_all_protected_routes_use_auth_middleware():
    """
    Ensure every protected endpoint uses authentication middleware.
    This prevents future endpoints from accidentally skipping auth (FR-035a).
    """
    public_routes = {
        "/api/v1/candles",
        "/api/v1/indicators",
        "/api/health",
    }

    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'dependencies'):
            if route.path in public_routes:
                continue

            # All other routes should have get_current_user dependency
            if route.path.startswith("/api/v1/"):
                assert any(
                    'get_current_user' in str(dep.dependency)
                    for dep in route.dependencies
                ), f"Route {route.path} missing authentication middleware"
```

**Alternatives Considered**:
- **Custom decorator function**: Harder to integrate with FastAPI's OpenAPI generation
- **Per-endpoint token verification**: Violates DRY, inconsistent implementation risk
- **Global middleware for all routes**: Would block public endpoints (candles, indicators)

**Best Practices**:
- Use `HTTPBearer` security scheme for automatic OpenAPI documentation
- Return 401 for invalid tokens, 403 for unverified emails (distinct error codes)
- Cache verified tokens per-request (FastAPI's `Depends()` handles this automatically)

---

## 4. LocalStorage Schema Versioning

### Decision: Schema version field with migration array pattern

**Rationale**:
- Simple, deterministic pattern used by popular libraries (Redux Persist, localStorage-persistence)
- Migrations run on app load before any data access
- Version bump + migration function ensures future compatibility
- Aligns with constitution (local-first, offline-capable)

**Implementation Pattern**:
```typescript
// src/hooks/useLocalStorage.ts
const CURRENT_SCHEMA_VERSION = 1;

interface LocalStorageSchema {
  schemaVersion: number;
  alerts: Alert[];
  watchlist: WatchlistItem[];
  layouts: Layout[];
}

const migrations = [
  // v0 -> v1 migration (add UUIDs, timestamps)
  {
    version: 1,
    migrate: (data: any): LocalStorageSchema => ({
      schemaVersion: 1,
      alerts: data.alerts?.map(addUuidAndTimestamps) ?? [],
      watchlist: data.watchlist ? addUuidAndTimestamps(data.watchlist) : [],
      layouts: data.layouts?.map(addUuidAndTimestamps) ?? [],
    })
  },
  // Future migrations added here
];

function loadLocalStorage(): LocalStorageSchema {
  const raw = localStorage.getItem('polishedcharts_data');
  if (!raw) {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, alerts: [], watchlist: [], layouts: [] };
  }

  let data = JSON.parse(raw);

  // Run migrations if needed
  if (data.schemaVersion < CURRENT_SCHEMA_VERSION) {
    for (const migration of migrations) {
      if (data.schemaVersion === migration.version - 1) {
        data = migration.migrate(data);
        data.schemaVersion = migration.version;
      }
    }
    saveLocalStorage(data);
  }

  return data;
}
```

**Alternatives Considered**:
- **Separate keys per schema** (`alerts_v1`, `alerts_v2`): Pollutes localStorage, harder to clean up
- **Timestamp-based versioning**: Ambiguous, harder to compare
- **No versioning**: Breaks existing users on schema change (violates constitution)

**Best Practices**:
- Always include schema version in stored data
- Run migrations synchronously on app load before React render
- Test migrations with old schema data in unit tests
- Keep migrations backward-compatible (handle missing fields gracefully)

---

## 5. Idempotent Upsert-by-UUID Merge Utility

### Decision: Shared utility function with deterministic timestamp comparison

**Rationale**:
- Single implementation prevents bugs from divergent logic (FR-013a)
- PostgreSQL `ON CONFLICT` clause for atomic upsert operations
- Deterministic tiebreaker (±2 minute tolerance, prefer cloud) ensures repeatability
- Works for all user entities (alerts, watchlist, layouts)

**Implementation Pattern**:
```python
# backend/app/services/merge_util.py
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Type, TypeVar, Generic

MERGE_TIMESTAMP_TOLERANCE_MS = 120000  # ±2 minutes (FR-010)

T = TypeVar('T')

async def upsert_by_uuid(
    db: AsyncSession,
    model: Type[T],
    items: List[dict],
    user_id: str,
) -> None:
    """
    Shared idempotent upsert utility for user entities (FR-013, FR-013a).

    Uses upsert-by-UUID with updated_at comparison. If timestamps are equal
    within tolerance, prefers the cloud version (deterministic tiebreaker).
    """
    if not items:
        return

    table = model.__table__
    stmt = insert(table).values([{
        **item,
        'user_id': user_id,
    } for item in items])

    # PostgreSQL ON CONFLICT for atomic upsert
    conflict_columns = ['user_id', 'uuid']
    update_columns = {
        col.name: col
        for col in table.columns
        if col.name not in conflict_columns + ['id', 'created_at']
    }

    # Custom update rule for updated_at (tiebreaker logic)
    def get_update_stmt():
        # If new updated_at > existing updated_at + tolerance, update
        # If within ±2 minutes, keep existing (prefer cloud)
        stmt = stmt.on_conflict_do_update(
            index_elements=conflict_columns,
            set_=update_columns
        ).where(
            table.c.updated_at < (stmt.excluded.updated_at - datetime.fromtimestamp(
                MERGE_TIMESTAMP_TOLERANCE_MS / 1000, tz=timezone.utc
            ))
        )
        return stmt

    await db.execute(get_update_stmt())
    await db.commit()
```

**Alternatives Considered**:
- **Separate merge logic per entity**: Violates DRY, risk of inconsistent behavior
- **Blind inserts**: Creates duplicates, not idempotent
- **Application-side comparison + update**: Slower, race conditions, not atomic

**Best Practices**:
- Use PostgreSQL native `ON CONFLICT` for atomicity
- Always filter by `user_id` to prevent cross-user data leaks
- Commit transaction after upsert to release locks
- Test with identical timestamps to verify tiebreaker logic

---

## 6. Firebase Auth Emulator for Testing

### Decision: Use Firebase Auth Emulator for integration tests

**Rationale**:
- Free, no quota usage during testing
- Runs locally, no network dependency
- Supports email/password, Google OAuth (mocked), token verification
- Matches production Firebase Auth behavior

**Setup Pattern**:
```python
# tests/conftest.py
import pytest
import firebase_admin
from firebase_admin import auth
from firebase_admin import credentials
import os

@pytest.fixture(scope="session")
def firebase_emulator():
    """Initialize Firebase Admin SDK with emulator for tests."""
    os.environ['FIREBASE_AUTH_EMULATOR_HOST'] = 'localhost:9099'

    # Use mock credentials for emulator
    if not firebase_admin._apps:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": "test-project"
        })
        firebase_admin.initialize_app(cred)

    yield

    # Cleanup
    firebase_admin.delete_app(firebase_admin.get_app())
```

**Frontend Test Setup**:
```typescript
// src/test/setup.ts
import { connectAuthEmulator, getAuth } from 'firebase/auth';

if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const auth = getAuth();
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

**Alternatives Considered**:
- **Mock Firebase SDK**: Doesn't catch real integration bugs
- **Test with production Firebase**: Consumes quota, slow, requires network
- **Skip auth tests**: Violates TDD requirement (constitution)

**Best Practices**:
- Run emulator in Docker for CI/CD consistency
- Set `FIREBASE_AUTH_EMULATOR_HOST` env var for backend tests
- Clean up emulator data between test runs
- Mock Google OAuth in emulator tests (requires special setup)

---

## 7. Email Verification Enforcement (Dual Enforcement)

### Decision: Check `email_verified` on both client and backend

**Rationale**:
- Frontend check (`user.emailVerified`) provides immediate UX feedback
- Backend check (`email_verified` claim in token) prevents bypass via API calls
- Firebase automatically sets `email_verified` after email link click
- No "temporary session" workaround—unverified users get blocked (FR-003, FR-005a)

**Implementation Pattern**:

**Frontend**:
```typescript
// src/hooks/useAuth.ts
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Client-side email verification check
        if (!firebaseUser.emailVerified) {
          // Block access, show verification prompt
          setUser(null);
          return;
        }
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          emailVerified: firebaseUser.emailVerified,
        });
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  return { user, isSignedIn: !!user };
}
```

**Backend** (already shown in middleware):
```python
async def get_current_user(...) -> dict:
    decoded = await verify_token(token)

    # Backend-side email verification check (FR-005a)
    if not decoded.get('email_verified'):
        raise HTTPException(status_code=403, detail="Email verification required")

    return decoded
```

**Alternatives Considered**:
- **Frontend-only enforcement**: Bypassable via direct API calls
- **Backend-only enforcement**: Poor UX (blocks after form submission)
- **Temporary sessions for unverified users**: Violates spec (FR-003), security risk

**Best Practices**:
- Frontend check for immediate feedback (better UX)
- Backend check for security (cannot be bypassed)
- Consistent error messages: "Please verify your email to continue"

---

## 8. Provider Linking (Account-Exists-With-Different-Credential)

### Decision: Explicit linking flow with error handling

**Rationale**:
- Firebase throws `auth/account-exists-with-different-credential` error
- Best practice: prompt user to sign in with existing provider first, then link
- Prevents account duplication for same email
- Aligns with spec User Story 7 (FR-029)

**Implementation Pattern**:
```typescript
// src/hooks/useAuth.ts
async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/account-exists-with-different-credential') {
      // User already exists with email/password
      // Prompt: "Please sign in with your password to link your Google account"
      throw new Error('LINKING_REQUIRED');
    }
    throw error;
  }
}

async function linkGoogleAccount(password: string) {
  // 1. Sign in with email/password first
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(auth.currentUser!, credential);

  // 2. Link Google account
  const result = await linkWithPopup(auth.currentUser!, googleProvider);
  return result.user;
}
```

**Guest Data During Linking**:
```typescript
// Guest localStorage persists throughout the entire linking flow
// Only merges after final successful sign-in (FR-003, User Story 7 #4)
const guestData = loadLocalStorage(); // Preserved during linking
```

**Alternatives Considered**:
- **Automatic linking**: Not supported by Firebase default behavior, security risk
- **Separate accounts**: Confusing UX, data split across accounts
- **Deny linking**: Poor UX, users can't use multiple providers

**Best Practices**:
- Store guest data in memory during multi-step linking flow
- Only merge after final successful authentication
- Clear error messages: "Account already exists. Sign in to link your Google account."

---

## 9. Token Refresh Failure Handling

### Decision: Switch to guest mode, preserve local data

**Rationale**:
- Token refresh can fail (network, Firebase downtime, account disabled)
- Consistent fallback behavior: guest mode with local data preserved
- Aligns with constitution (local-first, offline-tolerant)
- Specified in FR-016

**Implementation Pattern**:
```typescript
// src/hooks/useAuth.ts
import { onIdTokenChanged } from 'firebase/auth';

useEffect(() => {
  const unsubscribe = onIdTokenChanged(auth, async (user) => {
    if (user) {
      try {
        // Force token refresh
        const token = await user.getIdToken(true);
        // Store token for API calls
        setAuthToken(token);
      } catch (error) {
        // Token refresh failed - switch to guest mode (FR-016)
        console.error('Token refresh failed:', error);

        // Preserve local data, switch to guest mode
        setAuthToken(null);
        setCurrentUser(null);

        // Show user-friendly message
        toast.error('Signed out due to session error. Your data is saved locally.');
      }
    }
  });

  return unsubscribe;
}, []);
```

**Alternatives Considered**:
- **Retry indefinitely**: Can hang app, poor UX
- **Force logout immediately**: Loses unsaved changes, violates constitution
- **Ignore error**: Security risk, stale tokens

**Best Practices**:
- Preserve localStorage data when switching to guest mode
- Show clear user feedback (not silent failure)
- Allow user to retry sign-in manually

---

## Summary of Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Frontend Auth SDK** | Firebase JS SDK v10+ | Modular, tree-shakeable, official support |
| **Backend Admin SDK** | firebase-admin Python | Official SDK, async support, token verification |
| **Auth Middleware** | FastAPI Depends() | OpenAPI integration, per-endpoint control |
| **Storage** | PostgreSQL + localStorage | PostgreSQL for cloud, localStorage for guest (constitution) |
| **Merge Strategy** | Upsert-by-UUID + timestamp | Idempotent, deterministic, atomic |
| **Testing** | Firebase Auth Emulator + pytest/Vitest | Local, free, production-like behavior |
| **Schema Migrations** | Version field + migration array | Simple, deterministic, backward-compatible |

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| **How to prevent unverified users from accessing protected endpoints?** | Dual enforcement: check `user.emailVerified` on frontend AND `email_verified` claim in backend middleware (FR-005a) |
| **How to handle merge conflicts with identical timestamps?** | Prefer cloud version if timestamps within ±2 minutes (`MERGE_TIMESTAMP_TOLERANCE_MS`), deterministic tiebreaker (FR-010) |
| **How to ensure all protected endpoints use auth middleware?** | Single shared `get_current_user` dependency + automated test that enumerates routes (FR-035a) |
| **How to prevent inconsistent merge logic across entities?** | Shared `upsert_by_uuid` utility used by alerts, watchlist, layouts (FR-013a) |
| **How to handle localStorage schema changes?** | Schema version field + migration array, run on app load (FR-008a) |
| **What happens during multi-step provider linking?** | Guest localStorage persists in memory, only merges after final successful sign-in (User Story 7 #4) |
| **How to test auth without hitting production Firebase?** | Firebase Auth Emulator for integration tests, mocks for unit tests |

---

## Dependencies Added

### Backend (requirements.txt)
```
firebase-admin>=6.0.0
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "firebase": "^10.0.0"
  },
  "devDependencies": {
    "@types/firebase": "^3.2.1"
  }
}
```

### Environment Variables
```bash
# Backend
FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded JSON>
FIREBASE_PROJECT_ID=polishedcharts

# Frontend (Vite)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_PROJECT_ID=polishedcharts
VITE_FIREBASE_AUTH_DOMAIN=polishedcharts.firebaseapp.com
VITE_FIREBASE_EMULATOR_HOST=localhost:9099  # Tests only
```

---

**Phase 0 Complete**: All NEEDS CLARIFICATION items resolved. Proceed to Phase 1 (data model, contracts, quickstart).
