/**
 * Password reset component for handling Firebase password reset flow.
 *
 * Feature: 011-firebase-auth
 * User Story 4: Password Reset
 *
 * Handles the password reset flow:
 * - User receives email with reset link containing oobCode
 * - User clicks link and is redirected to this page
 * - Component extracts oobCode from URL and verifies it
 * - User enters new password
 * - Password is reset and user can sign in
 *
 * Per FR-023: Reset links expire after a configurable time (default 24 hours)
 * Per FR-034: Generic error messages to prevent account enumeration
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'

// =============================================================================
// Types
// =============================================================================

type ResetState = 'loading' | 'invalid' | 'expired' | 'ready' | 'success' | 'error'

// =============================================================================
// Component
// =============================================================================

/**
 * PasswordReset component handles the password reset flow from email link.
 *
 * URL parameters:
 * - mode: "resetPassword" (Firebase password reset mode)
 * - oobCode: One-time code for verifying the reset request
 * - continueUrl: URL to redirect after successful reset
 *
 * The component:
 * 1. Extracts and validates the oobCode from URL
 * 2. Checks if the code is valid or expired
 * 3. Allows user to enter new password
 * 4. Confirms password reset with Firebase
 * 5. Shows success message and option to sign in
 */
export function PasswordReset() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Form state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // UI state
  const [state, setState] = useState<ResetState>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  // Get mode and oobCode from URL
  const mode = searchParams.get('mode')
  const oobCode = searchParams.get('oobCode')

  /**
   * Verify the password reset code on mount.
   */
  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode || mode !== 'resetPassword') {
        setState('invalid')
        setError('Invalid password reset link. Please request a new password reset.')
        return
      }

      try {
        // Verify the oobCode is valid and get the associated email
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode)
        setEmail(verifiedEmail)
        setState('ready')
      } catch (err: any) {
        console.error('Password reset code verification failed:', err)

        // Check if expired
        if (err.code === 'auth/expired-action-code') {
          setState('expired')
          setError('Password reset link has expired. Please request a new password reset.')
        } else if (err.code === 'auth/invalid-action-code') {
          setState('invalid')
          setError('Invalid password reset link. Please request a new password reset.')
        } else if (err.code === 'auth/user-disabled') {
          setState('error')
          setError('This account has been disabled. Please contact support.')
        } else if (err.code === 'auth/user-not-found') {
          // Generic message per FR-034 - don't reveal if account exists
          setState('invalid')
          setError('Invalid password reset link. Please request a new password reset.')
        } else {
          setState('error')
          setError('Failed to verify reset link. Please try again or request a new password reset.')
        }
      }
    }

    verifyCode()
  }, [oobCode, mode])

  /**
   * Handle password reset form submission.
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsResetting(true)

    try {
      // Confirm password reset with Firebase
      await confirmPasswordReset(auth, oobCode!, password)

      setState('success')
    } catch (err: any) {
      console.error('Password reset failed:', err)

      if (err.code === 'auth/expired-action-code') {
        setState('expired')
        setError('Password reset link has expired. Please request a new password reset.')
      } else if (err.code === 'auth/invalid-action-code') {
        setState('invalid')
        setError('Invalid password reset link. Please request a new password reset.')
      } else if (err.code === 'auth/weak-password') {
        setState('error')
        setError('Password is too weak. Please choose a stronger password.')
      } else {
        setState('error')
        setError('Failed to reset password. Please try again.')
      }
    } finally {
      setIsResetting(false)
    }
  }, [password, confirmPassword, oobCode])

  /**
   * Navigate to sign-in page.
   */
  const goToSignIn = useCallback(() => {
    navigate('/?signin=true', { replace: true })
  }, [navigate])

  // =============================================================================
  // Render States
  // =============================================================================

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  if (state === 'invalid' || state === 'expired') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Password Reset Link Error</p>
              <p className="text-sm">{error}</p>
            </AlertDescription>
          </Alert>

          <div className="mt-4 flex gap-2">
            <Button onClick={goToSignIn} variant="outline" className="flex-1">
              Go to Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              <p className="font-semibold mb-2">Password Reset Successful</p>
              <p className="text-sm">
                Your password has been reset. You can now sign in with your new password.
              </p>
            </AlertDescription>
          </Alert>

          <Button onClick={goToSignIn} className="w-full mt-4">
            Go to Sign In
          </Button>
        </div>
      </div>
    )
  }

  // =============================================================================
  // Reset Form
  // =============================================================================

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Reset Your Password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter a new password for {email}
          </p>
        </div>

        {/* Error Display */}
        {error && state === 'error' && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isResetting}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters long.
            </p>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isResetting}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isResetting || !password || !confirmPassword || password !== confirmPassword}
            className="w-full"
          >
            {isResetting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting Password...
              </>
            ) : (
              'Reset Password'
            )}
          </Button>

          {/* Password Match Error */}
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-sm text-destructive text-center">
              Passwords do not match.
            </p>
          )}
        </form>

        {/* Cancel Option */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={goToSignIn}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel and return to sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default PasswordReset
