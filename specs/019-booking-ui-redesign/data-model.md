# Phase 1 Data Model: Booking UI Redesign

**Branch**: `019-booking-ui-redesign` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

**No new tables or columns.** The one computed shape below merges two existing sources at
request time; every other page in this feature reads data that's already fully modeled
(`booking_events`/Payload, `booking_time_slots`, `bookings`, `session_records`,
`availability_schedules`, `availability_overrides` — all pre-existing, specs/013).

## Session List Row *(computed, not stored)*

Stories 2 and 3 (Sessions page, My Schedule page) both consume this same shape — Sessions shows
every coach's rows (filterable), My Schedule shows one coach's rows grouped by day.

| Field | Type | Source |
|---|---|---|
| `id` | text | `session_records.id` for a historical row; `bookings.id` prefixed/tagged for a live row (so the two id spaces can't collide in a merged list) |
| `eventTitle` | text | `session_records.event_type_title_snapshot` (historical) or the live event's `title` via `getBookingEvent` (live) |
| `category` | `'one-on-one' \| 'group' \| 'workshop'` | `session_records.session_category` or the live event's `eventType` |
| `scheduledStart` | ISO timestamp | `session_records.scheduled_start` or `booking_time_slots.start_time` |
| `durationMinutes` | number | `session_records.duration_minutes` or the live event's `durationMinutes` |
| `attendee` | `{ kind: 'name'; name: string } \| { kind: 'count'; count: number }` | One-on-one: the single booked student's `customer_profiles.first_name`. Group/workshop: the count of non-cancelled `bookings` rows sharing that time slot (research.md #1, spec.md FR-011) |
| `status` | `'live' \| 'completed' \| 'cancelled_by_student' \| 'cancelled_by_coach' \| 'no_show'` | `'live'` for a not-yet-occurred confirmed booking with no `session_records` row yet; otherwise the existing `session_records.status` value verbatim |
| `coachId` / `coachName` | text | `session_records.coach_id`/`coach_name_snapshot` (historical) or the live event's `coachId` + a `staff_profiles` lookup (live) |

`status === 'live'` renders as "Confirmed" with the emerald pill (research.md #2); every other
status renders under its own existing label/color.

## Everything else — unchanged shapes, new presentation only

- **Booking Event** (Story 1): `BookingEventSummary` (`src/lib/booking/booking-events.ts`) — read
  via the existing `listOwnedBookingEvents()`, no shape change.
- **Weekly Schedule / Date Override** (Story 4): `listSchedulesForCoach`/`listOverridesForCoach`
  (`src/lib/booking/availability.ts`) — no shape change, same forms/fields.
- **Troubleshoot result** (Story 4): `explainAvailability()` — no shape change.
