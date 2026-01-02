/**
 * Authentication dialog component for sign-in and sign-up.
 *
 * Feature: 011-firebase-auth
 * User Story 1: Email/Password Registration
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { ProviderLinkingPrompt } from './ProviderLinkingPrompt';

// =============================================================================
// Props
// =============================================================================

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'sign-in' | 'sign-up';
}

// =============================================================================
// Component
// =============================================================================

/**
 * AuthDialog provides a modal for user authentication.
 *
 * Features:
 * - Email/password sign-in (FR-001)
 * - Email/password sign-up with 8-char minimum password (FR-019)
 * - Google OAuth sign-in (FR-002)
 * - Email verification enforcement (FR-005a)
 * - Password reset flow (FR-022)
 * - Generic error messages to prevent account enumeration (FR-031, FR-034)
 */
export function AuthDialog({ open, onOpenChange, defaultTab = 'sign-in' }: AuthDialogProps) {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    isLoading,
    error,
    clearError,
    providerLinkingError,
  } = useAuth();

  // Form state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  // UI state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'sign-in' | 'sign-up'>(defaultTab);
  const [showProviderLinking, setShowProviderLinking] = useState(false);

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Clear all state when dialog closes
      setSignInEmail('');
      setSignInPassword('');
      setSignUpEmail('');
      setSignUpPassword('');
      setSignUpConfirmPassword('');
      setResetEmail('');
      setShowPasswordReset(false);
      setResetSent(false);
      setVerificationSent(false);
      setShowProviderLinking(false);
      clearError();
    } else {
      // Reset to default tab when dialog opens
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab, clearError]);

  // Show provider linking prompt when there's a provider linking error (T064-T068)
  useEffect(() => {
    if (providerLinkingError) {
      setShowProviderLinking(true);
    }
  }, [providerLinkingError]);

  // =============================================================================
  // Handlers
  // =============================================================================

  /**
   * Handle sign-in form submission.
   */
  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await signIn(signInEmail, signInPassword);
      // Success - close dialog
      onOpenChange(false);
    } catch (err) {
      // Error is handled by auth context and displayed in UI
    }
  }, [signInEmail, signInPassword, signIn, clearError, onOpenChange]);

  /**
   * Handle sign-up form submission.
   */
  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Validate passwords match
    if (signUpPassword !== signUpConfirmPassword) {
      // Error will be caught by auth context, but we can add local validation too
      return;
    }

    try {
      await signUp(signUpEmail, signUpPassword);
      // Show verification sent message
      setVerificationSent(true);
      // After a delay, close the dialog
      setTimeout(() => {
        onOpenChange(false);
        setVerificationSent(false);
      }, 3000);
    } catch (err) {
      // Error is handled by auth context and displayed in UI
    }
  }, [signUpEmail, signUpPassword, signUpConfirmPassword, signUp, clearError, onOpenChange]);

  /**
   * Handle Google sign-in.
   */
  const handleGoogleSignIn = useCallback(async () => {
    clearError();

    try {
      await signInWithGoogle();
      // Success - close dialog
      onOpenChange(false);
    } catch (err) {
      // Error is handled by auth context and displayed in UI
    }
  }, [signInWithGoogle, clearError, onOpenChange]);

  /**
   * Handle password reset form submission.
   */
  const handlePasswordReset = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await resetPassword(resetEmail);
      setResetSent(true);
    } catch (err) {
      // Error is handled by auth context and displayed in UI
    }
  }, [resetEmail, resetPassword, clearError]);

  /**
   * Handle switching back to sign-in from password reset.
   */
  const handleBackToSignIn = useCallback(() => {
    setShowPasswordReset(false);
    setResetSent(false);
    setResetEmail('');
    clearError();
  }, [clearError]);

  /**
   * Handle re-opening sign-in dialog from provider linking prompt.
   */
  const handleOpenSignInFromLinking = useCallback(() => {
    setShowProviderLinking(false);
  }, []);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
          <DialogTitle>
            {showPasswordReset ? 'Reset Password' : 'Welcome to PolishedCharts'}
          </DialogTitle>
          <DialogDescription>
            {showPasswordReset
              ? 'Enter your email to receive a password reset link.'
              : 'Sign in to access your alerts and watchlist, or create a new account.'}
          </DialogDescription>
        </DialogHeader>

        {/* Error Display */}
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Success Messages */}
        {verificationSent && (
          <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400">
            Verification email sent! Please check your inbox and click the link to verify your account.
          </div>
        )}

        {resetSent && (
          <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400">
            If an account exists with this email, we sent an email with instructions to reset your password.
          </div>
        )}

        {/* Password Reset Form */}
        {showPasswordReset ? (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="name@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Email'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleBackToSignIn}
                disabled={isLoading}
                className="w-full"
              >
                Back to Sign In
              </Button>
            </div>
          </form>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sign-in' | 'sign-up')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in">Sign In</TabsTrigger>
              <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="sign-in" className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="name@example.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="sign-up" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@example.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters long.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" disabled={isLoading || signUpPassword !== signUpConfirmPassword} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* T064-T068: Provider linking prompt for account-exists-with-different-credential error */}
      <ProviderLinkingPrompt
        open={showProviderLinking}
        onOpenChange={setShowProviderLinking}
        onOpenSignInDialog={handleOpenSignInFromLinking}
      />
    </>
  );
}

export default AuthDialog;
