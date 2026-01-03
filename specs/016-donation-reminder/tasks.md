# Tasks: Feedback and Donation Prompts

**Input**: Design documents from `/specs/016-donation-reminder/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD required for core logic (usage time tracking, idle detection, time accumulation, feedback storage). Component tests for prompt display/dismiss behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- This feature is frontend-only: `frontend/src/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Copy TypeScript type definitions to frontend/src/types/donation.ts from specs/016-donation-reminder/contracts/donation.types.ts
- [ ] T002 [P] Create frontend/src/lib/donationConfig.ts with prompt content, UTM params, and thresholds
- [ ] T003 [P] Create frontend/src/components directory placeholder for DonationPrompt, FeedbackModal, FeedbackForm
- [ ] T004 [P] Create frontend/src/hooks directory placeholder for useDonationPrompt, useUsageTimeTracker, useFeedbackForm, useFeedbackStorage
- [ ] T005 [P] Create frontend/tests/hooks and frontend/tests/components directories for test files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Implement UUID generation utility in frontend/src/lib/uuid.ts (for session and feedback IDs)
- [ ] T007 [P] Implement time formatting utility in frontend/src/lib/timeFormat.ts (format ms to "1h 23m" string)
- [ ] T008 [P] Implement localStorage wrapper utilities in frontend/src/lib/storage.ts (get, set, remove with JSON parsing)
- [ ] T009 [P] Create base CSS animation keyframes in frontend/src/styles/animations.css (slideIn, fadeIn, pulse)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First Hour Feedback Request (Priority: P1) 🎯 MVP

**Goal**: Display feedback request prompt after 1 hour of usage with message box for submitting feedback

**Independent Test**: Use app for 60 minutes → feedback prompt appears → click "Leave Feedback" → submit feedback → verify stored in localStorage

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Write test for idle detection in frontend/tests/hooks/useUsageTimeTracker.test.ts (should pause timer after 20min inactivity)
- [ ] T011 [P] [US1] Write test for time accumulation in frontend/tests/hooks/useUsageTimeTracker.test.ts (should track active time correctly)
- [ ] T012 [P] [US1] Write test for 1-hour prompt trigger in frontend/tests/hooks/useDonationPrompt.test.ts (visiblePrompt becomes '1h' at 60min)
- [ ] T013 [P] [US1] Write test for feedback form state management in frontend/tests/hooks/useFeedbackForm.test.ts (validation, submit, cancel)
- [ ] T014 [P] [US1] Write test for feedback storage in frontend/tests/hooks/useFeedbackStorage.test.ts (save, retrieve, export JSON/CSV)
- [ ] T015 [P] [US1] Write test for DonationPrompt component in frontend/tests/components/DonationPrompt.test.tsx (renders, dismiss, action clicks)
- [ ] T016 [P] [US1] Write test for FeedbackModal component in frontend/tests/components/FeedbackModal.test.tsx (form submission, validation)

### Implementation for User Story 1

#### Type Definitions (Complete in T001)
- [ ] T017 [US1] Verify FeedbackSubmission, FeedbackFormState, FeedbackFormProps, FeedbackModalProps interfaces in frontend/src/types/donation.ts

#### Time Tracking Hook
- [ ] T018 [US1] Implement useUsageTimeTracker hook in frontend/src/hooks/useUsageTimeTracker.ts (track session start, active time, idle detection with 20min timeout)
- [ ] T019 [US1] Add localStorage persistence in useUsageTimeTracker.ts (save session start, active time, last activity)
- [ ] T020 [US1] Add idle event listeners in useUsageTimeTracker.ts (mousedown, keydown, scroll, touchstart)
- [ ] T021 [US1] Implement idle timer logic in useUsageTimeTracker.ts (pause accumulation after 20min inactivity, resume on user input)

