---

description: "Task list for Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign"
---

# Tasks: Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign

**Input**: Design documents from `/specs/021-staff-students-submissions-tiers-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested; no automated test framework exists in this repo. Validation is manual via `quickstart.md`.

**Organization**: US1 = Staff Dashboard (P1), US2 = Staff Accounts (P2), US3 = Students (P1), US4 = Submissions (P2), US5 = Tiers (P3). No Foundational phase — each story's new pieces are its own, nothing shared across more than one story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Paths are relative to repo root, inside `apps/academy-platform/` (plan.md Structure Decision)

---

## Phase 1: Setup

- [X] T001 [P] No new npm dependencies required (research.md confirms every piece reuses existing patterns) — nothing to install

---

## Phase 2: User Story 1 - Staff sees a redesigned Staff Dashboard matching the real mockup (Priority: P1) 🎯 MVP

**Goal**: `/staff/dashboard` matches Staff Dashboard.png — replaces specs/018 Story 8's panels-based content entirely (FR-004).

**Independent Test**: quickstart.md Scenario 1.

- [X] T002 [P] [US1] Create `src/components/admin-dashboard/ShortcutCard.tsx` — a large tile (icon + title + description) linking to a given href, for the Shortcut grid
- [X] T003 [US1] Replace `src/app/staff/dashboard/page.tsx`'s content: two-tone "Staff Dashboard" title, "Welcome, [name]. You are logged in as [Role]" line, `DashboardSearch` (hidden for Coach, FR-001); four stat cards — My Sessions Today (`getBookingsTodayStat`, role-scoped per specs/018), Awaiting Review (`getAwaitingReviewStat`), Credit Alerts (`getCreditWatchAlerts().length`, hidden for Coach), Active Students (`getActiveStudentsStat`) (FR-002); a "Shortcut" section with four `ShortcutCard`s — Credit Watch (hidden for Coach), Customers, Submissions, Booking (FR-003)

**Checkpoint**: Staff Dashboard fully redesigned against the real mockup, independently testable/deployable.

---

## Phase 3: User Story 2 - Admin sees a redesigned Staff Accounts page (Priority: P2)

**Goal**: `/admin/staff` matches Staff.png — instant search + pagination added.

**Independent Test**: quickstart.md Scenario 2.

- [X] T004 [US2] Convert `src/components/StaffListTable.tsx` to a client component with local search (name/email) and pagination state over the already-passed `profiles` array (research.md #2) — role-change/deactivate/reactivate forms unchanged
- [X] T005 [US2] Restyle `src/app/admin/staff/page.tsx`: large "Staff Accounts" title + subtitle, "Invite Staff Member" button (unchanged destination), card-wrapped table (FR-005/006/007)

**Checkpoint**: Staff Accounts fully redesigned, independently testable/deployable.

---

## Phase 4: User Story 3 - Admin sees a redesigned Students page with real stat cards (Priority: P1)

**Goal**: `/admin/students` matches Students.png — stat cards, search, pagination, CSV export.

**Independent Test**: quickstart.md Scenario 3.

- [X] T006 [US3] Convert `src/components/StudentListTable.tsx` to a client component with local search (name/email/Academy ID) and pagination state (research.md #2), plus an "Export CSV" handler that builds a CSV string from the full `profiles` array and triggers a `Blob` download (research.md #3) — Disable/Enable forms unchanged
- [X] T007 [US3] Restyle `src/app/admin/students/page.tsx`: large "Students" title + subtitle, four stat cards computed inline from `listCustomerProfiles()` — Total Students (count), New This Month (created-this-month count, research.md #4), Active This Week (total active count, labeled per mockup, research.md #4), Avg Completion ("—", research.md #4) (FR-008); card-wrapped table

**Checkpoint**: Students fully redesigned, independently testable/deployable.

---

## Phase 5: User Story 4 - Coach sees a redesigned Submissions queue (Priority: P2)

**Goal**: `/staff/submissions` matches Submissions.png — pending count badge, priority flag, search.

**Independent Test**: quickstart.md Scenario 4.

- [X] T008 [US4] Restyle `src/app/staff/submissions/page.tsx`: large "Submissions" title + subtitle, a client-side search box filtering by student name/email, Pending/Reviewed tabs with a count badge on Pending (FR-013), a computed `isPriority` flag per pending row (`now - submittedAt > 24h`, research.md #5, FR-014), card-wrapped table with student avatar initials and relative "submitted X ago" time, "Review" action unchanged (FR-015/016)

**Checkpoint**: Submissions fully redesigned, independently testable/deployable.

---

## Phase 6: User Story 5 - Admin sees a redesigned Tiers page (Priority: P3)

**Goal**: `/staff/tiers` matches Tiers.png — visual only.

**Independent Test**: quickstart.md Scenario 5.

- [X] T009 [US5] Restyle `src/app/staff/tiers/page.tsx`: large "Tiers" title + subtitle, card-wrapped table and "Add a Tier" form, zero field/action changes (FR-017)

**Checkpoint**: Tiers fully redesigned, independently testable/deployable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T010 [P] Run every scenario in `quickstart.md` end-to-end against a dev environment with real staff, students, and submissions
- [X] T011 Run `npm run typecheck --workspace=apps/academy-platform` and `npm run build --workspace=apps/academy-platform` for a final clean check
- [X] T012 [P] Confirm every existing action (staff role change/deactivate/reactivate, student disable/enable, submission review, tier reorder/pricing/delete/create) still produces the same result as before this redesign (FR-018, SC-003)

---

## Dependencies & Execution Order

- **US1, US2, US3, US4, US5 are fully independent of each other** — each touches a disjoint set of files.
- Within US1: T002 (new component) and T003 (page) — T003 needs T002 finished first.
- Within US2/US3: the list-table conversion (T004/T006) should land before its page restyle (T005/T007), since the page passes the same props either way but the new search/export UI lives inside the table component.

**Suggested MVP scope**: US1 + US3 (Phases 2 + 4) — the two P1 stories.

## Parallel Execution Examples

- Once Setup is done: US1, US2, US3, US4, US5 can all be staffed in parallel.
- Within US1: T002 can be written while T003 is being scaffolded, as long as T003's import of `ShortcutCard` waits for T002 to land.
