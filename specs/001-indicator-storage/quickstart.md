# Quick Start: Indicator Database Storage

**Feature**: Indicator Database Storage
**Branch**: `001-indicator-storage`
**Last Updated**: 2025-01-04

## Overview

This guide helps developers quickly understand and work with the indicator database storage feature. Indicators are now stored in PostgreSQL (instead of localStorage) for multi-device access and persistence.

---

## Architecture Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │         │   Backend   │         │  PostgreSQL │
│             │         │  (FastAPI)  │         │  Database   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Get Indicators    │                       │
       ├──────────────────────>│                       │
       │                       │  2. Query DB          │
       │                       ├──────────────────────>│
       │                       │  3. Return JSON       │
       │                       │<──────────────────────┤
       │  4. Display Indicators│                       │
       │<──────────────────────┤                       │
       │                       │                       │
       │  5. Create/Update     │                       │
       ├──────────────────────>│                       │
       │                       │  6. Upsert DB         │
       │                       ├──────────────────────>│
       │  7. Success Response  │                       │
       │<──────────────────────┤                       │
```

---

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `backend/app/models/indicator_config.py` | Database model (SQLAlchemy) |
| `backend/app/api/v1/indicator_configs.py` | REST API endpoints |
| `backend/app/services/merge_util.py` | Guest → Auth merge logic |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useIndicatorInstances.ts` | Main hook for indicator CRUD |
| `frontend/src/types/auth.ts` | TypeScript types for indicators |
| `frontend/src/migrations/migrateIndicatorsToCloud.ts` | One-time migration script |

---

## Database Schema

```sql
CREATE TABLE indicator_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uuid UUID NOT NULL,
    indicator_name VARCHAR(50) NOT NULL,
    indicator_category VARCHAR(20) NOT NULL,
    indicator_params JSON NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    style JSON NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_indicator_config_user_uuid UNIQUE (user_id, uuid)
);

CREATE INDEX ix_indicator_configs_user_id ON indicator_configs(user_id);
CREATE INDEX ix_indicator_configs_indicator_name ON indicator_configs(indicator_name);
```

**Key Points**:
- Composite unique constraint `(user_id, uuid)` ensures UUID is unique per user
- `user_id` can be NULL (for guest/unassigned indicators)
- `indicator_params` and `style` are JSON columns for flexibility

---

## API Endpoints

### Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://polishedcharts-backend.onrender.com/api/v1`

### Authentication
All endpoints require Firebase ID token in Authorization header:
```
Authorization: Bearer <firebase_token>
```

### Endpoints

#### Get All Indicators
```bash
GET /indicator-configs
```

**Response**:
```json
[
  {
    "id": 123,
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "indicator_name": "sma",
    "indicator_category": "overlay",
    "indicator_params": {"length": 20},
    "display_name": "SMA (20)",
    "style": {"color": "#FF5733", "lineWidth": 2, "showLastValue": true},
    "is_visible": true,
    "created_at": "2025-01-04T12:00:00Z",
    "updated_at": "2025-01-04T12:30:00Z"
  }
]
```

#### Create Indicator
```bash
POST /indicator-configs
Content-Type: application/json

{
  "indicator_name": "sma",
  "indicator_category": "overlay",
  "indicator_params": {"length": 20},
  "display_name": "SMA (20)",
  "style": {"color": "#FF5733", "lineWidth": 2, "showLastValue": true}
}
```

#### Update Indicator
```bash
PUT /indicator-configs/{uuid}
Content-Type: application/json

{
  "indicator_params": {"length": 50},
  "display_name": "SMA (50)",
  "style": {"color": "#4CAF50", "lineWidth": 3}
}
```

#### Delete Indicator
```bash
DELETE /indicator-configs/{uuid}
```

---

## Frontend Usage

### Using the Hook

