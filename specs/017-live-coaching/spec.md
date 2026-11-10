# Feature Specification: Academy Live Coaching (Calendly Replacement)

**Feature Branch**: `017-live-coaching`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Build a Academy-owned scheduling system that replaces Calendly for one-on-one lessons, group coaching, and workshops, per the Academy Live Coaching developer spec. This extends the existing Coach Session Booking feature (013-coach-session-booking) rather than starting over — 013 already delivers one-on-one and group booking with manual one-off time slots, capacity-safe booking, Tier restriction, and email notifications. This spec covers everything 013 does not: workshops with a public master calendar, real coach availability (weekly hours, overrides, cross-type conflict checks) in place of manual slot entry, automatic credit check/debit/refund against the existing Django credit system, auto-created Zoom meetings, external calendar sync (Google/Microsoft/iCloud), session tracking by category with export, a stable scheduling API with identity handoff for the future Academy app, configurable notification workflows, and expanded roles/audit/API-key infrastructure."

## User Scenarios & Testing *(mandatory)*

<!--
  This spec builds directly on 013-coach-session-booking, which already ships one-on-one and
  group booking against manually-entered time slots, capacity-safe reservation, Tier
  restriction, and email notifications (specs/013-coach-session-booking/spec.md). Those
  capabilities are not re-described here. Every story below is either new (workshops, Zoom,
  credits, calendar sync, session export, roles/audit) or replaces a specific 013 limitation
  called out in its own Assumptions section (manual one-off slots, no reschedule/cutoff, single
  fixed reminder window, email-only notifications).
-->

### User Story 1 - Coach defines recurring weekly availability instead of adding slots one at a time (Priority: P1)

A Coach sets up a weekly availability pattern once (e.g. "Mon/Wed/Fri 2pm-6pm" for one-on-one lessons, a separate "Tue 10am-12pm" pattern for group coaching), with optional date overrides for a specific day (a holiday, an extra evening) and blocked date ranges for vacations. The system then generates bookable slots from that pattern automatically for as far ahead as Students are allowed to book, instead of the Coach adding each slot by hand. A slot generated for one purpose (one-on-one) is never offered for a conflicting purpose (group/workshop) at the same time, and vice versa.

**Why this priority**: This is the single biggest operational gap versus Calendly today — 013 requires a Coach to hand-add every future slot. Every other new capability (workshops, Zoom, credits) is booked against whatever slots exist, so a real availability engine is the foundation the rest of this spec is built on.

**Independent Test**: Can be fully tested by having a Coach define a weekly pattern with two different purposes (one-on-one hours and group hours) that don't overlap, confirming the system generates the correct future slots for each without manual entry, then adding a one-day override that blocks a specific date and confirming no slot is offered that day — delivers working recurring availability independent of Zoom, credits, or calendar sync.

**Acceptance Scenarios**:

1. **Given** a Coach has no availability configured, **When** they define a weekly schedule (days, start/end times, a time zone, and which event category it applies to), **Then** bookable slots matching that pattern appear automatically for the configured booking horizon, with no manual slot entry required.
2. **Given** a Coach has separate schedules for one-on-one and group/workshop hours, **When** those schedules overlap in time, **Then** the system MUST prevent that overlap from being saved, or MUST clearly flag it as a conflict the Coach must resolve before the schedule takes effect.
3. **Given** a Coach has a standing weekly schedule, **When** they add a one-off date override (a single extra day, or a blocked vacation range), **Then** slots for that date/range reflect the override instead of the standing weekly pattern.
4. **Given** a slot has already been booked by a Student, **When** a Coach changes the underlying weekly schedule afterward, **Then** the existing booking is honored and not silently cancelled by the schedule change.
5. **Given** a Coach or Admin is troubleshooting why a specific time isn't offered, **When** they open that time in an admin view, **Then** the system explains the reason (outside weekly hours, blocked by an override, already booked, conflicts with another category, or blocked by a synced personal calendar event).

---

### User Story 2 - A Student's lesson credit is automatically checked, debited, and refunded (Priority: P1)

A Student attempting to book a credit-based session (one-on-one or group) only sees it as bookable if they have an available credit in the matching category. Confirming the booking records exactly one credit debit; cancelling within policy records a refund. No booking is ever created for a Student without an available credit, and no credit is ever debited twice for the same booking.

