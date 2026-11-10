# Tasks: Admin Customer Console

**Input**: Design documents from `/specs/009-admin-customer-console/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not requested in the spec; this repo has no automated test framework (plan.md Technical Context). Validation is manual via `quickstart.md`.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1 > US2 > US3) so each can be implemented and tested independently.

**No blocking external dependency**: unlike 008-staff-credit-watch, every capability this feature needs (`fetchSnapshot`, `credit_adjustments`, `getCustomerProfileByCoreId`) already exists live in production today. Nothing here is stub-only.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to US1 / US2 / US3 from spec.md

## Path Conventions

Single existing Next.js app (`plan.md` Structure Decision) — all paths are relative to the repo root (`src/...`).

---

## Phase 1: Setup

**Purpose**: Project initialization

No setup tasks — this feature introduces no new table, no new npm dependency, and no new environment variable. It reuses `credit_adjustments` (008-staff-credit-watch), `customer_profiles`, and the existing Core snapshot integration as-is.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared search function and shared display component every user story renders through

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 [P] Add `searchCustomerProfiles(query: string): Promise<StudentProfile[]>` to `src/lib/auth/customer-profile.ts` — trims `query`, returns `[]` on empty, queries `customer_profiles` with `.or('email.ilike.%…%,first_name.ilike.%…%')` ordered by `created_at` ascending, per `research.md` §1 and `contracts/server-actions.md`
- [X] T002 [P] Create `src/components/customers/CustomerDetailPanel.tsx` — extract the wallet grid, adjustment form, and adjustment-history list JSX from `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` unchanged, and add two new sections: upcoming/past sessions (from `snapshot.sessions`) and the activity ledger (from `snapshot.activity`), each with its own empty-state message (e.g., "No sessions on record" / "No activity on record") matching the existing wallet section's empty-state pattern ("No credit wallets for this student"), per spec.md's Edge Cases ("zero wallets, zero sessions, zero activity... render as empty, not as errors"); accepts `{ snapshot, adjustments, hasLinkedPortalAccount, submitAdjustmentAction }` props per `contracts/server-actions.md`'s `CustomerDetailPanelProps`
- [X] T003 Modify `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` to call `getCustomerProfileByCoreId(coreCustomerId)` (existing, unchanged) for `hasLinkedPortalAccount`, and replace its inline wallet/form/history JSX with a single `<CustomerDetailPanel />` render, passing its existing `snapshot`, `adjustments`, and `submitAdjustmentAction` (unchanged redirect/revalidate targets) (depends on T002)
- [X] T004 [P] Add a "Customers" nav item to `src/components/StaffSidebar.tsx`, linking to `/staff/customers`, visible only when `role !== 'coach'` (same conditional pattern already used for "Credit Watch")

**Checkpoint**: `CustomerDetailPanel` exists, Credit Watch's drill-down renders through it (now showing sessions/activity for the first time), and `searchCustomerProfiles` is queryable. All user stories can now be built.

---

## Phase 3: User Story 1 - Look up a customer by ID and view their full snapshot (Priority: P1) 🎯 MVP

**Goal**: Staff enter any CourseHost/Core customer ID on `/staff/customers` and land on a page showing that customer's full snapshot — wallets, sessions, activity ledger — whether or not they've ever linked a Academy portal account.

**Independent Test**: Enter a known ID for a customer with no `customer_profiles` row; confirm their snapshot renders with a "no linked portal account" indicator and no error.

### Implementation for User Story 1

- [X] T005 [US1] Create `src/app/staff/customers/page.tsx` — `requireStaffRole(['super_admin', 'staff'])` gate, render `CustomerSearchForm`
- [X] T006 [US1] Create `src/app/staff/customers/CustomerSearchForm.tsx` (`'use client'`) — a direct CourseHost/Core ID input that, on submit, navigates via `router.push` to `/staff/customers/{id}`
- [X] T007 [US1] Create `src/app/staff/customers/[coreCustomerId]/page.tsx` — `requireStaffRole(['super_admin', 'staff'])` gate, `fetchSnapshot(coreCustomerId)`, `listAdjustmentsForCustomer(coreCustomerId)`, `getCustomerProfileByCoreId(coreCustomerId)` for the linked-account indicator, effective balances computed inside `CustomerDetailPanel` (T002) with the resolved data (depends on T002). Note: uses an inline friendly "no customer found" render instead of `notFound()` (see T008) so 404s don't hit the generic Next.js not-found page, since this app has no custom `not-found.tsx` under `/staff`.
- [X] T008 [US1] In `src/app/staff/customers/page.tsx` and `src/app/staff/customers/[coreCustomerId]/page.tsx`, add explicit "no customer found" (404 → friendly message, not a raw Next.js not-found page) and "customer data unavailable" (non-404 `CoreApiError`) states, per Edge Cases and `quickstart.md` Scenario 2

**Checkpoint**: User Story 1 is fully functional and independently testable — any customer, linked or not, is viewable by ID.

---

## Phase 4: User Story 2 - Record a manual credit adjustment for a located customer (Priority: P2)

**Goal**: From a located customer's page, staff record a credit adjustment that immediately reflects in their effective balance and history, without writing to Core.

**Independent Test**: From the page built in US1, submit a valid adjustment; confirm it appears in the effective balance and history immediately, and confirm the same record appears in Credit Watch's drill-down for the same customer (FR-009).

### Implementation for User Story 2

- [X] T009 [US2] In `src/app/staff/customers/[coreCustomerId]/page.tsx`, add an inline `'use server'` `submitAdjustmentAction` calling `createCreditAdjustment` (existing, unchanged — its own zero-amount/empty-reason rejection from 008-staff-credit-watch is reused as-is), redirecting back to this same route with `?success=`/`?error=` and revalidating only this path; pass it as `CustomerDetailPanel`'s `submitAdjustmentAction` prop (depends on T007)

**Checkpoint**: User Stories 1 AND 2 both work — recording an adjustment here and viewing it via Credit Watch's drill-down show identical history, by construction (T002/T003).

---

## Phase 5: User Story 3 - Find a linked customer without knowing their ID (Priority: P3)

**Goal**: Staff search by email or name (for customers who have linked a portal account) and reach the same detail page as a direct ID lookup.

**Independent Test**: Search a linked customer's email; confirm they appear as a selectable result leading to `/staff/customers/{their id}`; search a nonexistent query; confirm a "no results" state that mentions direct ID lookup.

### Implementation for User Story 3

- [X] T010 [US3] Extend `src/app/staff/customers/CustomerSearchForm.tsx` with a second input for email/name search, submitting via navigation to `/staff/customers?q=...`
- [X] T011 [US3] In `src/app/staff/customers/page.tsx`, read `?q=`; if present, call `searchCustomerProfiles(q)` (T001) and render matching customers as links to `/staff/customers/{coreCustomerId}`; render a "no results" state (mentioning direct ID lookup) when the search returns nothing (depends on T001, T005)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Run `npx tsc --noEmit` and resolve any type errors introduced by T001–T011 — clean, zero errors
- [X] T013 Verify coach-role staff are redirected away from both `/staff/customers` and `/staff/customers/[coreCustomerId]`, and that the "Customers" nav item is absent from their sidebar (FR-010, `quickstart.md` Scenario 6) — verified live against a real coach account (`student@example.com`): nav item absent, both routes redirect to `/staff/dashboard`
- [X] T014 Run `quickstart.md` Scenarios 1–7 end-to-end (all live — no stub needed) and record results — all 7 passed live against a real super_admin session (`admin@example.com`) and 13 real Core customer IDs: Scenario 1 (customer ID 1, "richard" — never linked — rendered wallets/sessions/activity with the "no linked portal account" banner); Scenario 2 (ID 99999999 → friendly "No customer found" state; non-numeric ID "abc" → distinct "data unavailable" error state, confirming FR-005's two-state distinction); Scenario 3 (adjustment recorded for customer 10002, effective balance 1→4 with placeholder indicator, and the identical adjustment confirmed rendering on `/staff/credit-watch/10002`'s drill-down too — FR-009); Scenario 4 (zero-amount submission rejected with `?error=`, confirmed via direct Supabase query that no row was created, then the one real test row was deleted after verification); Scenario 5 (search by name "Student A" and by email substring both resolved customer 10002; a nonsense query returned the "no results" state mentioning direct ID lookup); Scenario 6 (see T013); Scenario 7 (Credit Watch's drill-down for 10002 now also renders sessions/activity via the shared panel, and the aggregate `/staff/credit-watch` dashboard is confirmed unmodified — it still only depends on the pre-existing, not-yet-implemented `fetchCreditWatch()` and correctly shows its known pre-existing error state, unrelated to this feature, satisfying FR-011). All verification processes (dev server on port 3041, Playwright) were stopped afterward; the user's own dev server on port 3040 and `.env`/`.env.local` were untouched throughout.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, nothing required
- **Foundational (Phase 2)**: No dependencies — start immediately — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion
  - US1's page (T007) is a prerequisite file for US2 (T009, same file) and US3 (T011, same directory) — those stories extend files US1 creates, but each adds independently testable behavior on top
  - T010 (US3) depends on T006 (US1) — both edit `src/app/staff/customers/CustomerSearchForm.tsx`; T010 adds a second field to the file T006 creates
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T001, T002, T004 (Foundational) — different files, no shared dependency; T003 must follow T002
- T005/T006 (US1, new files) can proceed in parallel with T002/T003 (Foundational, existing-file changes) since they don't touch the same files
- T012 (Polish) can start as soon as all preceding tasks are code-complete, in parallel with T013/T014 (verification, no code changes)

---

## Parallel Example: Foundational Phase

```bash
# Launch these together:
Task: "Add searchCustomerProfiles(query) to src/lib/auth/customer-profile.ts"
Task: "Create src/components/customers/CustomerDetailPanel.tsx"
Task: "Add Customers nav item to src/components/StaffSidebar.tsx"
# T003 (wiring Credit Watch's drill-down to the new panel) starts once T002 lands
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2 (Foundational)
2. Complete Phase 3 (US1)
3. **STOP and VALIDATE**: Run `quickstart.md` Scenarios 1–2 — direct ID lookup works for both linked and unlinked customers
4. Demo internally; this alone solves the original gap (no way to view an unlinked customer's account anywhere in the app)

### Incremental Delivery

1. Foundational → shared panel and search function ready
2. Add US1 → validate → demo (MVP: any customer viewable by ID)
3. Add US2 → validate (adjustment reflected immediately, matches Credit Watch's history) → demo
4. Add US3 → validate (email/name search for linked customers) → demo
5. Run full `quickstart.md` Scenarios 1–7, including the Credit Watch regression check

### Parallel Team Strategy

- Developer A: T001, T004 (Foundational) → T005/T006/T007/T008 (US1) → T009 (US2)
- Developer B: T002 → T003 (Foundational, touches Credit Watch's existing route) → T010/T011 (US3) once T007 lands

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature has no external blocking dependency — everything needed is already live, unlike 008-staff-credit-watch's Core bulk-endpoint gap
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