```typescript
import { useIndicatorInstances } from '@/hooks/useIndicatorInstances';

function IndicatorPanel() {
  const {
    indicators,
    loading,
    error,
    addIndicator,
    removeIndicator,
    updateStyle,
    updateParams,
    toggleVisibility
  } = useIndicatorInstances();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {indicators.map(indicator => (
        <div key={indicator.id}>
          {indicator.display_name}
          <button onClick={() => removeIndicator(indicator.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Indicator Instance Type

```typescript
interface IndicatorInstance {
  id: string;              // UUID
  indicatorName: string;   // 'sma', 'ema', 'tdfi', etc.
  params: Record<string, number>;  // Parameter values
  displayName: string;
  style: {
    color: string;
    lineWidth: number;
    showLastValue?: boolean;
    seriesColors?: Record<string, string>;
  };
  isVisible: boolean;
}
```

---

## Data Flow

### Authenticated User

```
1. User signs in with Firebase
2. Hook calls GET /indicator-configs
3. Backend validates Firebase token, extracts user_id
4. Backend queries indicator_configs WHERE user_id = ?
5. Backend returns JSON array
6. Hook stores in state (optimistic caching)
7. UI renders indicators
```

### Guest User

```
1. User uses app without signing in
2. Hook reads from localStorage only
3. No API calls made
4. Indicators stored locally
5. On sign-in: merge triggered (see Merge Flow below)
```

### Merge Flow (Guest → Authenticated)

```
1. Guest user has 2 indicators in localStorage
2. Guest signs in with existing account
3. Frontend sends localStorage indicators to POST /merge
4. Backend executes upsert_indicator_configs():
   - For each guest indicator:
     - Check if UUID exists for this user_id
     - If no: INSERT with user_id
     - If yes: Compare updated_at timestamps
       - If guest > existing + 2min: UPDATE
       - Else: Keep existing (prefer cloud)
5. Backend returns merged indicator list
6. Frontend replaces localStorage with merged list
7. UI displays all indicators (guest + account combined)
```

---

## Testing

### Backend Tests

```bash
cd backend
pytest tests/test_indicator_configs.py -v
```

**Test Cases**:
- Create indicator configuration
- Get all indicators for user
- Update indicator configuration
- Delete indicator configuration
- Merge guest indicators with authenticated user
- Validate indicator parameters

### Frontend Tests

```bash
cd frontend
npm test useIndicatorInstances.test.ts
```

**Test Cases**:
- Hook loads indicators from API
- Hook falls back to localStorage on API error
- Optimistic updates work correctly
- Rollback on API failure
- Guest mode uses localStorage only

---

## Migration Script

### Running the Migration

Open browser console and run:

```javascript
// Load migration script
const script = document.createElement('script');
script.src = '/src/migrations/migrateIndicatorsToCloud.ts';
document.head.appendChild(script);

// After script loads, run migration:
window.migrateIndicatorsToCloud().then(result => {
  console.log('Migration complete:', result);
});
```

### What It Does

1. Reads localStorage keys: `indicatorinstance*`, `indicatorlistglobal`
2. Generates UUID for each indicator (if missing)
3. Uploads to database via POST /indicator-configs
4. Verifies upload success
5. Reports results

### Rollback

If migration fails, indicators remain in localStorage. No data is deleted until successful migration is confirmed.

---

## Common Issues

### Issue: "Invalid or expired Firebase token"

**Cause**: Token expired (1 hour lifetime)

**Solution**: Refresh token using Firebase SDK:
```typescript
const { getIdToken } = useAuth();
const newToken = await getIdToken(true); // forceRefresh = true
```

### Issue: "Indicator configuration not found"

**Cause**: UUID doesn't exist for this user

**Solution**: Ensure UUID is from user's own indicators (not another user's)

### Issue: "Composite unique constraint violation"

**Cause**: Duplicate UUID for same user

**Solution**: Generate new UUID or update existing indicator

### Issue: Guest indicators not merging

**Cause**: Merge endpoint not called after sign-in

**Solution**: Check that `useMerge` hook is triggered on auth state change

---

## Performance Considerations

### Batch Retrieval
- All indicators retrieved in single API call
- Typical: 5-10 indicators (~5-10 KB)
- Heavy users: 50+ indicators (~25-50 KB)
- Expected time: <200ms (production)

### Optimistic Updates
- UI updates immediately
- API call happens in background
- Rollback on error
- Provides responsive feel

### LocalStorage Fallback
- Used when API unavailable
- Automatic retry with backoff (30-second timeout)
- Visible sync indicator shows pending status

---

## Next Steps

For Developers:
1. Review `data-model.md` for detailed entity relationships
2. Review `contracts/openapi.yaml` for API specification
3. Run tests to verify implementation
4. Check `plan.md` for implementation tasks

For Users:
1. Sign in to enable cloud storage
2. Existing localStorage indicators will auto-migrate
3. Access your indicators on any device
4. Data persists even after clearing browser cache
