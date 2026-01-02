# Visual Verification Request: Firebase Authentication UI Components

**Feature**: 011-firebase-auth
**Component**: Auth UI Components (AuthDialog, ProviderLinkingPrompt, EmailVerificationPrompt, UserMenu)
**Constitution Version**: 1.2.0
**Date**: 2025-12-30

---

## Context

Per Constitution v1.2.0, all visual, UI, or styling additions require explicit verification by the project maintainer before merging. This feature adds several new authentication UI components that need visual verification.

**User Stories Addressed**:
- US1: Email and Password Registration (P1) - AuthDialog sign-in/sign-up forms
- US2: Google OAuth Sign-In (P1) - AuthDialog Google sign-in button
- US3: Guest Access with Optional Sign-In (P1) - Landing page integration
- US4: Password Reset (P2) - AuthDialog password reset flow
- US5: Sign Out (P2) - UserMenu sign-out button
- US7: Provider Linking (P2) - ProviderLinkingPrompt component

---

## 1. Exact Reproduction Steps

### Prerequisites
1. Ensure Firebase is configured (see `quickstart.md` Step 1-2)
2. Backend server running: `cd backend && python start_server.py`
3. Frontend dev server running: `cd frontend && npm run dev`
4. Firebase project created with Email/Password and Google OAuth providers enabled

### Test Scenarios

#### Scenario 1: Landing Page with Auth Dialog
1. Navigate to http://localhost:5173
2. Observe the landing page with "Log in" button in header
3. Click "Log in" button
4. AuthDialog should appear

#### Scenario 2: Email Sign-Up Flow
1. Open AuthDialog (via landing page "Log in" or direct URL)
2. Click "Sign Up" tab
3. Enter email: `test@example.com`
4. Enter password: `testpass123` (8+ characters)
5. Enter confirm password: `testpass123`
6. Click "Create Account"
7. Observe verification sent message

#### Scenario 3: Email Sign-In Flow
1. Open AuthDialog
2. Stay on "Sign In" tab
3. Enter email and password
4. Click "Sign In"
5. Observe successful sign-in

#### Scenario 4: Google Sign-In Flow
1. Open AuthDialog
2. Click "Sign in with Google" button
3. Complete Google OAuth flow
4. Observe successful sign-in

#### Scenario 5: Password Reset Flow
1. Open AuthDialog
2. Click "Forgot password?" link
3. Enter email address
4. Click "Send Reset Email"
5. Observe confirmation message

#### Scenario 6: Provider Linking Flow
1. Create account with email/password
2. Sign out
3. Click "Sign in with Google" with SAME email
4. Observe ProviderLinkingPrompt dialog
5. Follow instructions to link accounts

#### Scenario 7: Sign-Out Flow
1. Sign in with any method
2. Click user avatar/name in header
3. Click "Sign out" in UserMenu dropdown
4. Observe return to landing page

#### Scenario 8: Responsive Design
1. Repeat Scenarios 1-7 on:
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

---

## 2. Visual Artifacts to Verify

The following components should be visually verified:

### AuthDialog Component
- **Location**: `frontend/src/components/AuthDialog.tsx`
- **States to verify**:
  - Sign-in form (default state)
  - Sign-up form (with password confirmation)
  - Password reset form
  - Loading states (buttons with spinner)
  - Error states (error message display)
  - Success states (verification sent, reset sent)

### ProviderLinkingPrompt Component
- **Location**: `frontend/src/components/ProviderLinkingPrompt.tsx`
- **States to verify**:
  - Initial prompt dialog
  - Loading state during linking

### UserMenu Component
- **Location**: `frontend/src/components/UserMenu.tsx`
- **States to verify**:
  - User profile display (avatar, name, email)
  - Dropdown menu with sign-out option

### LandingPage Integration
- **Location**: `frontend/src/LandingPage.tsx` and `frontend/src/App.tsx`
- **States to verify**:
  - "Log in" button in header
  - "Sign in with Google" button on landing page
  - "Email login" button on landing page
  - AuthDialog appears when buttons clicked

