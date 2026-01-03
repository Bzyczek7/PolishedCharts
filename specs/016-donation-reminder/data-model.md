# Data Model: Feedback and Donation Prompts

**Feature**: 016-donation-reminder
**Date**: 2025-01-03
**Phase**: 1 - Design

## Overview

This document defines the TypeScript interfaces, state structures, and data flow for the feedback collection and donation reminder prompt system. All data is stored client-side in localStorage per the "no backend changes" assumption.

**Key Changes from Original Spec**:
- 1-hour prompt is now **feedback-focused** (asks if user likes the product, invites suggestions)
- 4-hour prompt remains **donation-focused** (asks for Ko-fi support)
- New **feedback collection mechanism** with message box/modal and localStorage storage

---

## Core Interfaces

### UsageSession

Represents a user's active usage session with time tracking.

```typescript
interface UsageSession {
  /** Session start timestamp (Unix ms) */
  startTime: number;

  /** Accumulated active time in milliseconds */
  activeTimeMs: number;

  /** Last activity timestamp (for idle detection) */
  lastActivity: number;

  /** Whether session is currently idle */
  isIdle: boolean;

  /** Session ID (unique per browser tab session) */
  sessionId: string;
}
```

**State transitions**:
```
[START] → Active → Idle (after 20min inactivity) → Active (on user input)
          ↓                                            ↓
      [TRACK TIME]                               [RESUME TRACKING]
```

**Validation rules**:
- `startTime` must be > 0
- `activeTimeMs` must be >= 0
- `lastActivity` must be >= `startTime`
- `isIdle` must be true if `(Date.now() - lastActivity) > 20 minutes`

---

### PromptState

Represents the display state of donation prompts.

```typescript
interface PromptState {
  /** Which prompts have been shown this session */
  shownPrompts: PromptType[];

  /** Timestamps when prompts were dismissed */
  dismissedAt: Map<PromptType, number>;

  /** Currently visible prompt (if any) */
  visiblePrompt: PromptType | null;
}

type PromptType = '1h' | '4h';
```

**State transitions**:
```
[SESSION START] → shownPrompts = []
      ↓
[REACH 1h THRESHOLD] → shownPrompts = ['1h'], visiblePrompt = '1h'
      ↓
[USER DISMISSES] → dismissedAt['1h'] = timestamp, visiblePrompt = null
      ↓
[REACH 4h THRESHOLD] → shownPrompts = ['1h', '4h'], visiblePrompt = '4h'
      ↓
[USER DISMISSES] → dismissedAt['4h'] = timestamp, visiblePrompt = null
```

**Validation rules**:
- `shownPrompts` must contain unique values (no duplicates)
- `dismissedAt` keys must be subset of `shownPrompts`
- `visiblePrompt` must be in `shownPrompts` or `null`

---

### PromptContent

Represents the content and configuration for a prompt.

```typescript
interface PromptContent {
  /** Type of prompt */
  type: PromptType;

  /** Threshold in minutes before showing */
  thresholdMinutes: number;

  /** Main message text (personal/conversational tone) */
  message: string;

  /** Ko-fi URL with UTM parameters */
  koFiUrl: string;

  /** For supporters: alternative content */
  supporterVariant?: {
    message: string;
    actions: SupporterAction[];
  };
}

interface SupporterAction {
  label: string;
  url?: string;
  action?: 'github' | 'feedback' | 'share';
}
```

**Examples**:

```typescript
const ONE_HOUR_PROMPT: PromptContent = {
  type: '1h',
  thresholdMinutes: 60,
  message: "I see you've been using the product for a while now... Does this mean you like it? Do you want to help improve it?",
  koFiUrl: 'https://ko-fi.com/marekdabrowski?utm_source=tradingapp&utm_medium=prompt&utm_campaign=1h',
  supporterVariant: {
    message: "Thanks for being a supporter! Since you've been here for an hour...",
    actions: [
      { label: 'Share Feedback', action: 'feedback' },
      { label: 'Report a Bug', action: 'github' },
      { label: 'Spread the Word', action: 'share' }
    ]
  }
};

const FOUR_HOUR_PROMPT: PromptContent = {
  type: '4h',
  thresholdMinutes: 240,
  message: "Wow, you must really like the product! You've been here for 4 hours...",
  koFiUrl: 'https://ko-fi.com/marekdabrowski?utm_source=tradingapp&utm_medium=prompt&utm_campaign=4h',
  supporterVariant: {
    message: "You're amazing! 4 hours of usage and you're already a supporter...",
    actions: [
      { label: 'Share Feedback', action: 'feedback' },
      { label: 'Report a Bug', action: 'github' }
    ]
  }
};
```

---

### UserMembershipStatus

Represents the user's membership/support status.

```typescript
type MembershipStatus = 'free' | 'supporter' | 'member';

interface UserMembershipState {
  /** Current membership status */
  status: MembershipStatus;

  /** When this status was last updated */
  updatedAt: number;

  /** Source of this status (manual | verified) */
  source: 'manual' | 'verified';
}
```

**Storage**: `localStorage['tradingapp_member_status']`

---

### FeedbackSubmission

Represents a user feedback submission through the message box.

```typescript
interface FeedbackSubmission {
  /** Unique submission ID (UUID) */
  id: string;

  /** Feedback text from user */
  feedback: string;

  /** Submission timestamp (Unix ms) */
  timestamp: number;

  /** Session ID when feedback was submitted */
  sessionId: string;

  /** Active usage time at submission (ms) */
  usageTimeMs: number;

  /** Optional user contact info */
  contactEmail?: string;

  /** Which prompt triggered this feedback */
  promptType: PromptType;
}
```

