# Quickstart: Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign

**Branch**: `021-staff-students-submissions-tiers-ui` | **Spec**: [spec.md](./spec.md)

Manual end-to-end validation — no automated test framework exists in this repo.

## Scenario 1 — Staff Dashboard (Story 1)

1. Load `/staff/dashboard` as a Coach, then as Staff Support, then as Super Admin.
2. **Expected**: 4 stat cards with correct role-scoped numbers; Credit Alerts/Credit Watch
   shortcut hidden for Coach only; Shortcut grid's 4 cards all link correctly.

## Scenario 2 — Staff Accounts (Story 2)

1. Load `/admin/staff`, search by a known name and a known email.
2. **Expected**: list filters instantly, no reload.
3. Change a role, deactivate, then reactivate a staff member.
4. **Expected**: all three succeed exactly as before this redesign.

## Scenario 3 — Students (Story 3)

1. Load `/admin/students`.
2. **Expected**: Total Students and New This Month match a manual count; Avg Completion shows "—".
3. Search by name, email, and Academy ID.
4. **Expected**: instant filtering, no reload.
5. Click Export CSV.
6. **Expected**: downloads the full student list, not just the current filtered/paginated view.
7. Disable then Enable a student.
8. **Expected**: succeeds exactly as before this redesign.

## Scenario 4 — Submissions (Story 4)

1. Load `/staff/submissions` with a submission pending >24h and one pending <24h.
2. **Expected**: the older one is flagged Priority, the newer one isn't; the Pending tab shows
   the correct count badge.
3. Search by student name.
4. **Expected**: instant filtering.
5. Click Review on a row.
6. **Expected**: opens that submission's existing review page.

## Scenario 5 — Tiers (Story 5)

1. Load `/staff/tiers`, reorder a tier, update its pricing, create a new tier.
2. **Expected**: all three succeed exactly as before this redesign, just restyled.
