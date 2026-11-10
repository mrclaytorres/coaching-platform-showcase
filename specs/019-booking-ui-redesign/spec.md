# Feature Specification: Booking UI Redesign

**Feature Branch**: `019-booking-ui-redesign`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Create a spec for the Booking UI improvements. Implement these mockups: Booking.png (the Booking Events landing page), Booking - Sub Page - Sessions.png, Booking - Sub Page - My Schedule.png, Booking - Sub Page - Availability.png — make sure they follow what was designed."

## User Scenarios & Testing *(mandatory)*

<!--
  The four existing pages this spec redesigns — /booking/staff (events list), /booking/staff/
  sessions, /booking/staff/schedule, /booking/staff/availability — are already fully functional:
  every field, filter, form, and export in the mockups already has a working backend behind it
  today (specs/013-coach-session-booking). This is primarily a visual/layout redesign to match
  the mockups' card-based, Anton-headed style (matching specs/018-admin-dashboard-redesign's
  sidebar/font work), plus two real data-shape changes the mockups call for (see Assumptions):
  the Sessions page needs to show upcoming bookings, not just historical outcomes, and both the
  Sessions and My Schedule pages need to show each booking's student (or student count).
-->

### User Story 1 - Staff sees a redesigned Booking home page (Priority: P1)

A Staff Support, Coach, or Super Admin opens the Booking area and sees the event-types list in
the new card-based layout — a bold title, a short subtitle, a prominent "New Event" button, and
a row of tabs to the four sub-areas — matching the mockup.

**Why this priority**: This is the landing page every other Booking page is reached from — the
first thing establishing the new visual language for the whole area.

**Independent Test**: Load `/booking/staff` as each of the three roles and confirm the page
renders the new header/tab-row/table layout with the same event data the current page already
shows, and that every tab and the "New Event" button navigate correctly.

**Acceptance Scenarios**:

1. **Given** the Booking landing page loads, **When** the header renders, **Then** it shows an
   accent-colored "Coach Session Booking" eyebrow, a large "Booking" title, and a one-line
   subtitle, with a "New Event" button linking to the existing New Booking Event page.
2. **Given** the page loads, **When** the tab row renders, **Then** it shows Availability, My
   Schedule, Sessions, and Calendar tabs linking to their existing pages, each in the mockup's
   pill-button style.
3. **Given** the viewer holds an elevated (owner/admin) booking role, **When** the tab row
   renders, **Then** a Roles tab also appears, linking to the existing Roles page; a viewer
   without that role does not see it — unchanged from the current page's existing behavior.
4. **Given** the events table renders, **When** an event's status is shown, **Then** Published
   appears in a distinct accent/positive color and Draft in a muted color, matching the mockup.

---

### User Story 2 - Staff sees a redesigned Sessions page, including upcoming bookings (Priority: P1)

A Staff Support, Coach, or Super Admin opens the Sessions sub-page and sees both upcoming and
past sessions — who's booked, when, and their status — in the new card-based layout, with the
same filtering and CSV/XLSX export already available today.

**Why this priority**: The mockup's example data shows upcoming ("Confirmed") sessions in this
list, not just historical outcomes — today's page only ever shows historical rows (see
Assumptions). Getting this right is the one genuine functional change in this spec, so it's
appropriately high priority.

**Independent Test**: Load `/booking/staff/sessions` with at least one upcoming confirmed
booking and one historical (completed/cancelled) session record; confirm both appear, correctly
attributed and styled, and that filtering/export still work exactly as today.

**Acceptance Scenarios**:

1. **Given** a student has a confirmed, not-yet-occurred booking, **When** the Sessions page
   loads, **Then** that booking appears in the list alongside any historical session records,
   sorted by scheduled time.
