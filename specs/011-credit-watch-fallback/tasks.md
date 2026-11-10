---

description: "Task list for Credit Watch Data Fallback (Interim)"
---

# Tasks: Credit Watch Data Fallback (Interim)

**Input**: Design documents from `/specs/011-credit-watch-fallback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/fallback-module.md, quickstart.md

**Tests**: Not requested in spec.md; no automated test framework exists in this repo (plan.md Technical Context). Validation is manual via `quickstart.md`, referenced in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md: US1 = negative balances, P1; US2 = at-risk sessions estimate, P2; US3 = partial-data transparency, P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to repo root; this is a single Next.js project (no backend/frontend split)

---

## Phase 1: Setup

**Purpose**: Confirm prerequisites — no new project, dependencies, or env vars are introduced by this feature.

- [X] T001 Confirm local `.env`/`next dev` already has `CORE_API_BASE`, `CORE_SHARED_SECRET`, `CORE_WAF_BYPASS` set (unchanged from existing `src/lib/core-api.ts` usage — no new env vars needed for this feature)
- [X] T002 [P] Confirm at least one `customer_profiles` row exists locally with a real, Core-recognized `core_customer_id` (seed one via the existing `/dev/seed-accounts` flow if none exists) — needed to exercise the fallback pool per `quickstart.md` Prerequisites (confirmed: 3 rows exist locally, including core_customer_id 10001)
- [X] T003 [P] Re-read `src/lib/auth/customer-profile.ts` (`listCustomerProfiles`), `src/lib/core-api.ts` (`fetchSnapshot`), and `src/lib/credit-watch/effective-balance.ts` (`applyPlaceholderAdjustments`) to confirm their current signatures still match `contracts/fallback-module.md` before writing new code

**Checkpoint**: Environment confirmed ready; no code written yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared per-student fetch loop and page wiring that both US1 and US2's list-building logic sit on top of. **Must complete before any user story phase.**

- [X] T004 Create `src/lib/credit-watch/fallback.ts` with the `FallbackCreditWatchResult` type (`CreditWatchResponse & { source: 'fallback'; uncheckedCount: number }`) and a `fetchCreditWatchFallback(lookAheadDays)` function that: calls `listCustomerProfiles()` for the known-student pool, calls `fetchSnapshot(coreCustomerId)` per student with each call individually try/caught (a per-student failure increments `uncheckedCount`, not propagated), and returns `{ generated_at, excluded_coach_to_coach_count: 0, at_risk_sessions: [], negative_balances: [], source: 'fallback', uncheckedCount }` — empty arrays are filled in by US1/US2 tasks below (per `contracts/fallback-module.md`)
- [X] T005 Wire `src/app/staff/credit-watch/page.tsx` to call `fetchCreditWatchFallback(days)` inside the existing `fetchCreditWatch(days)` `catch` block instead of immediately rendering the error state; keep the current error JSX as the fallback-of-fallback path (only rendered if `fetchCreditWatchFallback` itself throws); add an `isFallback = 'source' in creditWatch && creditWatch.source === 'fallback'` check for use by later tasks

**Checkpoint**: Fallback triggers on primary-source failure and returns an (empty) valid result; page no longer errors, but shows empty-state sections. Ready for user story work.

---

## Phase 3: User Story 1 - See real negative balances instead of an error (Priority: P1) 🎯 MVP

**Goal**: "Negative balances right now" is populated from real, current per-student balances when the primary source is down, matching the same balance shown on that student's own detail page.

**Independent Test**: Open Credit Watch (primary source down) and confirm every known student with a negative balance in any lesson type appears in "Negative balances right now" with a balance matching `/staff/credit-watch/<id>`, and that no error message appears (quickstart.md Scenarios 1 & 2).

### Implementation for User Story 1

- [X] T006 [US1] In `src/lib/credit-watch/fallback.ts`, for each successfully-fetched snapshot, map `snapshot.credits` (`SnapshotWallet[]`) entries with `balance < 0` to `CreditWatchNegativeBalance` rows (`student: { customer_id, display_name: first_name || 'Unknown' }, lesson_type_id, lesson_type_name, balance, renewal: null`) and push onto `result.negative_balances` (data-model.md §"Credit Balance")
- [X] T007 [US1] Manually verify (no code change expected) that `page.tsx`'s existing `buildNegativeRow()` / `applyPlaceholderAdjustments()` overlay renders fallback `negative_balances` rows correctly, since they satisfy the same `CreditWatchNegativeBalance` shape as the primary source
- [X] T008 [US1] In `src/app/staff/credit-watch/page.tsx`, render "Renewal info not available" (instead of "No active subscription") in the negative-balances table's renewal cell when `isFallback` is true
- [X] T009 [US1] Manually verify the empty-known-student-pool edge case: with no `customer_profiles` rows (or all balances non-negative), the existing `EmptyState` renders — not an error (spec.md Edge Cases)

**Checkpoint**: User Story 1 is fully functional and independently testable — the page shows real negative balances instead of the 404 error.

---

## Phase 4: User Story 2 - See likely at-risk upcoming sessions, clearly marked as an estimate (Priority: P2)

**Goal**: "Upcoming sessions at risk" is populated using the assumed 1-credit-per-session cost, with every row visibly labeled as an estimate and no fabricated renewal claims.

**Independent Test**: Open Credit Watch and confirm "Upcoming sessions at risk" shows only known students with a session in the look-ahead window whose lesson-type balance would go negative after an assumed 1-credit debit, each row labeled "Estimate," with renewal cells reading "Renewal info not available" (quickstart.md Scenario 3).

### Implementation for User Story 2

- [X] T010 [US2] In `src/lib/credit-watch/fallback.ts`, for each successfully-fetched snapshot, filter `snapshot.sessions` (`SnapshotSession[]`) to `!is_past` and `event_start_time` within `lookAheadDays`, compute `current_balance` (matching wallet by `lesson_type_id`) and `balance_after_session = current_balance - 1`, include a `CreditWatchAtRiskSession` row (`coach: null`, `lesson_type_id: session.lesson_type_id ?? -1`, `lesson_type_name: session.lesson_type_name ?? 'Unknown'`, `renewal: null`) only when `balance_after_session < 0`, and push onto `result.at_risk_sessions` (data-model.md §"Upcoming Session (at risk)")
- [X] T011 [US2] In `src/app/staff/credit-watch/page.tsx`, add an "Estimate" badge to each at-risk-session row, rendered only when `isFallback` is true (FR-008)
- [X] T012 [US2] In `src/app/staff/credit-watch/page.tsx`, render "Renewal info not available" in the at-risk table's "Expected accrual" cell when `isFallback` is true, instead of a renewal date or blank dash

**Checkpoint**: User Stories 1 AND 2 both work independently — negative balances are exact, at-risk sessions are clearly-labeled estimates.

---

## Phase 5: User Story 3 - Know the data is partial, not the full customer base (Priority: P2)

**Goal**: Staff can tell, from the page itself, that the fallback view only covers already-known students, and that this note disappears once the primary source returns.

**Independent Test**: With the fallback active, confirm a visible plain-language note states the list is limited to already-known students; confirm the note (and all fallback-only wording) disappears once the primary source succeeds (quickstart.md Scenarios 1 & 5).

### Implementation for User Story 3

- [X] T013 [US3] In `src/app/staff/credit-watch/page.tsx`, add a visible banner shown only when `isFallback` is true, stating the data covers only already-known students and that the complete view returns once the normal source is available (FR-004)
- [X] T014 [US3] In `src/app/staff/credit-watch/page.tsx`, append a "{uncheckedCount} known students couldn't be checked" note to the banner when `creditWatch.uncheckedCount > 0` (spec.md Edge Cases: partial per-student failure)
- [X] T015 [US3] Manually verify (no code change expected — `page.tsx`'s existing try/catch already makes this automatic per research.md §6) that the banner, "Estimate" badges, and "Renewal info not available" wording all disappear once `fetchCreditWatch(days)` succeeds (FR-006, quickstart.md Scenario 5)

**Checkpoint**: All three user stories are independently functional; the feature is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] Run `npm run typecheck` and `npm run lint`; fix any errors introduced by `src/lib/credit-watch/fallback.ts` or `src/app/staff/credit-watch/page.tsx` changes
- [ ] T017 Run all 5 scenarios in `specs/011-credit-watch-fallback/quickstart.md` end-to-end and confirm each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T004/T005 must exist before T006+)
- **User Stories (Phase 3-5)**: All depend on Foundational (T004, T005) completion
  - US1 (T006-T009) has no dependency on US2 or US3
  - US2 (T010-T012) has no dependency on US1 or US3
  - US3 (T013-T015) has no dependency on US1 or US2
  - Note: T006/T010 both edit `src/lib/credit-watch/fallback.ts`, and T008/T011/T012/T013/T014 all edit `src/app/staff/credit-watch/page.tsx` — stories touch shared files, so within a single-developer flow they run sequentially even though they're logically independent; a multi-developer team would need to coordinate merges on those two files
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel
- Across stories, US1/US2/US3 are logically independent and could be developed in parallel branches, but T006/T010 share `fallback.ts` and T008/T011/T012/T013/T014 share `page.tsx` — plan for sequential merges into those two files regardless of dev order
- T016 (typecheck/lint) can run in parallel with writing T017's manual verification notes, but should be run last against the final code

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T004, T005)
3. Complete Phase 3: User Story 1 (T006-T009)
4. **STOP and VALIDATE**: quickstart.md Scenarios 1 & 2 — confirm the page shows real negative balances instead of the 404 error
5. This alone resolves the original complaint ("Credit watch page only shows a generic error message") — deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → fallback triggers, page no longer errors (empty sections)
2. Add US1 → negative balances real and accurate → validate → deploy (MVP)
3. Add US2 → at-risk estimates appear, clearly labeled → validate → deploy
4. Add US3 → partial-data transparency banner → validate → deploy
5. Each story adds value without breaking the previous one — `isFallback` gates every fallback-only render, so US2/US3 additions are additive to US1's JSX, not replacements

---

## Notes

- No new user story requires a new route, table, or Core endpoint — every task modifies one of two files (`src/lib/credit-watch/fallback.ts`, `src/app/staff/credit-watch/page.tsx`) or is a manual verification step
- [P] tasks = different files, no dependencies
- Commit after each phase checkpoint, not after every task, given how much the phases share the same two files
- This entire feature is explicitly temporary (spec.md Assumptions) — keep `fallback.ts` isolated and easy to delete wholesale once spec 008's real `/pull_credit_watch/` endpoint ships
