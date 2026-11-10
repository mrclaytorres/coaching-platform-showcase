# Phase 1 Data Model: Admin Dashboard Redesign

**Branch**: `018-admin-dashboard-redesign` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

**No new tables or columns.** Every shape below is a computed, read-only view assembled at request time from existing tables (`customer_profiles`, `staff_profiles`, `bookings`/`booking_time_slots`, Ask a Coach's `conversations`/`replies`, `student_tier_progress`, plus the existing Credit Watch data source) — matching spec.md's Key Entities section. Nothing here is persisted; nothing here needs a migration.

## Dashboard Snapshot *(computed, not stored)*

The four stat cards (Story 1, FR-001–004). One function per card, fetched in parallel by the page.

| Field | Type | Source |
|---|---|---|
| `activeStudents` | `{ count: number; deltaCount: number; deltaPercent: number }` | `customer_profiles` where `is_active = true` and `source_app IS NULL`; delta vs. the count as of the end of the prior calendar month (research.md #6) |
| `activeStaff` | `{ total: number; coaches: number; other: number }` | `staff_profiles` where `is_active = true`, split by `role = 'coach'` vs. not |
| `bookingsToday` | `{ oneOnOneAndGroup: number; workshop: number }` | `bookings`/`booking_time_slots` for the current calendar day, `status = 'confirmed'`, split by the owning event type's category (spec.md Assumption: replaces the nonexistent "pending" split) |
| `awaitingReview` | `{ total: number; priority: number; standard: number }` | Ask a Coach `conversations` where `status = 'open'` and no coach reply yet; `priority` = waiting > 12h (FR-013) |

## Growth Chart Point *(computed, not stored)*

One array of 6, oldest to newest, for each chart (Story 2, FR-005/006).

| Field | Type | Notes |
|---|---|---|
| `monthLabel` | text | e.g. `"Apr"` |
| `activeStudentCount` | number | Student Growth chart — active-student count as of that month's end |
| `newEnrollmentCount` | number | New Enrollments chart — count of `customer_profiles` with `created_at` in that month |

Both charts read the same underlying per-month aggregation (research.md #6); the page requests the field it needs per chart.

## Upcoming Booking Row *(computed, not stored)*

Story 3, FR-007. One row per confirmed booking today.

| Field | Type | Source |
|---|---|---|
| `bookingId` | uuid | `bookings.id` |
| `studentName` | text | `customer_profiles.first_name` for `bookings.student_id` |
| `coachName` | text | `staff_profiles` first/last name for the owning event's `coachId` |
| `startTime` | ISO timestamp | `booking_time_slots.start_time` |
| `status` | `'confirmed'` | Always confirmed per FR-007 (no pending/canceled rows are ever included) |

## Review Queue Item *(existing `conversations` row, new lens — not a new entity)*

Story 4, FR-009/010. Ask a Coach's own `conversations` table, read directly (research.md #3).

| Field | Type | Source |
|---|---|---|
| `conversationId` | uuid | `conversations.id` |
| `studentName` | text | The conversation's `customer_profiles.first_name` |
| `preview` | text | First message's text/transcript, truncated |
| `waitingSince` | ISO timestamp | The conversation's first message's `created_at` |
| `isPriority` | boolean | Computed: `waitingSince` older than 12h ago (FR-013) |
| `assignedCoachId` | uuid, nullable | `conversations.assigned_coach_id` — the existing column FR-011's bulk assignment writes to |

## Credit Watch Alert *(existing Credit Watch shape, not redefined here)*

Story 5, FR-014/015. Identical to what `fetchCreditWatch`/`fetchCreditWatchFallback` already return (research.md #4) — the dashboard panel takes the top N of `at_risk_sessions` and `negative_balances` as-is, no new shape.

## Activity Entry *(computed, not stored)*

Story 6, FR-016/017. Merged from three sources by `occurredAt`, descending.

| Field | Type | Source |
|---|---|---|
| `kind` | `'booking_confirmed' \| 'coach_replied' \| 'tier_advanced'` | Which of the three covered event types this is |
| `summary` | text | e.g. `"Daniel Reed reviewed Jack Miller's submission"` — assembled per `kind` from the row's own names |
| `occurredAt` | ISO timestamp | `bookings.created_at` / `replies.created_at` / `student_tier_progress.updated_at` respectively |

## Staff/Coach Dashboard reuse *(Story 8, added 2026-10-08)*

No new shapes — `/staff/dashboard` reuses every shape above as-is, except two functions gained
an optional `coachId` parameter that narrows the same query to one coach's own sessions (owner
or co-host) instead of every coach's:

| Function | Unscoped (Admin Dashboard) | Scoped (`coachId` passed — Coach role on Staff Dashboard) |
|---|---|---|
| `getBookingsTodayStat(coachId?)` | Every coach's bookings today | Just that coach's |
| `listTodaysBookings(coachId?)` | Every coach's bookings today | Just that coach's |

Dashboard Snapshot's `awaitingReview`, Review Queue Item, Credit Watch Alert, and Activity Entry
are all read identically regardless of viewer role (spec.md FR-025/026 — no row-level scoping).

## Search Result *(computed, not stored)*

Story 7, FR-018/019. One list, tagged by type, merging the two existing/new search functions (research.md #2).

| Field | Type | Source |
|---|---|---|
| `type` | `'student' \| 'staff'` | Which function produced this row |
| `id` | uuid | `customer_profiles.id` or `staff_profiles.id` |
| `name` | text | `first_name` (students) or `first_name + last_name` (staff) |
| `email` | text | For disambiguating same-name results |
| `recordHref` | text | The existing Customer record page or Staff Accounts page, respectively (FR-019) |
