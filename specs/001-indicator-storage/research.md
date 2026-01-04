# Research: Indicator Database Storage

**Feature**: Indicator Database Storage
**Date**: 2025-01-04
**Status**: Complete

## Overview

This document consolidates research findings for migrating indicator configurations from browser localStorage to PostgreSQL database. All technical decisions follow existing patterns in the codebase (Alert, UserWatchlist, Layout models).

---

## 1. Database Schema Design

### Decision: Composite Unique Constraint on (user_id, uuid)

**Rationale**:
- UUID must be unique per user for merge operations, not globally unique
- Matches Alert model pattern: `uuid` is globally unique for alerts, but indicators need per-user uniqueness
- Guest users have `user_id = NULL`, allowing multiple guest sessions to have same UUIDs
- Composite constraint prevents duplicate UUIDs within the same user's scope

**Alternatives Considered**:
1. **Globally unique UUID** (Alert pattern): Rejected because indicators are user-scoped data, not shared entities
2. **Single column on `uuid` only**: Rejected because would prevent guest users from having same UUIDs
3. **No UUID, use auto-increment ID**: Rejected because merge operations require stable identifiers

**Implementation Details**:
```python
__table_args__ = (
    UniqueConstraint('user_id', 'uuid', name='uq_indicator_config_user_uuid'),
)
```

---

## 2. Merge Strategy

### Decision: Upsert-by-UUID with Timestamp-Based Conflict Resolution

**Rationale**:
- Guest → Authenticated user transition requires merging localStorage indicators into database
- Timestamp-based resolution (2-minute buffer) prevents race conditions from concurrent updates
- Follows existing merge_util.py patterns for alerts and watchlist

**Merge Rule**:
1. If `uuid` doesn't exist in database: Insert as new
2. If `uuid` exists and `new.updated_at > existing.updated_at + 2 minutes`: Update
3. If `uuid` exists and timestamps within ±2 minutes: Keep existing (prefer cloud, deterministic)

**Alternatives Considered**:
1. **Last write wins (no timestamp check)**: Rejected because concurrent edits could cause data loss
2. **Manual conflict resolution**: Rejected because poor UX for indicator configurations
3. **Version vectors**: Rejected because overkill for simple config data

---

## 3. API Design

### Decision: REST CRUD Endpoints with Batch Support

**Rationale**:
- REST pattern matches existing API endpoints (alerts, watchlist, indicators)
- Batch endpoint (`GET /api/v1/indicator-configs`) retrieves all user indicators in one request
- Individual endpoints support single-indicator CRUD operations

**Endpoints**:
- `GET /api/v1/indicator-configs` - Retrieve all indicators for authenticated user
- `POST /api/v1/indicator-configs` - Create new indicator
- `PUT /api/v1/indicator-configs/{uuid}` - Update existing indicator
- `DELETE /api/v1/indicator-configs/{uuid}` - Delete indicator

**Alternatives Considered**:
1. **GraphQL**: Rejected because not used elsewhere in codebase; adds complexity
2. **WebSocket for real-time sync**: Rejected because indicators change infrequently; polling sufficient
3. **Single batch endpoint only**: Rejected because individual operations needed for CRUD

---

## 4. Frontend Migration Strategy

### Decision: API-First with LocalStorage Fallback

**Rationale**:
- Primary data source is API for authenticated users
- LocalStorage acts as cache and fallback for offline scenarios (FR-008)
- Optimistic updates provide responsive UI
- 30-second retry with backoff handles temporary database unavailability

**Data Flow**:
1. **Load indicators**: Try API → fallback to localStorage if error
2. **Create/Update/Delete**: Optimistic UI update → API call → rollback on error
3. **Guest mode**: localStorage only (no API calls)
4. **Merge**: On sign-in, merge localStorage indicators with database

**Alternatives Considered**:
1. **LocalStorage only**: Rejected because doesn't solve multi-device problem
2. **API only (no fallback)**: Rejected because violates Local-First constitution principle
3. **Service Worker with IndexedDB**: Rejected because overkill for small dataset (<1KB per indicator)

---

