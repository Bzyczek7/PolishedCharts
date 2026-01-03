# Research: Donation Reminder Prompts

**Feature**: 016-donation-reminder
**Date**: 2025-01-03
**Status**: Phase 0 - Research Complete

## Overview

This document consolidates research findings for implementing donation reminder prompts with usage time tracking, idle detection, and animated display. All clarifications from Technical Context have been resolved.

---

## Decision 1: Usage Time Tracking with Idle Detection

**What was chosen**: Custom React hook using `useEffect` + `useRef` with event listeners for mouse/keyboard activity detection

**Rationale**:
- Full control over idle detection logic (15-30 minute timeout configurable)
- No additional dependencies needed
- Lightweight and performant
- Easy to test deterministically
- Works offline (localStorage-based persistence)

**Alternatives considered**:
- `react-idle-timer` library: Provides idle detection but adds dependency for relatively simple logic
- `@uidotdev/usehooks` useIdle hook: Popular but requires external dependency for minimal functionality
- Web Worker approach: Overkill for this use case, adds complexity

**Implementation approach**:
```typescript
// useUsageTimeTracker hook
- Track session start time in localStorage
- Use ref to accumulate active time (resets on new session)
- Listen to 'mousedown', 'keydown', 'scroll', 'touchstart' events
- Reset idle timer on any user activity
- Pause time accumulation when idle threshold (20min) exceeded
- Resume accumulation when activity returns
```

**Testing strategy**:
- Mock timers with vi.useFakeTimers() for deterministic testing
- Test idle timeout behavior with accelerated time
- Test pause/resume on activity events
- Test localStorage persistence across page reloads

---

## Decision 2: Toast/Notification Library

**What was chosen**: Build custom modal/toast component using CSS animations

**Rationale**:
- Existing project uses react-hot-toast for notifications (see ToastNotification.tsx)
- Donation prompts require more custom styling and animation than standard toasts
- Need precise control over positioning, animation timing, and dismiss behavior
- Custom component allows branding consistency with app design
- No additional library dependency

**Alternatives considered**:
- `react-hot-toast` (already in project): Good for simple notifications but limited customization for complex prompts
- `react-hot-toast` with custom render: Possible but adds complexity over building custom component
- `framer-motion`: Powerful animation library but heavy dependency for simple fade-in/slide animations

**Implementation approach**:
```typescript
// DonationPrompt.tsx component
- Fixed positioning (bottom-right or bottom-center)
- CSS keyframe animations for fade-in + subtle slide
- Portal-based rendering to avoid z-index conflicts
- Dismiss button with keyboard (Escape) support
- Responsive design for mobile/desktop
```

---

## Decision 3: Animation Approach

**What was chosen**: CSS animations with CSS transforms

**Rationale**:
- Best performance (GPU-accelerated, no main thread blocking)
- Meets 60fps requirement from constitution
- Sufficient for "flashy but non-intrusive" requirement
- No additional dependencies
- Easier to maintain and tweak

**Alternatives considered**:
- Framer Motion: Powerful but heavy (40KB+), overkill for simple animations
- React Spring: Good physics but adds complexity and dependency
- Web Animations API: Modern but less browser support than CSS

**Implementation approach**:
```css
/* Animation specifications */
- Fade-in: opacity 0 → 1 over 300ms (ease-out)
- Slide-up: transform translateY(20px) → 0 over 300ms (ease-out)
- Pulse: subtle scale animation (1.0 → 1.02 → 1.0) every 3s to attract attention
- Dismiss: fade-out over 200ms (ease-in)
```

---

## Decision 4: Member/Donor Status Detection

**What was chosen**: localStorage flag for membership status (manual opt-in)

**Rationale**:
- No backend integration per spec assumptions
- Privacy-focused (no external API calls to verify membership)
- Simple to implement and test
- Users can self-identify as supporters
- Future-proof: easy to add backend verification later

**Alternatives considered**:
- Ko-fi API integration: Requires backend changes, OAuth, adds complexity
- Firebase custom claims: Possible but requires backend integration
- Browser localStorage only: Simplest, matches "no backend changes" assumption

**Implementation approach**:
```typescript
// localStorage keys
- 'tradingapp_member_status': 'free' | 'supporter' | 'member'
- 'tradingapp_prompt_dismissed_1h': timestamp
- 'tradingapp_prompt_dismissed_4h': timestamp
```

**Future enhancement**:
- Add backend API to verify Ko-fi membership
- Add Firebase custom claims integration
- Link Ko-fi webhook to update membership status

---

## Decision 5: UTM Parameter Construction

**What was chosen**: Helper function to construct UTM parameters in URL

**Rationale**:
- Simple string manipulation, no library needed
- Testable and type-safe
- Consistent UTM parameters across all prompts
- Easy to extend for future campaigns

**Implementation approach**:
```typescript
function buildKoFiUrl(campaign: '1h' | '4h'): string {
  const baseUrl = 'https://ko-fi.com/marekdabrowski';
  const params = new URLSearchParams({
    utm_source: 'tradingapp',
    utm_medium: 'prompt',
    utm_campaign: campaign
  });
  return `${baseUrl}?${params.toString()}`;
}
```

---

## Decision 6: Storage Strategy

**What was chosen**: localStorage for all session state

**Rationale**:
- Matches "no backend changes" assumption
- Works offline (constitution-compliant)
- Simple key-value storage sufficient for requirements
- Automatic cleanup on browser close (session-based)

**Storage schema**:
```typescript
// Session state (resets on tab close)
- 'tradingapp_session_start': timestamp
- 'tradingapp_active_time_ms': accumulated active time

// Per-session flags
- 'tradingapp_prompt_shown_1h': boolean
- 'tradingapp_prompt_shown_4h': boolean

// Persistent state (across sessions)
- 'tradingapp_member_status': 'free' | 'supporter' | 'member'
```

---

## Best Practices Identified

### React Hooks for Time Tracking
- Use `useRef` for values that don't trigger re-renders (accumulated time, idle timer)
- Use `useEffect` with cleanup for event listener registration
- Use `useCallback` for event handlers to avoid recreating listeners
- Mock `Date.now()` and timers for testing

### Performance Considerations
- Debounce activity events to avoid excessive state updates (100ms debounce)
- Use CSS transforms instead of layout-triggering properties
- Avoid frequent localStorage writes (batch updates, max once per minute)
- Use `requestIdleCallback` for non-critical updates if needed

### Accessibility
- Prompt must be keyboard navigable (Focus trap, Escape to dismiss)
- ARIA live region for screen reader announcement
- High contrast mode support
- Reduced motion support (respect `prefers-reduced-motion`)

### Mobile Considerations
- Touch events as well as mouse/keyboard
- Responsive positioning (bottom-center on mobile, bottom-right on desktop)
- Smaller font sizes and compact layout on mobile
- Prevent prompt from obscuring chart interactions

---

## Open Questions Resolved

1. **Idle timeout duration**: 20 minutes chosen as middle of 15-30 min range (configurable)
2. **Toast library**: Build custom component for better control
3. **Animation library**: CSS animations sufficient, no additional library
4. **Member detection**: localStorage flag for now, backend integration deferred

---

## Dependencies Required

**No new dependencies** - this feature uses:
- React 19 (existing)
- TypeScript 5.9+ (existing)
- Existing CSS modules pattern
- Existing test utilities (vitest, React Testing Library)

---

## Next Steps (Phase 1)

1. Generate `data-model.md` with TypeScript interfaces
2. Generate API contracts (component props, hook interfaces)
3. Generate `quickstart.md` with usage examples
4. Update agent context with new technology choices
