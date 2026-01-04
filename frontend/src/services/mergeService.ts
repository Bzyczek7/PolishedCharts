/**
 * Merge service for guest-to-user data synchronization.
 *
 * This service provides a clean API for merging localStorage guest data
 * with the cloud when a user signs in.
 *
 * Feature: 011-firebase-auth
 */
import type {
  MergeRequest,
  MergeResponse,
  MergeStatus,
  LocalStorageData,
} from '../types/auth';
import { mergeGuestData as apiMergeGuestData, getMergeStatus as apiGetMergeStatus } from './authService';

// =============================================================================
// Merge API
// =============================================================================

/**
 * Merge guest localStorage data with cloud data.
 *
 * @param guestData - LocalStorage data to merge
 * @returns Merge statistics (added/updated/skipped counts)
 */
export async function mergeGuestData(guestData: LocalStorageData): Promise<MergeResponse> {
  const mergeRequest: MergeRequest = {
    schemaVersion: guestData.schemaVersion,
    alerts: guestData.alerts,
    watchlist: guestData.watchlist,
    layouts: guestData.layouts,
    indicators: guestData.indicators || [],
  };

  const response = await apiMergeGuestData(mergeRequest);
  return response;
}

/**
 * Get merge status (counts of stored entities).
 *
 * @returns Counts of alerts, watchlists, and layouts stored in cloud
 */
export async function getMergeStatus(): Promise<MergeStatus> {
  return await apiGetMergeStatus();
}
