# Feature Specification: Coach Session Booking

**Feature Branch**: `013-coach-session-booking`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "Now I want to start a new feature. I want you to create a feature that works same as the functionality of Calendly. Our main MVP for this feature is Staff/Coaches can create a booking events. Staff/Coaches creates an event which will then create a list of time/schedules on a Calendar that students can then take. Event types could be a 1-on-1 and multiple registrations. If possible I want this to be a separate stand-alone application within our project since this is entirely a huge application. But will still use the existing collections that we are using (e.g. Users, etc.)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coach publishes a 1-on-1 booking event and a student books it (Priority: P1)

A Coach sets up a bookable session (e.g. "1-on-1 Technique Review"), adds a set of open time slots to it, and publishes it. A Student browses available sessions, finds an open slot that works for their schedule, and reserves it. The slot then shows as taken so no one else can book it.

**Why this priority**: This is the core value of the entire feature — without it, nothing else in this spec matters. It is also the smallest fully-working slice: one Coach, one event, one Student, one booking.

**Independent Test**: Can be fully tested by having a Coach create a 1-on-1 event with two time slots, then having a Student book one of them — the booked slot disappears from availability while the other remains open, and delivers a working end-to-end booking loop on its own.

**Acceptance Scenarios**:

1. **Given** a Coach is creating a new booking event, **When** they set the event type to 1-on-1, a title, a duration, and add one or more specific date/time slots, **Then** the event and its slots become visible to Students as available to book.
2. **Given** a published 1-on-1 event with an open slot, **When** a Student selects and confirms that slot, **Then** the booking is recorded, the slot is marked unavailable to other Students, and the Student sees the confirmed booking on their own schedule.
3. **Given** a Student has just booked a 1-on-1 slot, **When** another Student views the same event, **Then** that slot no longer appears as an option.

---

### User Story 2 - Coach publishes a group event with multiple registration spots (Priority: P2)

A Coach sets up a session meant for several Students at once (e.g. a group Q&A), sets how many Students may register per slot, and publishes it. Multiple Students can each reserve one spot in the same slot until it reaches capacity, after which it's no longer bookable.

**Why this priority**: Group sessions are explicitly called out as one of the two required event types for MVP, but they build directly on the booking mechanics established in User Story 1 (event → slot → booking), so they are the next-most-valuable increment rather than a parallel track.

**Independent Test**: Can be fully tested by having a Coach create a group event with a capacity of 3 on one slot, having three different Students each book a spot, and confirming a fourth Student can no longer book that slot — delivers working capacity-limited group booking independent of any other story.

**Acceptance Scenarios**:

1. **Given** a Coach is creating a new booking event, **When** they set the event type to group and specify a maximum number of registrants per slot, **Then** that slot accepts bookings from multiple Students up to that number.
2. **Given** a group slot with 2 of 3 spots filled, **When** a third Student books it, **Then** the slot becomes full and no longer appears as bookable to other Students.
3. **Given** a group slot that is already at capacity, **When** a Student attempts to book it, **Then** the system prevents the booking and clearly indicates the slot is full.

---

### User Story 3 - Coach restricts a booking event to Students in specific Tiers (Priority: P3)

A Coach setting up a booking event (e.g. an advanced technique session) limits it to Students who are currently in one or more specific Tiers of the platform's existing belt-progression system. Students outside those Tiers never see the event as an option; Students inside them see and book it exactly as they would an unrestricted event.

**Why this priority**: Booking is far more useful to the business once sessions can be targeted at the Students they're actually meant for, reusing the Tier concept that already governs course access elsewhere in the platform rather than showing every session to every Student regardless of relevance.

**Independent Test**: Can be fully tested by creating two Students in different Tiers, restricting an event to only one of those Tiers, and confirming the matching Student can see and book it while the other Student cannot see or book it — independent of group-capacity or cancellation behavior.

**Acceptance Scenarios**:

