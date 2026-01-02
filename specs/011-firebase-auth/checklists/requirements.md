# Specification Quality Checklist: Firebase Authentication

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2025-12-29
**Feature**: [spec.md](../spec.md)
**Last Updated**: 2025-12-30 (final clarity + consistency improvements)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified and have resolution strategies
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

All checklist items passed. The specification is complete and ready for implementation.

**User Preferences Clarified:**
- Authentication methods: Email + Google OAuth (P1)
- Guest access: Allow users to browse without signing in (P1)
- Data migration: Merge localStorage data with cloud data on sign-in (P1)

**Clarifications Added (2025-12-30):**
- **Story 1 #2/#4**: Auto-sign-in happens ONLY via Firebase's email verification link flow, not password login; explicitly blocks "temporary session" workarounds
- **FR-005a**: Email verification enforced on BOTH client and backend (dual enforcement)
- **FR-010**: Deterministic tiebreaker for equal timestamps with defined tolerance constant `MERGE_TIMESTAMP_TOLERANCE_MS` (±2 minutes, prefer cloud)
- **FR-013a**: Shared merge/upsert utility (no per-entity reimplementation)
- **FR-008a**: LocalStorage schema versioning with automatic migrations
- **FR-016**: Token refresh failure behavior (switch to guest mode, preserve local data)
- **FR-035a**: Single shared auth middleware with route enumeration test; per-route enforcement PROHIBITED
- **User Story 7 #4**: Guest data persists during multi-step provider linking flow
- **Edge Cases Resolved**: Clock skew (via tolerance constant), old localStorage schema (via migrations)
- **Assumptions Added**: Shared utilities requirement, localStorage schema migrations

**Consistency Improvements (2025-12-30):**
- **data-model.md**: All entity Merge Rules now use identical timestamp comparison wording: "If guest.updated_at > cloud.updated_at + 2 minutes: update; If within ±2 min: keep existing (prefer cloud)"
- **data-model.md**: Watchlist special case explicitly references shared `should_update()` tolerance logic (single source of truth)
- **backend-api.yaml**: Added explicit documentation that shared middleware uniformly enforces email_verified check; per-route enforcement prohibited
- **research.md**: Shared merge utility pseudocode is single source of truth for all entities (alerts, watchlists, layouts)

**Key User Stories:**
1. Email and Password Registration (P1)
2. Google OAuth Sign-In (P1)
3. Guest Access with Optional Sign-In (P1)
4. Password Reset (P2)
5. Sign Out (P2)
6. Cross-Device Data Sync (P2)
7. Provider Linking (P2)