**Correction after checking prior spec history (008-staff-credit-watch/011-credit-watch-fallback)**: live write access to Core (Django)'s credit system does not exist today — 008's own plan.md states this explicitly ("live write access to Core doesn't exist yet") and records every credit change as a `'placeholder'`-status adjustment in a Academy-owned Supabase table, not a real Core write, pending a Core-side endpoint that has never shipped. 008's bulk read endpoint (`POST /pull_credit_watch/`) is itself still unshipped and blocking that feature. This story therefore follows the exact same pattern rather than assuming a live write connection: the credit check reads from the existing, already-working single-student `fetchSnapshot()` endpoint (`src/lib/core-api.ts`); every debit/refund is recorded as a `'placeholder'`-status adjustment, immediately enforced and reflected in what a Student can book next (an "effective balance" overlays placeholder adjustments on Core's last-known snapshot balance, same technique 008 already uses); and a `'synced'` status is reserved for the future cutover once Core ships a real write endpoint, requiring no schema change when that happens. The Core write-endpoint contract is documented as a handoff (`contracts/core-credits-write-api.md`), mirroring 008's `contracts/core-credit-watch-api.md` — this feature's credit enforcement is real and live from launch, but the ledger of record only becomes Core itself once Core ships that endpoint.

**Why this priority**: The source spec calls this "required," and today's booking flow (013) is entirely credit-blind — a Student can currently book without any credit check at all. This is a financial-correctness gap, not a convenience feature, so it ranks alongside the availability engine as foundational.

**Independent Test**: Can be fully tested by giving a Student exactly one credit in a category, confirming they can book one matching session but are blocked from a second, then cancelling the first booking within the refund policy window and confirming the credit returns and a new booking succeeds — delivers working credit enforcement independent of Zoom, calendar sync, or workshops.

**Acceptance Scenarios**:

1. **Given** a Student has zero available credits in a session category, **When** they attempt to book a credit-based event in that category, **Then** the system blocks the booking and explains that a credit is required.
2. **Given** a Student has at least one available credit in the matching category, **When** they confirm a booking, **Then** exactly one credit in that category is debited and the booking is confirmed.
3. **Given** a credit-check or debit call to the credit system fails or times out, **When** a Student attempts to book, **Then** the system does not create a booking that was never actually paid for with a credit, and shows the Student a clear retry-able error rather than a silent failure.
4. **Given** a confirmed credit-based booking is cancelled within the refund policy, **When** the cancellation completes, **Then** the debited credit is returned to the Student exactly once.
5. **Given** a credit debit or refund call is retried after a network failure (the caller cannot tell if the first attempt succeeded), **When** the retry reaches the credit system, **Then** the same booking is never debited or refunded twice.

---

### User Story 3 - A Student discovers and books a public workshop (Priority: P2)

