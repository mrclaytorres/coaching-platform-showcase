---

description: "Task list for Dev/Demo Student Account Seeding & Normalized Account Display"
---

# Tasks: Dev/Demo Student Account Seeding & Normalized Account Display

**Input**: Design documents from `/specs/005-customer-data-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/supabase-schema.md, contracts/dev-routes.md, quickstart.md

**Tests**: Not requested in the feature spec. This repo has no automated test framework (confirmed in plan.md's Technical Context); validation is manual via `quickstart.md` scenarios, referenced directly from tasks below.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md's priorities P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, relative to repo root

---

## Phase 1: Setup

**Purpose**: Document the one new environment variable this feature requires. No new dependencies, packages, or project scaffolding are needed — this feature adds to the existing Next.js app in place.

- [X] T001 Add a "Development only" section to `.env.example` documenting `ALLOW_DEV_SEEDING=true`, per `specs/005-customer-data-integration/contracts/supabase-schema.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema, types, and safety-guard scaffolding that every user story below depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Apply the `is_seeded` column addition from `specs/005-customer-data-integration/contracts/supabase-schema.md` (`ALTER TABLE public.customer_profiles ADD COLUMN is_seeded boolean NOT NULL DEFAULT false;`) to the target (non-production) Supabase project's SQL editor
- [X] T003 [P] Extend `StudentProfile`, `UpsertInput`, `upsertCustomerProfile`, and `listCustomerProfiles` in `src/lib/auth/customer-profile.ts` to read/write the new `is_seeded` column as an `isSeeded` field (default `false` when not explicitly passed, so the existing real `linkAccount` call site in `src/app/login/page.tsx` is unaffected)
- [X] T004 [P] Create `src/lib/dev/seed-accounts.ts` with the module's shared building blocks: `DEV_SEED_PASSWORD` constant, `DEMO_CUSTOMER_IDS = [10002, 10001]`, `syntheticEmail(id: number)` returning `` `dev+customer-${id}@example.invalid` ``, `assertDevSeedingAllowed()` which throws unless `process.env.ALLOW_DEV_SEEDING === 'true'` (FR-012), and `assertNotProduction()` which throws unless `process.env.NODE_ENV !== 'production'` — a standalone, action-level guard for FR-007 that doesn't depend on the page component's `notFound()` call

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Seed the Two Known Demo Accounts (Priority: P1) 🎯 MVP

**Goal**: A developer can seed Supabase accounts for the two demo students and sign into either without ever touching email.

**Independent Test**: Run the seeder, then use the sign-in bypass to open each demo account's dashboard and confirm credit balances, sessions, and activity match the existing demo routes.

### Implementation for User Story 1