---

## 3. Acceptance Criteria

### Layout and Spacing
- [ ] Dialogs are centered on screen with proper margins
- [ ] Form fields have consistent spacing (labels, inputs, buttons)
- [ ] Buttons are properly aligned (full-width on mobile, appropriate width on desktop)
- [ ] Error/success messages have appropriate padding and border-radius

### Typography
- [ ] Font sizes are hierarchy-appropriate (headings larger than body)
- [ ] Font weights follow design system (bold for headings, medium for buttons)
- [ ] Text contrast meets accessibility standards (WCAG AA)

### Colors
- [ ] Primary buttons use brand color (#DC143C)
- [ ] Secondary buttons use outline variant (border with background)
- [ ] Error messages use destructive color (red)
- [ ] Success messages use green color
- [ ] Links have appropriate hover states

### Interactive States
- [ ] Buttons have visible hover states
- [ ] Buttons have disabled states (with opacity and cursor change)
- [ ] Loading states show spinner animation
- [ ] Input fields show focus state (border color change)

### Responsive Behavior
- [ ] Dialogs adapt to mobile screens (full width or appropriately sized)
- [ ] Form fields stack vertically on mobile
- [ ] Button text remains readable on small screens
- [ ] No horizontal scroll on mobile

### Accessibility
- [ ] All form inputs have associated labels
- [ ] Error messages are associated with form fields
- [ ] Buttons have accessible text (not just icons)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators are visible

### Copy and Wording
- [ ] Headings are clear and concise
- [ ] Button labels use action-oriented language ("Sign In", "Create Account")
- [ ] Error messages are user-friendly and actionable
- [ ] Help text is brief and helpful

---

## 4. Specific Component Checks

### AuthDialog
- [ ] Tabs ("Sign In" / "Sign Up") switch correctly
- [ ] "Forgot password?" link is visible and clickable
- [ ] Password confirmation validation works (match/non-match)
- [ ] Google sign-in button shows Google icon
- [ ] "Or continue with" separator displays correctly
- [ ] Back to Sign In button appears in password reset flow

### ProviderLinkingPrompt
- [ ] Dialog title is clear: "Link Your Accounts"
- [ ] Email address is displayed correctly
- [ ] Instructions are numbered (1, 2)
- [ ] "Sign In with Email" button is primary action
- [ ] "Link Accounts" button appears after sign-in
- [ ] Cancel button is present

### UserMenu
- [ ] Avatar displays correctly (with or without photo)
- [ ] User name/email are truncated if too long (ellipsis)
- [ ] Dropdown menu has proper z-index (appears above other content)
- [ ] "Sign out" option is clearly labeled

---

## 5. Known Limitations and Manual Notes

### Email Verification
- Email verification requires actual email delivery (Firebase sends real emails)
- For testing, use Firebase Emulator or real test accounts
- Verification link opens the app and auto-signs in (per FR-003)

### Google OAuth
- Requires real Google account for testing
- Popup may be blocked by browser popup blockers
- Test with different Google accounts to verify provider linking

### Provider Linking
- Requires two different providers (email/password + Google)
- Must use the same email address for both providers
- Linking flow requires multiple steps (documented in prompt)

---

## 6. Post-Verification Checklist

After visual verification is complete:

- [ ] All acceptance criteria above have been validated
- [ ] Screenshots/recordings have been taken for documentation
- [ ] Any issues found have been documented or fixed
- [ ] Constitution v1.2.0 compliance verified
- [ ] Ready to merge (if all checks pass)

---

## 7. References

- **Specification**: `/specs/011-firebase-auth/spec.md`
- **Plan**: `/specs/011-firebase-auth/plan.md`
- **Tasks**: `/specs/011-firebase-auth/tasks.md`
- **Quickstart**: `/specs/011-firebase-auth/quickstart.md`
- **Constitution**: `/.specify/memory/constitution.md` (v1.2.0)

---

**Verification Requested By**: Implementation via /speckit.implement
**Verification Required By**: Project Maintainer
**Status**: ⏳ Pending Visual Verification
