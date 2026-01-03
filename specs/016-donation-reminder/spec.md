# Feature Specification: Donation Reminder Prompts

**Feature Branch**: `016-donation-reminder`
**Created**: 2025-01-03
**Status**: Draft
**Input**: User description: "i want to create a toast or messege of some kind to appear after one hour of usage where it says that whomever is using the product since they have been using it for 1 h ... they should consider helping me by buying me coffe at https://ko-fi.com/marekdabrowski ... they can even become a member for as little as 5$ a month. The next financial goal is to have real time data. It would be worth it to become a member. Make it flashy ... Than to the same after 4h of the user being loged in ... that they must REALLY like the product .. etc ... but don't make it to intrusive ... something animated .. because movement catches eye"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First Hour Feedback Request (Priority: P1)

A user has been actively using the trading platform for one continuous hour. The system displays an animated, eye-catching but non-intrusive message asking if they're enjoying the product and inviting them to share feedback or suggestions for improvement. The message provides options to leave feedback (via message box or GitHub issues), dismiss, or optionally support the project.

**Why this priority**: This builds rapport and gathers valuable user feedback early in their journey. One hour represents meaningful engagement where users have formed initial impressions. Feedback-first approach establishes a relationship before asking for support.

**Independent Test**: Can be fully tested by using the application for one hour and verifying the prompt appears with correct messaging, feedback options, and functionality (message box opens, links work, can be dismissed).

**Acceptance Scenarios**:

1. **Given** a user has been actively using the application for 60 continuous minutes, **When** the one-hour threshold is reached, **Then** an animated feedback prompt message appears
2. **Given** the feedback prompt is displayed, **When** the user views the message, **Then** it includes:
   - Personal acknowledgment: "I see you've been using the product for a while now..."
   - Question: "Does this mean you like it? Do you want to help improve it?"
   - Call-to-action button: "Leave Feedback" (opens message box)
   - Optional link to GitHub issues for technical feedback
   - Dismiss button
   - Optional secondary link: "Or support the project" (links to Ko-fi with UTM tracking)
