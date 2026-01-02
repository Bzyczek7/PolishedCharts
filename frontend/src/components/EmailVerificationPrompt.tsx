/**
 * Email verification prompt component.
 *
 * Feature: 011-firebase-auth
 * User Story 1: Email and Password Registration
 *
 * Displays a prompt when user is signed in but email is not verified.
 * Shows the user's email and provides options to:
 * - Resend verification email
 * - Sign out and continue as guest
 * - Refresh to check if verification is complete
 */

import React, { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Loader2, Mail, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

// =============================================================================
// Props
// =============================================================================

interface EmailVerificationPromptProps {
  /** Callback when verification is complete (user can refresh to trigger) */
  onVerified?: () => void;
  /** Optional className for styling */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * EmailVerificationPrompt displays when user is signed in but email not verified.
 *
 * Features:
 * - Shows user's email address
 * - Resend verification email button
 * - Sign out button (switch to guest mode)
 * - Refresh button to check if email is verified
 * - Generic error messages per FR-031/FR-034
 */
export function EmailVerificationPrompt({
  onVerified,
  className = '',
}: EmailVerificationPromptProps) {
  const { user, signOut, resendVerificationEmail, isLoading } = useAuth();

  // Local state
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Handle resend verification email.
   */
  const handleResend = useCallback(async () => {
    setError(null);
    try {
      await resendVerificationEmail();
      setResent(true);
      // Reset success message after 5 seconds
      setTimeout(() => setResent(false), 5000);
    } catch (err: any) {
      // Generic error message per FR-034
      setError('If an account exists with this email, a verification email has been sent.');
    }
  }, [resendVerificationEmail]);

  /**
   * Handle sign out (switch to guest mode).
   */
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      // Continue anyway - Firebase state should clear
    }
  }, [signOut]);

  /**
   * Handle refresh to check if email is verified.
   * User clicks link in email, then clicks refresh here.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    // Force reload the page to trigger Firebase auth state refresh
    // Firebase automatically updates emailVerified after clicking verification link
    window.location.reload();
  }, []);

  // Guard: Should not render if no user or email already verified
  if (!user || user.emailVerified) {
    return null;
  }

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
        <Mail className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
        <AlertDescription className="text-sm">
          <div className="space-y-3">
            {/* Header */}
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Email Verification Required
              </h3>
              <p className="text-xs text-yellow-700/80 dark:text-yellow-300/80 mt-1">
                Please verify your email to access all features
              </p>
            </div>

            {/* Email Display */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background/50 border border-border/50">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{user.email}</span>
            </div>

            {/* Instructions */}
            <p className="text-xs text-muted-foreground">
              We've sent a verification email to the address above. Click the link in the email,
              then refresh this page.
            </p>

            {/* Success Message */}
            {resent && (
              <div className="flex items-start gap-2 text-green-700 dark:text-green-400 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Verification email sent! Check your inbox (and spam folder).</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 text-destructive text-xs">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                variant="default"
                className="w-full"
                size="sm"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    I've Verified My Email
                  </>
                )}
              </Button>

              <Button
                onClick={handleResend}
                disabled={resent || isLoading}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </Button>

              <Button
                onClick={handleSignOut}
                disabled={isLoading}
                variant="ghost"
                className="w-full"
                size="sm"
              >
                Continue as Guest
              </Button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-muted-foreground text-center">
              Don't see the email? Check your spam folder or{' '}
              <button
                onClick={handleResend}
                disabled={resent || isLoading}
                className="underline underline-offset-4 hover:text-foreground disabled:opacity-50"
              >
                resend
              </button>
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * Standalone card variant for use in modals or dedicated pages.
 */
export function EmailVerificationPromptCard({
  onVerified,
  className = '',
}: EmailVerificationPromptProps) {
  const { user, signOut, resendVerificationEmail, isLoading } = useAuth();

  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = useCallback(async () => {
    setError(null);
    try {
      await resendVerificationEmail();
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err: any) {
      setError('If an account exists with this email, a verification email has been sent.');
    }
  }, [resendVerificationEmail]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, [signOut]);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  if (!user || user.emailVerified) {
    return null;
  }

  return (
    <div className={`rounded-lg border bg-card p-6 shadow-sm ${className}`}>
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Icon */}
        <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <Mail className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-lg font-semibold">Verify Your Email</h2>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a verification link to <span className="font-medium">{user.email}</span>
          </p>
        </div>

        {/* Instructions */}
        <p className="text-sm text-muted-foreground max-w-xs">
          Click the link in the email to verify your account, then refresh this page.
        </p>

        {/* Success */}
        {resent && (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Email sent! Check your inbox.</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <XCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={handleRefresh} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            I've Verified My Email
          </Button>

          <Button
            onClick={handleResend}
            disabled={resent || isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Resend Email
          </Button>

          <Button
            onClick={handleSignOut}
            disabled={isLoading}
            variant="ghost"
            className="w-full"
          >
            Continue as Guest
          </Button>
        </div>

        {/* Help */}
        <p className="text-xs text-muted-foreground">
          No email? Check spam or <button onClick={handleResend} className="underline">resend</button>
        </p>
      </div>
    </div>
  );
}

export default EmailVerificationPrompt;