#### Prompt Display Hook
- [ ] T022 [US1] Implement useDonationPrompt hook in frontend/src/hooks/useDonationPrompt.ts (check thresholds, manage prompt state, track shown/dismissed)
- [ ] T023 [US1] Implement 1-hour threshold check in useDonationPrompt.ts (trigger at 60min active time)
- [ ] T024 [US1] Add prompt state management in useDonationPrompt.ts (visiblePrompt, shownPrompts, dismissedAt)
- [ ] T025 [US1] Implement feedback form state integration in useDonationPrompt.ts (openFeedbackForm, feedbackForm state)
- [ ] T026 [US1] Add dismiss prompt logic in useDonationPrompt.ts (prevent re-appearance in same session)

#### Feedback Storage Hook
- [ ] T027 [US1] Implement useFeedbackStorage hook in frontend/src/hooks/useFeedbackStorage.ts (save, getAll, exportAsJSON, exportAsCSV)
- [ ] T028 [US1] Implement feedback save logic in useFeedbackStorage.ts (store with key `tradingapp_feedback_{uuid}`, update index)
- [ ] T029 [US1] Implement feedback retrieval in useFeedbackStorage.ts (load all entries from index)
- [ ] T030 [US1] Implement JSON export in useFeedbackStorage.ts (format submissions as JSON string)
- [ ] T031 [US1] Implement CSV export in useFeedbackStorage.ts (format as CSV with headers: timestamp, feedback, sessionId, usageTimeMs, email)

#### Feedback Form Hook
- [ ] T032 [US1] Implement useFeedbackForm hook in frontend/src/hooks/useFeedbackForm.ts (form state, validation, submit, cancel)
- [ ] T033 [US1] Add form validation in useFeedbackForm.ts (feedback required 1-5000 chars, email optional but must be valid format)
- [ ] T034 [US1] Implement submitFeedback in useFeedbackForm.ts (generate UUID, create FeedbackSubmission, call useFeedbackStorage.saveFeedback)

#### Prompt Content Configuration
- [ ] T035 [US1] Create 1-hour prompt content in frontend/src/lib/donationConfig.ts (message: "I see you've been using the product for a while now... Does this mean you like it? Do you want to help improve it?")
- [ ] T036 [US1] Add Ko-fi UTM link for 1-hour prompt in donationConfig.ts (?utm_source=tradingapp&utm_medium=prompt&utm_campaign=1h)
- [ ] T037 [US1] Add GitHub issues link option in donationConfig.ts

#### Components
- [ ] T038 [US1] Implement DonationPrompt component in frontend/src/components/DonationPrompt.tsx (render message, Leave Feedback button, GitHub link, dismiss button, Ko-fi link)
- [ ] T039 [US1] Create DonationPrompt styles in frontend/src/components/DonationPrompt.module.css (position fixed, slideIn animation, responsive)
- [ ] T040 [US1] Implement FeedbackModal wrapper in frontend/src/components/FeedbackModal.tsx (modal overlay, close on ESC, focus trap)
- [ ] T041 [US1] Create FeedbackModal styles in frontend/src/components/FeedbackModal.module.css (centered modal, backdrop)
- [ ] T042 [US1] Implement FeedbackForm component in frontend/src/components/FeedbackForm.tsx (textarea, optional email field, submit/cancel buttons, validation errors)
- [ ] T043 [US1] Add keyboard navigation to DonationPrompt.tsx (Escape to dismiss, Tab to cycle through buttons)
- [ ] T044 [US1] Add ARIA live region to DonationPrompt.tsx (role="dialog", aria-labelledby, aria-describedby)

#### Integration
- [ ] T045 [US1] Integrate DonationPrompt and FeedbackModal in App.tsx (use useDonationPrompt hook, render both components)
- [ ] T046 [US1] Wire up Leave Feedback button to openFeedbackForm in App.tsx
- [ ] T047 [US1] Wire up action handlers in DonationPrompt.tsx (feedback action opens form, GitHub/Ko-fi links open in new tab)

**Checkpoint**: At this point, User Story 1 should be fully functional - user sees feedback prompt at 1h, can submit feedback, feedback is stored and retrievable

---

## Phase 4: User Story 2 - Four Hour Donation Prompt (Priority: P2)

**Goal**: Display donation prompt after 4 hours encouraging users to support the project

**Independent Test**: Use app for 240 minutes (4h) → donation prompt appears → verify Ko-fi link with UTM tracking

### Tests for User Story 2