**Validation rules**:
- `feedback` must be non-empty string (min 1 character, max 5000 characters)
- `timestamp` must be > 0
- `usageTimeMs` must be >= 60000 (at least 1 minute of usage)
- `contactEmail` must be valid email format if provided

**Storage**: Multiple entries in `localStorage['tradingapp_feedback_*']` (one key per submission)

---

## localStorage Schema

### Session-based Keys (reset on tab close)

| Key | Type | Description |
|-----|------|-------------|
| `tradingapp_session_start` | `number` | Session start timestamp |
| `tradingapp_active_time_ms` | `number` | Accumulated active time in ms |
| `tradingapp_last_activity` | `number` | Last activity timestamp |
| `tradingapp_session_id` | `string` | Unique session ID (UUID) |

### Per-session State Keys

| Key | Type | Description |
|-----|------|-------------|
| `tradingapp_prompt_shown_1h` | `boolean` | Whether 1h prompt was shown |
| `tradingapp_prompt_shown_4h` | `boolean` | Whether 4h prompt was shown |
| `tradingapp_prompt_dismissed_1h` | `number` | Timestamp when 1h prompt dismissed |
| `tradingapp_prompt_dismissed_4h` | `number` | Timestamp when 4h prompt dismissed |

### Persistent State Keys (across sessions)

| Key | Type | Description |
|-----|------|-------------|
| `tradingapp_member_status` | `string` | Membership status: 'free' \| 'supporter' \| 'member' |

### Feedback Storage Keys (persisted across sessions)

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `tradingapp_feedback_{uuid}` | `string` | JSON-encoded FeedbackSubmission object |
| `tradingapp_feedback_index` | `string[]` | Array of feedback submission IDs (for retrieval) |

**Retrieval**:
```typescript
// Get all feedback IDs
const feedbackIds = JSON.parse(localStorage.getItem('tradingapp_feedback_index') || '[]');

// Load each feedback submission
const allFeedback = feedbackIds.map(id =>
  JSON.parse(localStorage.getItem(`tradingapp_feedback_${id}`) || '{}')
);
```

---

## Component Props

### DonationPrompt Props

```typescript
interface DonationPromptProps {
  /** Prompt content to display */
  content: PromptContent;

  /** User's membership status (affects variant shown) */
  membershipStatus: MembershipStatus;

  /** Called when prompt is dismissed */
  onDismiss: (type: PromptType) => void;

  /** Called when action is clicked */
  onAction: (action: SupporterAction) => void;

  /** Whether prompt is visible */
  isVisible: boolean;
}
```

---

## Hook Return Types

### useUsageTimeTracker Return

```typescript
interface UsageTimeTrackerReturn {
  /** Accumulated active time in milliseconds */
  activeTimeMs: number;

  /** Formatted time string (e.g., "1h 23m") */
  formattedTime: string;

  /** Whether session is currently idle */
  isIdle: boolean;

  /** Reset session (for testing) */
  reset: () => void;

  /** Session info */
  session: UsageSession;
}
```

### useDonationPrompt Return

```typescript
interface DonationPromptReturn {
  /** Which prompt should be shown (if any) */
  visiblePrompt: PromptType | null;

  /** Content for the visible prompt */
  promptContent: PromptContent | null;

  /** Dismiss the current prompt */
  dismissPrompt: () => void;

  /** User's membership status */
  membershipStatus: MembershipStatus;

  /** Update membership status */
  setMembershipStatus: (status: MembershipStatus) => void;
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Mount                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  useUsageTimeTracker │
                    │  - Start session     │
                    │  - Listen to events  │
                    │  - Accumulate time   │
                    └──────────┬───────────┘
                               │
                               │ activeTimeMs updates
                               ▼
                    ┌─────────────────────┐
                    │  useDonationPrompt   │
                    │  - Check thresholds  │
                    │  - Show prompt?      │
                    └──────────┬───────────┘
                               │
                               │ promptContent
                               ▼
                    ┌─────────────────────┐
                    │   DonationPrompt     │
                    │   - Render message   │
                    │   - Handle actions   │
                    └──────────────────────┘
                               │
                               │ onDismiss / onAction
                               ▼
                    ┌─────────────────────┐
                    │   Update State      │
                    │   (localStorage)     │
                    └──────────────────────┘
```

---

## Constants

### Time Thresholds

```typescript
const PROMPT_THRESHOLDS = {
  ONE_HOUR_MINUTES: 60,
  FOUR_HOUR_MINUTES: 240
} as const;

const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes in milliseconds
```

### UTM Parameters

```typescript
const UTM_PARAMS = {
  SOURCE: 'tradingapp',
  MEDIUM: 'prompt',
  CAMPAIGNS: {
    ONE_HOUR: '1h',
    FOUR_HOUR: '4h'
  }
} as const;
```

---

## Testing Considerations

### Time-based Testing

- Use `vi.useFakeTimers()` for deterministic time testing
- Mock `Date.now()` to control time progression
- Test idle timeout by advancing time beyond 20 minutes
- Test threshold triggers at 60min and 240min

### State Validation

- Verify localStorage writes happen correctly
- Test session reset on browser close simulation
- Verify prompt show/dismiss state transitions
- Test membership status changes

### Integration Points

- Mock localStorage for tests
- Test component with various membership statuses
- Verify UTM parameters are correctly constructed
- Test accessibility (keyboard navigation, screen readers)
