/**
 * Donation Reminder Prompts - Type Definitions
 *
 * Feature: 016-donation-reminder
 * This file defines all TypeScript interfaces and types for the donation prompt system.
 * Copy this content to: frontend/src/types/donation.ts
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Prompt type identifiers
 */
export type PromptType = '1h' | '4h';

/**
 * User membership/support status
 */
export type MembershipStatus = 'free' | 'supporter' | 'member';

/**
 * Source of membership status
 */
export type MembershipSource = 'manual' | 'verified';

// =============================================================================
// Data Models
// =============================================================================

/**
 * Represents a user's active usage session with time tracking
 */
export interface UsageSession {
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

/**
 * Represents the display state of donation prompts
 */
export interface PromptState {
  /** Which prompts have been shown this session */
  shownPrompts: PromptType[];

  /** Timestamps when prompts were dismissed */
  dismissedAt: Record<PromptType, number>;

  /** Currently visible prompt (if any) */
  visiblePrompt: PromptType | null;
}

/**
 * Represents the content and configuration for a prompt
 */
export interface PromptContent {
  /** Type of prompt */
  type: PromptType;

  /** Threshold in minutes before showing */
  thresholdMinutes: number;

  /** Main message text (personal/conversational tone) */
  message: string;

  /** Ko-fi URL with UTM parameters */
  koFiUrl: string;

  /** For supporters: alternative content */
  supporterVariant?: PromptContentSupporter;
}

/**
 * Supporter-specific prompt content
 */
export interface PromptContentSupporter {
  /** Thank you message for existing supporters */
  message: string;

  /** Non-monetary action suggestions */
  actions: SupporterAction[];
}

/**
 * Action available to supporters
 */
export interface SupporterAction {
  /** Button label */
  label: string;

  /** Optional URL to open */
  url?: string;

  /** Optional predefined action */
  action?: 'github' | 'feedback' | 'share';
}

/**
 * User membership state
 */
export interface UserMembershipState {
  /** Current membership status */
  status: MembershipStatus;

  /** When this status was last updated */
  updatedAt: number;

  /** Source of this status */
  source: MembershipSource;
}

/**
 * User feedback submission
 */
export interface FeedbackSubmission {
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

/**
 * Feedback form state
 */
export interface FeedbackFormState {
  /** Whether form is currently open */
  isOpen: boolean;

  /** Current feedback text */
  text: string;

  /** Optional contact email */
  email: string;

  /** Form validation errors */
  errors: {
    text?: string;
    email?: string;
  };

  /** Form submission state */
  isSubmitting: boolean;
}

// =============================================================================
// Component Props
// =============================================================================

/**
 * Props for DonationPrompt component
 */
export interface DonationPromptProps {
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

/**
 * Props for FeedbackForm component
 */
export interface FeedbackFormProps {
  /** Whether form is visible */
  isOpen: boolean;

  /** Current form state */
  state: FeedbackFormState;

  /** Called when feedback is submitted */
  onSubmit: (feedback: string, email?: string) => void;

  /** Called when form is cancelled */
  onCancel: () => void;

  /** Called when form field changes */
  onChange: (field: 'text' | 'email', value: string) => void;
}

/**
 * Props for FeedbackModal component (wrapper for FeedbackForm)
 */
export interface FeedbackModalProps {
  /** Whether modal is visible */
  isOpen: boolean;

  /** Session ID for correlation */
  sessionId: string;

  /** Current usage time */
  usageTimeMs: number;

  /** Which prompt triggered this */
  promptType: PromptType;

  /** Called when feedback is submitted */
  onSubmit: (submission: FeedbackSubmission) => void;

  /** Called when modal is closed */
  onClose: () => void;
}

/**
 * Props for useUsageTimeTracker hook
 */
export interface UsageTimeTrackerOptions {
  /** Idle timeout in milliseconds (default: 20 minutes) */
  idleTimeoutMs?: number;

  /** Whether to persist session to localStorage (default: true) */
  persist?: boolean;
}

/**
 * Props for useDonationPrompt hook
 */
export interface DonationPromptOptions {
  /** Custom prompt content (optional, uses defaults if not provided) */
  customContent?: Partial<Record<PromptType, PromptContent>>;