1. **Given** a Coach is creating or editing a booking event, **When** they select one or more Tiers to restrict it to, **Then** only Students associated with at least one of those Tiers can see and book the event.
2. **Given** a booking event has no Tier restriction set, **When** any active Student browses events, **Then** the event appears to all of them, matching the unrestricted default.
3. **Given** a Student who is not in a restricted event's allowed Tier(s), **When** they attempt to open or book that event directly, **Then** the system prevents the booking and does not list the event among their bookable options.

---

### User Story 4 - Coaches and Students manage existing bookings (Priority: P4)

A Student can see their own upcoming bookings and cancel one if their plans change, which frees that spot for someone else. A Coach can see who is registered for each of their slots and can cancel a slot entirely (e.g. if they become unavailable), which removes any bookings tied to it.

**Why this priority**: Booking creation without any way to correct mistakes or free up capacity would make the feature unusable in practice within days of launch, but it is only needed once bookings already exist, so it naturally follows Stories 1-3.

**Independent Test**: Can be fully tested by having a Student cancel one of their own bookings and confirming the freed slot becomes bookable again, and separately by having a Coach cancel a slot and confirming any Students who had booked it are removed from it — delivers working booking lifecycle management independent of new event/slot creation.

**Acceptance Scenarios**:

1. **Given** a Student has an upcoming booking, **When** they cancel it, **Then** the booking is removed from their schedule and the slot's availability increases by one (or the slot reopens, for a 1-on-1 event).
2. **Given** a Coach is viewing one of their events, **When** they open a specific slot, **Then** they see the list of Students currently registered for it.
3. **Given** a slot has one or more Students registered, **When** the Coach cancels that slot, **Then** all associated bookings are removed and the affected Students no longer see that session on their schedule.

---

### User Story 5 - Students and Coaches receive email notifications for booking activity (Priority: P5)

When a Student books, cancels, or is about to attend a session, both the Student and the owning Coach receive an email reflecting that activity, so a booking's status is never something either party has to remember to check the app for.

**Why this priority**: Notifications make the booking record durable and reduce no-shows, but they layer on top of booking/cancellation mechanics that must already exist and work — they add trust and polish to a flow that functions without them.

**Independent Test**: Can be fully tested by having a Student book a slot and confirming both the Student and the owning Coach each receive a confirmation email, then canceling it and confirming both receive a cancellation email — testable independently of any UI change.

**Acceptance Scenarios**:

1. **Given** a Student successfully books a slot, **When** the booking is confirmed, **Then** the Student receives a confirmation email with the session's date, time, and Coach, and the Coach receives a notification email that a new booking was made.
2. **Given** a confirmed booking is canceled, whether by the Student or by the Coach canceling the slot, **When** the cancellation occurs, **Then** the affected Student(s) receive a cancellation email.
3. **Given** a Student has an upcoming confirmed booking, **When** the scheduled reminder window before the session's start time is reached, **Then** the Student receives a reminder email for that booking.

---

### Edge Cases

