/**
 * Auth service for backend API calls related to authentication.
 *
 * This service handles communication between the frontend (Firebase Auth)
 * and the backend API (token verification, user profile, merge operations).
 *
 * Feature: 011-firebase-auth
 */
import axios, { type AxiosInstance } from 'axios';
import { onAuthStateChanged } from 'firebase/auth';
import type {
  UserProfile,
  MergeRequest,
  MergeResponse,
  MergeStatus,
  ApiError,
} from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://polishedcharts-backend.onrender.com')

// Track auth initialization promise to avoid multiple concurrent waits
let authInitPromise: Promise<void> | null = null;

// T036: Cache axios instance to avoid repeated token fetches and instance creation
// This significantly improves performance for parallel indicator requests
let cachedAuthClient: AxiosInstance | null = null;
let cachedToken: string | null = null;

/**
 * Initialize auth and wait for it to be ready
 */
async function waitForAuthReady(): Promise<void> {
  const { auth } = await import('../lib/firebase');

  // If a wait is already in progress, wait for that
  if (authInitPromise) {
    return authInitPromise;
  }

  // Create a new wait promise
  authInitPromise = new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      unsubscribe();
      // T037: Reduced buffer from 100ms to 10ms for faster auth
      setTimeout(resolve, 10);
    });

    // Safety timeout
    setTimeout(() => {
      unsubscribe();
      resolve();
    }, 10000);
  });

  return authInitPromise;
}

/**
 * Get auth token for API requests
 */
async function getAuthToken(): Promise<string | null> {
  // Wait for auth to be ready
  await waitForAuthReady();

  const { auth } = await import('../lib/firebase');
  const user = auth.currentUser;
  if (!user) return null;

  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Create axios instance with auth header (T036: cached for performance)
 */
export async function createAuthenticatedAxios(): Promise<AxiosInstance> {
  const token = await getAuthToken();

  // Return cached client if token hasn't changed
  if (cachedAuthClient && cachedToken === token) {
    return cachedAuthClient;
  }

  // Create new client and cache it
  cachedToken = token;
  cachedAuthClient = axios.create({
    baseURL: `${API_BASE_URL}/api/v1`,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  return cachedAuthClient;
}

/**
 * Create fetch wrapper with AbortSignal for request cancellation (T038)
 * Used to cancel in-flight requests when symbol changes
 */
export async function createAbortFetchWrapper(): Promise<typeof fetch> {
  const authClient = await createAuthenticatedAxios();

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const originalSignal = init?.signal;

    // If there's an existing signal, abort when our controller aborts
    if (originalSignal) {
      originalSignal.addEventListener('abort', () => controller.abort(originalSignal.reason));
    }

    try {
      // Convert axios request to fetch-compatible format
      const url = typeof input === 'string' ? input : input.toString();
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      throw error;
    }
  };
}

// =============================================================================
// Auth API
// =============================================================================

/**
 * Verify Firebase token with backend and get user profile.
 *
 * Frontend handles Firebase authentication (email/password, Google OAuth).
 * This endpoint verifies the token with Firebase Admin SDK and returns
 * the user profile from the database.
 */
export async function verifyToken(idToken: string): Promise<UserProfile> {
  const response = await axios.post<UserProfile>(
    `${API_BASE_URL}/api/v1/auth/sign-in`,
    { id_token: idToken }
  );
  return response.data;
}

/**
 * Get current user profile from backend.
 */
export async function getCurrentUser(): Promise<UserProfile> {
  const client = await createAuthenticatedAxios();
  const response = await client.get<UserProfile>('/auth/user');
  return response.data;
}

/**
 * Sign out from backend (clears backend session).
 *
 * Note: Firebase tokens are stateless, so this is mainly for logging
 * and any future backend-side session cleanup.
 */
export async function signOut(): Promise<void> {
  const client = await createAuthenticatedAxios();
  await client.post('/auth/sign-out');
}

/**
 * Request password reset email.
 *
 * Returns generic message per FR-034 (no "check your inbox" hints).
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response = await axios.post<{ message: string }>(
    `${API_BASE_URL}/api/v1/auth/password-reset`,
    { email }
  );
  return response.data;
}

// =============================================================================
// Merge API
// =============================================================================

/**
 * Merge guest localStorage data with cloud data.
 *
 * Uses upsert-by-UUID strategy with timestamp comparison.
 * Returns statistics about what was added/updated/skipped.
 */
export async function mergeGuestData(data: MergeRequest): Promise<MergeResponse> {
  const client = await createAuthenticatedAxios();
  const response = await client.post<MergeResponse>('/merge/sync', data);
  return response.data;
}

/**
 * Get merge status (counts of stored entities).
 */
export async function getMergeStatus(): Promise<MergeStatus> {
  const client = await createAuthenticatedAxios();
  const response = await client.get<MergeStatus>('/merge/status');
  return response.data;
}

// =============================================================================
// Error Handling
// =============================================================================>

/**
 * Check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'detail' in error &&
    typeof (error as ApiError).detail === 'string'
  );
}

/**
 * Extract error message from API error
 */
export function getApiErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}