A prospective or existing Student browses a public master workshop calendar — filterable by coach, topic, and date — without needing to already know a direct link, finds an upcoming workshop with open seats, and books a seat (or joins a waitlist if it's full). A workshop can have one or more coaches and a capacity cap, and is visible on the public calendar the moment it's published. Each workshop is individually configured as free, credit-based, or paid at creation time — pricing model is not fixed system-wide.

**Why this priority**: Workshops are one of the three event types the source spec requires and 013 has no concept of them at all today (only one-on-one and group). A public calendar is also new surface area — today's booking area is entirely behind a Student login.

**Independent Test**: Can be fully tested by publishing a workshop with a capacity of 3, confirming it appears on the public calendar filterable by date/topic/coach, having three Students each reserve a seat, and confirming a fourth sees the workshop as full (with a waitlist option) — delivers a working public workshop flow independent of one-on-one/group booking, Zoom, or credits.

**Acceptance Scenarios**:

1. **Given** an Admin or Scheduler publishes a workshop with a date, capacity, and one or more coaches, **When** publishing completes, **Then** the workshop appears on the public master workshop calendar without requiring the viewer to be logged in.
2. **Given** a visitor is viewing the public workshop calendar, **When** they filter by coach, topic, or date, **Then** only matching workshops are shown.
3. **Given** a workshop has open seats, **When** a Student books one, **Then** the remaining-seats count decreases and the booking is confirmed for that Student.
4. **Given** a workshop has reached its capacity, **When** another Student attempts to book it, **Then** they are offered a waitlist position instead of a failed booking, and are promoted automatically if a seat frees up.
5. **Given** an Admin marks a workshop hidden/secret, **When** a visitor browses the public calendar, **Then** that workshop does not appear there but remains bookable by anyone with its direct link.

---

### User Story 4 - Every confirmed session gets an auto-created Zoom meeting (Priority: P2)

The moment a one-on-one, group, or workshop booking is confirmed, a unique Zoom meeting is created automatically and its join link appears in the calendar invite, the confirmation email, reminder emails, and the booking's details in the app. Rescheduling updates the same Zoom meeting; cancelling deletes it. A group or workshop session has exactly one shared Zoom meeting for every attendee.

**Why this priority**: Auto-created video links are a headline Calendly feature and 013 has no Zoom integration at all today (location is a free-text field a Coach fills in manually) — this directly closes a visible gap versus what's being replaced.

**Independent Test**: Can be fully tested by confirming a one-on-one booking and verifying a unique Zoom link appears in the confirmation email and booking details, then cancelling it and confirming the Zoom meeting is deleted — delivers working Zoom lifecycle management independent of availability, credits, or workshops.

**Acceptance Scenarios**:

1. **Given** a booking (one-on-one, group, or workshop) is confirmed, **When** confirmation completes, **Then** a unique Zoom meeting is created and its join link is attached to the booking, the calendar invite, and the confirmation email.
2. **Given** a confirmed booking with a Zoom meeting is rescheduled, **When** the new time is saved, **Then** the same Zoom meeting is updated to the new time rather than a new meeting being created.
3. **Given** a confirmed booking with a Zoom meeting is cancelled, **When** the cancellation completes, **Then** the Zoom meeting is deleted.
4. **Given** a group or workshop session with multiple attendees, **When** any attendee views their booking details, **Then** they all see the same single Zoom join link for that session.
5. **Given** Zoom's API is unavailable or a coach's connected account has hit a rate limit at the moment of booking, **When** meeting creation fails, **Then** the booking itself still succeeds, the failure is recorded for staff follow-up, and a retry path exists rather than the Student being left with no meeting link at all.

---

### User Story 5 - Coaches get paid correctly from exportable, category-tagged session records (Priority: P2)

Every session that actually happens is recorded with its category (one-on-one, group, workshop), status (completed, cancelled by student, cancelled by coach, no-show), and attendee count. A Coach can see their own session counts by category and date range; an Admin can filter and export the same data (and everyone else's) to CSV or XLSX for running payroll, since coaches are paid at different rates by category.

**Why this priority**: The source spec calls this a hard requirement ("coaches are paid based on sessions delivered... every session must be recorded with its category"), and 013 today only offers a live roster view with no aggregate counts, no status beyond confirmed/cancelled, and no export at all.

**Independent Test**: Can be fully tested by completing several sessions across categories for one Coach, confirming their own dashboard shows correct per-category counts for a date range, and confirming an Admin's CSV/XLSX export of the same range matches exactly — delivers working session tracking and export independent of Zoom, availability, or credits.

**Acceptance Scenarios**:

1. **Given** a session's scheduled time has passed, **When** its outcome is determined, **Then** it is recorded with a status of completed, cancelled-by-student, cancelled-by-coach, or no-show, and this status can never silently change on its own afterward.
2. **Given** a Coach opens their own session history, **When** they filter by category and date range, **Then** they see accurate counts matching only their own sessions.
3. **Given** an Admin requests an export, **When** they filter by coach, category, status, and date range and export, **Then** the resulting CSV/XLSX file's row count and totals match what the filtered on-screen view shows.
4. **Given** an event type, coach, or student record is later edited or deleted, **When** an Admin views historical session records that referenced it, **Then** those historical records remain intact and unchanged (history is never retroactively altered or lost).
5. **Given** a Coach who is not an Admin, **When** they attempt to change which category an event type is tracked under, **Then** the system prevents it — categories are admin-controlled only.

---

### User Story 6 - A Coach's personal calendar keeps their schedule conflict-free (Priority: P3)

A Coach connects an external calendar (Google Calendar, Microsoft 365/Outlook, or Apple iCloud). Events already on that calendar block matching times from being offered to Students, and new Academy bookings are added to a calendar of the Coach's choosing, so a Coach never has to manually keep two calendars in sync or ends up double-booked between a personal commitment and a lesson.

**Why this priority**: This closes a real double-booking risk that recurring availability (Story 1) alone can't fully solve, but a Coach can operate correctly without it in the interim by keeping their schedule accurate inside Academy directly, so it ranks below the P1/P2 items.

**Independent Test**: Can be fully tested by connecting a test calendar account, placing a busy event on it during otherwise-available hours, confirming that time no longer appears bookable, then confirming a new Academy booking appears on the chosen external calendar — delivers working two-way calendar sync independent of Zoom, credits, or workshops.

**Acceptance Scenarios**:

1. **Given** a Coach connects an external calendar account, **When** the connection completes, **Then** they choose which of that account's calendars are checked for conflicts and which one receives new Academy bookings.
2. **Given** a Coach has a busy event on a connected calendar during their configured availability, **When** a Student browses that Coach's open times, **Then** that time is not offered.
3. **Given** a Academy booking is confirmed for a Coach with a connected calendar, **When** confirmation completes, **Then** the booking appears as an event on the Coach's chosen external calendar.
4. **Given** a connected calendar's sync authorization expires or a push subscription lapses, **When** the system detects this, **Then** the Coach is alerted to reconnect and stale availability is not silently trusted past its renewal window.
5. **Given** a Coach's connected calendar is Apple iCloud (CalDAV, no push support), **When** the system checks for conflicts, **Then** it polls on a regular schedule rather than relying on a push notification that iCloud cannot send.

---

### User Story 7 - Admin manages scheduling roles and reviews a change history (Priority: P3)

An Owner/Admin invites a new team member and assigns them a role: full Owner/Admin access, a Scheduler/Designer who can create event types, workshops, and notification templates but not manage users or API keys, or a Coach limited to their own availability and bookings. An Admin can toggle whether Coaches are allowed to create their own event types. Every change to availability, event types, or scheduling settings is recorded in an audit log an Admin can review.

**Why this priority**: This is operational/administrative scaffolding that matters once the team using the system grows beyond a couple of people, but the system is usable for a single Admin and a handful of Coaches without it, so it ranks below the student-facing and financial-correctness stories.

**Independent Test**: Can be fully tested by inviting a user as Scheduler/Designer, confirming they can create an event type but cannot open user management or API keys, then making an availability change and confirming it appears correctly attributed in the audit log — delivers working roles and audit independent of any other story.

**Acceptance Scenarios**:

1. **Given** an Owner/Admin invites a new team member, **When** they assign the Scheduler/Designer role, **Then** that person can create event types, workshops, and notification templates but cannot manage users, API keys, or global settings.
2. **Given** a Coach account, **When** the assigned Admin setting for "coaches may create their own event types" is off, **Then** that Coach cannot create a new event type, only manage their own availability and view their bookings.
3. **Given** any change to a Coach's availability, an event type, or a global scheduling setting, **When** the change is saved, **Then** an audit log entry records who made it, what changed, and when.
4. **Given** a Coach or Admin account is deactivated, **When** deactivation completes, **Then** their historical sessions, bookings, and audit entries remain intact and attributed to them.

---

### User Story 8 - Coach and Admin configure notification workflows per event type (Priority: P4)

An Admin or Scheduler sets up notification workflows per event type — which trigger (booked, cancelled, rescheduled, a chosen time before start, a chosen time after end) fires which action (email today; SMS reserved for later), so a workshop's reminder cadence can differ from a one-on-one lesson's, and Coaches/Admins get their own alerts for new bookings, cancellations, and a daily agenda.

**Why this priority**: 013 already sends confirmation/cancellation/reminder emails at one fixed interval, so this is a refinement of an existing, working capability rather than new coverage — it ranks last because the system functions correctly without it.

**Independent Test**: Can be fully tested by configuring a workshop's reminder to fire 24 hours before start and a one-on-one's to fire 1 hour before, confirming each event type's Students receive their reminder at the configured offset and not the other's — delivers working per-event-type workflows independent of every other story.

**Acceptance Scenarios**:

1. **Given** an Admin or Scheduler is editing an event type, **When** they configure a notification workflow (trigger + action + timing), **Then** it applies only to bookings of that event type.
2. **Given** two event types with different reminder timing, **When** each type's session approaches, **Then** Students receive reminders at their own event type's configured offset, not a shared global one.
3. **Given** a new booking or cancellation occurs, **When** it completes, **Then** the owning Coach and relevant Admins receive an alert reflecting it, separate from the Student-facing confirmation email.
4. **Given** an Admin wants a daily summary, **When** the configured time arrives, **Then** each Coach with sessions that day receives a daily-agenda notification.

---

### Edge Cases

- What happens when a Coach's weekly availability pattern is edited to remove hours that already have confirmed future bookings inside them? The existing bookings are honored; only future, not-yet-booked slot generation reflects the new pattern (see Story 1, Scenario 4).
- What happens across a daylight-saving-time transition for a Coach's weekly schedule? Generated slot times MUST continue to reflect the Coach's configured local wall-clock hours (e.g. "9am-5pm") correctly on both sides of the transition, not shift by an hour.
- What happens when two Students attempt to claim the same workshop's last open seat, or the same waitlist promotion, at the same moment? Exactly one succeeds; the other sees the seat is taken or remains on the waitlist.
- What happens when a Student who is on a workshop waitlist never responds to a seat-available offer? A time-boxed hold expires and the seat offers to the next waitlisted Student.
- What happens when a Zoom meeting creation call fails but the booking itself succeeded? The booking stands, the missing-meeting failure is recorded for staff follow-up and retry, consistent with 013's existing rule that a notification failure never rolls back a booking.
- What happens when a coach's connected Zoom account hits its daily API rate limit while multiple sessions are being booked? Later meeting-creation attempts queue and retry rather than failing the underlying bookings.
- What happens when a credit debit call and a Zoom meeting-creation call are both required for the same booking and one succeeds while the other fails? The booking's confirmed/credit-debited state and its Zoom-meeting state are tracked independently, so a Zoom failure never blocks or reverses an already-debited credit, and vice versa.
- What happens when a coach's external calendar sync token expires and is never renewed? The Coach is alerted; until reconnected, their availability is not treated as conflict-checked against that calendar, and this is visible to an Admin troubleshooting a scheduling complaint.
- What happens when a Coach is removed from an in-progress workshop that has other co-hosts? The workshop continues with its remaining hosts; attendee bookings are unaffected.
- What happens when an Admin changes an event type's session category after sessions have already been recorded under the old category? Already-recorded historical session records keep their original category; only future sessions use the new one.
- What happens when a Student's booking spans a credit refund policy's cutoff (they cancel exactly at the boundary)? The configured cutoff is evaluated inclusively in the Student's favor, and this boundary behavior is documented and testable.

## Requirements *(mandatory)*

### Functional Requirements

**Availability & Calendars**

- **FR-001**: System MUST allow a Coach to define one or more named weekly availability schedules (days, start/end times, a time zone), each assigned to one or more event categories (one-on-one, group, workshop).
- **FR-002**: System MUST allow a Coach to add date-specific overrides (extra availability on a specific date, or a blocked date/range) that take precedence over the standing weekly pattern for that date.
- **FR-003**: System MUST generate bookable slots from a Coach's active weekly schedules and overrides automatically, out to the configured booking horizon, without requiring manual per-slot entry.
- **FR-004**: System MUST prevent a Coach's schedules from producing overlapping availability across mutually exclusive event categories (e.g. one-on-one hours and group hours at the same time for the same Coach) — either at save time or by treating an overlap as a conflict that blocks slot generation for the conflicting window.
- **FR-005**: System MUST honor an existing confirmed booking when the underlying weekly schedule or override that originally generated its slot is later changed.
- **FR-006**: System MUST provide an admin-facing view that explains, for any given time and Coach, why a slot is or isn't available (outside hours, overridden/blocked, already booked, cross-category conflict, or blocked by a synced external calendar event).
- **FR-007**: System MUST provide a public master workshop calendar, viewable without authentication, listing published workshops filterable by coach, topic, and date.
- **FR-008**: System MUST provide a Coach-scoped calendar view combining that Coach's one-on-one, group, and workshop sessions.
- **FR-009**: System MUST provide an Admin master calendar view combining every Coach's schedule, showing one-on-one session details only to Admins (never to other Coaches or Students).
- **FR-010**: System MUST allow a Coach to connect an external calendar account (Google Calendar, Microsoft 365/Outlook, or Apple iCloud/CalDAV), choose which of its calendars are checked for conflicts, and choose which calendar receives new Academy bookings.
- **FR-011**: System MUST treat a busy event on a Coach's conflict-checked external calendar(s) as blocking that time from being offered to Students.
- **FR-012**: System MUST keep external calendar sync current — renewing push subscriptions before they expire (Google, Microsoft) and polling on a regular schedule for connections with no push support (iCloud/CalDAV) — and MUST alert a Coach when a connection needs to be reconnected.
- **FR-013**: System MUST provide subscribable ICS feed links for the public workshop calendar and for a Student's own bookings.

**Event Types & Booking Experience**

- **FR-014**: System MUST support a workshop event type distinct from one-on-one and group, supporting one or more coaches, a capacity cap, and an optional waitlist.
- **FR-015**: System MUST allow each workshop to be individually configured as free, credit-based, or paid at creation time; a credit-based workshop draws from the same credit adapter as one-on-one/group sessions (FR-023–025), and a paid workshop requires a completed checkout before the booking is confirmed.
- **FR-016**: System MUST automatically promote the next waitlisted Student when a workshop seat frees up, within a time-boxed window to respond before offering it to the following Student.
- **FR-017**: System MUST allow an event type to define custom booking questions (each marked required or optional) that a Student answers when booking.
- **FR-018**: System MUST allow an event type to define minimum booking notice, how far ahead Students may book, start-time increments, and buffers before/after each session.
- **FR-019**: System MUST allow an event type to define daily, weekly, and monthly booking limits, both per event type and across all of a Coach's sessions.
- **FR-020**: System MUST allow a Student to reschedule their own booking (subject to the event type's configured cutoff window) and to cancel it with a required reason once a cutoff window applies; both actions MUST keep applicable Zoom and credit handling consistent (Story 4, Story 2). The same configured cutoff governs both the reschedule/cancel window and credit-refund eligibility (FR-025) — one setting per event type, not two.
- **FR-021**: System MUST allow an event type to be marked hidden/secret, in which case it is excluded from the public workshop calendar and any general browse view but remains bookable via its direct link or from inside the app.
- **FR-022**: System MUST display remaining-spots and automatically stop accepting bookings once a group or workshop event type reaches capacity, consistent with 013's existing group-capacity behavior extended to workshops.

**Credits & Access**

- **FR-023**: System MUST call a credit-check before showing or confirming a credit-based booking, and MUST NOT create a confirmed booking for a Student who fails that check. The check reads the Student's Core-reported balance (via the existing single-student snapshot endpoint) overlaid with any not-yet-synced placeholder adjustments recorded by this feature, matching 008-staff-credit-watch's established "effective balance" technique.
- **FR-024**: System MUST record exactly one credit debit, in the event type's configured category, upon confirming a credit-based booking, using a unique booking identifier so a retried or duplicated debit is never applied twice. This debit is recorded as a `'placeholder'`-status adjustment (immediately enforced against future availability checks) until a live Core write endpoint exists, at which point it can be synced and its status flips to `'synced'` with no schema change required, matching 008's `credit_adjustments` precedent.
- **FR-025**: System MUST record a matching refund adjustment when a credit-based booking is cancelled before its event type's configured late-cancellation cutoff (a fixed time window before session start); a cancellation after that cutoff, or a no-show, forfeits the credit and MUST still be recorded as a session delivered for coach-payment purposes, using the same duplicate-safe booking identifier.
- **FR-026**: System MUST implement the credit check/debit/refund calls behind a swappable adapter, so the current placeholder-adjustment-over-Core-snapshot approach and a future live Core write endpoint (or a future Academy-platform credit system) can both be plugged in without changing the booking flow itself.
- **FR-027**: A live Core write endpoint for debit/refund does not exist today (confirmed by checking 008-staff-credit-watch/011-credit-watch-fallback's spec history) — this is a hard external dependency for this feature's credit ledger to become Core itself rather than a Academy-side placeholder overlay, documented as a handoff contract (`contracts/core-credits-write-api.md`) mirroring 008's `contracts/core-credit-watch-api.md`. This feature's credit *enforcement* (Story 2) does not wait on that endpoint — only the eventual sync of Academy's placeholder ledger back into Core as the system of record does.
- **FR-028**: System MUST allow an event type to be restricted to Students holding a specific product/entitlement, provided by the host application, in addition to (or instead of) a credit requirement.

**Zoom**

- **FR-029**: System MUST automatically create a unique Zoom meeting when a one-on-one, group, or workshop booking is confirmed, and attach its join link to the booking record, calendar invite, confirmation email, and reminder emails.
- **FR-030**: System MUST update the existing Zoom meeting (not create a new one) when a booking with a Zoom meeting is rescheduled, and MUST delete the Zoom meeting when such a booking is cancelled.
- **FR-031**: System MUST use a single shared Zoom meeting for every attendee of a given group or workshop session.
- **FR-032**: System MUST record a Zoom meeting-creation failure for staff follow-up and retry without rolling back or blocking the underlying booking.
- **FR-033**: System MUST use Zoom webhooks (meeting ended, participant joined) to help determine a session's completed/no-show status for session tracking (Story 5).

**Session Tracking**

- **FR-034**: System MUST record every session with its coach, event type, session category, date/time, duration, attendee count, and status (scheduled, completed, cancelled-by-student, cancelled-by-coach, no-show).
- **FR-035**: System MUST count a group or workshop session as one session for coach-payment purposes regardless of attendee count, while separately recording that attendee count.
- **FR-036**: System MUST let a Coach view their own session counts filtered by category and date range.
- **FR-037**: System MUST let an Admin export session records to CSV and XLSX, filtered by coach, category, status, and date range, with row counts and totals matching the equivalent on-screen filtered view.
- **FR-038**: System MUST provide API access to the same session-count data available in the export.
- **FR-039**: System MUST preserve historical session records unchanged if the coach, student, or event type they reference is later edited or deleted.
- **FR-040**: System MUST prevent a Coach (non-Admin) from changing an event type's session category.

**Notifications & Time Zones**

- **FR-041**: System MUST allow an Admin or Scheduler to configure a notification workflow per event type, each combining a trigger (booked, cancelled, rescheduled, a configurable time before start, a configurable time after end) with an action (email; SMS reserved as a future action type) and message variables (student name, coach, event type).
- **FR-042**: System MUST send Coach/Admin alerts — new booking, cancellation, and a daily agenda — separate from Student-facing confirmation/reminder emails.
- **FR-043**: System MUST store all scheduling times in UTC with IANA time zone identifiers, auto-detect each viewer's time zone with a manual override, and correctly handle daylight-saving transitions so a Coach's configured local hours never silently shift.
- **FR-044**: System MUST show every email's times in the recipient's own time zone with the zone name spelled out.

**Roles, API & Infrastructure**

- **FR-045**: System MUST support an Owner/Admin role (full access), a Scheduler/Designer role (create event types, workshops, and notification templates; cannot manage users or API keys), and a Coach role (manage own availability/calendar connections/Zoom; view own bookings and session counts), reusing the platform's existing staff login system for authentication.
- **FR-046**: System MUST provide an Admin-controlled setting for whether Coaches may create their own event types.
- **FR-047**: System MUST record an audit log entry — who, what changed, when — for every change to a Coach's availability, an event type, or a global scheduling setting.
- **FR-048**: System MUST support named, revocable, hashed, read-only-by-default API keys for programmatic access to coaches, event types, slots, bookings, and session-count data.
- **FR-049**: System MUST expose a stable Academy scheduling API (list coaches/event types, get open slots, book, reschedule, cancel, list a student's bookings) as the only interface the booking UI and any future embed or in-app surface use — no caller talks to the underlying scheduling engine directly.
- **FR-050**: System MUST accept a signed identity token from a host application identifying an already-logged-in Student, pre-filling and skipping the contact step of the booking flow when present.
- **FR-051**: System MUST store an `external_user_id` on every student scheduling record in addition to email, so a student can be matched reliably even if their email changes; email alone MUST NOT be the only matching key.
- **FR-052**: System MUST deliver outbound webhooks — booking created, rescheduled, cancelled, completed, no-show — signed, with retries on delivery failure.
- **FR-053**: System MUST allow built-in Student-facing notifications to be turned off per event type, so a host application can send its own notifications instead once one exists.

### Key Entities

- **Coach Availability Schedule**: A named, timezone-aware weekly pattern of open hours belonging to one Coach, assigned to one or more event categories; a Coach may have several (e.g. separate one-on-one and group schedules).
- **Availability Override**: A date-specific exception (extra hours, or a blocked range) that takes precedence over a Coach's standing weekly schedule for that date.
- **Event Type**: A bookable session definition (extends 013's Booking Event) — adds a required session category including workshop, booking questions, buffers/limits, reschedule/cancellation rules with a cutoff, hidden/secret visibility, and a per-type notification workflow and credit/access configuration.
- **Workshop**: An Event Type variant supporting one or more co-hosting Coaches, a capacity cap, an optional waitlist, and listing on the public master workshop calendar.
- **Zoom Meeting**: A meeting record tied 1:1 to a confirmed session — holds the join link and tracks lifecycle (created, updated on reschedule, deleted on cancellation) and creation-failure/retry state.
- **External Calendar Connection**: A Coach's linked Google/Microsoft/iCloud account — which calendars are checked for conflicts, which receives new bookings, and sync/renewal/reconnect state.
- **Credit Transaction**: A record of a check/debit/refund call against the credit adapter for one booking, keyed by a unique booking identifier so it is never applied twice.
- **Session Record**: The immutable, category-tagged record of one delivered (or not) session — coach, event type, category, date/time, duration, attendee count, and final status — the basis for payroll export and API access.
- **Notification Workflow**: A per-event-type configuration mapping a trigger to an action and timing, distinct from 013's single fixed reminder interval.
- **Audit Log Entry**: A record of who changed what (availability, event type, or global setting) and when.
- **API Key**: A named, revocable, hashed credential granting programmatic access to scheduling data, read-only by default.
- **Scheduler/Designer**: A staff role, scoped to this feature, that can create event types/workshops/notification templates but not manage users or API keys — distinct from the platform's existing three-value staff role.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Coach can set up a full week of recurring availability, across multiple categories, in under 5 minutes, replacing what previously required adding each slot individually.
- **SC-002**: Zero bookings are ever confirmed for a credit-based event type when the booking Student has no available matching credit, verified under concurrent-attempt testing.
- **SC-003**: Zero credits are ever debited or refunded more than once for the same booking, verified under retried/duplicated-call testing.
- **SC-004**: A visitor can find and book an open workshop seat from the public master workshop calendar without needing a direct link or an existing account, in under 3 minutes.
- **SC-005**: 100% of confirmed one-on-one, group, and workshop bookings have a working, unique Zoom join link attached within 1 minute of confirmation under normal Zoom API availability.
- **SC-006**: An Admin's filtered CSV/XLSX session export always matches the equivalent on-screen filtered totals exactly, with zero discrepancies in spot-check testing.
- **SC-007**: Zero scheduling double-bookings occur between a Coach's Academy sessions and events on their connected external calendar, verified under conflict testing across all three supported providers.
- **SC-008**: 100% of a Coach's generated availability correctly reflects their configured local wall-clock hours on both sides of a daylight-saving transition, verified by testing.
- **SC-009**: At least 95% of workflow-configured notifications (confirmation, cancellation, reminder, alert) are delivered within 5 minutes of their configured trigger time.
- **SC-010**: An Admin can review who changed a given Coach's availability or event type and when, for 100% of changes made after this feature ships, with zero un-attributed changes.

## Assumptions

- **Extends, does not replace, 013's existing one-on-one and group booking mechanics**: Slot reservation, per-slot capacity, Tier restriction, and the confirmed/cancelled booking model from 013-coach-session-booking are reused as-is; this spec adds availability generation, workshops, credits, Zoom, calendar sync, session tracking, and roles/audit on top of them rather than re-specifying booking mechanics already shipped.
- **Underlying scheduling engine (Cal.com vs. continuing to extend the current custom system) is a planning-stage technical decision, not a spec-level one**: The source developer spec recommends self-hosting Cal.com but also flags its own license history as needing review before committing. This specification describes required capabilities and behavior only; which engine delivers them is decided in the implementation plan, per the project's "avoid HOW to implement" convention for specs.
- **Zoom connection model defaults to per-coach accounts**: Each Coach connects their own Zoom account (the source spec's first option) rather than routing every meeting through one shared company account, to avoid concentrating Zoom's per-user daily rate limit across the whole coaching staff on a single account. Coaches running group sessions or workshops need a paid Zoom license (free accounts cap group meetings at 40 minutes).
- **Interim manual meeting link, pending Zoom account provisioning**: until a paid Zoom account with Server-to-Server OAuth access is provisioned (docs/live-coaching-provisioning.md), FR-029's auto-created Zoom meeting is not live. A required manual `meetingLink` field on every event type stands in as the actual join-info mechanism in the meantime; a system-wide admin toggle (`zoomIntegrationEnabled`) and a per-event `autoCreateZoomMeeting` checkbox exist as scaffolding for the real integration but do not yet create real meetings when turned on.
- **SMS is out of scope for this launch**: Notification workflows are designed so SMS can be added as a future action type (FR-041), but only email is implemented now; SMS opt-in/consent flows are not part of this spec.
- **Round-robin and collective event assignment are out of scope**: These are available in Cal.com and noted as optional in the source spec, but no user story here requires them; every event type in this spec has an explicitly chosen coach (or co-hosts, for a workshop).
- **Recurring booking series (a Student auto-booked into weekly lessons) is out of scope**: The source spec calls this a nice-to-have; a Student books each session individually against generated availability.
- **Notifications reuse the existing email provider**: Confirmation/cancellation/reminder/alert emails use the same provider already integrated for 013 and Ask a Coach (Resend), with Academy-branded, editable templates, consistent with the source spec's "same email provider as Ask a Coach."
- **Credits launch timing, workshop pricing, and late-cancellation policy** were open decisions in the source developer spec, resolved during specification: credit enforcement is real and live from launch, but — per checking 008-staff-credit-watch/011-credit-watch-fallback's spec history, which found live Core write access does not exist — is recorded as placeholder adjustments overlaid on Core's read-only snapshot balance rather than a true Core write, pending a Core-side endpoint documented as a handoff contract (Story 2, FR-023–027); workshop pricing is configurable per workshop — free, credit-based, or paid (FR-015); and a fixed per-event-type cutoff window governs both reschedule/cancellation and credit-refund eligibility, with a late cancellation or no-show forfeiting the credit but still counting as a delivered session for coach pay (FR-020, FR-025).
