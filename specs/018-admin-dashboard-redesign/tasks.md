---

description: "Task list for Admin Dashboard Redesign"
---

# Tasks: Admin Dashboard Redesign

**Input**: Design documents from `/specs/018-admin-dashboard-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested in spec.md; no automated test framework exists in this repo (plan.md Technical Context). Validation is manual via `quickstart.md`, referenced in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md: US1 = snapshot cards P1, US2 = growth charts P1, US3 = upcoming bookings P2, US4 = review queue + bulk assign P2, US5 = credit watch panel P3, US6 = recent activity P3, US7 = search + quick actions P4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)
- Paths are relative to repo root, inside `apps/academy-platform/` (plan.md Structure Decision)

---

## Phase 1: Setup

**Purpose**: New folders only — research.md #1 confirms no new npm dependency is needed anywhere in this feature.

- [X] T001 [P] Create `src/lib/admin-dashboard/` and `src/components/admin-dashboard/` directories

**Checkpoint**: Folders exist; no application code written yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The page shell every story's UI plugs into, plus the one shared cross-story data dependency (the Ask a Coach conversations read, needed by both US1's Awaiting Review card and US4's full Review Queue panel). **Must complete before US1 or US4**; US2/US3/US5/US6/US7 only need T002 (the shell).

- [X] T002 Replace the placeholder at `src/app/admin/dashboard/page.tsx` with the dashboard page shell: header (title + subtitle), a 4-card grid, a 2-chart grid, a 4-panel grid (2x2), and the quick-actions row — each section wrapped in its own `<Suspense>` boundary around a server component placeholder (FR-023, plan.md Constraints), gated by `requireStaffRole(['super_admin'])` (FR-022). Leave each Suspense child as a simple "coming soon" stub — later tasks replace each stub with its real component.
- [X] T003 [P] Create `src/lib/admin-dashboard/review-queue.ts` with `listOpenConversations()` — reads Ask a Coach's `conversations` table directly via a service-role Supabase client (research.md #3, the `getCrossAppLinks` precedent in `src/lib/auth/staff-profile.ts`), returning each open/unassigned conversation's student name, first-message preview, `waitingSince`, and a computed `isPriority` flag (waiting > 12h, FR-013)

**Checkpoint**: Page loads (all stub sections) for a Super Admin; `listOpenConversations()` is ready for both US1 and US4 to build on.

---

## Phase 3: User Story 1 - Admin sees the academy's current state at a glance (Priority: P1) 🎯 MVP

**Goal**: The four stat cards (Active Students, Active Staff, Bookings Today, Awaiting Review) render real numbers.

**Independent Test**: quickstart.md Scenario 1 — compare each card's number against the equivalent full feature page for the same moment; all four match exactly.

- [X] T004 [P] [US1] Add `getActiveStudentsStat()` to `src/lib/admin-dashboard/snapshot.ts` — active count plus delta vs. the count as of the end of the prior calendar month (FR-001, research.md #6)
- [X] T005 [P] [US1] Add `getActiveStaffStat()` to the same file — total active count split into coaches vs. everyone else (FR-002)
- [X] T006 [P] [US1] Add `getBookingsTodayStat()` to the same file — today's confirmed booking count split one-on-one/group vs. workshop (FR-003, spec.md Assumption replacing the nonexistent "pending" split)
- [X] T007 [US1] Add `getAwaitingReviewStat()` to the same file, built on T003's `listOpenConversations()` — total/priority/standard counts (FR-004)
- [X] T008 [US1] Create `src/components/admin-dashboard/StatCard.tsx` — one shared presentational component for all four cards (label, icon slot, big number, detail line)
- [X] T009 [US1] Replace the stat-card Suspense stubs in `page.tsx` (T002) with the four real cards, each calling its own `getXStat()` function

**Checkpoint**: Loading `/admin/dashboard` as a Super Admin shows four accurate, independently-verifiable numbers — deliverable as the MVP on its own.

---

## Phase 4: User Story 2 - Admin sees growth trends without leaving the dashboard (Priority: P1)

**Goal**: Student Growth and New Enrollments charts render 6 months of real data.

**Independent Test**: quickstart.md Scenario 2 — confirm both charts' values and percent-change badges against a manual count of `customer_profiles` rows bucketed by month.

- [X] T010 [US2] Create `src/lib/admin-dashboard/growth.ts` with the shared month-bucketing aggregation over `customer_profiles.created_at`/`is_active`, returning the last 6 months' `{monthLabel, activeStudentCount, newEnrollmentCount}` (FR-005/006, research.md #6)
- [X] T011 [P] [US2] Create `src/components/admin-dashboard/StudentGrowthChart.tsx` — hand-rolled inline SVG line/area chart plus the "+X% vs last month" badge (research.md #1)
- [X] T012 [P] [US2] Create `src/components/admin-dashboard/NewEnrollmentsChart.tsx` — hand-rolled inline SVG bar chart, most recent month visually highlighted, plus its own percent-change badge
- [X] T013 [US2] Replace the chart Suspense stubs in `page.tsx` with both real charts, both reading from T010's single aggregation call

**Checkpoint**: Both charts render real 6-month trends — independently testable and deliverable alongside US1.

---

## Phase 5: User Story 3 - Admin triages today's bookings from one place (Priority: P2)

**Goal**: The Upcoming Bookings panel lists today's confirmed sessions across every coach.

**Independent Test**: quickstart.md Scenario 3 — confirm the panel's list matches the Admin Master Calendar's bookings for today.

- [X] T014 [US3] Create `src/lib/admin-dashboard/bookings.ts` with `listTodaysBookings()` — a thin filter over the existing `listAllUpcomingSlots()` (`src/lib/booking/time-slots.ts`) narrowed to the current calendar day (FR-007)
- [X] T015 [US3] Create `src/components/admin-dashboard/UpcomingBookingsPanel.tsx` — table of student/coach/time/status, soonest-first, a cap with "ALL N BOOKINGS" linking to `/booking/admin/master-calendar` (FR-008), and an explicit empty state (Edge Case)
- [X] T016 [US3] Replace the Upcoming Bookings Suspense stub in `page.tsx` with the real panel

**Checkpoint**: Today's bookings are visible and accurate from the dashboard — independently testable.

---

## Phase 6: User Story 4 - Admin triages the coaching-question backlog from one place (Priority: P2)

**Goal**: The Review Queue panel lists the oldest open Ask a Coach conversations with priority flagging, and supports bulk assignment to a coach.

**Independent Test**: quickstart.md Scenario 4 — leave conversations unanswered for varying lengths of time, confirm oldest-first ordering and correct priority flags, bulk-assign a batch, confirm the assignment is visible in the coach's own Ask a Coach inbox.

- [X] T017 [US4] Create `src/components/admin-dashboard/ReviewQueuePanel.tsx` — list UI built on T003's `listOpenConversations()`, oldest-first, priority items visually flagged, a cap with "VIEW ALL" linking to the Ask a Coach inbox (FR-009/010/012)
- [X] T018 [US4] Add a bulk-assign Server Action to `src/lib/admin-dashboard/review-queue.ts` — given a list of conversation ids and one coach id, writes `assigned_coach_id` on each via the same service-role client as T003 (FR-011, research.md #3)
- [X] T019 [US4] Add the bulk-assign UI (checkboxes, a coach-picker dropdown, "ASSIGN REVIEWS" button) to `ReviewQueuePanel.tsx`, calling T018's action and refreshing the panel and the US1 Awaiting Review card on success
- [X] T020 [US4] Replace the Review Queue Suspense stub in `page.tsx` with the real panel

**Checkpoint**: The coaching-question backlog is triageable end-to-end from the dashboard — independently testable.

---

## Phase 7: User Story 5 - Admin spots credit-risk students without leaving the dashboard (Priority: P3)

**Goal**: The Credit Watch panel surfaces the same expiring-soon and negative-balance students as the full Credit Watch page.

**Independent Test**: quickstart.md Scenario 5 — confirm the panel's entries match the full Credit Watch page's top entries exactly.

- [X] T021 [US5] Create `src/lib/admin-dashboard/credit-watch.ts` — thin wrapper calling the existing `fetchCreditWatch`/`fetchCreditWatchFallback` (`src/lib/core-api.ts`, `src/lib/credit-watch/fallback.ts`), returning only the top N of each list (FR-014/015, research.md #4)
- [X] T022 [US5] Create `src/components/admin-dashboard/CreditWatchPanel.tsx` — list UI labeled by alert type, a cap with "ALL ALERTS" linking to `/staff/credit-watch`
- [X] T023 [US5] Replace the Credit Watch Suspense stub in `page.tsx` with the real panel

**Checkpoint**: Credit risk is visible from the dashboard with zero new aggregation logic — independently testable.

---

## Phase 8: User Story 6 - Admin sees what just happened across the academy (Priority: P3)

**Goal**: The Recent Activity panel shows a merged, timestamp-ordered feed of bookings confirmed, Ask a Coach replies sent, and tier advancements.

**Independent Test**: quickstart.md Scenario 6 — perform one action in each category, confirm all three appear correctly ordered with correct relative timestamps.

- [X] T024 [US6] Create `src/lib/admin-dashboard/activity.ts` with `listRecentActivity()` — reads `bookings` (confirmed, `created_at`), Ask a Coach `replies` (`author_type = 'coach'`, `created_at`), and `student_tier_progress` (`updated_at`) directly, merges by timestamp descending, capped and windowed per spec.md's fixed-constants Assumption (FR-016/017, research.md #5)
- [X] T025 [US6] Create `src/components/admin-dashboard/RecentActivityPanel.tsx` — feed UI with relative timestamps ("8 minutes ago"), a link to a fuller activity view, and an explicit empty state (Edge Case)
- [X] T026 [US6] Replace the Recent Activity Suspense stub in `page.tsx` with the real panel

**Checkpoint**: Recent cross-feature activity is visible from the dashboard with no new write paths anywhere — independently testable.

---

## Phase 9: User Story 7 - Admin jumps straight into common actions and records (Priority: P4)

**Goal**: A combined student/staff search and three quick-action buttons work from the dashboard.

**Independent Test**: quickstart.md Scenario 7 — search for a known student and a known staff member, confirm correct labeled results and correct destination pages; confirm each quick-action button lands on its correct existing page.

- [X] T027 [P] [US7] Add `searchStaffProfiles(query)` to `src/lib/auth/staff-profile.ts`, mirroring the existing `searchCustomerProfiles` (research.md #2)
- [X] T028 [US7] Create `src/lib/admin-dashboard/search.ts` combining `searchCustomerProfiles` and T027's `searchStaffProfiles` into one tagged, deduplicated result list, each row carrying its `recordHref` (FR-018/019)
- [X] T029 [US7] Create `src/components/admin-dashboard/DashboardSearch.tsx` — client component with a debounced text input calling a Server Action backed by T028, labeled "student"/"staff" results, and an explicit no-match state (FR-020)
- [X] T030 [US7] Create `src/components/admin-dashboard/QuickActions.tsx` — "Book Coaching" (links to `/booking/admin/master-calendar`, per spec.md's Assumption — not a new proxy-booking flow), "Invite Staff" (links to the existing Invite Staff Member page), "Create Booking" (links to the existing New Booking Event page) (FR-021)
- [X] T031 [US7] Wire `DashboardSearch` into the page header and `QuickActions` into the page footer in `page.tsx`

**Checkpoint**: Every mockup element is now live — all 7 stories complete.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across every story.

- [X] T032 [P] Run every scenario in `quickstart.md` end-to-end against a dev environment with real data in each touched system
- [X] T033 Run `npm run typecheck --workspace=apps/academy-platform` and `npm run build --workspace=apps/academy-platform` for a final clean check
- [X] T034 [P] quickstart.md Scenario 8 — confirm a failure isolated to the Ask a Coach read degrades only the Awaiting Review card and Review Queue panel, never the rest of the page (FR-023, SC-005)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: hard blocker for US1 and US4 specifically (T002 blocks every story's UI wiring task; T003 blocks US1's T007 and all of US4).
- **US1 (P1)** and **US2 (P1)** have no dependency on each other beyond the shared page shell (T002) — both can start immediately after Foundational, in parallel if staffed separately.
- **US3 (P2)** only needs T002 — independent of US1/US2/US4-US7 beyond that.
- **US4 (P2)** needs T003 (Foundational) in addition to T002 — independent of US1-US3/US5-US7 otherwise, despite sharing T003 with US1.
- **US5 (P3)** only needs T002 — independent of every other story; the lightest-weight story (pure wrapper over existing Credit Watch code).
- **US6 (P3)** only needs T002 — independent of every other story.
- **US7 (P4)** only needs T002 — independent of every other story.

**Suggested MVP scope**: US1 + US2 (Phases 3-4) — the four snapshot cards and two growth charts are the smallest slice that delivers the dashboard's core promise ("state of the academy at a glance") and directly match the two P1 stories in spec.md.

## Parallel Execution Examples

- Within Foundational: T003 can run in parallel with T002 (different files) — T002 doesn't need `listOpenConversations()` to exist yet, just a stub to call it later.
- Within US1: T004, T005, T006 (same file, but non-overlapping functions) can be written together; T008 (the shared `StatCard` component) can be built in parallel with any of T004-T007.
- Within US2: T011 and T012 (two independent chart components) can run in parallel once T010 exists.
- Across stories once Foundational is done: US3, US5, US6, US7 touch entirely disjoint new files and can be staffed in parallel with each other and with US1/US2; US4 can join that parallel set too as long as T003 is already done.

---

## Phase 11: User Story 8 - Staff and Coaches get the same live dashboard, scoped to their role (Priority: P3)

**Added 2026-10-08**, after the Admin Dashboard (Phases 1-10) was already implemented — reuses
nearly everything built there; see spec.md User Story 8 / FR-024–027 and data-model.md's
"Staff/Coach Dashboard reuse" section.

**Goal**: `/staff/dashboard` (today a bare placeholder, shared by Staff Support, Coach, and
Super Admin accounts) shows the same live panels as the Admin Dashboard, scoped by role.

**Independent Test**: quickstart.md Scenario 9 (below) — log in as each of the three roles,
confirm scoping and link targets per spec.md's Acceptance Scenarios.

- [X] T035 [US8] Add an optional `coachId` parameter to `getBookingsTodayStat()` in `src/lib/admin-dashboard/snapshot.ts` — when passed, counts only that coach's sessions (owner or co-host); omitted, counts every coach's (unchanged default, Admin Dashboard unaffected)
- [X] T036 [US8] Add the same optional `coachId` parameter to `listTodaysBookings()` in `src/lib/admin-dashboard/bookings.ts`, same scoping rule
- [X] T037 [P] [US8] Add `title`/`viewAllHref`/`viewAllLabel` props (each with a default matching current Admin Dashboard usage) to `src/components/admin-dashboard/UpcomingBookingsPanel.tsx`
- [X] T038 [US8] Replace the placeholder at `src/app/staff/dashboard/page.tsx` with a role-aware dashboard: 2 stat cards (Bookings Today — scoped per FR-024, Awaiting Review — unscoped per FR-025), Upcoming Bookings + Review Queue panels, Credit Watch panel gated `role !== 'coach'` (FR-026, reusing the page's own existing `canManageCredits` convention) + Recent Activity panel, and a single "Create Booking" quick action linking to `/booking/staff/new` — every link routed per FR-027 (`/booking/staff/schedule`, never the owner/admin-only Master Calendar or the super_admin-only Invite Staff page)

**Checkpoint**: All three roles see a correctly-scoped, fully-functional dashboard at `/staff/dashboard` — independently testable per role.

---

## Quickstart addendum

**Scenario 9 — Staff/Coach Dashboard role-scoping (Story 8)**

1. Log in as a Coach with at least one session today. Load `/staff/dashboard`.
2. **Expected**: "My Bookings Today" card/panel show only that coach's own sessions; no Credit Watch panel appears; "Create Booking" and the schedule link both open successfully (no redirect to `/booking/staff` from a failed role check).
3. Log in as a Staff Support (non-coach) account. Load `/staff/dashboard`.
4. **Expected**: "Bookings Today" shows every coach's sessions; the Credit Watch panel appears and matches the full `/staff/credit-watch` page.
5. Log in as the Super Admin. Load `/staff/dashboard`.
6. **Expected**: same as Staff Support (every coach's bookings, Credit Watch visible) — confirming `canManageCredits`'s existing `role !== 'coach'` convention is preserved correctly for this role too.
