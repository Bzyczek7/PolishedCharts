/**
 * TypeScript types for Firebase Authentication.
 *
 * These types align with the backend API contract and Firebase JS SDK types.
 *
 * Feature: 011-firebase-auth
 */

// =============================================================================
// Firebase User Types
// =============================================================================

/**
 * Firebase Auth user profile (from Firebase JS SDK)
 */
export interface FirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  providerId: string;
  isAnonymous: boolean;
}

/**
 * Simplified user object used throughout the application
 */
export interface User {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
}

// =============================================================================
// Auth Context Types
// =============================================================================

/**
 * Authentication context state and methods
 */
export interface AuthContextType {
  /** Current authenticated user (null if guest/unauthenticated) */
  user: User | null;

  /** Whether user is signed in (not guest) */
  isSignedIn: boolean;

  /** Whether user is in guest mode (unauthenticated) */
  isGuest: boolean;

  /** Whether auth state is still loading */
  isLoading: boolean;

  /** Sign in with email and password */
  signInWithEmail: (email: string, password: string) => Promise<void>;

  /** Sign up with email and password (sends verification email) */
  signUpWithEmail: (email: string, password: string) => Promise<void>;

  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<void>;

  /** Sign out (switch to guest mode) */
  signOut: () => Promise<void>;

  /** Request password reset email */
  resetPassword: (email: string) => Promise<void>;

  /** Resend verification email */
  resendVerificationEmail: (email: string) => Promise<void>;
}

// =============================================================================
// LocalStorage Types (Guest Data)
// =============================================================================

/**
 * Current localStorage schema version
 */
export const LOCAL_STORAGE_SCHEMA_VERSION = 1;

/**
 * LocalStorage data structure
 */
export interface LocalStorageData {
  schemaVersion: number;
  alerts: GuestAlert[];
  watchlist: GuestWatchlist;
  layouts: GuestLayout[];
  indicators: GuestIndicator[];
}

/**
 * Guest alert stored in localStorage
 */
export interface GuestAlert {
  uuid: string;
  symbol: string;
  condition: AlertCondition;
  target: number;
  enabled: boolean;
  created_at: string;  // ISO 8601 timestamp
  updated_at: string;  // ISO 8601 timestamp
}

/**
 * Alert condition types
 */
export type AlertCondition = 'above' | 'below' | 'crosses-up' | 'crosses-down';

/**
 * Guest watchlist stored in localStorage
 */
export interface GuestWatchlist {
  uuid: string;
  symbols: string[];
  sort_order: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Guest layout stored in localStorage
 */
export interface GuestLayout {
  uuid: string;
  name: string;
  config: LayoutConfig;
  created_at: string;
  updated_at: string;
}

/**
 * Guest indicator stored in localStorage
 */
export interface GuestIndicator {
  uuid: string;
  indicatorType: string;  // 'sma', 'ema', 'tdfi', etc.
  displayName: string;
  params: Record<string, number>;
  style: {
    color: string;
    lineWidth: number;
    showLastValue?: boolean;
    seriesColors?: Record<string, string>;
  };
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Layout configuration (JSON-serializable)
 */
export interface LayoutConfig {
  indicators: IndicatorConfig[];
  chartSettings: ChartSettings;
  [key: string]: any;  // Allow additional properties
}

/**
 * Indicator configuration within a layout
 */
export interface IndicatorConfig {
  key: string;
  name: string;
  params: Record<string, unknown>;
  enabled: boolean;
}

/**
 * Chart settings within a layout
 */
export interface ChartSettings {
  interval: string;
  chartType: string;
  [key: string]: unknown;
}

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Migration definition
 */
export interface StorageMigration {
  /** Schema version this migration targets */
  version: number;
  /** Migration function that transforms data from previous version */
  migrate: (data: unknown) => LocalStorageData;
}

/**
 * Type alias for migration function
 */
export type MigrationFunction = (data: unknown) => LocalStorageData;

/**
 * Storage schema before migrations (legacy format)
 */
export interface LegacyStorageData {
  alerts?: Partial<GuestAlert>[];
  watchlist?: {
    symbols?: string[];
    [key: string]: unknown;
  };
  layouts?: Partial<GuestLayout>[];
}

// =============================================================================
// API Types (Backend Contract)
// =============================================================================

/**
 * User profile from backend
 */
export interface UserProfile {
  id: number;
  firebase_uid: string;
  email: string;
  email_verified: boolean;
  display_name: string | null;
  photo_url: string | null;  // Backend uses photo_url, frontend uses photoURL
  created_at: string;
  updated_at: string;
}

/**
 * Merge request payload
 */
export interface MergeRequest {
  schemaVersion: number;
  alerts: GuestAlert[];
  watchlist: GuestWatchlist;
  layouts: GuestLayout[];
  indicators: GuestIndicator[];
}

/**
 * Merge response from backend
 */
export interface MergeResponse {
  message: string;
  stats: {
    alerts: MergeEntityStats;
    watchlist: MergeEntityStats;
    layouts: MergeEntityStats;
    indicators: MergeEntityStats;
  };
}

/**
 * Statistics for a single entity type after merge
 */
export interface MergeEntityStats {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Merge status from backend
 */
export interface MergeStatus {
  alerts: number;
  watchlists: number;
  layouts: number;
  indicators: number;
}

/**
 * API error response
 */
export interface ApiError {
  detail: string;
}

// =============================================================================
// Auth Error Types
// =============================================================================

/**
 * Firebase Auth error codes (partial list)
 */
export type FirebaseAuthErrorCode =
  | 'auth/email-already-in-use'
  | 'auth/invalid-email'
  | 'auth/user-disabled'
  | 'auth/user-not-found'
  | 'auth/wrong-password'
  | 'auth/invalid-credential'
  | 'auth/weak-password'
  | 'auth/account-exists-with-different-credential'
  | 'auth/credential-already-in-use'
  | 'auth/popup-closed-by-user'
  | 'auth/too-many-requests'
  | 'auth/unverified-email';

/**
 * Custom auth error for application-specific handling
 */
export class AuthError extends Error {
  public code?: string;
  public originalError?: unknown;