- [ ] T048 [P] [US2] Write test for 4-hour prompt trigger in frontend/tests/hooks/useDonationPrompt.test.ts (visiblePrompt becomes '4h' at 240min)
- [ ] T049 [P] [US2] Write test for 4-hour prompt content in frontend/tests/components/DonationPrompt.test.tsx (verifies donation messaging)

### Implementation for User Story 2

#### Prompt Display Hook Extension
- [ ] T050 [US2] Implement 4-hour threshold check in frontend/src/hooks/useDonationPrompt.ts (trigger at 240min active time)
- [ ] T051 [US2] Add 4-hour prompt content to frontend/src/lib/donationConfig.ts (message: "Wow, you must really like the product! You've been here for 4 hours...")
- [ ] T052 [US2] Add Ko-fi UTM link for 4-hour prompt in donationConfig.ts (?utm_source=tradingapp&utm_medium=prompt&utm_campaign=4h)
- [ ] T053 [US2] Add membership option info to 4-hour prompt content in donationConfig.ts ($5/month membership, real-time data goal)

#### Component Extension
- [ ] T054 [US2] Extend DonationPrompt.tsx to display 4-hour content (Ko-fi link, membership info, enthusiastic messaging)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - 1h shows feedback prompt, 4h shows donation prompt

---

## Phase 5: User Story 3 - Animated Non-Intrusive Design (Priority: P1)

**Goal**: Prompts use subtle animation to attract attention without disrupting trading workflow

**Independent Test**: Observe prompt behavior - animation is visible but not jarring, chart remains responsive at 60fps, dismiss works

### Tests for User Story 3

- [ ] T055 [P] [US3] Write test for animation performance in frontend/tests/components/DonationPrompt.test.tsx (verify no main thread blocking)

### Implementation for User Story 3

#### CSS Animations
- [ ] T056 [P] [US3] Implement slideIn keyframe animation in frontend/src/styles/animations.css (translateY 20px → 0, opacity 0 → 1, 300ms ease-out)
- [ ] T057 [P] [US3] Implement fadeIn keyframe animation in animations.css (opacity 0 → 1, 200ms)
- [ ] T058 [P] [US3] Implement pulse keyframe animation in animations.css (scale 1.0 → 1.02 → 1.0, 3s duration)
- [ ] T059 [P] [US3] Implement fadeOut animation in animations.css (opacity 1 → 0, 200ms ease-in)

#### Component Styling
- [ ] T060 [US3] Apply animations to DonationPrompt.module.css (slideIn on enter, fadeOut on dismiss)
- [ ] T061 [US3] Add pulse animation to DonationPrompt.module.css (subtle attention-grabbing after 3s)
- [ ] T062 [US3] Ensure animations use CSS transforms in DonationPrompt.module.css (GPU-accelerated: transform, opacity)
- [ ] T063 [US3] Add responsive positioning to DonationPrompt.module.css (bottom-right on desktop, bottom-center on mobile)
- [ ] T064 [US3] Add z-index management to DonationPrompt.module.css (ensure prompt appears above chart but below modals)
- [ ] T065 [US3] Add reduced motion support to DonationPrompt.tsx (respect prefers-reduced-motion media query)

**Checkpoint**: Animations are subtle, performant, and non-disruptive

---

## Phase 6: User Story 4 - Supporter Appreciation Prompts (Priority: P3)

**Goal**: Existing members/donors see appreciation prompts with non-monetary help suggestions

**Independent Test**: Set membership status to 'member', use app for 1h and 4h → verify appreciation prompts with gratitude messaging (no donation requests)

### Tests for User Story 4

- [ ] T066 [P] [US4] Write test for supporter variant rendering in frontend/tests/components/DonationPrompt.test.tsx (verifies appreciation content)

### Implementation for User Story 4

#### Membership Status Management
- [ ] T067 [US4] Implement membership status persistence in frontend/src/hooks/useDonationPrompt.ts (read from localStorage key 'tradingapp_member_status')
- [ ] T068 [US4] Implement setMembershipStatus function in useDonationPrompt.ts (write to localStorage, trigger re-render)
- [ ] T069 [US4] Add membership status detection logic in useDonationPrompt.ts (check if user is 'supporter' or 'member')

