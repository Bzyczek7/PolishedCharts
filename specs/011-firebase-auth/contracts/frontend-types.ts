/**
 * TypeScript Types Contract for Firebase Authentication
 *
 * This file defines all TypeScript types used in the frontend for
 * Firebase Authentication integration.
 *
 * Feature: 011-firebase-auth
 * Generated: 2025-12-30
 */

// ============================================================================
// Firebase User Types
// ============================================================================

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

// ============================================================================
// Auth Context Types
// ============================================================================

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

/**
 * Auth provider configuration
 */
export interface AuthProviderConfig {
  /** Google OAuth provider */
  googleProvider: {
    scopes: string[];
    customParameters?: { [key: string]: string };
  };
}

// ============================================================================
// LocalStorage Types (Guest Data)
// ============================================================================

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

// ============================================================================
// Migration Types
// ============================================================================

/**
 * LocalStorage migration function
 */
export type StorageMigration = (data: unknown) => LocalStorageData;

/**
 * Migration definition
 */
export interface Migration {
  version: number;
  migrate: StorageMigration;
}

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

// ============================================================================
// API Types (Backend Contract)
// ============================================================================

/**
 * User profile from backend
 */
export interface UserProfile {
  id: number;
  firebase_uid: string;
  email: string;
  email_verified: boolean;
  display_name: string | null;
  photo_url: string | null;
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
}

/**
 * API error response
 */
export interface ApiError {
  detail: string;
}

// ============================================================================
// Auth Error Types
// ============================================================================

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
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Provider linking error (account-exists-with-different-credential)
 */
export class ProviderLinkingError extends AuthError {
  constructor(
    public existingEmail: string,
    public existingProvider: string,
    public attemptedProvider: string
  ) {
    super(
      `Account already exists with ${existingProvider}. Please sign in with ${existingProvider} to link your ${attemptedProvider} account.`,
      'auth/account-exists-with-different-credential'
    );
    this.name = 'ProviderLinkingError';
  }
}

// ============================================================================
// UI Component Props Types
// ============================================================================

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

// ============================================================================
// Hook Return Types
// ============================================================================

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

// ============================================================================
// Service Function Signatures
// ============================================================================

/**
 * Auth service API
 */
export interface AuthService {
  /** Verify Firebase token with backend */
  verifyToken(token: string): Promise<UserProfile>;

  /** Get current user profile */
  getCurrentUser(token: string): Promise<UserProfile>;

  /** Sign out from backend */
  signOut(token: string): Promise<void>;

  /** Merge guest data with cloud */
  mergeGuestData(token: string, data: MergeRequest): Promise<MergeResponse>;

  /** Get merge status */
  getMergeStatus(token: string): Promise<MergeStatus>;

  /** Request password reset */
  resetPassword(email: string): Promise<void>;

  /** Resend verification email */
  resendVerification(email: string): Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

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

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract promise return type
 */
export type AsyncReturnType<T extends (...args: any) => Promise<any>> =
  T extends (...args: any) => Promise<infer R> ? R : any;

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Deep partial type (recursive Partial)
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
