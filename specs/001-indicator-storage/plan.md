# Implementation Plan: Indicator Database Storage

**Branch**: `001-indicator-storage` | **Date**: 2025-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-indicator-storage/spec.md`

## Summary

Migrate indicator configurations from browser localStorage to PostgreSQL database, enabling multi-device access, data persistence across browser cache clearing, and seamless guest-to-authenticated user transitions. Currently, indicators stored in `useIndicatorInstances.ts` are inaccessible across devices and lost when browser cache is cleared. Solution: Create `IndicatorConfig` database model following existing patterns (Alert, UserWatchlist, Layout), with REST API endpoints and frontend migration.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**: FastAPI 0.104+, SQLAlchemy 2.0+, Firebase Admin SDK (backend), React 19, axios (frontend)
**Storage**: PostgreSQL (via SQLAlchemy with asyncpg driver)
**Testing**: pytest (backend), vitest (frontend)
**Target Platform**: Web (browser) + Render (production backend)
**Project Type**: Web application (backend + frontend)
**Performance Goals**:
- Indicator retrieval: <2 seconds (SC-001)
- Indicator sync: <1 second for typical configs (SC-003)
- Zero data loss during migration (SC-005)
**Constraints**:
- Must maintain backward compatibility with localStorage during transition
- Must handle guest users (user_id = NULL) similar to alerts
- Must support the existing IndicatorInstance interface
- Must preserve UUID for each indicator instance
**Scale/Scope**:
- Supports unlimited indicators per user (Constitution: Unlimited Alerts Philosophy)
- Typical user: 5-10 indicators
- Heavy users: 50+ indicators (edge case identified in spec)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior - N/A (this feature is data migration only, no UI changes)
- [x] UI changes include before/after verification - N/A (this feature is data migration only, no UI changes)
- [x] Performance budgets: 60fps panning, 3s initial load - N/A (this feature does not affect chart rendering performance)

**Note**: This feature is a data migration/persistence feature only. No visual or UI changes are made to the chart interface. The existing indicator overlay rendering remains unchanged.

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented - **NEW** - All timestamps stored in UTC with timezone-aware datetime objects
- [x] Deduplication strategy: database constraints or idempotent inserts - **NEW** - Composite unique constraint on (user_id, uuid) ensures per-user uniqueness
- [x] Alert semantics: above/below/crosses defined with edge cases tested - N/A (this feature is indicator storage, not alerts)
- [x] Gap handling: explicit marking and backfill strategy - N/A (this feature does not handle gaps)

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count - **NEW** - No arbitrary limits on indicator count per user
- [x] Alert evaluation performance budgeted (500ms) - N/A (indicators are configuration, not evaluation)
- [x] Graceful degradation defined for high alert volumes - **NEW** - Large indicator lists (50+) may affect performance; batch retrieval used to minimize impact

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally - **NEW** - Existing candle cache continues to work
- [x] Offline behavior: charts, alerts, history remain accessible - **NEW** - LocalStorage fallback ensures indicators accessible when DB unavailable (FR-008)
- [x] Provider error handling: graceful degradation with user feedback - **NEW** - API errors fall back to localStorage; visible sync indicator shows pending status

### Testing and Quality Gates

- [ ] Core logic uses TDD (alert engine, indicators, candle normalization) - **NEW TASK** - New merge logic requires TDD approach
- [ ] Bug fixes include regression tests - N/A (new feature, not a bug fix)
- [ ] CI includes: lint, typecheck, unit, integration tests - **NEW TASK** - Tests to be added in Phase 2

### Performance Budgets

- [x] Initial chart load: 3 seconds - N/A (not affected)
- [x] Price update latency: 2 seconds - N/A (not affected)
- [x] Alert evaluation: 500ms - N/A (not affected)
- [x] UI panning: 60fps - N/A (not affected)
- [x] Memory: 500MB for 5 symbols / 20 alerts - **NEW** - Indicator data minimal (<1KB per indicator), well within budget

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern - N/A (existing registry, this feature adds persistence)
- [x] Data providers implement common interface - N/A (not affected)
- [x] Provider-specific logic isolated from UI - N/A (not affected)

### Security & Privacy

- [x] No telemetry or data upload without consent - **VERIFIED** - Indicators stored in user's own database, tied to their Firebase auth
- [x] API keys stored securely (not in repo) - N/A (no new API keys)
- [x] Local data treated as sensitive - **VERIFIED** - localStorage contains indicator configurations; treated as user data

### Governance

- [x] If any principle violated: justification in Complexity Tracking - **NO VIOLATIONS**
- [x] Constitution supersedes spec/plan conflicts - **VERIFIED**

## Project Structure

### Documentation (this feature)

```text
specs/001-indicator-storage/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (to be created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Web application structure
backend/
├── app/
│   ├── models/
│   │   ├── indicator_config.py    # NEW - Database model
│   │   └── ...
│   ├── api/
│   │   └── v1/
│   │       └── indicator_configs.py    # NEW - REST API endpoints
│   └── services/
│       └── merge_util.py         # MODIFY - Add indicator merge support
└── tests/
    └── test_indicator_configs.py  # NEW - API tests

frontend/
├── src/
│   ├── hooks/
│   │   └── useIndicatorInstances.ts    # MAJOR REFACTOR - Switch to API
│   ├── types/
│   │   └── auth.ts          # MODIFY - Add GuestIndicator type
│   └── migrations/
│       └── migrateIndicatorsToCloud.ts  # NEW - One-time migration script
└── tests/
    └── useIndicatorInstances.test.ts  # MODIFY - Update for API mode
```

**Structure Decision**: Web application structure (backend/frontend) confirmed by existing repository layout.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

**No violations** - This feature follows all constitutional principles:

1. **UX Parity** - No UI/visual changes; only data migration
2. **Correctness** - Uses UTC timestamps and database constraints for deduplication
3. **Unlimited Alerts** - No hard caps on indicator count
4. **Local-First** - Maintains localStorage fallback for offline scenarios
5. **Testing** - New merge logic will be test-driven
6. **Performance** - Within all budgets; minimal memory impact
7. **Extensibility** - Follows existing patterns (Alert, UserWatchlist, Layout)
8. **Security** - User's own data, tied to their Firebase auth, no telemetry

---

## Implementation Plan

### Phase 1: Database Schema (Backend)

**File**: `backend/app/models/indicator_config.py` (NEW)

```python
"""Indicator configuration model for user-specific indicator instances.

Stores overlay indicator instances with styling and visibility settings.
Follows the same pattern as Alert, UserWatchlist, and Layout models.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects import postgresql
from app.db.base_class import Base


class IndicatorConfig(Base):
    """User-specific indicator configuration for overlay indicators.

    Stores per-instance indicator settings including:
    - Indicator type (name, category, params)
    - Display name (e.g., "SMA (20)")
    - Visual styling (color, line width, etc.)
    - Visibility state

    Attributes:
        id: Internal database primary key
        user_id: Foreign key to users table (NULL for guest/unassigned configs)
        uuid: Stable identifier for merge operations (per-user unique)
        indicator_name: Indicator name (e.g., 'sma', 'ema', 'tdfi')
        indicator_category: Indicator category ('overlay' or 'oscillator')
        indicator_params: Parameter values as JSON (e.g., {'length': 20})
        display_name: Human-readable display name (e.g., "SMA (20)")
        style: Visual styling configuration as JSON
        is_visible: Visibility state (hide without removing)
        created_at: Config creation timestamp
        updated_at: Last update timestamp (used for merge conflict resolution)

    Merge Rule:
        - Upsert by uuid within user_id scope
        - If uuid exists: update only if new updated_at > existing updated_at + 2 minutes
        - If uuid doesn't exist: insert as new
        - If timestamps within ±2 minutes: keep existing (prefer cloud, deterministic)

    Note: UUID is NOT globally unique - it's unique per user (composite constraint).
    This matches the merge semantics of "upsert by uuid within user_id scope".
    """
    __tablename__ = "indicator_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    # Non-unique UUID (unique per user, not globally)
    uuid = Column(
        postgresql.UUID(as_uuid=True),
        nullable=False,
        default=uuid.uuid4
    )

    # Indicator type definition
    indicator_name = Column(String(50), nullable=False, index=True)  # 'sma', 'ema', 'tdfi', etc.
    indicator_category = Column(String(20), nullable=False)  # 'overlay' or 'oscillator'
    indicator_params = Column(JSON, nullable=False)  # {'length': 20} or {'period': 14}

    # Display and styling
    display_name = Column(String(255), nullable=False)
    style = Column(JSON, nullable=False)  # {color, lineWidth, showLastValue, seriesColors}
    is_visible = Column(Boolean, nullable=False, default=True)

    # Timestamps for merge operations
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Composite unique constraint for (user_id, uuid)
    # This ensures UUID is unique within each user's scope, not globally
    __table_args__ = (
        UniqueConstraint('user_id', 'uuid', name='uq_indicator_config_user_uuid'),
    )

    # No cascade on relationship (use nullable FK + SET NULL instead)
    # This matches Alert, UserWatchlist, Layout patterns
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<IndicatorConfig(id={self.id}, user_id={self.user_id}, name={self.indicator_name})>"
```

**File**: `backend/app/models/__init__.py` (MODIFY)

Add export:
```python
from app.models.indicator_config import IndicatorConfig

__all__ = [
    # ... existing exports ...
    "IndicatorConfig",
]
```

**Database Migration**: Create Alembic migration for new table
```bash
cd /home/marek/DQN/TradingAlert/backend
alembic revision --autogenerate -m "Add indicator_configs table"
```

---

### Phase 2: Backend API (REST Endpoints)

**File**: `backend/app/api/v1/indicator_configs.py` (NEW)

Full implementation in plan with Pydantic schemas and CRUD endpoints.

---

### Phase 3: Merge Support (Guest → Authenticated User)

**File**: `backend/app/services/merge_util.py` (MODIFY)

Add `upsert_indicator_configs()` function following existing patterns for alerts/watchlist.

**File**: `backend/app/api/v1/merge.py` (MODIFY)

Add indicators to merge endpoint and status endpoint.

---

### Phase 4: Frontend Migration

**File**: `frontend/src/hooks/useIndicatorInstances.ts` (MAJOR REFACTOR)

- Switch from localStorage-only to API-first with localStorage fallback
- Maintain backward compatibility for guest users
- Implement optimistic updates with error rollback
- Add retry logic for database unavailability (30-second timeout)

**File**: `frontend/src/types/auth.ts` (MODIFY)

Add GuestIndicator interface and update merge types.

---

### Phase 5: Data Migration Script

**File**: `frontend/src/migrations/migrateIndicatorsToCloud.ts` (NEW - ONE-TIME USE)

Browser console script to migrate existing localStorage indicators to cloud.

---

## Implementation Order

### Step 1: Backend Foundation (1-2 hours) [Delegate: backend-python-implementer]
1. Create `IndicatorConfig` model with composite unique constraint
2. Add export to `backend/app/models/__init__.py`
3. Generate and run Alembic migration
4. Test table creation in PostgreSQL

### Step 2: Backend API (2-3 hours) [Delegate: backend-python-implementer]
1. Create `backend/app/api/v1/indicator_configs.py` with all CRUD endpoints
2. Register router in main app (`backend/app/api/api.py`)
3. Test endpoints with Postman/curl

### Step 3: Merge Support (1-2 hours) [Delegate: backend-python-implementer]
1. Add `upsert_indicator_configs()` to `backend/app/services/merge_util.py`
2. Update `backend/app/api/v1/merge.py` to include indicators
3. Test merge with sample data
4. Write unit tests for merge logic (TDD approach)

### Step 4: Frontend Migration (3-4 hours) [Delegate: frontend-ts-implementer]
1. Update `frontend/src/types/auth.ts` with proper typed interfaces
2. Refactor `frontend/src/hooks/useIndicatorInstances.ts` with proper TypeScript generics
3. Test both authenticated and guest flows
4. Update existing component tests for new hook behavior

### Step 5: Data Migration (1 hour) [Delegate: frontend-ts-implementer]
1. Create `frontend/src/migrations/migrateIndicatorsToCloud.ts`
2. Test migration script in development

### Step 6: Testing & Polish (2-3 hours) [Delegate: code-reviewer-regression-agent, code-reviewer-perf]
1. End-to-end testing
2. Performance testing (verify <2s load, <1s sync)
3. Documentation updates
4. CI integration

**Total Estimated Time**: 10-15 hours

---

## Critical Files for Implementation

### Backend
- **backend/app/models/indicator_config.py** (NEW) - Core database model with composite unique constraint
- **backend/app/models/__init__.py** (MODIFY) - Export IndicatorConfig for Alembic
- **backend/app/api/v1/indicator_configs.py** (NEW) - CRUD API endpoints
- **backend/app/services/merge_util.py** (MODIFY) - Add upsert_indicator_configs
- **backend/app/api/v1/merge.py** (MODIFY) - Add indicators to merge pipeline
- **backend/app/api/api.py** (MODIFY) - Register indicator_configs router

### Frontend
- **frontend/src/hooks/useIndicatorInstances.ts** (MAJOR REFACTOR) - Switch from localStorage to API with proper typing
- **frontend/src/types/auth.ts** (MODIFY) - Add GuestIndicator and update MergeRequest/Response
- **frontend/src/migrations/migrateIndicatorsToCloud.ts** (NEW) - One-time migration script

### Testing
- **backend/tests/test_indicator_configs.py** (NEW) - API endpoint tests
- **backend/tests/test_merge_util.py** (MODIFY) - Add indicator merge tests
- **frontend/src/hooks/useIndicatorInstances.test.ts** (MODIFY) - Update for API mode
