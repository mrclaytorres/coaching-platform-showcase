# Phase 0 Research: Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign

**Branch**: `021-staff-students-submissions-tiers-ui` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

## #1 — Staff Dashboard: reuse, don't rebuild

**Decision**: Replace `src/app/staff/dashboard/page.tsx`'s content with a 4-stat-card row +
Shortcut grid, calling `getBookingsTodayStat`, `getAwaitingReviewStat`, `getActiveStudentsStat`
(`src/lib/admin-dashboard/*`, specs/018) and `getCreditWatchAlerts()` (`src/lib/credit-watch/
alerts.ts`, specs/020) for its total count. `DashboardSearch` (specs/018) is reused as-is, gated
`role !== 'coach'`.

**Rationale**: Every number this new mockup needs is already computed by an existing function
from the two prior specs — zero new aggregation required, just different composition.

**Alternatives considered**: Keep specs/018 Story 8's panels (Upcoming Bookings, Review Queue,
Recent Activity) alongside the new stat cards — rejected; the real mockup shows neither panel,
and stacking both designs on one page would be visually incoherent, not a redesign.

## #2 — Staff/Students search and pagination: client-side, no new queries

**Decision**: Wrap `StaffListTable`/`StudentListTable` in a small `'use client'` filter layer —
local text-match over the already-fetched array, sliced for pagination.

**Rationale**: Both lists are already fetched in full server-side on every page load
(`listStaffProfiles()`, `listCustomerProfiles()`) — there's no existing paginated/searchable
query to reuse, and a small, medium-sized staff/student roster doesn't need one. Client-side
filtering matches the mockup's instant, no-reload search feel for free.

## #3 — Students CSV export: new, client-side, no new API route

**Decision**: A small client-side handler builds a CSV string from the already-loaded
`StudentProfile[]` and triggers a `Blob` download — no server endpoint.

**Rationale**: No students export exists anywhere today (confirmed — grepped for any
students-CSV function, zero hits). Since research.md #2 already means the full list is in the
browser for search/pagination, building the export server-side would mean a second, redundant
fetch of data already in hand.

## #4 — Students stat cards: two real, two substituted

**Decision**: Total Students and New This Month are computed from `listCustomerProfiles()`'s
existing `createdAt`, mirroring specs/018's `growth.ts` month-bucketing. Active This Week shows
the existing total-active count (not a true weekly figure). Avg Completion shows "—".

**Rationale**: `customer_profiles` has no last-login/session-recency column anywhere (confirmed:
grepped for `last_sign_in`/`last_active`, zero hits) — there's no way to compute a true "active
in the last 7 days" figure. `lesson-completions.ts` only tracks one student's one lesson at a
time (`getLessonCompletions`, `markLessonComplete`) — no existing academy-wide average-
completion aggregate. Both are spec.md Assumptions resolved the same way specs/018/020 resolved
their own no-data-source gaps: show the closest honest real thing, never fabricate.

## #5 — Submissions priority: new threshold, same computed-flag pattern as Ask a Coach

**Decision**: A pending submission is flagged Priority when `now - submittedAt > 24h`, computed
at request time in the page itself — no new column.

**Rationale**: No priority concept exists on `SubmissionRecord` (`src/lib/progress/
submissions.ts`) today. Mirrors specs/018's Ask a Coach Review Queue priority flag pattern
(`isPriority` computed from wait time), with its own independently-chosen threshold since
full-course-assignment review happens on a different cadence than live chat.

## #6 — Tiers: pure restyle

**Decision**: No lib/action changes — `listTiers`/`createTier`/`updateTier`/`deleteTier`/
`setTierPricing` (`src/lib/courses/tier-actions.ts`) stay exactly as they are; only the page's
JSX/layout changes.

**Rationale**: Confirmed by reading the full current implementation — every mockup field/action
already exists with the exact same shape.
