# Feature Specification: Customer Recording Library

**Feature Branch**: `001-customer-recording-library`

**Created**: 2026-06-08

**Status**: Draft

**Input**: Customer can browse and replay all their past lesson recordings inside the platform.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse the Recording Library (Priority: P1)

A customer visits their Recording Library page from the sidebar and sees a list of all their past lesson sessions that have a recording available. Each entry shows the event name, lesson type, and date. The customer can scroll through the full list and understand at a glance what they have available to watch.

**Why this priority**: This is the foundation of the feature — without a usable list, nothing else is reachable. Delivers standalone value even without filtering or playback.

**Independent Test**: Load the library page for customer 10001 (heavy: 461 sessions). Confirm recordings with a `recording_url` appear in the list with name, lesson type, and date. Confirm sessions without a recording do not appear.

**Acceptance Scenarios**:

1. **Given** a customer with past sessions that have recordings, **When** they navigate to `/customer/[id]/library`, **Then** they see a list of all those sessions, each showing the event name, lesson type, and date.
2. **Given** a customer with no past sessions that have recordings, **When** they navigate to the library, **Then** they see a clear empty-state message explaining there are no recordings yet.
3. **Given** a customer with past sessions but none have recordings, **When** they navigate to the library, **Then** they see the same empty-state message.

---

### User Story 2 — Filter and Search Recordings (Priority: P2)

A customer narrows down the list by typing a search term, selecting a lesson type, or picking a date range. The list updates to show only matching recordings. When no results match, an informative message is shown.

**Why this priority**: Customers with many sessions (e.g. 461 entries) need filtering to find anything useful. Without it the list is hard to navigate, but the page still works without it.

**Independent Test**: On customer 10001's library, filter by a specific lesson type — confirm the list shows only matching entries. Clear the filter — confirm all recordings return. Enter a search term that matches no event names — confirm the no-results state is shown.

**Acceptance Scenarios**:

1. **Given** an unfiltered library list, **When** the customer selects a lesson type from the filter, **Then** only recordings of that lesson type are displayed.
2. **Given** an unfiltered library list, **When** the customer enters a search term, **Then** only recordings whose event name contains that term (case-insensitive) are displayed.
3. **Given** an unfiltered library list, **When** the customer sets a date range, **Then** only recordings that fall within that range are displayed.
4. **Given** active filters, **When** the resulting list is empty, **Then** a "no results for current filters" message is shown with an option to clear filters.
5. **Given** active filters, **When** the customer clears all filters, **Then** the full recording list is restored.

---

### User Story 3 — Play a Recording (Priority: P2)

A customer clicks a recording from the list and watches it inside the platform without leaving the page. The player handles the three common link types they may encounter: a direct video file, a Vimeo-hosted video, and a Zoom cloud recording. If the link is broken or unplayable, the customer sees a clear error rather than a blank screen.

**Why this priority**: Playback is the core value of the library; filtering is useless without something to open. Tied with P2 filtering in importance, but both require the list to exist first.

**Independent Test**: Open a recording with each URL type (mp4, Vimeo, Zoom) in turn. Confirm each plays correctly in-app. Then test a recording with a deliberately broken URL and confirm an error state is shown.

**Acceptance Scenarios**:

1. **Given** a recording with a direct video file URL, **When** the customer clicks it, **Then** a video player loads and plays the file in-app.
2. **Given** a recording with a Vimeo URL, **When** the customer clicks it, **Then** an embedded Vimeo player loads and plays the video in-app.
3. **Given** a recording with a Zoom cloud recording URL, **When** the customer clicks it, **Then** an appropriate viewer or fallback is shown (either embedded or a clear link to open in Zoom).
4. **Given** a recording whose URL is broken or unreachable, **When** the customer clicks it, **Then** an error state is shown explaining the recording is unavailable, rather than a blank or crashed player.

---

### User Story 4 — Resume Where You Left Off (Priority: P3)

A customer starts watching a recording, navigates away, and returns later. The player automatically resumes from where they stopped.

**Why this priority**: Comfort feature that significantly improves long-session usability, but the feature is fully viable without it.

**Independent Test**: Start watching a recording, note the timestamp, close or navigate away, return to the same recording — confirm playback resumes near the saved position.

**Acceptance Scenarios**:

1. **Given** a customer who has previously watched part of a recording, **When** they open that recording again, **Then** the player starts from their last saved position.
2. **Given** a customer opening a recording for the first time, **When** they open it, **Then** the player starts from the beginning.
3. **Given** a customer who has watched a recording to completion, **When** they open it again, **Then** the player starts from the beginning (not from the very end).

---

### User Story 5 — Mark a Recording as Reviewed (Priority: P3)

A customer marks a recording as "reviewed" after they finish it. Reviewed recordings are visually distinct in the list, making it easy to track what's been watched.

**Why this priority**: Helps customers manage their learning progress. Adds polish but does not block any earlier story.

**Independent Test**: Mark a recording as reviewed. Confirm it looks different in the list (e.g. badge, muted styling, checkmark). Reload the page — confirm the reviewed state persists. Mark it again to un-review — confirm it returns to its default appearance.

