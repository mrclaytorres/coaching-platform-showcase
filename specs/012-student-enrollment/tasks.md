---

description: "Task list for Staff-Driven Student Enrollment"
---

# Tasks: Staff-Driven Student Enrollment

**Input**: Design documents from `/specs/012-student-enrollment/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: Not requested in spec.md; no automated test framework exists in this repo (plan.md Technical Context). Validation is manual via `quickstart.md`, referenced in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md: US1 = Tier sequence enrollment, P1; US2 = standalone Course enrollment, P1; US3 = enrollment status visibility, P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to repo root; this is a single Next.js project (no backend/frontend split)

---

## Phase 1: Setup

**Purpose**: Confirm prerequisites — no new dependencies or env vars, but this feature does need existing Tiers/Courses to enroll into.

- [X] T001 Confirm local `.env`/`next dev` is unchanged (no new env vars for this feature) and that the app runs
- [X] T002 [P] Confirm at least one Tier (`/staff/tiers`) and one standalone Course (`/staff/courses`) already exist locally — create them if not, since this feature only enrolls into existing ones (spec.md Key Entities) (confirmed: 8 Tiers exist; only 1 Course existed and it was sequential-locked, so a standalone test Course, "Test Standalone Course (012 QA)", was created)
- [X] T003 [P] Re-read `src/lib/progress/enrollment.ts`, `src/lib/progress/tier-progress.ts`, `src/lib/auth/customer-profile.ts`, `src/lib/courses/tier-actions.ts` (`listTiers`), and `src/lib/courses/course-queries.ts` (`listCourses`) to confirm their current signatures still match `contracts/server-actions.md` before writing new code

**Checkpoint**: Environment confirmed ready; no code written yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema migration and resolve-or-create machinery both `enrollStudentInTierSequence` and `enrollStudentInCourse` sit on top of. **Must complete before any user story phase.**

- [X] T004 Write and apply a Supabase migration: `ALTER TABLE public.customer_profiles ALTER COLUMN supabase_user_id DROP NOT NULL;` (data-model.md Migration section) — confirm existing RLS policies still behave correctly (a `NULL` `supabase_user_id` row stays inaccessible to every authenticated user)
- [X] T005 In `src/lib/auth/customer-profile.ts`: add `createPendingCustomerProfile(input: { coreCustomerId, email, firstName })` (real, non-dev insert with `supabase_user_id: NULL`, `is_seeded: false`); change `upsertCustomerProfile`'s upsert `onConflict` target from `supabase_user_id` to `core_customer_id` so the real `/login` flow adopts a pre-enrolled row instead of colliding with it (research.md §2, contracts/server-actions.md)
- [X] T006 In `src/lib/progress/enrollment.ts`: add the shared `EnrollResult` discriminated-union type (data-model.md) and an internal (unexported) `resolveOrCreateStudentProfile(coreCustomerId)` helper — calls `getCustomerProfileByCoreId`; on a miss, calls `fetchSnapshot` (returning `{ status: 'customer_not_found' }` on a 404) then `createPendingCustomerProfile`; used by both enroll functions in Phase 3/4 below

**Checkpoint**: Migration applied; shared resolve-or-create logic and result type exist and compile. Ready for user story work.

---

## Phase 3: User Story 1 - Enroll a student into a Tier sequence (Priority: P1) 🎯 MVP

**Goal**: Staff can grant a student access to a Sequential-Locked Course track by enrolling them into a Tier sequence, choosing which Tier they start at, whether or not the student has ever logged into the portal.

**Independent Test**: Enroll a student (with or without an existing local account) at a chosen Tier, and confirm that Tier's Course (and any earlier Tier's Course) becomes accessible to them, while later Tiers remain locked (quickstart.md Scenarios 1, 2, 3, 5).

### Implementation for User Story 1

- [X] T007 [US1] Modify `enrollStudentInTierSequence` in `src/lib/progress/enrollment.ts` to the new signature `(coreCustomerId: number, startingTierId: string, courseOwnerId = 'academy'): Promise<EnrollResult>` — calls `resolveOrCreateStudentProfile`, looks up the chosen Tier's `order` via `listTiers(courseOwnerId)`, returns `already_enrolled` (with current Tier name) if a `student_tier_progress` row already exists at that rank, returns `would_downgrade` (with both Tier names) if the chosen Tier's `order` is below the existing rank, otherwise inserts/keeps `current_tier_rank` at the chosen Tier's `order` and returns `enrolled` (contracts/server-actions.md, data-model.md)
- [X] T008 [US1] [P] In `src/app/staff/customers/[coreCustomerId]/page.tsx`: fetch `listTiers()`, add a `submitTierEnrollAction` `'use server'` function that calls `enrollStudentInTierSequence` and redirects with a `?success=`/`?error=` message derived from the returned `EnrollResult.status`, and pass `tiers`/`submitTierEnrollAction` to `CustomerDetailPanel`
- [X] T009 [US1] [P] Apply the same change as T008 to `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` (shares `CustomerDetailPanel`, per plan.md Structure Decision)
- [X] T010 [US1] In `src/components/customers/CustomerDetailPanel.tsx`, add the Tier enrollment form: a `<select name="tierId">` listing the `tiers` prop by name (ordered), a `SubmitButton`, wired to `submitTierEnrollAction` — same visual pattern as the existing "Record a credit adjustment" form

**Checkpoint**: User Story 1 is fully functional and independently testable — staff can enroll any student (known or not) into a Tier sequence at a Tier of their choosing.

---

## Phase 4: User Story 2 - Enroll a student into a standalone Course (Priority: P1)

**Goal**: Staff can grant a student direct access to one specific standalone Course, independent of any Tier sequence, whether or not the student has ever logged into the portal.

**Independent Test**: Enroll a student into a standalone Course and confirm the Course (and its published Lessons) becomes accessible to them; confirm a Sequential-Locked Course never appears as a choice in this form (quickstart.md Scenario 4).

### Implementation for User Story 2

- [X] T011 [US2] Modify `enrollStudentInCourse` in `src/lib/progress/enrollment.ts` to the new signature `(coreCustomerId: number, courseId: string): Promise<EnrollResult>` — calls `resolveOrCreateStudentProfile`, returns `not_standalone` (with the Course's Tier name) if `course.courseCategory !== 'standalone'`, returns `already_enrolled` if a `course_enrollments` row already exists, otherwise inserts and returns `enrolled` (replaces today's silent `ignoreDuplicates: true` upsert and thrown-Error category check — contracts/server-actions.md, data-model.md)
- [X] T012 [US2] [P] In `src/app/staff/customers/[coreCustomerId]/page.tsx`: fetch `listCourses()`, add a `submitCourseEnrollAction` `'use server'` function that calls `enrollStudentInCourse` and redirects with a `?success=`/`?error=` message derived from the returned `EnrollResult.status`, and pass `courses`/`submitCourseEnrollAction` to `CustomerDetailPanel`
- [X] T013 [US2] [P] Apply the same change as T012 to `src/app/staff/credit-watch/[coreCustomerId]/page.tsx`
- [X] T014 [US2] In `src/components/customers/CustomerDetailPanel.tsx`, add the standalone-Course enrollment form: a `<select name="courseId">` listing only `courses.filter(c => c.courseCategory === 'standalone')`, a `SubmitButton`, wired to `submitCourseEnrollAction`

**Checkpoint**: User Stories 1 AND 2 both work independently — staff can enroll a student into either a Tier sequence or a standalone Course, with clear duplicate/category guard messages instead of errors or silent no-ops.

---

## Phase 5: User Story 3 - See a student's current enrollment status (Priority: P2)

**Goal**: Staff can see a student's current Tier rank (by name) and standalone Course enrollments on their account page, before deciding what to enroll them in next.

**Independent Test**: Open a student with no enrollments and confirm the page clearly shows "not enrolled" for both; open a student enrolled in both a Tier and a standalone Course and confirm both are shown by name (quickstart.md Scenario 6).

### Implementation for User Story 3

- [X] T015 [US3] Add `listCourseEnrollmentsForStudent(studentId: string): Promise<{ courseId: string }[]>` to `src/lib/progress/enrollment.ts` — reads `course_enrollments` filtered to `student_id` (data-model.md)
- [X] T016 [US3] [P] In `src/app/staff/customers/[coreCustomerId]/page.tsx`: when a linked profile exists, fetch `getStudentTierProgress(profileId, 'academy')` and `listCourseEnrollmentsForStudent(profileId)` (both empty/`null` otherwise); pass `tierProgress`/`courseEnrollments` to `CustomerDetailPanel`
- [X] T017 [US3] [P] Apply the same change as T016 to `src/app/staff/credit-watch/[coreCustomerId]/page.tsx`
- [X] T018 [US3] In `src/components/customers/CustomerDetailPanel.tsx`, add the "Enrollment status" display block above the two forms: current Tier name (joined against the `tiers` prop by `order === tierProgress.currentTierRank`) or "Not enrolled in a Tier sequence"; list of enrolled standalone Course titles (joined against the `courses` prop) or "No standalone Course enrollments"

**Checkpoint**: All three user stories are independently functional; the feature is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Run `npm run typecheck` and `npm run lint`; fix any errors introduced by this feature's changes across `src/lib/auth/customer-profile.ts`, `src/lib/progress/enrollment.ts`, both `[coreCustomerId]/page.tsx` files, and `CustomerDetailPanel.tsx` (typecheck: clean, run 4x across the implementation. `npm run lint`: repo has no ESLint config — `next lint` just prompts interactively to create one; this is a pre-existing condition unrelated to this feature, same as noted in 011-credit-watch-fallback, not fixed here)
- [~] T020 Run all 6 scenarios in `specs/012-student-enrollment/quickstart.md` end-to-end and confirm each passes, including Scenario 5 (a pre-enrolled student's real first login still works and adopts, not duplicates, their `customer_profiles` row) — **partially verified, not by browser.** This sandbox has no authenticated staff browser session, so the actual UI forms in `/staff/customers/[coreCustomerId]` and `/staff/credit-watch/[coreCustomerId]` were not clicked through. Instead verified the highest-risk mechanism (Scenario 5, the migration + `upsertCustomerProfile` conflict-target change) directly against the real dev DB schema in a rolled-back transaction: inserted a pending row (`supabase_user_id: NULL`) for a fake Core customer id, then ran the exact `INSERT ... ON CONFLICT (core_customer_id) DO UPDATE` shape `upsertCustomerProfile` uses, using a real unlinked `auth.users` row — confirmed the **same** `customer_profiles.id` persisted across both statements with `supabase_user_id` filled in, and `count(*) = 1` for that `core_customer_id` (adoption, not duplication). Transaction was `ROLLBACK`ed, no data left behind. The guard logic in `enrollStudentInTierSequence`/`enrollStudentInCourse` (already_enrolled / would_downgrade / not_standalone) was verified by code review only, not exercised live. **Recommend the user manually walks quickstart.md's 6 scenarios in-browser**, especially Scenario 5 end-to-end (real login after a staff pre-enrollment) and Scenarios 2/3 (the duplicate/downgrade guard messages), since those touch user-facing copy and the existing `/login` flow that this feature had to reconcile with.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T004/T005/T006 must exist before T007+, since every enroll path needs the migration and `resolveOrCreateStudentProfile`)
- **User Stories (Phase 3-5)**: All depend on Foundational completion
  - US1 (T007-T010) has no dependency on US2 or US3
  - US2 (T011-T014) has no dependency on US1 or US3
  - US3 (T015-T018) has no dependency on US1 or US2, but is most useful once at least one enrollment exists to display
  - Note: T007/T011/T015 all edit `src/lib/progress/enrollment.ts`, and every `page.tsx`/`CustomerDetailPanel.tsx` task across all three stories edits one of the same three UI files — stories are logically independent but converge on a small set of shared files, so plan for sequential merges regardless of story order
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel
- Within each story, the two `page.tsx` tasks (T008/T009, T012/T013, T016/T017) are marked `[P]` — different files, same shape of change, no dependency between them
- Across stories, US1/US2/US3 are logically independent and could be developed in parallel branches, but all converge on `enrollment.ts`, both `page.tsx` files, and `CustomerDetailPanel.tsx` — coordinate merges on those files regardless of dev order

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T004-T006) — this is the riskiest part (schema migration + login-flow behavior change), worth validating on its own via quickstart.md Scenario 5 before building either enroll UI on top of it
3. Complete Phase 3: User Story 1 (T007-T010)
4. **STOP and VALIDATE**: quickstart.md Scenarios 1, 2, 3, 5 — confirm Tier enrollment works for both known and brand-new students, guards behave, and real login afterward doesn't break
5. This alone resolves the core ask (staff can enroll a student into a Tier) — deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → migration applied, resolve-or-create logic exists and compiles, no user-facing change yet
2. Add US1 → Tier enrollment works end-to-end → validate → deploy (MVP)
3. Add US2 → standalone Course enrollment works end-to-end → validate → deploy
4. Add US3 → staff can see status without acting → validate → deploy
5. Each story adds a form/section to `CustomerDetailPanel` without removing or restructuring what the previous story added

---

## Notes

- The Foundational phase carries more risk than usual for this feature (a schema migration touching a table another, unrelated flow — real student login — already depends on) — do not skip quickstart.md Scenario 5 even though it looks like a US1 concern; it's really validating Foundational.
- [P] tasks = different files, no dependencies
- Commit after each phase checkpoint, not after every task, given how much the phases share the same handful of files
- No un-enrollment and no Lesson-level enrollment in this version (spec.md Assumptions) — don't add either without a spec update
