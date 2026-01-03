# Implementation Plan: Donation Reminder Prompts

**Branch**: `016-donation-reminder` | **Date**: 2025-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-donation-reminder/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Display animated feedback and donation reminder prompts after 1 hour and 4 hours of active usage. The 1-hour prompt asks users if they like the product and invites feedback through a message box. The 4-hour prompt encourages engaged users to support the project via Ko-fi donations or membership. Features include UTM tracking for conversion analytics, personal/conversational messaging, different content for existing supporters (appreciation vs. donation request), and a feedback collection mechanism with localStorage storage and export functionality. Technical approach: Frontend-only implementation using React hooks for usage time tracking with idle detection (15-30 min timeout), toast/modal components for prompts, CSS animations for "flashy" but non-intrusive presentation, and localStorage for session state and feedback storage.

## Technical Context

**Language/Version**: TypeScript 5.9+ (frontend), React 19
**Primary Dependencies**: React hooks (useEffect, useRef, useCallback), Framer Motion or CSS animations for animation, react-hot-toast or similar for toast display (NEEDS CLARIFICATION: preferred toast library)
**Storage**: localStorage for session state (no backend changes per spec assumptions)
**Testing**: vitest for unit tests, React Testing Library for component tests
**Target Platform**: Web browser (desktop and mobile responsive)
**Project Type**: web (frontend + backend)
**Performance Goals**: Prompts must not block main thread or interfere with chart rendering (60fps panning)
**Constraints**: No backend changes; idle detection timeout 15-30 minutes; prompts must be dismissible in <2 seconds
**Scale/Scope**: All users of the application; prompts appear once per session per threshold

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] N/A - This feature adds donation prompts, not chart interactions
- [ ] UI changes (prompts) include visual verification per Constitution §IX (Visual Addition Verification)
- [ ] Prompts must not interfere with 60fps panning requirement

### Correctness Over Cleverness

- [x] N/A - No market data or alert semantics involved
- [ ] Usage time tracking must be deterministic and testable

### Unlimited Alerts Philosophy

- [x] N/A - Feature does not involve alerts

### Local-First and Offline-Tolerant

- [x] Compliant - Uses localStorage, works offline
- [ ] Prompts must appear even when offline (Ko-fi link will fail gracefully)

### Testing and Quality Gates

- [ ] Usage time tracking logic requires TDD (idle detection, time accumulation)
- [ ] Component tests for prompt display/dismiss behavior
- [ ] CI: existing lint, typecheck, tests

### Performance Budgets

- [ ] Prompts must not block main thread or degrade 60fps panning
- [ ] Prompt animation must be performant (CSS transform > JS animation)
- [ ] Memory impact of tracking must be minimal (<1MB)

### Architecture for Extensibility

- [x] N/A - Feature is self-contained UI component
- [ ] Consider if prompt content should be configurable (future extensibility)

### Security & Privacy

- [x] Compliant - No telemetry, all data local
- [ ] UTM parameters are only appended to external links (no tracking on your side)
- [ ] Usage time data stored locally in browser

### Governance

- [x] No violations identified

**Status**: ✅ PASS - Feature is compliant with constitution. Requires visual verification per §IX for prompt UI/animations.

## Project Structure

### Documentation (this feature)

```text
specs/016-donation-reminder/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (frontend + backend)
backend/
# No changes required for this feature

frontend/
├── src/
│   ├── components/
│   │   ├── DonationPrompt.tsx           # New: Main prompt component
│   │   ├── DonationPrompt.module.css    # New: Prompt styles and animations
│   │   ├── FeedbackModal.tsx            # New: Feedback modal wrapper
│   │   ├── FeedbackForm.tsx             # New: Feedback form component
│   │   └── FeedbackModal.module.css     # New: Modal styles
│   ├── hooks/
│   │   ├── useDonationPrompt.ts         # New: Hook managing prompt display logic
│   │   ├── useUsageTimeTracker.ts       # New: Hook for usage time tracking with idle detection
│   │   ├── useFeedbackForm.ts           # New: Hook for feedback form state
│   │   └── useFeedbackStorage.ts        # New: Hook for feedback storage/retrieval
│   ├── lib/
│   │   └── donationConfig.ts            # New: Prompt content, UTM params, thresholds
│   └── types/
│       └── donation.ts                  # New: TypeScript interfaces for prompts and feedback
└── tests/
    ├── hooks/
    │   ├── useUsageTimeTracker.test.ts  # New: Test idle detection logic
    │   ├── useDonationPrompt.test.ts    # New: Test prompt display logic
    │   ├── useFeedbackForm.test.ts      # New: Test feedback form logic
    │   └── useFeedbackStorage.test.ts   # New: Test feedback storage/retrieval
    └── components/
        ├── DonationPrompt.test.tsx      # New: Test prompt component behavior
        └── FeedbackModal.test.tsx       # New: Test feedback modal behavior
```

**Structure Decision**: Web application structure selected (frontend + backend detected). This feature is frontend-only with no backend changes per spec assumptions. Components follow existing patterns in `/frontend/src/components/`. Custom hooks follow existing patterns in `/frontend/src/hooks/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