  constructor(message: string, code?: string, originalError?: unknown) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Provider linking error (account-exists-with-different-credential)
 */
export class ProviderLinkingError extends AuthError {
  public existingEmail: string;
  public existingProvider: string;
  public attemptedProvider: string;

  constructor(existingEmail: string, existingProvider: string, attemptedProvider: string) {
    super(
      `Account already exists with ${existingProvider}. Please sign in with ${existingProvider} to link your ${attemptedProvider} account.`,
      'auth/account-exists-with-different-credential'
    );
    this.name = 'ProviderLinkingError';
    this.existingEmail = existingEmail;
    this.existingProvider = existingProvider;
    this.attemptedProvider = attemptedProvider;
  }
}

// =============================================================================
// UI Component Props Types
// =============================================================================

/**
 * Props for AuthDialog component
 */
export interface AuthDialogProps {
  /** Whether the dialog is open */
  open: boolean;

  /** Called when dialog is closed */
  onClose: () => void;

  /** Default tab to show ('email' | 'google') */
  defaultTab?: 'email' | 'google';

  /** Show "continue as guest" option */
  showGuestOption?: boolean;
}

/**
 * Props for UserMenu component
 */
export interface UserMenuProps {
  /** User display info */
  user: User;

  /** Trigger element (avatar, button, etc.) */
  trigger?: React.ReactNode;

  /** Called when sign out is clicked */
  onSignOut?: () => void;
}

/**
 * Props for EmailVerificationPrompt component
 */
export interface EmailVerificationPromptProps {
  /** User email address */
  email: string;

  /** Called to resend verification email */
  onResend: () => Promise<void>;

  /** Called to continue as guest */
  onContinueAsGuest?: () => void;
}

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for useAuth hook
 */
export type UseAuthReturn = AuthContextType;

/**
 * Return type for useLocalStorage hook
 */
export interface UseLocalStorageReturn {
  /** LocalStorage data */
  data: LocalStorageData | null;

  /** Whether data is loading */
  isLoading: boolean;

  /** Whether data has been loaded at least once */
  isLoaded: boolean;

  /** Save data to localStorage */
  save: (data: LocalStorageData) => void;

  /** Clear all localStorage data */
  clear: () => void;

  /** Get current schema version */
  getSchemaVersion: () => number;
}

/**
 * Return type for useMerge hook
 */
export interface UseMergeReturn {
  /** Merge guest data with cloud data */
  mergeGuestData: (guestData: LocalStorageData) => Promise<MergeResponse>;

  /** Get merge status (counts of stored entities) */
  getMergeStatus: () => Promise<MergeStatus>;

  /** Whether merge is in progress */
  isMerging: boolean;

  /** Last merge error */
  mergeError: Error | null;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * LocalStorage key for guest data
 */
export const LOCAL_STORAGE_KEY = 'polishedcharts_data';

/**
 * Merge timestamp tolerance (milliseconds)
 * Equal timestamps within this window prefer cloud version
 */
export const MERGE_TIMESTAMP_TOLERANCE_MS = 120000; // ±2 minutes

/**
 * Auth state persistence setting for Firebase
 */
export const AUTH_PERSISTENCE = 'localStorage' as const;

/**
 * Token refresh check interval (milliseconds)
 */
export const TOKEN_REFRESH_INTERVAL_MS = 300000; // 5 minutes

/**
 * Google OAuth scopes
 */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
] as const;
