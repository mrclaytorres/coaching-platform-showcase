# Phase 0 Research: Booking UI Redesign

**Branch**: `019-booking-ui-redesign` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

No `[NEEDS CLARIFICATION]` markers were left in spec.md. This resolves the remaining technical
unknowns needed before design.

## #1 — Sessions list merge: reuse the Admin Dashboard's join pattern, don't duplicate it

**Decision**: A new function in `src/lib/booking/sessions.ts` (or a thin new sibling module)
merges two sources into one list: `listSessionRecords()` (existing, historical outcomes) plus a
new query for confirmed `bookings` whose time slot hasn't passed yet — the same
`booking_time_slots` → `bookings` → `customer_profiles` join pattern already built for the Admin
Dashboard's `listTodaysBookings()` (`src/lib/admin-dashboard/bookings.ts`), just not bounded to
"today."

**Rationale**: `session_records` rows are only ever created by `recordCancellation` (cancellation)
or `markSessionOutcome` (completed/no_show) — confirmed by reading every call site in
`sessions.ts`. There is no code path that ever inserts a `'scheduled'` row, even though the
`SessionStatus` type includes that value. The mockup's own pictured data includes upcoming
"Confirmed" sessions, so the redesigned page must read live `bookings` too. The admin-dashboard
join (coach/student name resolution via `getBookingEvent` + `customer_profiles`) is a proven,
already-working pattern for exactly this shape of data — reusing its approach (not its code,
since that module is scoped to "today only" and this needs an arbitrary filtered range) avoids
re-deriving the same join logic from scratch.

**Alternatives considered**: Writing a `'scheduled'` `session_records` row the moment a booking
is confirmed (in `bookSlot`, `src/lib/booking/bookings.ts`) — rejected: `session_records` is
explicitly a denormalized *history* snapshot ("history never retroactively changes," per its own
code comment); a session that's later rescheduled, cancelled, or whose event is edited would
leave a stale "scheduled" row needing its own update/cleanup path — far more invasive than a
read-time merge, for a feature that's supposed to be primarily visual.

## #2 — Status pill colors

**Decision**: Map each real status to one of the existing color tokens already used elsewhere in
this codebase (Credit Watch page, Admin Dashboard's Review Queue panel) rather than inventing a
new palette:

| Status | Color |
|---|---|
| Live/confirmed (not yet occurred) | `emerald` (already used for "confirmed" in `UpcomingBookingsPanel`) |
| `completed` | `violet` (new to this feature — no existing "completed"-style color precedent; chosen to read as "good and done," distinct from the "still coming up" emerald) |
| `cancelled_by_student` / `cancelled_by_coach` | `red` (already used for cancellation/error states throughout) |
| `no_show` | `muted/gray` (already used for "deactivated"/neutral states) |

**Rationale**: Reuses the existing `text-{color}-400 bg-{color}-900/20 border border-{color}-900/40`
pill pattern already established in `CreditWatchPage`'s `RenewalBadge`/`EstimateBadge` and the
Admin Dashboard's priority flag — no new visual language introduced, just applied consistently
to session status for the first time.

**Alternatives considered**: A literal "Pending" amber status matching the mockup — rejected per
spec.md's own Assumption; no real status in this system corresponds to it.

## #3 — Anton font wiring, scoped to `/booking/staff/*` only

**Decision**: Add the same `Anton` `next/font/google` loader (mirroring `src/app/admin/layout.tsx`
and `src/app/staff/layout.tsx` from specs/018) to `src/app/booking/staff/layout.tsx` only — not
`src/app/booking/admin/layout.tsx` (Master Calendar, Roles, API Keys, Audit Log, setup guides),
which this spec explicitly leaves unredesigned (spec.md Assumptions — no mockup provided for
Calendar/Roles).

**Rationale**: All four redesigned pages (landing, Sessions, My Schedule, Availability) live
under `/booking/staff/*`, sharing that one layout file — adding the loader there covers every
page this spec actually touches with a single change, matching 018's own "scoped to the subtree
that needs it" precedent exactly.

## #4 — Breadcrumb back-link

**Decision**: A small shared presentational pattern — `ArrowLeft` icon (lucide-react, already
used elsewhere in this codebase) + "BOOKING" label, muted color, linking to `/booking/staff` —
replacing each sub-page's current plain `← Booking Events` text link.

**Rationale**: Matches the mockup's small "← BOOKING" breadcrumb on every sub-page; `ArrowLeft`
is already an established icon choice in this codebase, not a new dependency.

## #5 — Tab row component

**Decision**: One new small presentational component, `BookingTabs`, rendering the
Availability/My Schedule/Sessions/Calendar(/Roles) pill-button row — replacing the Booking
landing page's current inline `Link` row. Takes the same `isElevated` boolean the page already
computes via `hasBookingRole` to conditionally show Roles (FR-004), unchanged logic, new
presentation only.

**Rationale**: The mockup only shows this tab row on the landing page (sub-pages show the
breadcrumb instead, research.md #4) — confirmed by comparing all four mockup screenshots — so
this is a single-page component, not a layout-level nav bar.
