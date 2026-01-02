# Tasks: Indicator Legend/Pane Header - Hover-Reveal Action Icons

**Input**: User request to hide action icons by default and reveal them on hover/keyboard focus
**Prerequisites**: Existing `IndicatorHeader.tsx` and `OverlayIndicatorLegend.tsx` components

**Tests**: Not explicitly requested - UI verification is sufficient

**Organization**: Single-phase implementation for both oscillator and overlay indicators

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (N/A for this enhancement)
- Include exact file paths in descriptions

## Phase 1: Implementation

**Purpose**: Add hover-reveal behavior to action icons in indicator headers

- [X] T001 [P] Update IndicatorHeader.tsx to hide action icons by default using opacity-0 + transition-opacity in frontend/src/components/IndicatorHeader.tsx
- [X] T002 [P] Add group class to IndicatorHeader root div with group-hover:opacity-100 on icon buttons container in frontend/src/components/IndicatorHeader.tsx
- [X] T003 [P] Add group-focus-within:opacity-100 to icon buttons container for keyboard focus in frontend/src/components/IndicatorHeader.tsx
- [X] T004 [P] Remove pointer-events-none from root container, add pointer-events-auto to icon button container in frontend/src/components/IndicatorHeader.tsx
- [X] T005 [P] Update OverlayIndicatorLegend.tsx to hide action icons by default using opacity-0 + transition-opacity in frontend/src/components/OverlayIndicatorLegend.tsx
- [X] T006 [P] Add group class to legend container with group-hover:opacity-100 on hover targets in frontend/src/components/OverlayIndicatorLegend.tsx
- [X] T007 [P] Add group-focus-within:opacity-100 to action elements for keyboard focus in frontend/src/components/OverlayIndicatorLegend.tsx
- [X] T008 [P] Review and adjust pointer-events settings in overlay legend to ensure hoverability in frontend/src/components/OverlayIndicatorLegend.tsx

**Checkpoint**: ✅ COMPLETE - Action icons in both oscillator panes and overlay legends are hidden by default and revealed on hover or keyboard focus

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Implementation)**: No dependencies - all tasks can run in parallel

### Parallel Opportunities

- All tasks marked [P] in Phase 1 can run in parallel as they target different files or different concerns within the same file

---

## Implementation Strategy

### Single-Phase Delivery

1. Execute all tasks in Phase 1 (can be done in parallel)
2. Test visually: hover over indicator names, verify icons appear smoothly
3. Test keyboard: Tab focus to indicator rows, verify icons appear
4. Verify layout stability (icons take up space but are invisible, no layout shift)

### Key Technical Decisions

1. **Tailwind Classes to Use**:
   - `opacity-0` - hidden by default
   - `transition-opacity` - smooth fade in/out
   - `duration-200` - 200ms transition (optional, for smoother feel)
   - `group` - on parent container
   - `group-hover:opacity-100` - reveal on hover
   - `group-focus-within:opacity-100` - reveal on keyboard focus
   - `pointer-events-auto` - on interactive icon buttons

2. **Layout Stability**:
   - Icons remain in DOM (not conditionally rendered)
   - Only opacity changes, not display or visibility
   - No layout shift when icons appear/disappear

3. **Accessibility**:
   - `group-focus-within` ensures keyboard users can see icons
   - Icons remain focusable when hidden (just not visible)
   - Smooth transition avoids jarring appearance

---

## Notes

- This is a UI enhancement, no backend changes required
- Focus on smooth transitions and layout stability
- Ensure both mouse and keyboard users have good experience
- Test with both oscillator indicators (IndicatorHeader) and overlay indicators (OverlayIndicatorLegend)