3. **Given** the user clicks "Leave Feedback", **When** the button is clicked, **Then** a message box/modal appears allowing them to type and submit feedback
4. **Given** the feedback message box is open, **When** the user submits feedback, **Then** the feedback is stored locally and can be retrieved later by the developer
5. **Given** the user clicks "Or support the project", **When** the link is clicked, **Then** the Ko-fi page opens in a new tab with UTM tracking (https://ko-fi.com/marekdabrowski?utm_source=tradingapp&utm_medium=prompt&utm_campaign=1h)
6. **Given** the feedback prompt is displayed, **When** the user dismisses it, **Then** the message closes and does not reappear for the remainder of the session

---

### User Story 2 - Four Hour Dedicated User Prompt (Priority: P2)

A user has been actively using the trading platform for four continuous hours. The system displays a second animated message acknowledging their extensive usage and enthusiasm for the product, and encourages them to support the project's development through donation or membership.

**Why this priority**: This targets the most engaged users who have derived significant value from the platform. These power users are more likely to convert to paying supporters. It's lower priority because fewer users reach this threshold.

**Independent Test**: Can be fully tested by using the application for four hours after dismissing the one-hour prompt, and verifying the second prompt appears with appropriate messaging for long-term users.

**Acceptance Scenarios**:

1. **Given** a user has been actively using the application for 240 continuous minutes (4 hours), **When** the four-hour threshold is reached, **Then** a second animated donation prompt appears
2. **Given** the user has already seen the one-hour prompt, **When** the four-hour threshold is reached, **Then** the prompt acknowledges their continued usage and enthusiasm
3. **Given** the four-hour prompt is displayed, **When** the user views the message, **Then** it includes:
   - Acknowledgment of their four hours of usage
   - Messaging that they "must really like the product"
   - Link to Ko-fi donation page with UTM tracking (https://ko-fi.com/marekdabrowski?utm_source=tradingapp&utm_medium=prompt&utm_campaign=4h)
   - Membership option information
4. **Given** the four-hour prompt is displayed, **When** the user dismisses the prompt, **Then** the message closes and does not reappear for the remainder of the session

---

### User Story 3 - Animated Non-Intrusive Design (Priority: P1)

The donation prompts use subtle animation to attract attention without disrupting the user's workflow or trading activities. The movement catches the eye but the prompts remain easy to dismiss and do not block critical functionality.

**Why this priority**: User experience is critical. Intrusive prompts could frustrate users and reduce platform usage, defeating the purpose of the feature. Good UX ensures positive association with the donation request.

**Independent Test**: Can be tested by observing the prompt behavior during active trading activities, verifying animations are visible but not disruptive, and that core application features remain accessible while the prompt is displayed.

**Acceptance Scenarios**:

1. **Given** the application is displaying trading charts or data, **When** a donation prompt appears, **Then** the prompt does not obscure critical trading information or controls
2. **Given** a donation prompt appears, **When** the user is interacting with the application, **Then** the prompt uses subtle animation (fade-in, gentle movement) rather than jarring transitions
3. **Given** a donation prompt is displayed, **When** the user continues working, **Then** all application features remain fully functional
4. **Given** a donation prompt is displayed, **When** the user wants to dismiss it, **Then** a clear, easily clickable dismiss button is available

---

### User Story 4 - Supporter Appreciation Prompts (Priority: P3)

A user who has already donated or become a member reaches the usage time thresholds. Instead of asking for money again, the system displays prompts that thank them for their existing support and suggest other ways they can help the project (sharing feedback, filing GitHub issues, spreading the word, etc.).

**Why this priority**: Important for maintaining good relationships with existing supporters. This is lower priority because it applies to a smaller subset of users (those who have already donated/membership status can be detected).

**Independent Test**: Can be tested by simulating an existing member/donor status and verifying that prompts appear with gratitude-focused messaging instead of donation requests.

**Acceptance Scenarios**:

1. **Given** a user with existing donor/member status has been using the application for 60 minutes, **When** the one-hour threshold is reached, **Then** an appreciation prompt appears thanking them for their support
2. **Given** the appreciation prompt is displayed, **When** the user views the message, **Then** it includes:
   - Thank you message for their existing support
   - Suggestions for non-monetary ways to help (feedback, GitHub issues, sharing)
   - No direct request for additional donations or membership
3. **Given** an existing supporter reaches four hours of usage, **When** the four-hour threshold is reached, **Then** a second appreciation prompt acknowledges their continued engagement and support

---

### User Story 5 - Feedback Collection and Retrieval (Priority: P1)

A user submits feedback through the message box. The system stores the feedback locally with metadata (timestamp, session info, optional contact info) and provides a mechanism for the developer to retrieve all collected feedback.

**Why this priority**: Feedback collection is the primary purpose of the 1-hour prompt. Without storage and retrieval, the feedback feature is incomplete.

**Independent Test**: Can be tested by submitting feedback through the message box and verifying it's stored correctly, then using a retrieval mechanism (admin panel, export function, or localStorage inspection) to access the feedback.

**Acceptance Scenarios**:

1. **Given** the feedback message box is displayed, **When** the user types feedback and clicks submit, **Then** the feedback is stored with timestamp and session metadata
2. **Given** feedback is submitted, **When** stored, **Then** it includes:
   - User's feedback text
   - Submission timestamp
   - Session ID (for correlation)
   - Active usage time at submission
   - Optional: user email/contact if provided
3. **Given** multiple feedback submissions exist, **When** the developer retrieves feedback, **Then** all feedback entries are returned in chronological order
4. **Given** the feedback is retrieved, **When** viewed, **Then** it can be exported as JSON or CSV for analysis
5. **Given** feedback is submitted, **When** stored locally, **Then** it persists across browser sessions (using localStorage)

---

### Edge Cases

- What happens when the user closes and reopens the browser before reaching the time threshold?
  - Usage time resets when browser tab/window is closed
- What happens if the user has already donated or become a member?
  - They see prompts with different messaging thanking them for support and suggesting non-monetary ways to help (share feedback, GitHub issues, spread the word)
- What happens if the user reaches 4 hours in a single session but saw the 1-hour prompt days ago?
  - The 4-hour prompt should trigger based on current session duration
- What happens if multiple users share the same device/browser?
  - Each session is treated independently; prompts appear based on current session usage
- What happens if the user is idle (no activity) but the browser remains open?
  - Usage timer pauses after 15-30 minutes of no mouse/keyboard interaction and resumes when activity returns
- What happens on mobile devices with smaller screens?
  - Prompts and message box should be responsive and not take up excessive screen space
- What happens if the user has seen the prompt previously in another session?
  - Prompts appear once per session based on time thresholds
- What happens if the user submits feedback multiple times?
  - Each submission is stored separately with its own timestamp
- What happens if localStorage is full?
  - Feedback submissions use a separate storage key space; oldest entries can be pruned if needed
- What happens if the user submits empty feedback?
  - System should validate that feedback is not empty before storing
- What happens if the developer retrieves feedback while user is submitting?
  - localStorage operations are atomic; no conflicts occur

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST track application usage time starting from when the user first loads the application
- **FR-002**: System MUST display an animated feedback request prompt after 60 minutes of usage
- **FR-003**: System MUST display a second animated donation prompt after 240 minutes of usage
- **FR-004**: The one-hour prompt MUST ask if the user likes the product and wants to help improve it
- **FR-004a**: The one-hour prompt MUST include a "Leave Feedback" button that opens a message box/modal
- **FR-004b**: The one-hour prompt MUST include an optional link to GitHub issues for technical feedback
- **FR-004c**: The one-hour prompt MUST include an optional secondary link to Ko-fi with UTM tracking for users who want to support
- **FR-005**: The four-hour donation prompt MUST include a clickable link to https://ko-fi.com/marekdabrowski with UTM tracking parameters that opens in a new tab
- **FR-005a**: Four-hour prompt MUST include UTM parameters: ?utm_source=tradingapp&utm_medium=prompt&utm_campaign=4h
- **FR-006**: Four-hour donation prompt MUST mention the $5/month membership option
- **FR-007**: Four-hour donation prompt MUST reference that contributions fund real-time data features
- **FR-008**: The four-hour prompt MUST acknowledge the user's extended usage and enthusiasm ("you must really like the product")
- **FR-009**: All prompts MUST include a dismiss button that closes the prompt for the current session
- **FR-010**: Once dismissed, prompts MUST NOT reappear in the same session
- **FR-011**: Prompts MUST use animation to attract attention without being intrusive
- **FR-012**: Prompts MUST NOT obscure critical trading information or application controls
- **FR-013**: All application features MUST remain fully accessible while prompts are displayed
- **FR-014**: System MUST measure usage time using a hybrid approach: count browser open time but pause the timer after 15-30 minutes of no mouse/keyboard interaction, and resume when activity returns
- **FR-015**: For users identified as existing donors or members, prompts MUST display appreciation messaging thanking them for support instead of requesting donations
- **FR-016**: Supporter appreciation prompts MUST include suggestions for non-monetary ways to help the project (share feedback, file GitHub issues, spread the word)
- **FR-017**: Supporter appreciation prompts MUST NOT include direct requests for additional donations or membership
- **FR-018**: System MUST provide a message box/modal for users to submit feedback
- **FR-019**: Feedback submissions MUST be stored locally with timestamp, session ID, and usage time metadata
- **FR-020**: Feedback submissions MUST persist across browser sessions using localStorage
- **FR-021**: System MUST provide a mechanism for the developer to retrieve all collected feedback (admin panel, export function, or localStorage access)
- **FR-022**: Feedback retrieval MUST support export to JSON or CSV format for analysis

### Key Entities

- **Usage Session**: Represents a period of continuous application usage, tracks elapsed time since session start
- **Prompt**: Represents the message displayed to users (feedback request at 1h, donation request at 4h), contains messaging content, timing trigger, and dismissed state
- **Prompt Display**: Represents the visual presentation of prompts, includes animation behavior, position on screen, and dismissal state
- **Feedback Submission**: Represents user feedback submitted through the message box, contains feedback text, timestamp, session ID, usage time, and optional contact info

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of users who reach one hour of usage see the feedback request prompt
- **SC-002**: 100% of users who reach four hours of usage see the donation prompt
- **SC-003**: Users can dismiss prompts in under 2 seconds
- **SC-004**: Prompts do not interfere with trading activities - users can perform all actions while prompt is visible
- **SC-005**: Less than 5% of users report prompts as intrusive or annoying (measured through their feedback)
- **SC-006**: At least 10% of users who see the 4-hour prompt click through to the Ko-fi page
- **SC-006a**: Ko-fi links include UTM parameters for campaign tracking in Ko-fi analytics (4h prompt performance)
- **SC-007**: At least 5% of users who see the 1-hour prompt submit feedback through the message box
- **SC-008**: Animation is visible and attracts attention without causing user distraction (measured via observation/testing)
- **SC-009**: Prompts are fully readable on mobile, tablet, and desktop screen sizes
- **SC-010**: Feedback submissions are successfully stored and retrievable by the developer

### Assumptions

1. **Time Measurement**: Usage time is measured from when the user first loads the application in a browser session
2. **Session Persistence**: Usage time tracking resets when the user closes the browser tab/window
3. **Single Display**: Each prompt type (1-hour, 4-hour) appears only once per session
4. **Member Status**: Existing donors/members see prompts with appreciation messaging and non-monetary help suggestions (feedback, GitHub issues, sharing)
5. **Active vs. Passive Time**: Hybrid approach - count browser open time but pause timer after 15-30 minutes of no interaction (mouse/keyboard), resume when activity returns
6. **Animation Style**: "Flashy" means eye-catching through subtle animation (fade-in, gentle movement), not intrusive pop-ups or alerts
7. **Messaging Tone**: Prompts should feel personal and conversational, like a direct request from the developer, not generic marketing copy
8. **Ko-fi Integration**: The Ko-fi page is external and no integration with their payment system is required
9. **No Backend Changes**: Usage tracking can be implemented on the frontend without database changes
10. **Idle Timeout**: 15-30 minutes of inactivity before usage timer pauses (specific duration to be determined during implementation)
