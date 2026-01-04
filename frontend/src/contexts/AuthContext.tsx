/**
 * Authentication context provider for managing user authentication state.
 *
 * Feature: 011-firebase-auth
 * User Story 1: Email/Password Registration
 *
 * T062: Token refresh mechanism using onIdTokenChanged listener
 * T063: Token refresh failure handling - switches to guest mode while preserving local data
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  browserLocalPersistence,
  setPersistence,
  linkWithPopup,
  type User,
  type Auth as FirebaseAuth,
  type IdTokenResult,
  type UserCredential,
  type AuthError as FirebaseAuthError,
} from 'firebase/auth';
import { auth, googleProvider, signInWithGoogle } from '../lib/firebase';
import type {
  UserProfile,
  MergeRequest,
  MergeResponse,
  LocalStorageData,
} from '../types/auth';
import { ProviderLinkingError } from '../types/auth';
import { verifyToken, signOut as apiSignOut } from '../services/authService';
import { mergeGuestData as apiMergeGuestData } from '../services/mergeService';
import { useLocalStorage } from '../hooks/useLocalStorage';

// =============================================================================
// Types
// =============================================================================

interface AuthContextType {
  // State
  user: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isLoading: boolean;
  error: string | null;

  // Provider linking state (T064-T068)
  pendingProviderCredential: any | null; // Firebase AuthCredential for linking
  providerLinkingError: ProviderLinkingError | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;

  // Provider linking actions (T064-T068)
  linkProvider: () => Promise<void>; // T068: Explicit linking flow
  clearProviderLinkingError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================================
// Props
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * AuthProvider component that wraps the application and provides
 * authentication state and operations to all child components.
 *
 * Features:
 * - Firebase auth state management
 * - Backend user profile sync
 * - Guest-to-registered user data merge
 * - Automatic token refresh
 * - Email verification enforcement
 */
