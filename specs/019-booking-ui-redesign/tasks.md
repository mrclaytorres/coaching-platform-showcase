---

description: "Task list for Booking UI Redesign"
---

# Tasks: Booking UI Redesign

**Input**: Design documents from `/specs/019-booking-ui-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested in spec.md; no automated test framework exists in this repo. Validation is manual via `quickstart.md`, referenced in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md: US1 = Booking landing page P1, US2 = Sessions page P1, US3 = My Schedule page P2, US4 = Availability page P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Paths are relative to repo root, inside `apps/academy-platform/` (plan.md Structure Decision)

---

## Phase 1: Setup

- [X] T001 [P] Create `src/components/booking/` directory (no new npm dependencies — research.md confirms every piece reuses existing patterns)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Anton font (needed by every story's headings), the live/historical session merge (needed by US2 and US3), and the two small shared components (needed by US2, US3, and US4). **Must complete before US2, US3, US4**; US1 only needs T002.

- [X] T002 Add the `Anton` `next/font/google` loader to `src/app/booking/staff/layout.tsx`, scoped via `variable: '--font-display'` and applied to the layout's wrapping div — mirrors `src/app/admin/layout.tsx`/`src/app/staff/layout.tsx` from specs/018 (research.md #3, FR-021)
- [X] T003 [P] Create `src/lib/booking/session-list.ts` with the live+historical merge function — queries not-yet-occurred confirmed `bookings` (joined to `booking_time_slots`/`getBookingEvent`/`customer_profiles`, mirroring `src/lib/admin-dashboard/bookings.ts`'s join pattern) and merges them with `listSessionRecords()`'s existing historical rows into one sorted list of `Session List Row` (data-model.md), accepting optional coach/category/status/date-range filters (research.md #1, FR-010)
- [X] T004 [P] Create `src/components/booking/SessionStatusPill.tsx` — maps each status (`'live'`/`completed`/`cancelled_by_student`/`cancelled_by_coach`/`no_show`) to its color per research.md #2 (FR-012)
- [X] T005 [P] Create `src/components/booking/BookingBreadcrumb.tsx` — `ArrowLeft` icon + "BOOKING" label linking to `/booking/staff`, replacing each sub-page's current plain text link (research.md #4)

**Checkpoint**: Shared pieces exist; US1 can already proceed; US2/US3/US4 are unblocked.

---

## Phase 3: User Story 1 - Staff sees a redesigned Booking home page (Priority: P1) 🎯 MVP

**Goal**: `/booking/staff` matches the Booking.png mockup.

**Independent Test**: quickstart.md Scenario 1 — load as Super Admin and as a plain Coach, confirm header/tabs/table render correctly and every link/button works.

- [X] T006 [US1] Create `src/components/booking/BookingTabs.tsx` — the Availability/My Schedule/Sessions/Calendar tab row, plus a conditionally-shown Roles tab taking an `isElevated` boolean prop (research.md #5, FR-003/004)
- [X] T007 [US1] Update `src/app/booking/staff/page.tsx`: accent "Coach Session Booking" eyebrow, large "Booking" title (now Anton via T002), subtitle, "New Event" button (FR-001/002); replace the current inline nav-link row with `BookingTabs` (FR-003/004); wrap the events table in a card with Published rendered in a distinct accent/positive color and Draft in muted (FR-005)

**Checkpoint**: The Booking landing page is fully redesigned and independently testable/deployable.

---

## Phase 4: User Story 2 - Staff sees a redesigned Sessions page, including upcoming bookings (Priority: P1)

**Goal**: `/booking/staff/sessions` matches the mockup and shows live + historical sessions together.

**Independent Test**: quickstart.md Scenario 2 — confirm an upcoming, a completed, and a cancelled session all appear correctly attributed and styled; confirm filtering and export still work.

- [X] T008 [US2] In `src/app/booking/staff/sessions/page.tsx`, replace the current `listSessionRecords`-only call with T003's merge function, passing through the existing Coach/Category/Status/From/To filters unchanged (FR-010)
- [X] T009 [US2] Restyle `sessions/page.tsx`: swap the current `← Booking Events` link for `BookingBreadcrumb` (FR-006); wrap the filter controls in a card correctly labeled for what it does, not "Add a Date Override" (FR-007, spec.md Assumptions); add a "{N} sessions found" line reflecting the current filters (FR-008); restyle Export CSV/XLSX from underlined links to bordered buttons, functionally unchanged (FR-009); wrap the results table in a card, each row showing the event title, the attendee name (one-on-one) or count (group/workshop) beneath it, and a `SessionStatusPill` (FR-011/012)

**Checkpoint**: The Sessions page is fully redesigned, shows upcoming bookings for the first time, and is independently testable/deployable.

---

## Phase 5: User Story 3 - Staff sees a redesigned My Schedule page, grouped by day (Priority: P2)

**Goal**: `/booking/staff/schedule` matches the mockup, grouped under relative-day headings.

**Independent Test**: quickstart.md Scenario 3 — confirm today's and tomorrow's sessions each render under the correct relative-day heading with correct attribution.

- [X] T010 [US3] In `src/app/booking/staff/schedule/page.tsx`, replace the current `listCoachSchedule` call with T003's merge function scoped to the selected coach, so each row carries attendee attribution and a status (FR-015)
- [X] T011 [US3] Restyle `schedule/page.tsx`: swap the current `← Booking Events` link for `BookingBreadcrumb` (FR-013); replace the current day-of-week grouping with relative-day headings — "Today, [date]" and "Tomorrow, [date]" for the next two calendar days, a weekday-and-date heading beyond that (FR-014); wrap each day's sessions in its own card, each row showing start time + duration, event title, attendee attribution, and a `SessionStatusPill` (FR-015)

**Checkpoint**: My Schedule is fully redesigned and independently testable/deployable.

---

## Phase 6: User Story 4 - Staff sees a redesigned Availability page (Priority: P2)

**Goal**: `/booking/staff/availability` matches the mockup — visual redesign only, zero field/behavior changes.

**Independent Test**: quickstart.md Scenario 4 — add a weekly schedule and a date override, confirm both succeed exactly as today inside the new card layout.

- [X] T012 [US4] Restyle `src/app/booking/staff/availability/page.tsx`: swap the current `← Booking Events` link for `BookingBreadcrumb` (FR-016); wrap the Weekly Schedules list/empty-state and its "Add a Weekly Schedule" form in the mockup's card layout, fields/behavior unchanged (FR-017); wrap Date Overrides the same way (FR-018); wrap Troubleshoot a Time the same way (FR-019)

**Checkpoint**: All four pages are now fully redesigned — every story complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T013 [P] Run every scenario in `quickstart.md` end-to-end against a dev environment with real booking events, bookings, and session records
- [X] T014 Run `npm run typecheck --workspace=apps/academy-platform` and `npm run build --workspace=apps/academy-platform` for a final clean check
- [X] T015 [P] quickstart.md Scenario 2 steps 7-8 (export contents unchanged) and Scenario 1 steps 3-4 (Roles tab hidden for a non-elevated Coach) — confirm FR-009's and FR-020's "unchanged behavior" guarantees hold

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: T002 blocks every story's heading rendering; T003/T004 block US2 and US3; T005 blocks US2, US3, and US4.
- **US1 (P1)** only needs T002 — can start immediately after Foundational, independent of US2-US4.
- **US2 (P1)** needs T003, T004, T005 — independent of US1/US3/US4 otherwise.
- **US3 (P2)** needs T003, T004, T005 — independent of US1/US2/US4 otherwise (does not depend on US2's page changes, only the same shared T003 function).
- **US4 (P2)** needs T005 only — the lightest-weight story (pure restyle, no data changes).

**Suggested MVP scope**: US1 + US2 (Phases 3-4) — the two P1 stories: the landing page redesign and the one genuine functional improvement (Sessions showing upcoming bookings).

## Parallel Execution Examples

- Within Foundational: T003, T004, T005 can all be written in parallel (different files, T002 is independent of all three).
- Once Foundational is done: US1, US2, US3, US4 can all be staffed in parallel — each touches a disjoint page file, and US3's T010/T011 don't depend on US2's T008/T009 despite sharing T003's underlying function.
- Within US1: T006 (new component) can be written before or alongside the start of T007, since T007 only needs T006's finished export, not its own file.