  /** Custom thresholds in minutes (optional, uses defaults if not provided) */
  customThresholds?: Partial<Record<PromptType, number>>;
}

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for useUsageTimeTracker hook
 */
export interface UsageTimeTrackerReturn {
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

/**
 * Return type for useDonationPrompt hook
 */
export interface DonationPromptReturn {
  /** Which prompt should be shown (if any) */
  visiblePrompt: PromptType | null;

  /** Content for the visible prompt */
  promptContent: PromptContent | null;

  /** Dismiss the current prompt */
  dismissPrompt: () => void;

  /** Open feedback form (for 1h prompt) */
  openFeedbackForm: () => void;

  /** User's membership status */
  membershipStatus: MembershipStatus;

  /** Update membership status */
  setMembershipStatus: (status: MembershipStatus) => void;

  /** Feedback form state */
  feedbackForm: FeedbackFormState;
}

/**
 * Return type for useFeedbackForm hook
 */
export interface FeedbackFormReturn {
  /** Form state */
  state: FeedbackFormState;

  /** Submit feedback */
  submitFeedback: () => void;

  /** Cancel/close form */
  cancelFeedback: () => void;

  /** Update form field */
  updateField: (field: 'text' | 'email', value: string) => void;

  /** Validate form */
  validate: () => boolean;
}

/**
 * Return type for useFeedbackStorage hook
 */
export interface FeedbackStorageReturn {
  /** Save feedback submission */
  saveFeedback: (submission: FeedbackSubmission) => void;

  /** Get all feedback submissions */
  getAllFeedback: () => FeedbackSubmission[];

  /** Export feedback as JSON */
  exportAsJSON: () => string;

  /** Export feedback as CSV */
  exportAsCSV: () => string;

  /** Clear all feedback (for testing) */
  clearAll: () => void;

  /** Feedback count */
  count: number;
}

// =============================================================================
// localStorage Keys
// =============================================================================

/**
 * localStorage key constants
 */
export const LOCAL_STORAGE_KEYS = {
  // Session-based (reset on tab close)
  SESSION_START: 'tradingapp_session_start',
  ACTIVE_TIME_MS: 'tradingapp_active_time_ms',
  LAST_ACTIVITY: 'tradingapp_last_activity',
  SESSION_ID: 'tradingapp_session_id',

  // Per-session state
  PROMPT_SHOWN_1H: 'tradingapp_prompt_shown_1h',
  PROMPT_SHOWN_4H: 'tradingapp_prompt_shown_4h',
  PROMPT_DISMISSED_1H: 'tradingapp_prompt_dismissed_1h',
  PROMPT_DISMISSED_4H: 'tradingapp_prompt_dismissed_4h',

  // Persistent state
  MEMBER_STATUS: 'tradingapp_member_status',

  // Feedback storage (persisted across sessions)
  FEEDBACK_PREFIX: 'tradingapp_feedback_',
  FEEDBACK_INDEX: 'tradingapp_feedback_index',
} as const;

// =============================================================================
// Constants
// =============================================================================

/**
 * Prompt time thresholds
 */
export const PROMPT_THRESHOLDS = {
  ONE_HOUR_MINUTES: 60,
  FOUR_HOUR_MINUTES: 240,
} as const;

/**
 * Idle timeout (20 minutes in ms)
 */
export const IDLE_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * UTM parameter constants
 */
export const UTM_PARAMS = {
  SOURCE: 'tradingapp',
  MEDIUM: 'prompt',
  CAMPAIGNS: {
    ONE_HOUR: '1h',
    FOUR_HOUR: '4h',
  },
} as const;

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Theme variant for styling
 */
export type PromptTheme = 'light' | 'dark';

/**
 * Animation state
 */
export type AnimationState = 'entering' | 'entered' | 'exiting' | 'exited';

/**
 * Prompt position
 */
export type PromptPosition = 'bottom-right' | 'bottom-center' | 'bottom-left';
