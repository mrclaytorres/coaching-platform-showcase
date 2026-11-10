# Quickstart: Booking UI Redesign

**Branch**: `019-booking-ui-redesign` | **Spec**: [spec.md](./spec.md) | **Data shapes**: [data-model.md](./data-model.md)

Manual end-to-end validation — no automated test framework exists in this repo. Run each
scenario as a Super Admin (and once more as a plain Coach for Scenario 1's Roles-tab check)
against a dev/staging environment with real booking events, bookings, and at least one
cancelled/completed/no-show session record.

## Scenario 1 — Booking landing page (Story 1)

1. Load `/booking/staff`.
2. **Expected**: accent "Coach Session Booking" eyebrow, large "Booking" title, subtitle, "New
   Event" button, a tab row (Availability/My Schedule/Sessions/Calendar), events table in a
   card with Published in a distinct color from Draft.
3. Reload as a plain Coach with no elevated booking role.
4. **Expected**: the Roles tab is absent; every other tab/button is unchanged.
5. Click each tab and "New Event".
6. **Expected**: each lands on its existing page with no broken links.

## Scenario 2 — Sessions page shows live and historical sessions together (Story 2)

1. Confirm a booking for a date in the future (don't cancel or mark its outcome).
2. Mark a different past booking as completed, and cancel another.
3. Load `/booking/staff/sessions` with no filters.
4. **Expected**: all three appear — the future one as "Confirmed" (emerald pill), the completed
   one as "Completed" (violet pill), the cancelled one as "Cancelled..." (red pill) — each
   showing the right student name (one-on-one) or count (group/workshop), sorted by time.
5. Filter by Coach/Category/Status/From/To.
6. **Expected**: the list and the "{N} sessions found" count both update correctly; the filter
   card is labeled for what it does (not "Add a Date Override").
7. Click "Export CSV" and "Export XLSX".
8. **Expected**: both downloads succeed with the same historical-only contents the export
   already produces today (export scope is unchanged — FR-009's note).

## Scenario 3 — My Schedule groups by relative day (Story 3)

1. Confirm one booking for today and one for tomorrow, for the same coach.
2. Load `/booking/staff/schedule` for that coach.
3. **Expected**: two cards, headed "Today, [date]" and "Tomorrow, [date]"; each session row
   shows time/duration, event title, student attribution, and a status pill.
4. Switch the coach picker to a different coach and click "View".
5. **Expected**: the page reloads showing that coach's own schedule.

## Scenario 4 — Availability page, restyled only (Story 4)

1. Load `/booking/staff/availability`.
2. Add a weekly schedule and a date override using the form cards.
3. **Expected**: both succeed exactly as today, now inside the mockup's card layout; the new
   entries appear in their respective list sections.
4. Use "Troubleshoot a Time" with a known-blocked date/time.
5. **Expected**: the same available/unavailable result the current page already produces.

## Scenario 5 — Anton headings (cross-cutting, FR-021)

1. Load all four pages from Scenarios 1-4.
2. **Expected**: every page heading (Booking, Sessions, My Schedule, Availability) renders in
   Anton, matching the Admin/Staff Dashboard headings from specs/018.
