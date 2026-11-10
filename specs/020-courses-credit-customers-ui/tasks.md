---

description: "Task list for Courses, Credit Watch & Customers UI Redesign"
---

# Tasks: Courses, Credit Watch & Customers UI Redesign

**Input**: Design documents from `/specs/020-courses-credit-customers-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested; no automated test framework exists in this repo. Validation is manual via `quickstart.md`.

**Organization**: US1 = Courses page (P1), US2 = New Course page (P2), US3 = Credit Watch page (P1), US4 = Customers page (P2). No Foundational phase — unlike specs/018/019, none of this feature's new pieces are shared across more than one story, so each lives in its own story's phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Paths are relative to repo root, inside `apps/academy-platform/` (plan.md Structure Decision)

---

## Phase 1: Setup

- [X] T001 [P] Create `src/components/credit-watch/` directory (no new npm dependencies)

---

## Phase 2: User Story 1 - Admin sees a redesigned Courses page with pricing and quick actions (Priority: P1) 🎯 MVP

**Goal**: `/staff/courses` matches Courses.png — price and Edit/Publish-Unpublish actions added.

**Independent Test**: quickstart.md Scenario 1.

- [X] T002 [US1] Update `src/app/staff/courses/page.tsx`: large "Courses" title + subtitle + "New Course" button (unchanged Coach-hidden rule, FR-001); card-wrapped table; Price column showing `priceCents` formatted as currency when `isForSale`, else "Not for sale" (FR-003); Actions column with "Edit" (→ `/staff/courses/{id}`) and a small inline Server Action toggling `status` via the existing `updateCourse()`, labeled "Unpublish" when published / "Publish" when draft (FR-004)

**Checkpoint**: Courses page fully redesigned, independently testable/deployable.

---

## Phase 3: User Story 2 - Admin sees a redesigned New Course page (Priority: P2)

**Goal**: `/staff/courses/new` matches the mockup — visual only.

**Independent Test**: quickstart.md Scenario 2.

- [X] T003 [US2] Restyle `src/app/staff/courses/new/page.tsx`: "Courses > New Course" breadcrumb (FR-005), large "New Course" title, card wrapper around the existing unchanged `NewCourseForm`/`createCourseAction` (FR-006)

**Checkpoint**: New Course page fully redesigned, independently testable/deployable.

---

## Phase 4: User Story 3 - Admin sees a redesigned Credit Watch page with alert categories (Priority: P1)

**Goal**: `/staff/credit-watch` matches Credit Watch.png — four alert categories with filtering — while keeping the existing at-risk-sessions table beneath it (FR-015a, confirmed with user).

**Independent Test**: quickstart.md Scenario 3.

- [X] T004 [US3] Create `src/lib/credit-watch/alerts.ts` with `getCreditWatchAlerts()`: extends `fetchCreditWatchFallback`'s per-student sweep with a Low Balance bucket (0 ≤ balance ≤ 1) alongside its existing Negative Balance bucket, captures each student's most recent `snapshot.activity[0].occurred_at` as `lastActivity`, adds declined purchases via `listAllPurchases({ status: 'declined' })` as Failed Payment rows, and returns an always-empty Cards Expiring bucket — merging all four into one `CreditWatchAlert[]` (data-model.md, research.md #3/#4/#5)
- [X] T005 [P] [US3] Create `src/components/credit-watch/AlertPill.tsx` — maps each alert category to a colored pill (negative-balance → red, low-balance → amber, cards-expiring → blue, failed-payment → red), mirroring `SessionStatusPill`'s pattern from specs/019
- [X] T006 [US3] Restyle `src/app/staff/credit-watch/page.tsx`: large "Credit Watch" title + existing subtitle; four stat cards (counts per category, FR-007); a filter tab row (All Alerts + one per category, FR-011) driven by a `?category=` search param; a card-wrapped table of the filtered alerts using `AlertPill`, each row's action ("Add Credit" → `/staff/credit-watch/{coreCustomerId}`, "Send Reminder" — Cards Expiring only, never rendered since that bucket is always empty, "Retry Charge" → `/staff/purchases`) per FR-012/013/014; a clear empty state per category with zero rows (FR-015); keep the existing "Upcoming sessions at risk" section and its `LookAheadSelect` entirely unchanged, rendered below the new alert section (FR-015a)

**Checkpoint**: Credit Watch page fully redesigned with zero functionality lost, independently testable/deployable.

---

## Phase 5: User Story 4 - Admin sees a redesigned Customers page (Priority: P2)

**Goal**: `/staff/customers` matches Customers.png — two side-by-side lookup cards plus a Recent Lookups table.

**Independent Test**: quickstart.md Scenario 4.

- [X] T007 [US4] Add `listRecentCustomerLookups()` to `src/lib/auth/customer-profile.ts` — reuses `listCustomerProfiles()`, sorted most-recently-created first, capped to a handful of rows (research.md #7)
- [X] T008 [US4] Restyle `src/app/staff/customers/page.tsx`: large "Customers" title + existing unchanged subtitle; the two existing `CustomerSearchForm` lookup methods as side-by-side cards (FR-016); a new "Recent Lookups" card-wrapped table below, built on T007, each row linking to `/staff/customers/{coreCustomerId}` (FR-017)

**Checkpoint**: Customers page fully redesigned, independently testable/deployable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 [P] Run every scenario in `quickstart.md` end-to-end against a dev environment with real courses, students, and purchases
- [X] T010 Run `npm run typecheck --workspace=apps/academy-platform` and `npm run build --workspace=apps/academy-platform` for a final clean check
- [X] T011 [P] Confirm every existing action (course status toggle, course creation, both customer lookups, credit adjustments via the linked detail page, purchase refunds, the at-risk-sessions lookahead selector) still produces the same result as before this redesign (FR-018, SC-004)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: T001 only blocks T005 (the new component's own directory) — trivial, can run first or alongside anything.
- **US1, US2, US3, US4 are fully independent of each other** — each touches a disjoint set of files, no cross-story dependency (unlike specs/018/019, nothing here is shared across stories).
- Within US3: T004 and T005 can run in parallel; T006 needs both finished.

**Suggested MVP scope**: US1 + US3 (Phases 2 + 4) — the two P1 stories.

## Parallel Execution Examples

- Once Setup is done: US1, US2, US3, US4 can all be staffed in parallel.
- Within US3: T004 (lib function) and T005 (presentational component) can be written in parallel before T006 wires them together.