**Acceptance Scenarios**:

1. **Given** an unreviewed recording, **When** the customer marks it as reviewed, **Then** it visually changes in the list to indicate it has been reviewed, and that state persists on page reload.
2. **Given** a reviewed recording, **When** the customer removes the reviewed mark, **Then** it returns to its default unreviewed appearance, and that state persists.
3. **Given** a list containing both reviewed and unreviewed recordings, **Then** they are visually distinguishable at a glance.

---

### Edge Cases

- What happens when a customer has hundreds of recordings? The list must remain usable and not freeze or time out.
- What happens when a recording URL is present but the video has been deleted from the host (Vimeo/Zoom)? A graceful in-player error is shown.
- What happens when the customer's snapshot contains no `recording_url` values at all? The empty-state is shown.
- What happens when filters are combined (e.g. lesson type + date range + search)? All active filters apply simultaneously.
- What happens if browser local storage is unavailable (private browsing)? Playback position and reviewed state gracefully degrade — the feature still works, it just won't persist between visits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST provide a dedicated Recording Library page at `/customer/[id]/library` accessible from the customer sidebar.
- **FR-002**: The library MUST display only past sessions that have a recording available, sourced from the same customer snapshot already fetched on the dashboard — no additional backend calls or new API endpoints are required.
- **FR-003**: Each recording entry MUST display the event name, lesson type (if available), and session date.
- **FR-004**: The library MUST provide a text search field that filters entries by event name.
- **FR-005**: The library MUST provide a lesson-type filter that shows only the types present in the customer's data.
- **FR-006**: The library MUST provide a date range filter (from/to) that limits entries to a selected period.
- **FR-007**: All active filters MUST apply simultaneously and update the list in real time without a page reload.
- **FR-008**: When the filtered list is empty, the library MUST display a message explaining there are no matching recordings and offer a way to clear the active filters.
- **FR-009**: When no recordings exist for the customer at all, the library MUST display a distinct empty-state message.
- **FR-010**: Clicking a recording MUST open an in-app player; the platform MUST detect the URL type (direct video file, Vimeo, Zoom) and use the appropriate playback method for each.
- **FR-011**: When a recording URL is broken or the video is unavailable, the player MUST show an error state — never a blank or crashed screen.
- **FR-012**: The customer's playback position for each recording MUST be saved locally and restored when they reopen that recording.
- **FR-013**: A customer MUST be able to mark any recording as "reviewed"; that state MUST be visually reflected in the list and MUST persist between visits.
- **FR-014**: Reviewed and unreviewed recordings MUST be visually distinguishable in the list.
- **FR-015**: The library page MUST be added to the customer sidebar navigation.

### Key Entities

- **Recording**: A past session that has a `recording_url`. Key attributes: event name, lesson type, session date, recording URL, URL type (mp4 / Vimeo / Zoom), reviewed status, last-watched position.
- **Playback State**: The customer's progress within a specific recording. Attributes: recording identifier, position (time in seconds), last updated.
- **Reviewed State**: Whether a customer has marked a specific recording as reviewed. Attributes: recording identifier, reviewed (boolean).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A customer can locate a specific past recording by lesson type and event name within 30 seconds on a list of 50+ recordings.
- **SC-002**: All recordings with a `recording_url` in the customer's snapshot are surfaced in the library — zero are missing or incorrectly excluded.
- **SC-003**: Every supported recording URL type (direct mp4, Vimeo, Zoom) plays successfully without requiring the customer to leave the platform.
- **SC-004**: Broken or unavailable recording URLs are handled gracefully — the customer sees an error message in 100% of failure cases, never a blank screen.
- **SC-005**: A customer returning to a previously started recording resumes within 5 seconds of their saved position.
- **SC-006**: Reviewed state and playback positions are retained across browser sessions for customers not in private browsing mode.
- **SC-007**: The library page loads and displays its list within 2 seconds on a standard connection, even for customers with 100+ recordings.

## Assumptions

- The existing customer snapshot (`/pull_portal_snapshot/`) is already fetched for each customer page load; the library reuses this data and does not require a separate fetch or new backend endpoint.
- Playback position and reviewed state are stored locally in the customer's browser (e.g. `localStorage`) — no server-side persistence is required for V1. This means state is device-specific and will not sync across devices.
- A "Zoom link" in this context refers to a Zoom cloud recording URL (e.g. `zoom.us/rec/...`) which may not support embedding; opening in a new tab or showing a prominent link is an acceptable fallback.
- Sessions are only shown if `is_past: true` AND `recording_url` is non-null — the `join_link_visible` flag governs join links, not recording links; recordings are always shown when present.
- The list of lesson types available for filtering is derived from the recordings in the snapshot — no separate lookup is needed.
- No authentication beyond the existing customer route gating is required; the library is only accessible under the customer's own ID route.
- Mobile responsiveness (375px minimum) is required, consistent with the rest of the platform.
- Date display uses `snapshot.display_timezone`, consistent with the dashboard convention.
