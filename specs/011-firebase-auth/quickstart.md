# Quickstart: Firebase Authentication

**Feature**: 011-firebase-auth
**Branch**: `011-firebase-auth`
**Last Updated**: 2025-12-30

This guide will help you set up and develop with the Firebase Authentication feature.

---

## Prerequisites

1. **Firebase Project**: Create a Firebase project at https://console.firebase.google.com
2. **Node.js 18+**: Required for frontend development
3. **Python 3.11+**: Required for backend development
4. **PostgreSQL**: Database server running locally or accessible

---

## Step 1: Firebase Console Setup

### 1.1 Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project" and follow the setup wizard
3. **IMPORTANT**: When prompted to enable Google Analytics, select **"Not at this time"** or explicitly disable it
   - Constitution requirement: no telemetry or analytics without explicit user consent
   - Firebase Analytics must remain disabled unless a future consent feature is added

### 1.2 Enable Authentication

1. Navigate to **Build → Authentication**
2. Click **Get Started**
3. Enable **Email/Password** sign-in provider
4. Enable **Google** sign-in provider
5. Configure authorized domains (localhost for development, your domain for production)

### 1.3 Get Firebase Configuration

1. Navigate to **Project Settings** (gear icon)
2. Scroll to **Your apps → Web app**
3. Copy the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "polishedcharts.firebaseapp.com",
  projectId: "polishedcharts",
  // ...
};
```

### 1.4 Generate Service Account Key (Backend)

1. Navigate to **Project Settings → Service Accounts**
2. Click **Generate new private key**
3. Save the JSON file securely (never commit to git)
4. For deployment, encode to base64: `base64 -w 0 service-account.json`

---

## Step 2: Environment Configuration

### 2.1 Backend Environment Variables

Create or update `backend/.env`:

```bash
# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"polishedcharts",...}
FIREBASE_PROJECT_ID=polishedcharts

# Database (existing)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/polishedcharts
```

**For production**: Use base64-encoded service account key:
```bash
FIREBASE_SERVICE_ACCOUNT_KEY=$(base64 -w 0 service-account.json)
```

### 2.2 Frontend Environment Variables

Create or update `frontend/.env`:

```bash
# Firebase Client SDK
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=polishedcharts.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=polishedcharts
VITE_FIREBASE_STORAGE_BUCKET=polishedcharts.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# For local testing with emulator
VITE_USE_FIREBASE_EMULATOR=false
```

---

## Step 3: Backend Setup

### 3.1 Install Dependencies

```bash
cd backend
pip install "firebase-admin>=6.0.0"
```

### 3.2 Run Database Migration

```bash
# Create tables and add UUID columns
alembic upgrade head
```

### 3.3 Verify Setup

```bash
# Run tests
pytest tests/services/test_auth_middleware.py -v

# Start backend
uvicorn app.main:app --reload
```

Test the health endpoint:
```bash
curl http://localhost:8000/api/health
```

---

## Step 4: Frontend Setup

### 4.1 Install Dependencies

```bash
cd frontend
npm install "firebase@^10.0.0"
```

### 4.2 Initialize Firebase

Create `frontend/src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Prevent duplicate initialization in React StrictMode
export const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
auth.useDeviceLanguage(); // Use browser language for email templates

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account', // Force account selection
});
```

### 4.3 Set Up Auth Context

Create `frontend/src/contexts/AuthContext.tsx` (see contracts for full implementation).

### 4.4 Wrap App with AuthProvider

```typescript
// frontend/src/main.tsx
import { AuthProvider } from './contexts/AuthContext';

<AuthProvider>
  <App />
</AuthProvider>
```

### 4.5 Run Frontend

```bash
npm run dev
```

---

## Step 5: Development Workflow

### 5.1 Test Email/Password Sign-Up

1. Navigate to http://localhost:5173
2. Click "Email login"
3. Enter new email and password (min 8 characters)
4. Check your email for verification link
5. Click verification link (auto-signs you in)

### 5.2 Test Google Sign-In

1. Navigate to http://localhost:5173
2. Click "Sign in with Google"
3. Select your Google account
4. You should be signed in automatically

### 5.3 Test Guest Mode

1. Navigate to http://localhost:5173
2. Click "OPEN THE CHART"
3. Create alerts, modify watchlist
4. Open DevTools → Application → Local Storage
5. Verify `polishedcharts_data` exists with schema version

### 5.4 Test Guest → User Merge

1. As a guest, create some alerts and watchlist
2. Click "Sign in" and complete authentication
3. Verify your guest data merged with cloud data
4. Sign out and sign back in → data should persist

---

## Step 6: Testing with Firebase Emulator

### 6.1 Install Firebase Emulator

```bash
npm install -g firebase-tools
firebase init emulators
```

Select:
- **Authentication Emulator** (port 9099)

### 6.2 Start Emulator

```bash
firebase emulators:start
```

### 6.3 Configure Frontend for Emulator

Update `frontend/src/lib/firebase.ts`:

```typescript
import { getAuth, connectAuthEmulator } from 'firebase/auth';

export const auth = getAuth(app);

// Connect to emulator for development
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

Set environment variable:
```bash
export VITE_USE_FIREBASE_EMULATOR=true
```

