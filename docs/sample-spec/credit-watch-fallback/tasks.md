# Tasks: Credit Watch Data Fallback (Interim)

Grouped by user story so each story can be built and checked on its own.
`[P]` = can run in parallel (different files, no dependencies).

## Phase 1: Setup

- [x] T001 Confirm the existing API env vars are set (this feature adds none)
- [x] T002 [P] Confirm at least one known student with a real legacy customer ID exists locally
- [x] T003 [P] Re-read the snapshot client, known-student list and effective-balance overlay to
  confirm their signatures match the plan's contract

## Phase 2: Foundation (blocks all stories)

- [x] T004 Create `fallback.ts` with the result type and a fan-out that catches each student's
  failure and counts it in `uncheckedCount`. It returns empty lists for now; stories fill them in.
- [x] T005 Wire the page to call the fallback inside the aggregate call's `catch`, keep the
  existing error UI for when the fallback also fails, and add an `isFallback` flag

**Checkpoint:** the page no longer errors; it shows empty sections.

## Phase 3: User Story 1, negative balances (P1, MVP)

- [x] T006 [US1] Turn each snapshot wallet with `balance < 0` into a negative-balance row
- [x] T007 [US1] Confirm the existing effective-balance overlay renders fallback rows unchanged
- [x] T008 [US1] Show "Renewal info not available" in the renewal cell when `isFallback`
- [x] T009 [US1] Confirm an empty known-student pool shows the empty state, not an error

**Checkpoint:** the original complaint is fixed. This is shippable on its own.

## Phase 4: User Story 2, at-risk estimates (P2)

- [x] T010 [US2] Filter upcoming sessions to the look-ahead window, compute
  `balance - 1`, and add a row only when it's below zero
- [x] T011 [US2] Add an "Estimate" badge to each at-risk row when `isFallback`
- [x] T012 [US2] Show "Renewal info not available" in the at-risk table's accrual cell

## Phase 5: User Story 3, partial-data transparency (P2)

- [x] T013 [US3] Add a banner, shown only in fallback mode, explaining the data is limited to
  known students
- [x] T014 [US3] Append "{n} known students couldn't be checked" when `uncheckedCount > 0`
- [x] T015 [US3] Confirm every fallback-only element disappears once the aggregate call succeeds

## Phase 6: Polish

- [x] T016 [P] Run typecheck and lint, and fix anything the changes introduced
- [ ] T017 Run all quickstart scenarios end to end

## Notes

- Stories are logically independent but share two files, so they merge one after another.
- Commit at each phase checkpoint.
- The whole feature is temporary. `fallback.ts` stays isolated so it can be deleted in one go
  once the real endpoint ships.
