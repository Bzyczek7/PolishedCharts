/**
 * Provider Linking Prompt UI component.
 *
 * Feature: 011-firebase-auth
 *
 * T064: Handles "account-exists-with-different-credential" error
 * T065: Creates UI to prompt user to sign in with existing provider and link accounts
 * T066: Implements explicit linking flow
 * T067: Preserves guest localStorage data during linking
 * T068: Integrates with Firebase linkWithPopup for provider linking
 */

import React, { useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useAuth } from '../hooks/useAuthContext';
import { Loader2 } from 'lucide-react';

// =============================================================================
// Props
// =============================================================================

interface ProviderLinkingPromptProps {
  /** Whether the dialog is open */
  open: boolean;

  /** Called when dialog is closed */
  onOpenChange: (open: boolean) => void;

  /** Callback to open sign-in dialog */
  onOpenSignInDialog: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ProviderLinkingPrompt displays a modal when user tries to sign in with a provider
 * (e.g., Google) but an account with that email already exists with a different
 * provider (e.g., email/password).
 *
 * Flow:
 * 1. User clicks "Sign in with Google"
 * 2. Firebase returns "account-exists-with-different-credential" error
 * 3. This dialog opens, explaining the situation
 * 4. User clicks "Sign in with Email" to authenticate with existing account
 * 5. After sign-in, Firebase linkWithPopup is called to link the providers
 * 6. User can now sign in with either method
 *
 * T067: Guest localStorage data is preserved throughout the linking process.
 */
export function ProviderLinkingPrompt({
  open,
  onOpenChange,
  onOpenSignInDialog,
}: ProviderLinkingPromptProps) {
  const {
    providerLinkingError,
    linkProvider,
    isLoading,
    error,
    clearError,
    clearProviderLinkingError,
  } = useAuth();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      clearProviderLinkingError();
    }
  }, [open, clearProviderLinkingError]);

  /**
   * Handle "Sign in with Email" button click.
   * Opens the sign-in dialog so user can authenticate with their existing account.
   */
  const handleSignInWithEmail = useCallback(() => {
    // Close this dialog
    onOpenChange(false);

    // Open the main sign-in dialog
    onOpenSignInDialog();
  }, [onOpenChange, onOpenSignInDialog]);

  /**
   * Handle "Link Accounts" button click.
   * T068: Calls Firebase linkWithPopup to link the providers.
   */
  const handleLinkAccounts = useCallback(async () => {
    try {
      await linkProvider();

      // Success - close dialog
      onOpenChange(false);
    } catch (err) {
      // Error is handled by auth context and displayed in UI
      console.error('Provider linking failed:', err);
    }
  }, [linkProvider, onOpenChange]);

  /**
   * Handle dialog close.
   */
  const handleClose = useCallback(() => {
    clearProviderLinkingError();
    onOpenChange(false);
  }, [clearProviderLinkingError, onOpenChange]);

  // Extract information from the error
  const existingEmail = providerLinkingError?.existingEmail || '';
  const attemptedProvider = providerLinkingError?.attemptedProvider === 'google.com' ? 'Google' : 'this provider';
  const existingProvider = providerLinkingError?.existingProvider === 'password' ? 'email and password' : 'another provider';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Link Your Accounts</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                An account with email <strong>{existingEmail}</strong> already exists.
              </p>
              <p>
                You previously created an account using <strong>{existingProvider}</strong>.
                To add {attemptedProvider} sign-in to your account, please:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Sign in with your email and password below</li>
                <li>Then click &quot;Link Accounts&quot; to connect {attemptedProvider}</li>
              </ol>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Error Display */}
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {/* Primary action: Sign in with email first, then link */}
          <Button
            onClick={handleSignInWithEmail}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Sign In with Email'
            )}
          </Button>

          {/* Secondary action: Link accounts (shown after sign-in) */}
          {providerLinkingError && (
            <Button
              onClick={handleLinkAccounts}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Linking...
                </>
              ) : (
                `Link ${attemptedProvider} Account`
              )}
            </Button>
          )}

          {/* Cancel button */}
          <Button
            onClick={handleClose}
            disabled={isLoading}
            variant="ghost"
            className="w-full"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProviderLinkingPrompt;