#### Prompt Content Variants
- [ ] T070 [P] [US4] Create supporter variant for 1-hour prompt in donationConfig.ts (message: "Thanks for being a supporter! Since you've been here for an hour...", actions: Share Feedback, Report Bug, Spread the Word)
- [ ] T071 [P] [US4] Create supporter variant for 4-hour prompt in donationConfig.ts (message: "You're amazing! 4 hours of usage and you're already a supporter...", actions: Share Feedback, Report Bug)

#### Component Logic
- [ ] T072 [US4] Extend DonationPrompt.tsx to render supporter variant when membershipStatus is 'supporter' or 'member'
- [ ] T073 [US4] Remove Ko-fi link from supporter variant rendering in DonationPrompt.tsx (no direct donation requests)
- [ ] T074 [US4] Add support for custom actions in DonationPrompt.tsx (handle 'github', 'feedback', 'share' actions)

**Checkpoint**: Existing supporters see appreciation prompts without donation requests

---

## Phase 7: User Story 5 - Feedback Collection and Retrieval (Priority: P1)

**Goal**: Feedback is stored with metadata and developer can retrieve/export all submissions

**Independent Test**: Submit feedback through form → verify stored in localStorage → use retrieval mechanism → export as JSON and CSV

### Tests for User Story 5

> Tests already created in US1 Phase (T014), extend if needed:
- [ ] T075 [P] [US5] Write test for feedback persistence across sessions in frontend/tests/hooks/useFeedbackStorage.test.ts (feedback survives browser close)

### Implementation for User Story 5

#### Storage Implementation (Complete in US1 Phase)
- [ ] T076 [US5] Verify localStorage schema implementation in useFeedbackStorage.ts (keys: tradingapp_feedback_{uuid}, tradingapp_feedback_index)
- [ ] T077 [US5] Verify feedback metadata in FeedbackSubmission interface (id, feedback, timestamp, sessionId, usageTimeMs, contactEmail, promptType)

#### Retrieval Interface
- [ ] T078 [US5] Create feedback admin utility in frontend/src/lib/feedbackAdmin.ts (getAllFeedback, exportAsJSON, exportAsCSV wrapper functions)
- [ ] T079 [US5] Add console-based retrieval helper in feedbackAdmin.ts (debug function for quick localStorage inspection)

**Checkpoint**: Feedback collection and retrieval fully functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T080 [P] Add accessibility compliance audit in DonationPrompt.tsx and FeedbackModal.tsx (verify ARIA labels, keyboard nav, screen reader)
- [ ] T081 [P] Add responsive design testing in DonationPrompt.module.css and FeedbackModal.module.css (test on mobile, tablet, desktop breakpoints)
- [ ] T082 [P] Run performance profiler on time tracking in useUsageTimeTracker.ts (verify <1MB memory, no main thread blocking)
- [ ] T083 [P] Validate all UTM parameters in donationConfig.ts (verify 1h and 4h campaigns)
- [ ] T084 [P] Add visual verification checklist per Constitution §IX (create screenshots/video of prompt animations)
- [ ] T085 [P] Test prompts at different time thresholds manually (verify 60min and 240min triggers work correctly)
- [ ] T086 [P] Test idle detection behavior manually (verify timer pauses after 20min inactivity, resumes on input)
- [ ] T087 [P] Test feedback submission and export manually (submit feedback, export as JSON/CSV, verify data integrity)
- [ ] T088 [P] Add error boundaries around DonationPrompt and FeedbackModal components in App.tsx
- [ ] T089 [P] Verify offline behavior (ensure prompts work when offline, Ko-fi links fail gracefully)
- [ ] T090 [P] Run ESLint and TypeScript typecheck on all new files
- [ ] T091 [P] Run vitest test suite and verify all tests pass
- [ ] T092 Validate quickstart.md examples (ensure integration code works as documented)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User Story 1 (P1), User Story 3 (P1), User Story 5 (P1): Can run in parallel (all P1)
  - User Story 2 (P2): Can run in parallel with US1/US3/US5
  - User Story 4 (P3): Can run in parallel (depends on membership status logic from US1)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends useDonationPrompt.ts from US1 but independently testable
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - CSS-only changes, extends styles from US1
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Extends DonationPrompt.tsx and donationConfig.ts from US1
- **User Story 5 (P1)**: Can start after Foundational (Phase 2) - Uses useFeedbackStorage.ts from US1, but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Type definitions (T001) before any TypeScript files
- Utility functions (T006-T009) before hooks that use them
- Hooks before components
- Core implementation before integration