2. **Given** a listed session is a one-on-one event, **When** its row renders, **Then** it shows
   the booked student's name beneath the event title; **given** it's a group or workshop event,
   **Then** it shows the number of booked students instead (matching the mockup's "4 students").
3. **Given** the filter card renders, **When** the Admin changes Coach/Category/Status/From/To
   and submits, **Then** the list and the "{N} sessions found" count update exactly as the
   current filtering already does.
4. **Given** the Admin clicks "Export CSV" or "Export XLSX", **When** the file downloads,
   **Then** it contains the same filtered historical session data the export already produces
   today — this spec changes the buttons' appearance, not the export's contents.

---

### User Story 3 - Staff sees a redesigned My Schedule page, grouped by day (Priority: P2)

A Staff Support, Coach, or Super Admin opens My Schedule and sees a chosen coach's upcoming
sessions grouped under "Today," "Tomorrow," and later dates, each session showing who's booked
and its status.

**Why this priority**: A convenience view over data the Sessions page (Story 2) and the
underlying schedule already expose — valuable, but not as foundational as getting the Sessions
list's data source right.

**Independent Test**: Load `/booking/staff/schedule` for a coach with sessions today and
tomorrow; confirm both days render under the correct relative-day heading with correctly
attributed sessions.

**Acceptance Scenarios**:

1. **Given** a coach has upcoming sessions, **When** the page loads, **Then** each distinct
   calendar day groups under its own heading — "Today, [date]" and "Tomorrow, [date]" for the
   next two days, a weekday-and-date heading for days after that — each group in its own card.
2. **Given** a day's card renders, **When** a session row shows, **Then** it shows the start
   time and duration, the event title, the booked student's name (one-on-one) or student count
   (group/workshop), and a colored status pill — matching Story 2's same attribution rule.
3. **Given** the Admin changes the coach picker and clicks "View," **When** the page reloads,
   **Then** it shows that coach's schedule instead — unchanged from today's existing behavior.

---

### User Story 4 - Staff sees a redesigned Availability page (Priority: P2)

A Staff Support, Coach, or Super Admin opens Availability and manages a coach's weekly
schedules, date overrides, and a time-troubleshooting tool, all in the new card-based layout.

**Why this priority**: Every field and action here is already fully built and working today —
this story is pure visual redesign, the lowest-risk of the four.

**Independent Test**: Load `/booking/staff/availability`, add a weekly schedule and a date
override, and confirm both actions succeed and render exactly as they do on the current page,
just restyled.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the Weekly Schedules section renders, **Then** it shows
   an empty state or the coach's existing schedules, followed by an "Add a Weekly Schedule" form
   card with the same fields as today (Name, Category, Day, Time Zone, Start Time, End Time).
2. **Given** the page loads, **When** the Date Overrides section renders, **Then** it shows an
   empty state or the coach's existing overrides, followed by an "Add a Date Override" form card
   with the same fields as today (Date, Type, Start/End Time, Category, Reason).
3. **Given** the Troubleshoot a Time section renders, **When** the Admin enters a date/time and
   clicks "Check," **Then** it shows the same availability/unavailability result the current
   page already produces.

---

### Edge Cases

- What happens to a group/workshop session where some students have cancelled? The student
  count shown (Story 2/3) reflects only non-cancelled bookings for that time slot, matching how
  a slot's own confirmed-count is already tracked elsewhere in this codebase.
- What happens when a coach has zero sessions on a given day within the My Schedule view's
  range? That day is simply omitted — no empty-day card is shown, consistent with the current
  page's behavior of only rendering days that actually have sessions.
- What happens when Sessions/Export filters match zero sessions? The page shows its existing
  "no sessions match" state and the export buttons remain present (producing a header-only
  file), unchanged from today.
- What happens for a viewer without an elevated booking role who navigates directly to the
  Roles page by URL? Unchanged from today — they're redirected back to the Booking landing page
  by the existing `requireBookingRole` gate; this spec only changes whether the Roles tab is
  shown, never the destination page's own access control.

## Requirements *(mandatory)*

### Functional Requirements

**Booking landing page (Story 1)**

- **FR-001**: System MUST show, at the top of the Booking landing page, an accent-colored
  "Coach Session Booking" eyebrow, a large "Booking" title, and a one-line subtitle describing
  the page.
- **FR-002**: System MUST show a "New Event" button linking to the existing New Booking Event
  page.
- **FR-003**: System MUST show a row of tabs — Availability, My Schedule, Sessions, Calendar —
  each linking to its existing page.
- **FR-004**: System MUST show a Roles tab in that row only when the viewer holds an elevated
  (owner/admin) booking role, linking to the existing Roles page — unchanged from the current
  page's existing conditional-visibility behavior.
- **FR-005**: System MUST show the booking events table inside a card, with Published status in
  a distinct accent/positive color and Draft status in a muted color.

**Sessions page (Story 2)**

- **FR-006**: System MUST show a breadcrumb link back to the Booking landing page.
- **FR-007**: System MUST show the existing Coach/Category/Status/From/To filter controls
  inside a card, correctly labeled for what the card actually does (see Assumptions — the
  mockup's own label for this card does not match its fields).
- **FR-008**: System MUST show a "{N} sessions found" count reflecting the current filters.
- **FR-009**: System MUST show "Export CSV" and "Export XLSX" as bordered buttons, functionally
  unchanged from the current export links.
- **FR-010**: System MUST list, alongside existing historical session records (completed,
  cancelled, no-show), every confirmed booking that has not yet occurred and has not been
  cancelled, sorted by scheduled time together with the historical rows.
- **FR-011**: System MUST show, per listed session, the booked student's name for a one-on-one
  event or the number of booked students for a group/workshop event, beneath the event title.
- **FR-012**: System MUST show each session's status as a colored pill (e.g., upcoming/
  confirmed in one color, completed in another, cancelled/no-show in another) rather than plain
  text.

**My Schedule page (Story 3)**

- **FR-013**: System MUST show a breadcrumb link back to the Booking landing page, and the
  existing coach picker + "View" control.
- **FR-014**: System MUST group a coach's upcoming sessions by calendar day, each group headed
  by a relative label — "Today, [date]" and "Tomorrow, [date]" for the next two calendar days,
  a weekday-and-date label for any day after that — each group shown in its own card.
- **FR-015**: System MUST show, per session row within a day's card, the start time and
  duration, the event title, the student attribution from FR-011, and a status pill from
  FR-012.

**Availability page (Story 4)**

- **FR-016**: System MUST show a breadcrumb link back to the Booking landing page, and the
  existing coach picker + "View" control.
- **FR-017**: System MUST show the existing Weekly Schedules list/empty-state and "Add a Weekly
  Schedule" form, unchanged in fields and behavior, inside the mockup's card-based layout.
- **FR-018**: System MUST show the existing Date Overrides list/empty-state and "Add a Date
  Override" form, unchanged in fields and behavior, inside the mockup's card-based layout.
- **FR-019**: System MUST show the existing Troubleshoot a Time tool, unchanged in fields and
  behavior, inside the mockup's card-based layout.

**Cross-cutting**

- **FR-020**: System MUST preserve every page's existing role gating exactly as it is today —
  this spec changes layout and data presentation only, never access control.
- **FR-021**: System MUST render every page's headings in the same Anton display font already
  established for the Admin and Staff Dashboards (specs/018-admin-dashboard-redesign) — the
  Booking area's own layouts do not yet load that font and need the same wiring added.

### Key Entities

- **Session List Row**: Not a new stored entity — a computed, per-page merge of the existing
  `session_records` table (historical outcomes) and live, not-yet-occurred confirmed `bookings`
  rows (Story 2/3), each enriched with the booked student's name or count from `customer_profiles`
  via the existing `bookings`/`booking_time_slots` join pattern already established for the Admin
  Dashboard (specs/018, `src/lib/admin-dashboard/bookings.ts`). Nothing in this feature adds a
  new table or column.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Booking landing page, Sessions page, My Schedule page, and Availability page
  each visually match their mockup's layout, typography, and card structure, verified by
  side-by-side comparison.
- **SC-002**: The Sessions page shows every currently-upcoming confirmed booking in addition to
  historical outcomes, with zero sessions missing or double-counted, verified against a manual
  count of real bookings/session records for the same filters.
- **SC-003**: Every session/booking shown across the Sessions and My Schedule pages correctly
  attributes its student(s) — a one-on-one event always names the right student, a group/
  workshop event always shows the right count — verified by spot-check against the underlying
  bookings.
- **SC-004**: No existing Booking-area functionality (filtering, CSV/XLSX export, adding/
  removing schedules and overrides, the troubleshoot tool, role gating) regresses — every
  action available today still produces the same result after this redesign.

## Assumptions

- **The Sessions page's data source expands from "historical outcomes only" to "upcoming and
  historical together."** Today, `session_records` rows are only ever created on cancellation or
  a manual completed/no-show mark (`src/lib/booking/sessions.ts`) — a normal upcoming confirmed
  booking that hasn't happened yet has no row there at all, so the current page can never show
  an upcoming session. The mockup's own example data includes upcoming "Confirmed" sessions
  dated after the page's own "today," which only makes sense if the list also reads live
  bookings. Resolved by merging both sources (FR-010) rather than literally reproducing today's
  historical-only list, which couldn't match the mockup's pictured data at all.
- **The mockup's "Pending" status does not map to any real status in this system.**
  `bookings.status` is only ever `'confirmed'` or `'canceled'` (confirmed during
  specs/018-admin-dashboard-redesign's own research) — there's no intermediate pending state
  anywhere in the schema. Every live, non-cancelled booking shown by this feature is treated as
  "Confirmed" (FR-012); the mockup's "Pending" examples have no real backing data and aren't
  reproduced as a distinct status.
- **The Sessions mockup's filter-card heading ("Add a Date Override") doesn't match its own
  fields** (Coach/Category/Status/From/To — a filter form, not an override form; "Add a Date
  Override" is the Availability page's own, different card). Treated as a mockup labeling
  mistake, not a literal instruction — FR-007 keeps this card correctly labeled for what it
  actually does.
- **The Calendar and Roles tabs keep their current destinations.** No mockup screen was provided
  for either page, so this spec doesn't redesign them — Calendar continues linking to the
  existing external-calendar-connection page (`/booking/staff/calendar`), and Roles continues
  linking to the existing Roles page (`/booking/admin/roles`), both unchanged in behavior and
  access control (FR-004, FR-020).
- **Student attribution (one-on-one name vs. group/workshop count) is a reasonable, data-true
  reading of the mockups**, not an invented rule: the My Schedule mockup shows a named student
  for single-attendee sessions and a plain count ("4 students," "12 students") for multi-
  attendee ones — this spec applies that same rule to both the Sessions and My Schedule pages
  for consistency (FR-011).
- **No sidebar changes.** The sidebar already matches the established dark, Anton-headed style
  from specs/018-admin-dashboard-redesign and already links to Booking — this spec is scoped to
  the Booking area's own main content, same scoping convention as 018.