- What happens when two Students attempt to book the last open spot in a slot (1-on-1's only spot, or a group slot's last spot) at the same moment? Only one booking may succeed; the other Student is shown that the slot is no longer available.
- What happens when a Student tries to book a slot that overlaps in time with another slot they've already booked? The system prevents the double-booking and explains why.
- What happens when a Coach tries to add a time slot that has already passed? The system rejects it.
- What happens when a Coach deletes or unpublishes an entire event that still has future slots with active bookings? Existing bookings for slots that have not yet occurred are canceled and removed from affected Students' schedules, consistent with a Coach canceling an individual slot.
- What happens when a Student's only spot in a group slot is canceled by the Coach cancelling that slot? The Student's booking disappears and the freed capacity becomes available to other Students (unless the whole slot was removed).
- What happens when a Coach views a fully-booked group slot? They still see the full roster of registered Students even though no further bookings can be made.
- What happens when a Student's Tier changes after they've already booked a session that was restricted to a different Tier? The existing booking is honored; Tier eligibility is only checked at the moment of booking, not retroactively.
- What happens when a booking or cancellation email fails to send (e.g. no valid email on file)? The booking/cancellation itself still succeeds — the system does not roll it back — but the delivery failure is recorded so staff can follow up.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a Staff/Coach account to create a booking event with a title, description, duration, and event type (1-on-1 or group).
- **FR-002**: System MUST allow a Staff/Coach to add one or more specific date/time slots to a booking event they own.
- **FR-003**: System MUST allow a Staff/Coach to specify a maximum number of registrants for each slot of a group-type event; 1-on-1 events are limited to exactly one registrant per slot by definition.
- **FR-004**: System MUST prevent a Staff/Coach from adding a time slot that has already passed.
- **FR-005**: System MUST allow a Staff/Coach to publish an event so its slots become visible and bookable to Students, and to unpublish/withdraw an event so it no longer accepts new bookings.
- **FR-006**: System MUST allow an authenticated Student to browse published booking events and their open time slots.
- **FR-007**: System MUST allow an authenticated Student to reserve an open time slot, recording that Student against that slot.
- **FR-008**: System MUST prevent a Student from booking a slot that is already full (1-on-1 slot already taken, or group slot at capacity).
- **FR-009**: System MUST prevent a Student from holding two overlapping bookings across any events.
- **FR-010**: System MUST ensure that when two booking attempts for the same remaining spot occur at the same time, only one succeeds and the other is informed the spot is no longer available.
- **FR-011**: System MUST allow a Student to view a list of their own upcoming (and past) bookings.
- **FR-012**: System MUST allow a Student to cancel one of their own upcoming bookings, which returns that capacity to the slot.
- **FR-013**: System MUST allow a Staff/Coach to view, per slot, the list of Students currently registered.
- **FR-014**: System MUST allow a Staff/Coach to cancel an individual slot, which removes all bookings tied to that slot.
- **FR-015**: System MUST allow a Staff/Coach to view a list of the booking events they own along with each event's slots and booking counts.
- **FR-016**: System MUST restrict creation, editing, and cancellation of booking events and slots to Staff/Coach accounts; Students may only book and cancel their own bookings.
- **FR-017**: System MUST display booking event times to each Student in a way that reflects their own local time, so a time slot is unambiguous regardless of where the Student or Coach is located.
- **FR-018**: System MUST NOT reveal the identities of other registered Students to a Student browsing or booked into a group slot — a Student sees their own registration status and the slot's remaining/total capacity only.
- **FR-019**: System MUST allow a Staff/Coach to optionally restrict a booking event to one or more of the platform's existing Tiers at the time they create or edit the event.
- **FR-020**: System MUST only show and allow booking of a Tier-restricted event to Students associated with at least one of its allowed Tiers; an event with no Tier restriction remains visible and bookable to all active Students.
- **FR-021**: System MUST evaluate a Student's Tier eligibility at the moment they book a restricted event; a Student's Tier changing afterward MUST NOT cancel or invalidate a booking already made while eligible.
- **FR-022**: System MUST send a confirmation email to the booking Student and a notification email to the owning Coach when a booking is confirmed.
- **FR-023**: System MUST send a cancellation email to every affected Student when a booking or an entire slot is canceled, whether the Student or the Coach initiated the cancellation.
- **FR-024**: System MUST send a reminder email to a Student ahead of the start time of each of their upcoming confirmed bookings.
- **FR-025**: System MUST NOT block, delay, or roll back a booking or cancellation if its associated notification email fails to send; the delivery failure MUST be recorded for staff visibility.

### Key Entities

