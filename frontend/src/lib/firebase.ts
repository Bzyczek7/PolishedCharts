/**
 * Firebase Client SDK initialization and configuration.
 *
 * Initializes Firebase Auth for email/password and Google OAuth authentication.
 *
 * Feature: 011-firebase-auth
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from 'firebase/auth';

// Mobile browser detection for redirect vs popup flow
function isMobileBrowser(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Prevent duplicate initialization in React StrictMode
export const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Use browser language for email templates
auth.useDeviceLanguage();

// Google OAuth provider configuration
export const googleProvider = new GoogleAuthProvider();

// Add required scopes for Google OAuth
googleProvider.addScope('email');
googleProvider.addScope('profile');

/**
 * Sign in with Google OAuth using popup (desktop) or redirect (mobile).
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  // Mobile redirect path (no UserCredential returned)
  if (isMobileBrowser()) {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }

  return await signInWithPopup(auth, googleProvider);
}

/**
 * Connect to Firebase Auth Emulator for local testing.
 *
 * Call this during development to use the local emulator instead of production Firebase.
 * Set VITE_USE_FIREBASE_EMULATOR=true in .env to enable.
 */
export async function connectAuthEmulatorIfEnabled(): Promise<void> {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    try {
      // Dynamically import connectAuthEmulator to avoid issues when not using emulator
      const { connectAuthEmulator } = await import('firebase/auth');
      connectAuthEmulator(auth, 'http://localhost:9099');
      console.log('Connected to Firebase Auth Emulator');
    } catch (e) {
      console.warn('Failed to connect to Firebase Auth Emulator:', e);
    }
  }
}

// Initialize emulator connection if enabled
connectAuthEmulatorIfEnabled();
