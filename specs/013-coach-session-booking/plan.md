# Implementation Plan: Coach Session Booking

**Branch**: `013-coach-session-booking` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-coach-session-booking/spec.md`

## Summary

Staff/Coaches can define a bookable "Booking Event" (1-on-1 or capacity-limited group), add specific date/time slots to it, and publish it; Students browse and reserve an open slot, manage their own bookings, and both sides get email notifications. This is a genuinely new subsystem — no existing scheduling/booking code exists in this repo — built as a new `/booking` route tree inside the existing single Next.js app (not a separate deployable service, research.md #1), reusing existing Staff/Coach and Student identities and the existing Tier system for optional event gating rather than introducing any new account or membership concept. Booking Events (staff-authored, relatively static) live in a new Payload collection, mirroring `Assignments`/`Courses`; Time Slots and Bookings (high-write, concurrency-sensitive) live in new Supabase tables with an atomic-UPDATE capacity guard, mirroring `submissions`/`course_enrollments` (research.md #2/#3). Email notifications are a new integration (Resend, research.md #6) with a cron-triggered Route Handler for reminders (research.md #7), since no notification or scheduling infrastructure exists today.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`)

**Primary Dependencies**:
- Existing: PayloadCMS (`getPayloadClient()`), `@supabase/supabase-js` (service-role client, same pattern as every other write path), `requireStaffRole()` / `requireCustomerProfile()` (existing auth guards), `isCourseUnlocked`-style Tier comparison (`src/lib/progress/tier-progress.ts`, reused not modified).
- New: `resend` npm package (email, research.md #6) — the only new runtime dependency this feature adds.

**Storage**:
- New Payload collection `booking-events` (contracts/payload-collections.md) — requires a Payload migration (`push: false` convention, same as every prior collection change).
- New Supabase tables `booking_time_slots`, `bookings`, `booking_notification_failures` (contracts/supabase-schema.md) — applied manually per the existing schema-file convention (specs 002/004/008).
- No changes to any existing table or Payload collection.

**Testing**: No automated test framework exists in this repo (confirmed unchanged across specs 008/011/012). Validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app (`next dev` locally, `next start` in production), plus one new externally-triggered endpoint (`/api/booking/send-reminders`) that requires an external scheduler (host crontab or third-party HTTP-cron) to be wired up in production — a new operational dependency, documented in quickstart.md and to be added to `docs/production-deployment.md`.

**Project Type**: Web application — single existing Next.js app, no new services (research.md #1).

**Performance Goals**: N/A beyond "feels instant" for both Coach authoring and Student booking (SC-001, SC-002) — no bulk operations in this MVP.

**Constraints**:
- MUST NOT allow a Time Slot's confirmed Booking count to exceed its capacity under concurrent booking attempts (FR-010, SC-003) — solved with a single atomic guarded `UPDATE` on a denormalized `confirmed_count` column, not a stored procedure (research.md #3).
- MUST NOT let a Student hold two overlapping confirmed Bookings (FR-009) — an application-level check spanning the Payload/Supabase boundary (Time Slot start time in Supabase, Booking Event duration in Payload), not a database constraint (research.md #5).
- MUST NOT retroactively invalidate a Booking made while Tier-eligible, even if the Student's Tier later changes (FR-021) — eligibility is checked only at booking time, never re-checked afterward.
- MUST NOT block or roll back a booking/cancellation if its notification email fails to send (FR-025) — every `notifications.ts` call is wrapped so a Resend failure only ever produces a `booking_notification_failures` row, never a thrown error back to the booking flow.
- Booking Event creation/editing/publishing/slot management restricted to `super_admin`/`staff`/`coach` (FR-016); not owner-scoped to the specific Coach who created it — matches every other staff-authored content type in this codebase (research.md #9).
- A Student may only view/cancel their own Bookings (FR-016) — ownership check in `cancelBooking`/`listStudentBookings`, same pattern as `deleteSubmission`'s existing `studentId` ownership check.
- No waitlist, no recurring-availability generation, no reschedule fee/cutoff, no SMS/in-app notifications, single fixed reminder window — all explicitly out of scope per spec.md Assumptions.

**Scale/Scope**: MVP — one Booking Event type selector (1-on-1/group), explicit one-off slots only (no recurring generation), email-only notifications, no waitlist.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project (confirmed unchanged since specs 008/011/012). No gates to evaluate against. Proceeding under the same established conventions already used throughout this codebase: `requireStaffRole()`/`requireCustomerProfile()` gating for all writes, service-role Supabase client instantiated per-file, Payload accessed via the shared `getPayloadClient()` cache, cross-system Payload/Supabase references stored as plain (non-FK) columns, and functions owning their own `revalidatePath()` calls.

**Post-design re-check**: Two genuinely new patterns were introduced and are worth flagging even with no formal gates to check against: (1) the atomic-`UPDATE`-as-lock capacity guard (research.md #3) is a new concurrency pattern this codebase hasn't needed before, justified by SC-003's zero-double-booking requirement; (2) Resend is a new external dependency, justified by FR-022–025 being explicit, user-requested in-scope requirements rather than deferred assumptions. Both are documented in Complexity Tracking below for visibility, though neither violates any existing convention.

## Project Structure

### Documentation (this feature)

```text
specs/013-coach-session-booking/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   ├── payload-collections.md           # Phase 1 output — new booking-events collection
│   ├── supabase-schema.md               # Phase 1 output — new time slot/booking/failure-log tables
│   └── server-actions.md                # Phase 1 output — function contracts this feature adds
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
collections/
└── BookingEvents.ts                     # NEW — Payload collection (contracts/payload-collections.md)

payload.config.ts                        # MODIFIED — registers BookingEvents

src/
├── app/
│   ├── api/
│   │   └── booking/
│   │       └── send-reminders/
│   │           └── route.ts             # NEW — cron-triggered reminder scan (research.md #7)
│   └── booking/
│       ├── staff/
│       │   ├── page.tsx                 # NEW — list of Booking Events (FR-015)
│       │   ├── new/
│       │   │   └── page.tsx             # NEW — create Booking Event form (FR-001)
│       │   └── [eventId]/
│       │       └── page.tsx             # NEW — edit event, publish toggle, add/cancel Time Slots,
│       │                                 # per-slot roster, inline notification-failure list
│       │                                 # (FR-002, FR-005, FR-013, FR-014, research.md #8)
│       └── customer/
│           └── [id]/
│               ├── page.tsx             # NEW — browse bookable events (FR-006)
│               ├── bookings/
│               │   └── page.tsx         # NEW — Student's own upcoming/past Bookings, cancel
│               │                         # action (FR-011, FR-012)
│               └── [eventId]/
│                   └── page.tsx         # NEW — event detail, open-slot picker, book action
│                                         # (FR-007)
├── lib/
│   └── booking/
│       ├── booking-events.ts            # NEW — Payload CRUD for Booking Events
│       │                                 # (contracts/server-actions.md)
│       ├── time-slots.ts                # NEW — Supabase CRUD for Time Slots
│       ├── bookings.ts                  # NEW — booking lifecycle: atomic capacity claim,
│       │                                 # overlap check, Tier-eligibility check, cancellation
│       └── notifications.ts             # NEW — Resend wrappers + failure logging
```

**Structure Decision**: A new `/booking` route tree and a new `src/lib/booking/` module, entirely additive — no existing route, collection, or table is modified except `payload.config.ts` (one new import + one new array entry). This gives the feature its own distinct navigation surface (the "stand-alone application" feel requested) while staying inside the single existing Next.js app and reusing every existing identity/auth mechanism (research.md #1).

## Complexity Tracking

*No constitution violations — table intentionally omitted, per the Constitution Check note above (no ratified gates exist to violate). The two new patterns (atomic capacity claim, Resend dependency) are justified inline in Technical Context and research.md #3/#6, not tracked here since there's no gate they'd be an exception to.*