## 5. Timestamp Handling

### Decision: UTC with Timezone-Aware DateTime Objects

**Rationale**:
- Follows Correctness Over Cleverness constitutional principle
- Matches existing Alert and UserWatchlist models
- SQLAlchemy `DateTime(timezone=True)` ensures timezone-aware storage
- PostgreSQL `TIMESTAMP WITH TIME ZONE` stores in UTC

**Implementation**:
```python
from datetime import datetime, timezone

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
```

---

## 6. Performance Considerations

### Decision: No Pagination for Indicator Retrieval

**Rationale**:
- Typical user: 5-10 indicators (<10KB data)
- Heavy users: 50+ indicators (<50KB data)
- Batch retrieval is faster than pagination for small datasets
- Meets SC-003: <1 second sync for typical configs

**Alternatives Considered**:
1. **Pagination (page-based)**: Rejected because adds complexity without benefit
2. **Cursor-based pagination**: Rejected because overkill for small dataset
3. **Lazy loading**: Rejected because all indicators needed for rendering

---

## 7. Data Validation

### Decision: Pydantic Schemas for Request/Response Validation

**Rationale**:
- FastAPI uses Pydantic for automatic request validation
- Type safety prevents invalid data from reaching database
- Matches existing API patterns (alerts, watchlist)

**Schema Fields**:
- `indicator_name`: Enum of valid indicator names (sma, ema, tdfi, etc.)
- `indicator_category`: Enum ('overlay', 'oscillator')
- `indicator_params`: Dict with parameter validation
- `display_name`: String with max length 255
- `style`: Dict with color/lineWidth validation
- `is_visible`: Boolean

---

## 8. Guest User Handling

### Decision: user_id = NULL for Guest Indicators

**Rationale**:
- Matches Alert model pattern (guest alerts have `user_id = NULL`)
- Allows guest indicators to exist in database temporarily
- Merge operation assigns `user_id` when guest signs in
- Composite unique constraint allows duplicate UUIDs when `user_id = NULL`

**Alternatives Considered**:
1. **Separate guest_indicators table**: Rejected because adds unnecessary complexity
2. **Anonymous user accounts**: Rejected because bloats users table
3. **LocalStorage only for guests**: Rejected because doesn't support guest → authenticated transition

---

## 9. Account Deletion

### Decision: Hard Delete (CASCADE via User Deletion)

**Rationale**:
- GDPR compliance: user has right to be forgotten
- Data minimization: no retention of user's indicator configurations
- Matches Alert behavior: indicators are orphaned (user_id set to NULL) when user deleted
- SET NULL on foreign key means indicators remain but are unowned

**Implementation**:
```python
user_id = Column(
    Integer,
    ForeignKey("users.id", ondelete="SET NULL"),
    nullable=True,
    index=True
)
```

---

## 10. Testing Strategy

### Decision: TDD for Merge Logic

**Rationale**:
- Merge logic is critical for data integrity (SC-004: 100% success rate)
- Constitution requires TDD for core logic
- Test cases must cover:
  - Guest → authenticated merge (new user)
  - Guest → authenticated merge (existing user with indicators)
  - Concurrent edit conflict resolution
  - Timestamp edge cases (exactly 2 minutes apart)

**Alternatives Considered**:
1. **Manual testing only**: Rejected because doesn't prevent regressions
2. **Integration tests only**: Rejected because slow feedback loop
3. **Property-based testing**: Rejected because overkill for simple merge logic

---

## Summary

All research decisions align with existing codebase patterns and constitutional principles. The implementation follows the Alert/UserWatchlist/Layout models closely, ensuring consistency and maintainability.

**Key Risks Mitigated**:
1. **Data loss during merge**: Timestamp-based resolution with 2-minute buffer
2. **Offline scenarios**: LocalStorage fallback with retry logic
3. **Guest transitions**: Composite unique constraint allows NULL user_id
4. **Performance**: Batch retrieval without pagination for small datasets
5. **GDPR compliance**: Hard delete on user account deletion

**Next Steps**: Proceed to Phase 1 (data-model.md, contracts/, quickstart.md)
