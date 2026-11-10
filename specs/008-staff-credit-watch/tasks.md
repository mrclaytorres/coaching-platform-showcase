# Tasks: Staff Credit Watch Dashboard

**Input**: Design documents from `/specs/008-staff-credit-watch/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not requested in the spec; this repo has no automated test framework (plan.md Technical Context). Validation is manual via `quickstart.md`.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1 > US2 > US3) so each can be implemented and tested independently.

**⚠️ Blocking external dependency**: `contracts/core-credit-watch-api.md` (`POST /pull_credit_watch/`) does not exist on Core's side yet. Tasks that call `fetchCreditWatch()` (US1, US2) can be fully coded now but can only be end-to-end validated against a local stub until that endpoint ships (see `quickstart.md`'s note). US3 has no such dependency — it reuses the existing, already-live `fetchSnapshot()`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to US1 / US2 / US3 from spec.md

## Path Conventions

Single existing Next.js app (`plan.md` Structure Decision) — all paths are relative to the repo root (`src/...`).

---

## Phase 1: Setup

**Purpose**: The one piece of shared infrastructure this feature needs before any code can run against it

- [X] T001 Apply the `credit_adjustments` table (DDL, index, RLS) from `specs/008-staff-credit-watch/contracts/supabase-schema.md` to the Supabase project

**Note**: No new npm dependencies are required — `@supabase/supabase-js` and `lucide-react` are already in `package.json` and used the same way every other staff feature in this codebase uses them.

**Checkpoint**: `credit_adjustments` table exists and is queryable via the service-role client.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Code every user story depends on — the Core bulk-read client, the effective-balance overlay math, the adjustment read/write functions, and the nav entry point

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add `fetchCreditWatch(lookAheadDays)` to `src/lib/core-api.ts`, alongside the existing `fetchSnapshot()` — same `cache()` wrapper, same `CORE_API_BASE`/`CORE_SHARED_SECRET`/`CORE_WAF_BYPASS` auth, same `CoreApiError` on non-2xx, per `contracts/core-credit-watch-api.md`
- [X] T003 [P] Create `src/lib/credit-watch/effective-balance.ts` — pure functions `applyPlaceholderAdjustments()` and `isCoveredByRenewal()` per `data-model.md`'s effective-balance formula and `contracts/core-credit-watch-api.md`'s "less than 14 days overdue still counts" rule
- [X] T004 Create `src/lib/credit-watch/adjustments.ts` (`'use server'`) — `listAdjustmentsForCustomer(coreCustomerId)` and `createCreditAdjustment(input)`, both gated with `requireStaffRole(['super_admin', 'staff'])`, per `contracts/server-actions.md` (depends on T001 — table must exist)
- [X] T005 [P] Add a "Credit Watch" nav item to `src/components/StaffSidebar.tsx`, linking to `/staff/credit-watch`, visible only when `role !== 'coach'` (same conditional pattern already used for the "Tiers" item)

**Checkpoint**: Foundation ready — all three user stories can now be built.

---

## Phase 3: User Story 1 - Spot upcoming sessions that will overdraft a student (Priority: P1) 🎯 MVP

**Goal**: Staff open `/staff/credit-watch` and see every upcoming session, across all students, within a chosen look-ahead window that would leave a negative balance once debited.

**Independent Test**: Open `/staff/credit-watch` (or a URL with `?days=7`) and confirm the "Upcoming sessions at risk" table shows only sessions inside the selected window with a negative projected (effective) balance, each with student/lesson type/coach/now/after-session/covered-or-unfunded badge, plus the coach-to-coach exclusion count.

### Implementation for User Story 1

- [X] T006 [US1] Create `src/app/staff/credit-watch/page.tsx` — `requireStaffRole(['super_admin', 'staff'])` gate, read `?days=` search param (default `30`, validate against `7 | 14 | 30 | 60`), call `fetchCreditWatch(days)`
- [X] T007 [US1] In `src/app/staff/credit-watch/page.tsx`, for each row in `at_risk_sessions[]`, call `listAdjustmentsForCustomer` (T004) and `applyPlaceholderAdjustments` (T003) to compute the effective "Now" and "After session" balances shown, instead of Core's raw numbers
- [X] T008 [US1] In `src/app/staff/credit-watch/page.tsx`, render the "Upcoming sessions at risk" table — When (UTC), Student, Lesson type, Coach, Now, After session, Expected accrual, Projected, covered-by-renewal/unfunded badge (via `isCoveredByRenewal`, T003), "Analyze →" link to `/staff/credit-watch/{coreCustomerId}`
- [X] T009 [US1] In `src/app/staff/credit-watch/page.tsx`, render the look-ahead `<select>` (7/14/30/60 days, default 30) that navigates via `router.push` to update `?days=`, per `research.md` §5
- [X] T010 [US1] In `src/app/staff/credit-watch/page.tsx`, render the "N coach-to-coach sessions excluded" note from `excluded_coach_to_coach_count`
- [X] T011 [US1] In `src/app/staff/credit-watch/page.tsx`, render the "N sessions unfunded" summary badge at the top of the page (count of `at_risk_sessions` where `isCovered === false`)
- [X] T012 [US1] In `src/app/staff/credit-watch/page.tsx`, add an empty state for "Upcoming sessions at risk" when the (filtered) list has zero rows
- [X] T013 [US1] In `src/app/staff/credit-watch/page.tsx`, add a loading/error state for the whole page when `fetchCreditWatch` throws `CoreApiError` — never render an empty list as if it were "nothing at risk"

**Checkpoint**: User Story 1 is fully functional and independently testable (against a local Core stub until the real endpoint ships).

---

## Phase 4: User Story 2 - Review students who are already in a negative balance (Priority: P2)

**Goal**: On the same `/staff/credit-watch` page, staff see every student currently holding a negative credit balance for any lesson type.

**Independent Test**: On `/staff/credit-watch`, confirm "Negative balances right now" lists one row per student+lesson-type pair with a negative effective balance, each showing the balance and either a next-renewal date/amount or "No active subscription."

### Implementation for User Story 2

- [X] T014 [US2] In `src/app/staff/credit-watch/page.tsx`, for each row in `negative_balances[]`, call `listAdjustmentsForCustomer` (T004) and `applyPlaceholderAdjustments` (T003) to compute the effective balance shown; only render rows still negative after the overlay is applied
- [X] T015 [US2] In `src/app/staff/credit-watch/page.tsx`, render the "Negative balances right now" table — Student, Lesson type, Balance, Next renewal, "Analyze →" link to `/staff/credit-watch/{coreCustomerId}` (same target as T008's link)
- [X] T016 [US2] In `src/app/staff/credit-watch/page.tsx`, render "No active subscription" when `renewal === null`, otherwise "~{next_renewal_at} (+{renewal_amount})" — `next_renewal_at` displayed in UTC, per FR-012
- [X] T017 [US2] In `src/app/staff/credit-watch/page.tsx`, render the "N negative balances" summary badge at the top of the page, next to the badge added in T011
- [X] T018 [US2] In `src/app/staff/credit-watch/page.tsx`, add an empty state for "Negative balances right now" when the list has zero rows

**Checkpoint**: User Stories 1 AND 2 both work on the same page, independently verifiable.

---

## Phase 5: User Story 3 - Drill into one student's credit details (Priority: P3)

**Goal**: From either table, staff open a view scoped to one student, see their full per-lesson-type balance picture, and record a credit adjustment.

**Independent Test**: Click "Analyze" on any row in either table (or navigate directly to `/staff/credit-watch/{coreCustomerId}`), confirm the view shows that student's balances across all lesson types (not just the one that triggered the row), submit an adjustment with an amount and reason, and confirm the displayed balance updates with a "not yet written to Core" indicator and a new `credit_adjustments` row.

### Implementation for User Story 3

- [X] T019 [US3] Create `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` — `requireStaffRole(['super_admin', 'staff'])` gate, call `fetchSnapshot(coreCustomerId)` (existing, unmodified) and `listAdjustmentsForCustomer(coreCustomerId)` (T004)
- [X] T020 [US3] In `src/app/staff/credit-watch/[coreCustomerId]/page.tsx`, render effective balances (via `applyPlaceholderAdjustments`, T003) for every lesson type in the student's wallet, not just the one linked from the row the staff member came from; any renewal dates shown use UTC, per FR-012
- [X] T021 [US3] In `src/app/staff/credit-watch/[coreCustomerId]/page.tsx`, render the credit-adjustment form (lesson type select, amount input, reason textarea) as an inline `'use server'` action calling `createCreditAdjustment` (T004), using the project's `SubmitButton` component for the loading state
- [X] T022 [US3] In `src/app/staff/credit-watch/[coreCustomerId]/page.tsx`, validate `amount !== 0` and non-empty `reason` before calling `createCreditAdjustment`; on failure, show an inline validation message and do not submit (Edge Cases — no empty or zero-amount adjustments)
- [X] T023 [US3] In `src/app/staff/credit-watch/[coreCustomerId]/page.tsx`, render a persistent "not yet written to Core" indicator next to any lesson-type balance that includes a `status = 'placeholder'` adjustment (FR-015)
- [X] T024 [US3] In `src/app/staff/credit-watch/[coreCustomerId]/page.tsx`, render an adjustment history list for this student (who, when — in UTC per FR-012 — amount, lesson type, reason) sourced from `listAdjustmentsForCustomer`, for audit visibility (SC-007)
- [X] T025 [US3] In `src/app/staff/credit-watch/page.tsx`, wire the "Analyze →" links added in T008 and T015 to `/staff/credit-watch/{coreCustomerId}`

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 [P] Run `npx tsc --noEmit` and resolve any type errors introduced by T002–T025 — clean, zero errors
- [X] T027 Verify coach-role staff are redirected away from both `/staff/credit-watch` and `/staff/credit-watch/[coreCustomerId]`, and that the "Credit Watch" nav item is absent from their sidebar (FR-010, quickstart.md Scenario 4) — verified live against a real coach account; both routes redirect to `/staff/dashboard`, nav item absent
- [X] T028 Run `quickstart.md` Scenarios 1–5 end-to-end (Scenarios 1–2 and 5 against a local Core stub per the note at the top of `quickstart.md`; Scenario 3–4 against live code) and record results — all 5 passed live: at-risk table/badges/covered-unfunded/exclusion-note render correctly against a stubbed `/pull_credit_watch/`; negative-balances table correct; drill-down + adjustment tested against real customer 10002 (real `fetchSnapshot`, real `credit_adjustments` row, effective balance 1→6, placeholder indicator, audit history, UTC timestamps all correct); zero-amount adjustment correctly rejected server-side with no row written; coach access blocked; error state renders correctly when the Core call fails. Test data cleaned up afterward.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (staff applies the SQL from T001 to the Supabase project)
- **Foundational (Phase 2)**: Depends on T001 (T004 specifically needs the table to exist) — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion
  - US1 and US2 both build on the same `page.tsx` (T006 before T014) — sequential in practice, not parallel, despite being independent *stories*
  - US3 (`[coreCustomerId]/page.tsx`) has no file overlap with US1/US2's page and could be built in parallel with them, except T025 (wiring the "Analyze" links) touches US1/US2's file and must come after T008/T015
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T002, T003 (Foundational) — different files, no shared dependency
- T005 (Foundational) — different file from T002–T004, fully parallel
- T019–T024 (US3, on `[coreCustomerId]/page.tsx`) can proceed in parallel with T006–T018 (US1/US2, on `page.tsx`) once Phase 2 is done, since they're different files — only T025 needs to wait for both sides

---

## Parallel Example: Foundational Phase

```bash
# After T001 (schema applied), launch these together:
Task: "Add fetchCreditWatch() to src/lib/core-api.ts"
Task: "Create src/lib/credit-watch/effective-balance.ts"
Task: "Add Credit Watch nav item to src/components/StaffSidebar.tsx"
# T004 (adjustments.ts) can start alongside these too — its only dependency is T001, not T002/T003/T005
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (US1)
3. **STOP and VALIDATE**: Run `quickstart.md` Scenario 1 against a local Core stub (the real endpoint won't exist yet — see the blocking-dependency note at the top of this file)
4. Demo internally; this alone proves the look-ahead/at-risk/covered-vs-unfunded mechanics end-to-end

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate against stub → demo (MVP)
3. Add US2 → validate against stub → demo (same page, second table)
4. Add US3 → validate fully live (no stub needed — `fetchSnapshot` and `credit_adjustments` are both real today) → demo
5. Once Core ships `POST /pull_credit_watch/` for real, swap the stub for the live call in T002 and re-run Scenarios 1–2 and 5 against production data

### Parallel Team Strategy

- Developer A: Phase 2's T002/T003 → Phase 3 (US1) → Phase 4 (US2), all on `page.tsx`
- Developer B: Phase 2's T004/T005 → Phase 5 (US3), on `[coreCustomerId]/page.tsx` — no file conflicts with Developer A until T025

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature has an external blocking dependency (`contracts/core-credit-watch-api.md`) that no amount of internal task sequencing removes — US1/US2 can be fully coded and stub-tested but not validated against real data until Core ships the endpoint
- **Pagination (plan.md Scale/Scope)**: out of scope for v1 — both tables render whatever `fetchCreditWatch` returns in one page load. Revisit once the real endpoint's response size is known (the reference mockup's "195 negative balances" suggests this may need addressing before general rollout, but no task here implements it).
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