- **Booking Event**: A bookable session type defined by a Staff/Coach — has a title, description, duration, event type (1-on-1 or group), a per-slot capacity (for group events), an owning Coach, an optional restriction to one or more Tiers, and a published/unpublished state. Analogous to a Calendly "event type."
- **Time Slot**: A specific date/time instance belonging to one Booking Event — has a start time, remaining/total capacity, and a status (open, full, or canceled). This is the unit a Student actually reserves.
- **Booking**: A record linking one Student to one Time Slot — has a status (confirmed or canceled) and a timestamp of when it was made. A 1-on-1 slot can have at most one confirmed Booking; a group slot can have up to its configured capacity.
- **Coach/Staff Account**: The existing Staff/Coach identity that owns Booking Events; reuses the platform's current Staff and Coach roles rather than introducing a new one.
- **Student Account**: The existing Student/customer identity that makes Bookings; reuses the platform's current Student identity rather than introducing a new one.
- **Tier**: The platform's existing belt-progression grouping, reused (not redefined) here as an optional eligibility filter on a Booking Event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Coach can go from "no booking event exists" to "a bookable event with open slots is live for Students" in under 5 minutes.
- **SC-002**: A Student can find and confirm a booking for an open time slot in under 2 minutes from opening the booking area.
- **SC-003**: Zero double-bookings occur for any single slot's capacity under concurrent booking attempts (a slot never ends up with more confirmed Bookings than its capacity allows).
- **SC-004**: 100% of Students who cancel a booking see that slot's freed capacity reflected as bookable again without needing to refresh or wait.
- **SC-005**: A Coach can see an accurate, up-to-date roster of who is registered for any of their slots at any time, with no missing or stale entries.
- **SC-006**: At least 90% of Students surveyed after using the booking feature report they could tell, without confusion, which slots were available versus full or already booked by them.
- **SC-007**: 100% of Tier-restricted booking events are correctly hidden from Students outside the allowed Tier(s) in verification testing, with zero visibility leaks.
- **SC-008**: At least 95% of booking confirmation and cancellation emails are delivered within 5 minutes of the triggering action.
- **SC-009**: Students who receive a reminder email for a booking show a session no-show rate no higher than Students overall, indicating reminders are effectively reducing missed sessions.

## Assumptions

- **Standalone surface, shared identity**: "Separate stand-alone application within our project" is treated as a request for this feature to live in its own distinct area of the product (its own navigation/URL space, not folded into existing course/lesson pages) while still authenticating against and reusing the platform's existing Staff, Coach, and Student accounts — no new account system is introduced.
- **Tier restriction reuses the existing belt-progression Tier system**: "Enrollment/tier gating" is implemented via the platform's current Tier concept (the same one that already governs sequential-locked course access), not the separate, currently-blocked CourseHost membership-tier concept (Starter/Live/Pro/Forever/Master) — no new membership data source is required for this feature.
- **Explicit slots, not recurring availability rules**: For MVP, a Coach adds specific one-off date/time slots to an event directly (optionally several at once), rather than defining a recurring weekly-availability pattern that auto-generates slots indefinitely. Recurring-availability generation is a reasonable future enhancement but is out of scope here to keep the MVP bounded.
- **No waitlist for full slots**: When a 1-on-1 slot is taken or a group slot reaches capacity, it simply stops being bookable — there is no waitlist or automatic promotion when a spot frees up via cancellation for MVP.
- **Email is the notification channel**: Confirmation, cancellation, and reminder notifications are delivered via email, using the email address already on file for each Student and Coach account — no SMS or in-app notification center is introduced for MVP.
- **Single fixed reminder window**: The reminder email is sent at one fixed interval before a session's start time (not separately configurable per event) for MVP; the exact interval is a planning-stage detail rather than a business requirement.
- **No reschedule fee or cutoff window**: A Student may cancel their own booking at any time before the session's start time; there is no minimum-notice cancellation policy enforced in this MVP.
- **Time zone display**: Each Student and Coach sees slot times converted to their own local time zone, consistent with how session times are already shown elsewhere in the product.
