# Quickstart: Admin Dashboard Redesign

**Branch**: `018-admin-dashboard-redesign` | **Spec**: [spec.md](./spec.md) | **Data shapes**: [data-model.md](./data-model.md)

Manual end-to-end validation — no automated test framework exists in this repo (unchanged since every prior spec). Run each scenario as a Super Admin against a dev/staging environment with real data in each of the touched systems (Students, Staff, Booking, Ask a Coach, Credit Watch, Tiers).

## Scenario 1 — Snapshot cards (Story 1)

1. Note the current active-student count from `/admin/students`, active-staff count from `/admin/staff`, today's confirmed-booking count from `/booking/admin/master-calendar`, and Ask a Coach's open-conversation count from its inbox.
2. Load `/admin/dashboard`.
3. **Expected**: all four stat cards match those independently-observed numbers exactly (SC-002).

## Scenario 2 — Growth charts (Story 2)

1. Confirm at least 2-3 students were created in different calendar months within the last 6 months (seed via `/dev/seed-accounts` if needed on a dev box).
2. Load `/admin/dashboard`.
3. **Expected**: Student Growth and New Enrollments charts show 6 months of data, the New Enrollments bar chart's most recent month is visually distinct from the rest, and both percent-change badges match a manual calculation from the two most recent months' raw numbers.

## Scenario 3 — Upcoming Bookings (Story 3)

1. Confirm at least one booking for today across two different coaches.
2. Load `/admin/dashboard`.
3. **Expected**: the Upcoming Bookings panel lists them soonest-first with correct student/coach/time/status, and "ALL N BOOKINGS" links to `/booking/admin/master-calendar`.
4. Cancel all of today's bookings and reload.
5. **Expected**: the panel shows a clear empty state, not a blank area.

## Scenario 4 — Review Queue + bulk assignment (Story 4)

1. In Ask a Coach, leave one conversation unanswered for >12 hours (or adjust a seeded row's timestamp directly in a dev DB) and another for <12 hours.
2. Load `/admin/dashboard`.
3. **Expected**: both appear in the Review Queue, oldest first; only the >12h one is flagged priority.
4. Select both, choose a coach, and submit the bulk assignment.
5. **Expected**: both conversations' `assigned_coach_id` is updated; that coach's own Ask a Coach inbox now shows them as assigned; the Awaiting Review count on the dashboard drops accordingly on next load.

## Scenario 5 — Credit Watch panel (Story 5)

1. Note the current top expiring-soon and negative-balance students from `/staff/credit-watch`.
2. Load `/admin/dashboard`.
3. **Expected**: the Credit Watch panel's entries match the full page's top entries exactly, each labeled with its alert type, and "ALL ALERTS" links to `/staff/credit-watch`.

## Scenario 6 — Recent Activity (Story 6)

1. Confirm one booking, send one Ask a Coach coach reply, and advance one student's tier.
2. Load `/admin/dashboard`.
3. **Expected**: all three appear in the Recent Activity panel, most recent first, each with a correct relative timestamp and a human-readable summary line.

## Scenario 7 — Search & quick actions (Story 7)

1. On `/admin/dashboard`, search for a known student's name.
2. **Expected**: a labeled "student" result appears; clicking it opens that student's existing Customer record page.
3. Search for a known staff member's name.
4. **Expected**: a labeled "staff" result appears; clicking it opens the Staff Accounts page.
5. Search for text matching nobody.
6. **Expected**: a clear "no matches" state, not an empty list.
7. Click "Invite Staff" and "Create Booking".
8. **Expected**: each lands on the existing Invite Staff Member / New Booking Event page respectively.

## Scenario 8 — Partial data-source failure (Edge Case, FR-023)

1. Temporarily break connectivity to Ask a Coach's side of the shared database only (e.g. a deliberately wrong env var in a local test, reverted after).
2. Load `/admin/dashboard`.
3. **Expected**: the Awaiting Review card and Review Queue panel show a localized "couldn't load" state; every other card/chart/panel still renders normally (SC-005).