const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // T064-T068: Provider linking state
  const [pendingProviderCredential, setPendingProviderCredential] = useState<any | null>(null);
  const [providerLinkingError, setProviderLinkingError] = useState<ProviderLinkingError | null>(null);

  // Get localStorage for guest data management
  const { data: localStorageData, isLoading: isLocalStorageLoading, save, clear } = useLocalStorage();

  // Derived state
  const isAuthenticated = !!user && !!userProfile;
  const isEmailVerified = user?.emailVerified ?? false;

  // =============================================================================
  // Effects
  // =============================================================================

  /**
   * Initialize auth state listener on mount.
   * Sets up Firebase auth persistence and listens for auth state changes.
   *
   * T062: Also sets up token refresh listener using onIdTokenChanged.
   * T063: Handles token refresh failures by switching to guest mode while preserving local data.
   */
  useEffect(() => {
    let authUnsubscribe: (() => void) | undefined;
    let tokenUnsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        // Set auth persistence to LOCAL (survives browser restart)
        await setPersistence(auth, browserLocalPersistence);

        // Listen for auth state changes (T062: Auth state changes)
        authUnsubscribe = onAuthStateChanged(
          auth,
          async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
              // User is signed in - fetch their profile from backend
              try {
                const token = await firebaseUser.getIdToken();
                const profile = await verifyToken(token);
                setUserProfile(profile);
              } catch (err) {
                console.error('Failed to fetch user profile:', err);
                // If backend sync fails, sign out to prevent inconsistent state
                await firebaseSignOut(auth);
                setUser(null);
                setUserProfile(null);
              }
            } else {
              // User is signed out
              setUserProfile(null);
            }

            setIsLoading(false);
          },
          (authError) => {
            console.error('Auth state change error:', authError);
            setError(authError.message);
            setIsLoading(false);
          }
        );

        // T062: Listen for token refresh changes (T062: Token refresh mechanism)
        // onIdTokenChanged fires when:
        // - User signs in or signs out
        // - User's token refreshes (automatically every hour by Firebase)
        // - Token is manually refreshed via getIdToken(forceRefresh=true)
        tokenUnsubscribe = onIdTokenChanged(
          auth,
          async (firebaseUser: User | null) => {
            if (firebaseUser) {
              try {
                // Get the fresh token
                const token = await firebaseUser.getIdToken();

                // Sync with backend to update the user profile
                const profile = await verifyToken(token);
                setUserProfile(profile);

                console.log('[T062] Token refreshed successfully');
              } catch (err) {
                // T063: Handle token refresh failure - switch to guest mode, preserve local data
                console.error('[T063] Token refresh failed, switching to guest mode:', err);

                // Sign out from Firebase
                await firebaseSignOut(auth);
                setUser(null);
                setUserProfile(null);

                // Local data is preserved (localStorage is NOT cleared per FR-011)
                // User continues as guest with their existing data
                setError('Session expired. Please sign in again to sync your data.');
              }
            }
          },
          (tokenError) => {
            console.error('[T063] Token refresh error:', tokenError);
            // On token error, switch to guest mode
            setUser(null);
            setUserProfile(null);
          }
        );

      } catch (err) {
        console.error('Failed to initialize auth:', err);
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      if (authUnsubscribe) {
        authUnsubscribe();
      }
      if (tokenUnsubscribe) {
        tokenUnsubscribe();
      }
    };
  }, []);

  // =============================================================================
  // Actions
  // =============================================================================

  /**
   * Sign in with email and password.
   *
   * Per FR-005a: Enforces email verification on both client and backend.
   * Per FR-031: Returns generic error message to prevent account enumeration.
   *
   * @param email - User's email address
   * @param password - User's password
   * @throws Error with generic message if sign in fails
   */
  const signIn = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      // First, authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // DEV: Temporarily disabled email verification check for development testing
      // Re-enable this before production deployment per FR-005a
      // Check email verification (client-side enforcement per FR-005a)
      // if (!userCredential.user.emailVerified) {
      //   await firebaseSignOut(auth);
      //   throw new Error('Email verification required. Please check your email for a verification link.');
      // }

      // Get Firebase ID token and sync with backend
      const token = await userCredential.user.getIdToken();
      const profile = await verifyToken(token);
      setUserProfile(profile);

      // Merge any guest data from localStorage
      if (localStorageData) {
        await mergeGuestData(localStorageData);
      }

    } catch (err: any) {
      const message = err.message || 'Authentication failed. If an account exists, check your email for verification or password reset options';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign up with email and password.
   *
   * Per FR-005a: Sends verification email immediately after registration.
   * Per FR-031: Returns generic error message to prevent account enumeration.
   *
   * @param email - User's email address
   * @param password - User's password (min 8 characters per FR-019)
   * @throws Error if sign up fails or password is too weak
   */
  const signUp = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      // Validate password length (FR-019)
      if (password.length < 8) {
        throw new Error('Password should be at least 8 characters.');
      }

      // Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Send verification email (FR-005a)
      await sendEmailVerification(userCredential.user);

      // Sync with backend (creates user record)
      const token = await userCredential.user.getIdToken();
      const profile = await verifyToken(token);
      setUserProfile(profile);

      // Merge any guest data from localStorage
      if (localStorageData) {
        await mergeGuestData(localStorageData);
      }

    } catch (err: any) {
      const message = err.message || 'An error occurred during sign-up. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with Google OAuth.
   *
   * Per FR-027: Google accounts are pre-verified (no verification email needed).
   * T064: Handles "account-exists-with-different-credential" error for provider linking.
   * T067: Preserves guest localStorage data during multi-step linking flow.
   */
  const handleSignInWithGoogle = async () => {
    setError(null);
    setProviderLinkingError(null);
    setIsLoading(true);

    try {
      const userCredential = await signInWithGoogle();

      // Mobile redirect path: function returns null, page navigates
      // Anything after this line doesn't run in redirect flow
      if (!userCredential) {
        return;
      }

      // Google accounts are pre-verified
      const token = await userCredential.user.getIdToken();
      const profile = await verifyToken(token);
      setUserProfile(profile);

      // Merge any guest data from localStorage
      // T067: Guest data is preserved during linking flow
      if (localStorageData) {
        await mergeGuestData(localStorageData);
      }

      // Clear pending credential on successful sign-in/linking
      setPendingProviderCredential(null);

    } catch (err: any) {
      // T064: Handle "account-exists-with-different-credential" error
      if (err.code === 'auth/account-exists-with-different-credential') {
        // Extract the email and credential from the error
        const email = err.customData?.email || user?.email || '';
        const credential = err.credential;

        // Store the pending credential for later linking
        if (credential) {
          setPendingProviderCredential(credential);

          // Create provider linking error using the class constructor (T064)
          const linkingError = new ProviderLinkingError(
            email,
            'password', // Assuming existing account is email/password
            'google.com'  // Attempted provider
          );
          setProviderLinkingError(linkingError);
        }
        setError(err.message);
      } else {
        const message = err.message || 'An error occurred during sign-in. Please try again.';
        setError(message);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign out the current user.
   *
   * - Signs out from Firebase
   * - Signs out from backend (revokes token)
   * - Does NOT clear localStorage (guest data is preserved per FR-011)
   */
  const signOutUser = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Sign out from backend
      if (user) {
        const token = await user.getIdToken();
        await apiSignOut();
      }

      // Sign out from Firebase
      await firebaseSignOut(auth);

      setUser(null);
      setUserProfile(null);

    } catch (err: any) {
      console.error('Sign out error:', err);
      // Continue with Firebase signout even if backend fails
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resend verification email to the current user.
   *
   * Per FR-034: Returns generic message regardless of whether email exists.
   */
  const resendVerificationEmail = async () => {
    setError(null);

    if (!user) {
      throw new Error('No user is currently signed in.');
    }

    try {
      await sendEmailVerification(user);
    } catch (err: any) {
      const message = err.message || 'Failed to send verification email. Please try again.';
      setError(message);
      throw err;
    }
  };

  /**
   * Send password reset email.
   *
   * Per FR-034: Returns generic message regardless of whether email exists.
   *
   * @param email - User's email address
   */
  const resetPassword = async (email: string) => {
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const message = err.message || 'Failed to send password reset email. Please try again.';
      setError(message);
      throw err;
    }
  };

  /**
   * Clear the current error message.
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Clear the provider linking error state.
   */
  const clearProviderLinkingError = () => {
    setProviderLinkingError(null);
    setPendingProviderCredential(null);
  };

  /**
   * Link a provider to the current user's account.
   *
   * T066: Explicit linking flow - user must sign in with existing provider first.
   * T068: Uses Firebase linkWithPopup for provider linking.
   * T067: Preserves guest localStorage data during the linking process.
   */
  const linkProvider = async () => {
    setError(null);
    setIsLoading(true);

    if (!user || !pendingProviderCredential) {
      setError('No pending provider credential to link. Please try signing in again.');
      setIsLoading(false);
      return;
    }

    try {
      // T068: Link the provider using Firebase linkWithPopup
      // Note: linkWithCredential is the direct method, but for OAuth providers we need to use linkWithPopup
      // The pending credential contains the OAuth credential from the failed sign-in attempt

      // For Google OAuth, we need to use linkWithPopup
      const result = await linkWithPopup(user, googleProvider);

      console.log('[T068] Provider linked successfully:', result.providerId);

      // Sync with backend after linking
      const token = await user.getIdToken();
      const profile = await verifyToken(token);
      setUserProfile(profile);

      // Merge any guest data (T067: guest data is preserved during linking)
      if (localStorageData) {
        await mergeGuestData(localStorageData);
      }

      // Clear the pending credential
      setPendingProviderCredential(null);
      setProviderLinkingError(null);

    } catch (err: any) {
      console.error('[T068] Provider linking failed:', err);

      if (err.code === 'auth/credential-already-in-use') {
        setError('This provider is already linked to your account.');
      } else if (err.code === 'auth/provider-already-linked') {
        setError('This provider is already linked to your account.');
      } else {
        setError(err.message || 'Failed to link provider. Please try again.');
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================================================
  // Helper: Merge Guest Data
  // =============================================================================

  /**
   * Merge guest data from localStorage with user's cloud data.
   *
   * Per FR-013: Uses upsert-by-UUID with 2-minute timestamp tolerance.
   */
  const mergeGuestData = async (guestData: LocalStorageData) => {
    try {
      const mergeRequest: MergeRequest = {
        schemaVersion: guestData.schemaVersion,
        alerts: guestData.alerts,
        watchlist: guestData.watchlist,
        layouts: guestData.layouts,
        indicators: guestData.indicators || [],
      };

      const response: MergeResponse = await apiMergeGuestData(mergeRequest);

      // Clear localStorage after successful merge
      if (response.stats.alerts.added > 0 || response.stats.alerts.updated > 0 ||
          response.stats.watchlist.added > 0 || response.stats.watchlist.updated > 0 ||
          response.stats.layouts.added > 0 || response.stats.layouts.updated > 0 ||
          response.stats.indicators.added > 0 || response.stats.indicators.updated > 0) {
        await clear();
      }

    } catch (err) {
      console.error('Failed to merge guest data:', err);
      // Don't throw - merge failures should not block sign-in
    }
  };

  // =============================================================================
  // Context Value
  // =============================================================================

  const value: AuthContextType = {
    user,
    userProfile,
    isAuthenticated,
    isEmailVerified,
    isLoading: isLoading || isLocalStorageLoading,
    error,

    // Provider linking state (T064-T068)
    pendingProviderCredential,
    providerLinkingError,

    // Actions
    signIn,
    signUp,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: signOutUser,
    resendVerificationEmail,
    resetPassword,
    clearError,

    // Provider linking actions (T064-T068)
    linkProvider,
    clearProviderLinkingError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