- [X] T005 [US1] Implement `seedOneAccount(id: number): Promise<SeedResult>` in `src/lib/dev/seed-accounts.ts`, where `SeedResult = { id: number; status: 'seeded' | 'skipped' | 'error'; message?: string }`. Call `fetchSnapshot(id)`, look up any existing `customer_profiles` row for that `core_customer_id`; if it exists and `isSeeded` is `false`, return `{ id, status: 'skipped', message: 'already linked to a real account' }` (FR-005); otherwise create the `auth.users` row via `auth.admin.createUser({ email: syntheticEmail(id), password: DEV_SEED_PASSWORD, email_confirm: true })` (or reuse the existing seeded auth user on re-run) and call `upsertCustomerProfile({ ..., email: syntheticEmail(id), authUserEmail: syntheticEmail(id), isSeeded: true })`, returning `{ id, status: 'seeded' }` — naturally idempotent on re-run (FR-004) — depends on T003, T004
- [X] T006 [US1] Implement `seedDevAccounts(ids: number[]): Promise<SeedResult[]>` in `src/lib/dev/seed-accounts.ts`: call `assertDevSeedingAllowed()` first, deduplicate `ids`, then sequentially call `seedOneAccount` for each, collecting `SeedResult[]` — depends on T005
- [X] T007 [US1] Create `src/app/dev/seed-accounts/page.tsx`: call `notFound()` immediately when `process.env.NODE_ENV === 'production'` (FR-007); render the list of currently seeded accounts via `listCustomerProfiles()` filtered to `isSeeded`; render a "Seed demo accounts" form/button wired to a `seedDevAccounts` server action invoked with `DEMO_CUSTOMER_IDS` — depends on T006
- [X] T008 [US1] Implement the `signInAsSeededAccount(customerId: number)` server action co-located in `src/app/dev/seed-accounts/page.tsx`: call `assertNotProduction()` first (FR-007 — defends against a Server Action being invoked directly in production even if the page's own `notFound()` were somehow bypassed); then verify the target profile has `isSeeded === true` (refuse otherwise), call `createSupabaseServerClient().auth.signInWithPassword({ email: syntheticEmail(customerId), password: DEV_SEED_PASSWORD })`, then `redirect(\`/customer/${customerId}\`)` — depends on T007
- [X] T009 [US1] Add a "Sign in as this account" button next to each seeded account listed on `src/app/dev/seed-accounts/page.tsx`, bound to `signInAsSeededAccount` — depends on T008

**Checkpoint**: User Story 1 is fully functional and independently testable (`quickstart.md` Scenarios 1–2).

---

## Phase 4: User Story 2 - Seed Additional Accounts by Known ID (Priority: P2)

**Goal**: A developer can add arbitrary known student identifiers (e.g. sourced from CourseHost) to the seed run and get a working dev account for each.

**Independent Test**: Add one additional known student identifier to the seed input, run the seeder, and confirm a new account appears showing that student's real data.

### Implementation for User Story 2

- [X] T010 [US2] Update `seedOneAccount` in `src/lib/dev/seed-accounts.ts` so a `fetchSnapshot` failure (404 or otherwise) is caught and returned as `{ id, status: 'error', message }` (using the `SeedResult` shape already defined in T005) instead of thrown, so `seedDevAccounts` continues processing the remaining identifiers (FR-009) — depends on T005
- [X] T011 [US2] Add a text input to `src/app/dev/seed-accounts/page.tsx`'s seed form for developer-supplied identifiers (comma/whitespace-separated), parse to `number[]`, deduplicate, and merge with `DEMO_CUSTOMER_IDS` before calling `seedDevAccounts` — depends on T007, T010
- [X] T012 [US2] Render the per-identifier result list (seeded / skipped / error, with message) from the last run on `src/app/dev/seed-accounts/page.tsx` (FR-009 visibility) — depends on T010, T011

**Checkpoint**: User Stories 1 AND 2 both work independently (`quickstart.md` Scenarios 3–5).

---

## Phase 5: User Story 3 - Confirm Normalized Dashboard Covers Seeded Accounts (Priority: P3)

**Goal**: Verify the existing account dashboard renders correctly — empty states, large data volumes, correct timezones — for seeded accounts.

**Independent Test**: Sign in as the "heavy" demo account and confirm the dashboard loads and matches Core's API data; repeat for the "light" demo account and confirm empty-state handling.

### Implementation for User Story 3

- [X] T013 [US3] Run `quickstart.md` Scenario 6 against seeded `10002` (light) and `10001` (heavy): verify empty-state, large-list rendering, and recording-link visibility on `src/app/customer/[id]/page.tsx`; per `plan.md`'s Assumptions this is expected to require no code change — if a real discrepancy is found, fix it in `src/app/customer/[id]/page.tsx`
- [X] T014 [US3] Verify timezone-correct date/time rendering for a seeded account per `quickstart.md` Scenario 6 step 3, cross-checking `src/app/customer/[id]/page.tsx`'s existing date formatting logic

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Requirements that span all stories rather than belonging to one (admin visibility, the two independent production safeguards).

- [X] T015 [P] Add an `isSeeded`-aware "Dev" badge to `src/components/StudentListTable.tsx`, next to the existing Active/Inactive status column (FR-008) — depends on T003
- [X] T016 Run `quickstart.md` Scenario 7: `npm run build && npm run start`, confirm `/dev/seed-accounts` 404s in production (FR-007, SC-004) — depends on T007
- [X] T017 Run `quickstart.md` Scenario 8: unset/misconfigure `ALLOW_DEV_SEEDING`, confirm `seedDevAccounts` refuses to run and creates nothing (FR-012, SC-006) — depends on T006
- [X] T018 Run `quickstart.md` Scenario 9: confirm `/admin/students` visibly marks every seeded account — depends on T015
- [X] T019 [P] Document `/dev/seed-accounts` usage (required env var, demo IDs, how to add more identifiers, sign-in bypass) in `docs/onboarding.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; extends US1's `seedDevAccounts`/page (T006, T007), so build after US1 completes even though it is narratively independent
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 (needs at least one seeded, signed-into account to verify against)
- **Polish (Phase 6)**: Depends on the stories it cross-cuts — T015/T018 need T003; T016 needs T007; T017 needs T006

### Within Each User Story

- US1: models/guards (T005–T006) → page (T007) → sign-in action (T008) → UI wiring (T009)
- US2: batch error handling (T010) → form input (T011) → results UI (T012)
- US3: verification tasks only, no new production code expected

### Parallel Opportunities

- T003 and T004 (Phase 2) touch different files and can run in parallel
- T015 and T019 (Phase 6) touch different files and can run in parallel once their dependencies are met

---

## Parallel Example: Foundational Phase

```bash
Task: "Extend StudentProfile/UpsertInput/upsertCustomerProfile/listCustomerProfiles in src/lib/auth/customer-profile.ts with isSeeded"
Task: "Create src/lib/dev/seed-accounts.ts with DEV_SEED_PASSWORD, DEMO_CUSTOMER_IDS, syntheticEmail, assertDevSeedingAllowed"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004) — critical, blocks everything
3. Complete Phase 3: User Story 1 (T005–T009)
4. **STOP and VALIDATE**: Run `quickstart.md` Scenarios 1–2
5. This alone unblocks all local development/demoing without real email — the smallest useful slice

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently (Scenarios 1–2) → MVP
3. Add User Story 2 → validate independently (Scenarios 3–5)
4. Add User Story 3 → validate independently (Scenario 6)
5. Polish (T015–T019) → validate independently (Scenarios 7–9)

---

## Notes

- No test tasks were generated — not requested in the spec, and this repo has no test framework; `quickstart.md` scenarios are the validation mechanism throughout.
- FR-012's production-target guard (`assertDevSeedingAllowed`, T004) and FR-007's page-level `NODE_ENV` gate (T007) are deliberately separate tasks in separate files, matching the spec's requirement that they remain two independent safeguards.
- FR-007 additionally requires the sign-in bypass itself to be inoperative "under any circumstance," not just when the page renders — `assertNotProduction()` (T004) is called directly inside `signInAsSeededAccount` (T008) as an action-level guard, independent of the page's `notFound()`, since Next.js Server Actions can be invoked without re-running the page component's render logic.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently before continuing.
