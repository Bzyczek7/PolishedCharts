# Requirements Checklist: 001-initial-setup

**Purpose**: Ensure requirements are complete, testable, and ready for planning/implementation.
**Created**: 2025-12-23
**Updated**: 2025-12-23
**Feature**: [spec.md](../spec.md)

## 1) Document hygiene

- [x] File paths and links are correct (spec.md and any referenced docs exist).
- [x] Terminology is consistent (symbol, interval, candle, alert, trigger, indicator).
- [x] Requirement IDs are unique and stable (FR-xxx, NFR-xxx).
- [x] No contradictory statements across sections (goals, non-goals, scope, requirements).
- [x] No TODO / TBD / NEEDS CLARIFICATION markers remain.

## 2) Scope & boundaries

- [x] "In scope" items are explicitly listed and match the Acceptance Criteria.
- [x] "Out of scope" items are explicitly listed and do not appear elsewhere as requirements.
- [x] Assumptions are listed and have an owner/plan if they prove false.
- [x] External dependencies are identified (data provider availability, rate limits, licensing constraints).
- [x] Offline behavior is explicitly defined (what works, what degrades, what fails).

## 3) User stories coverage

- [x] Each user story has at least 1 acceptance scenario.
- [x] Acceptance scenarios cover primary flows end-to-end (happy path).
- [x] Edge cases have expected outcomes (not just questions).
- [x] Multi-symbol behavior is defined (isolation, resource limits, UI expectations).
- [x] Restart/persistence behavior is defined (alerts, triggers, cached candles).

## 4) Requirement quality gates

For each FR/NFR:

- [x] Singular: expresses one idea (not "A and B").
- [x] Unambiguous: avoids vague terms ("fast", "smooth", "reliable") unless quantified.
- [x] Testable: can be verified by automated test, manual test, or measurement procedure.
- [x] Bounded: defines limits/thresholds (time, memory, counts, intervals, retention).
- [x] Implementation-agnostic: does not mandate specific frameworks/libraries/vendors.
- [x] Priority is stated (P0/P1/P2) or implicitly mapped to user-story priority.

## 5) Traceability (must-have)

- [x] Mapping exists: User Story → Acceptance Scenario(s) → FR/NFR.
- [x] Mapping exists: FR/NFR → Test(s) (unit/integration/e2e/manual). **See tasks.md: T016-T080 map to FR/NFRs**
- [x] Each acceptance scenario references which FR/NFR it validates. **See spec.md User Scenarios section**
- [x] Each FR/NFR is validated by at least one acceptance scenario or explicit test case. **See tasks.md test tasks T016-T044**
- [x] "Unlimited alerts" is clarified into measurable limits (e.g., "no app-imposed cap; bounded by system resources") and tested accordingly. **See FR-007 and test T041**

## 6) Performance & load requirements

- [x] Metrics have clear measurement method (how measured, where measured, with what dataset).
- [x] Load profile is defined (symbols tracked, candle counts, alert counts, update frequency).
- [x] Baseline datasets are defined for testing (e.g., 10k candles, 100 alerts).
- [x] Degradation behavior is defined (what happens when limits exceeded). **See spec.md Edge cases: "1000+ alerts - evaluation may be delayed"**
- [x] Rate-limiting expectations are testable (backoff behavior, retry policy, error surfacing). **See spec.md FR-014 + tasks T019/T020/T024/T025**

## 7) Data integrity & time rules

- [x] Candle timestamp rules are defined (timezone, exchange time, UTC normalization). **See spec.md Clarifications: "Store all timestamps in UTC" + data-model.md**
- [x] Duplicate/out-of-order update handling is defined (ignore/merge/reorder). **See data-model.md: idempotent inserts via ON CONFLICT DO UPDATE**
- [x] Gap filling rules are defined (backfill strategy and "gap markers").
- [x] Cache invalidation rules are defined (refresh windows, retention, re-fetch behavior). **See spec.md FR-004, FR-005, research.md caching strategy**
- [x] Alert "crosses" semantics are defined precisely (previous price vs current price vs candle close). **See spec.md Clarifications: crosses-up/crosses-down semantics**

## 8) Persistence requirements

- [x] Persistence scope is explicit (alerts, triggers, cached candles, settings).
- [x] Migration strategy is acknowledged (schema evolution without data loss where feasible).
- [x] Data retention policies are defined (how long triggers/candles kept, if configurable). **See data-model.md: "Retain alert triggers for 90 days by default"**
- [x] Backup/export expectations are defined (optional for this feature, but state it).

## 9) Packaging & operational constraints

- [x] Supported OS targets are stated or explicitly deferred. **See plan.md: "Local web app" - platform-agnostic**
- [x] "Single command to run" is defined (what command, what it starts).
- [x] Logging expectations are defined (where logs go, minimum useful fields). **See plan.md Phase 7: "structured logging throughout backend"**
- [x] Error UX expectations are defined (provider down, offline, invalid symbol, etc.). **See spec.md Edge cases with defined expected outcomes**

## 10) Open questions closure (blocker)

- [x] Initial market choice decided (crypto vs equities vs forex). **US Equities - see spec.md Clarifications**
- [x] Notification modality decided (in-app only vs desktop notifications). **In-app only - see spec.md Clarifications**
- [x] Packaging approach decided (local web app vs desktop wrapper). **Pure local web app - see spec.md Clarifications**
- [x] Decision record updated in the spec (or linked ADR) for each closed question. **All decisions recorded in spec.md Clarifications section**

## Notes

- All checklist items are now complete based on spec.md, data-model.md, plan.md, research.md, and tasks.md
- Traceability matrix exists in tasks.md (test tasks T016-T044 map to all FR/NFRs)
- Open questions resolved in spec.md Session 2025-12-23 clarifications