### Parallel Opportunities

#### Setup Phase (Phase 1)
- T002, T003, T004, T005 can run in parallel (different directories)

#### Foundational Phase (Phase 2)
- T006, T007, T008, T009 can run in parallel (independent utilities)

#### User Story 1 Tests (Phase 3)
- T010, T011, T012, T013, T014 can run in parallel (different test files)
- T015, T016 can run in parallel (component tests)

#### User Story 1 Implementation
- T018 (useUsageTimeTracker) and T022 (useDonationPrompt hooks) can run in parallel
- T027 (useFeedbackStorage) and T032 (useFeedbackForm hooks) can run in parallel
- T038 (DonationPrompt) and T040 (FeedbackModal) components can run in parallel

#### User Stories 1, 3, 5 (All P1)
- Once Foundational phase completes, all three P1 stories can run in parallel by different developers

#### All Polish Tasks
- T080-T092 can mostly run in parallel (independent concerns)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together (after hook implementations exist):
Task T010: "Write test for idle detection in frontend/tests/hooks/useUsageTimeTracker.test.ts"
Task T011: "Write test for time accumulation in frontend/tests/hooks/useUsageTimeTracker.test.ts"
Task T012: "Write test for 1-hour prompt trigger in frontend/tests/hooks/useDonationPrompt.test.ts"
Task T013: "Write test for feedback form state management in frontend/tests/hooks/useFeedbackForm.test.ts"
Task T014: "Write test for feedback storage in frontend/tests/hooks/useFeedbackStorage.test.ts"
Task T015: "Write test for DonationPrompt component in frontend/tests/components/DonationPrompt.test.tsx"
Task T016: "Write test for FeedbackModal component in frontend/tests/components/FeedbackModal.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Feedback Request + Collection)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Use app for 60 minutes (or set active_time_ms in localStorage)
   - Verify feedback prompt appears
   - Submit feedback through form
   - Export feedback as JSON/CSV
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: feedback prompts working!)
3. Add User Story 2 → Test independently → Deploy/Demo (donation prompts at 4h)
4. Add User Story 3 → Test independently → Deploy/Demo (animations polished)
5. Add User Story 4 → Test independently → Deploy/Demo (supporter variants)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Feedback Request + Collection)
   - Developer B: User Story 3 (Animated Design - can work in parallel, CSS-focused)
   - Developer C: User Story 5 (Feedback Retrieval - extends US1 storage)
3. After US1 complete:
   - Developer A: User Story 2 (4h Donation Prompt)
   - Developer B: User Story 4 (Supporter Appreciation)

---

## Summary

- **Total Tasks**: 92
- **Tasks per User Story**:
  - User Story 1 (P1): 37 tasks
  - User Story 2 (P2): 7 tasks
  - User Story 3 (P1): 10 tasks
  - User Story 4 (P3): 8 tasks
  - User Story 5 (P1): 4 tasks (mostly complete in US1)
  - Setup + Foundational: 10 tasks
  - Polish: 13 tasks
- **Parallel Opportunities Identified**: 20+ tasks marked [P] can run in parallel
- **Independent Test Criteria**: Each user story has clear independent test criteria
- **Suggested MVP Scope**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1) = 56 tasks
  - MVP delivers: Time tracking, 1-hour feedback prompt, message box, feedback storage/retrieval

### Format Validation

✅ ALL tasks follow the checklist format:
- Checkbox: `- [ ]`
- Task ID: T001-T092
- [P] marker: Included for parallelizable tasks
- [Story] label: Included for all user story phase tasks
- File paths: Specified for all implementation tasks