### 6.4 Run Tests with Emulator

```bash
# Frontend tests
npm run test

# Backend tests (automatically uses emulator via conftest.py)
pytest tests/api/test_auth.py -v
```

---

## Step 7: Common Tasks

### Add Auth to a New API Endpoint

```python
from fastapi import APIRouter, Depends
from app.services.auth_middleware import get_current_user

router = APIRouter()

@router.get("/api/v1/protected")
async def protected_endpoint(user: dict = Depends(get_current_user)):
    """
    Protected endpoint - requires verified Firebase account.

    The get_current_user dependency (shared middleware) enforces:
    - Valid Firebase ID token in Authorization header
    - Email verified (email_verified claim == true)
    - Returns 401 for invalid tokens, 403 for unverified emails
    """
    return {"message": f"Hello {user['email']}"}

@router.get("/api/v1/public")
async def public_endpoint():
    """Public endpoint - no authentication required (accessible to guests)."""
    return {"message": "Hello guest"}
```

### Add Auth to a Frontend Component

```typescript
import { useAuth } from '../hooks/useAuth';

export function MyComponent() {
  const { user, isSignedIn, signInWithGoogle } = useAuth();

  if (!isSignedIn) {
    return <button onClick={signInWithGoogle}>Sign In</button>;
  }

  return <div>Welcome, {user.email}!</div>;
}
```

### Create a LocalStorage Migration

```typescript
// src/hooks/useLocalStorage.ts
const migrations: Migration[] = [
  // Existing migrations...
  {
    version: 2,
    migrate: (data: any): LocalStorageSchema => ({
      schemaVersion: 2,
      alerts: data.alerts.map(addNewField),
      watchlist: data.watchlist,
      layouts: data.layouts,
    })
  }
];
```

---

## Step 8: Troubleshooting

### "Email verification required" Error

**Cause**: User signed up but didn't click email verification link

**Solution**:
1. Check email inbox (and spam folder)
2. Use "Resend verification email" option
3. Or "Continue as guest" to explore without verification

### "Account exists with different credential" Error

**Cause**: Trying to sign in with Google when email/password account exists (or vice versa)

**Solution**:
1. Sign in with existing provider first
2. Then link the new provider in account settings
3. Future sign-ins work with either provider

### LocalStorage Schema Mismatch

**Cause**: Old schema version in localStorage

**Solution**:
1. Clear localStorage: DevTools → Application → Local Storage → Delete
2. Refresh page
3. Or implement missing migration in `useLocalStorage.ts`

### Token Refresh Fails

**Cause**: Network issue, Firebase downtime, or account disabled

**Solution**:
1. Check network connection
2. Sign out and sign back in
3. Local data is preserved (guest mode fallback)

---

## Step 9: Deployment Checklist

### Backend

- [ ] Set `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable (base64-encoded)
- [ ] Set `FIREBASE_PROJECT_ID` environment variable
- [ ] Run database migrations: `alembic upgrade head`
- [ ] Verify Firebase Admin SDK initialization in logs
- [ ] Test protected endpoint with valid token

### Frontend

- [ ] Set all `VITE_FIREBASE_*` environment variables
- [ ] Verify Firebase config in production build
- [ ] Enable authorized domain in Firebase Console
- [ ] Test sign-in flow in production
- [ ] Test guest mode and data merge

### Firebase Console

- [ ] Verify Email/Password provider enabled
- [ ] Verify Google provider enabled
- [ ] Configure authorized domains
- [ ] Customize email templates (optional)
- [ ] Check quota usage (Firebase Spark Plan: 3,000 MAU)

---

## Step 10: File Structure Reference

```
backend/
├── app/
│   ├── models/
│   │   ├── user.py              # User SQLAlchemy model
│   │   ├── alert.py             # Modified (user_id, uuid, timestamps)
│   │   └── watchlist.py         # Modified (user_id, uuid, timestamps)
│   ├── services/
│   │   ├── auth_middleware.py   # Shared auth middleware
│   │   ├── merge_util.py        # Shared merge utility
│   │   └── firebase_admin.py    # Firebase Admin SDK initialization
│   └── api/
│       └── v1/
│           └── auth.py          # Auth endpoints
└── tests/
    └── services/
        └── test_auth_middleware.py

frontend/
├── src/
│   ├── lib/
│   │   └── firebase.ts          # Firebase initialization
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state provider
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth operations hook
│   │   └── useLocalStorage.ts   # LocalStorage with migrations
│   ├── services/
│   │   └── authService.ts       # Backend API calls
│   └── components/
│       ├── AuthDialog.tsx       # Sign-in modal
│       └── UserMenu.tsx         # User menu with sign-out
```

---

## Additional Resources

- [Firebase Web SDK Docs](https://firebase.google.com/docs/web/setup)
- [Firebase Admin Python SDK](https://firebase.google.com/docs/admin/setup)
- [FastAPI Security Docs](https://fastapi.tiangolo.com/tutorial/security/)
- [Project Spec](./spec.md)
- [Research Findings](./research.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/backend-api.yaml)

---

**Quickstart Complete**: You're ready to develop with Firebase Authentication!

For questions or issues, refer to the [spec.md](./spec.md) or [research.md](./research.md).
