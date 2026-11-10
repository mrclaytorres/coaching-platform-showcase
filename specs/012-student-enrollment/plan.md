# Implementation Plan: Staff-Driven Student Enrollment

**Branch**: `012-student-enrollment` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-student-enrollment/spec.md`

## Summary

Staff currently have no UI to grant a student access to a Tier sequence or a standalone Course — the backend functions that do this (`enrollStudentInTierSequence`, `enrollStudentInCourse`, spec 004) exist but are never called from anywhere in the app. This feature adds that UI to the staff customer detail page (`/staff/customers/[coreCustomerId]`), alongside the existing credit-adjustment form, plus a small set of backend changes: enrolling by Core customer ID directly (resolving-or-creating the student's local account record the same way the dev seed tool already does, per FR-009), letting staff choose which Tier a student starts at instead of always the lowest (reusing the existing `advanceTier` rank-set capability), and duplicate/downgrade guards (FR-004, FR-005) surfaced as clear messages rather than silent no-ops. A new "Enrollment" section on that same page shows current status (FR-006/Story 3), reading data that's already queryable today (`getStudentTierProgress`, and a new small query over `course_enrollments`).

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`)

**Primary Dependencies**: PayloadCMS (`getPayloadClient()`, `listTiers()`, `listCourses()` — existing, unmodified), `@supabase/supabase-js` (service-role client, same pattern as every other staff write path), existing `src/lib/progress/enrollment.ts` (`enrollStudentInTierSequence`, `enrollStudentInCourse` — both modified), existing `src/lib/progress/tier-progress.ts` (`getStudentTierProgress`, `advanceTier` — both reused, `advanceTier` reused for "choose starting Tier"), existing `src/lib/auth/customer-profile.ts` (`getCustomerProfileByCoreId`, `upsertCustomerProfile` — reused for resolve-or-create), existing `src/lib/core-api.ts` (`fetchSnapshot` — reused for resolve-or-create, same call the dev seed tool already makes), existing `src/lib/auth/staff-profile.ts` (`requireStaffRole`)

**Storage**: Supabase Postgres — no new tables, but one migration to an existing one: `customer_profiles.supabase_user_id` becomes nullable (currently `NOT NULL`), so a pre-enrolled student with no portal login yet can have a row (research.md §2). Writes to the existing `student_tier_progress` and `course_enrollments` tables (spec 004), and — when the student has no local account yet — a new insert path into `customer_profiles` with `supabase_user_id: NULL`.

**Testing**: No automated test framework exists in this repo (confirmed for specs 008/011; unchanged). Validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app (`next dev` locally, `next start` in production)

**Project Type**: Web application — single existing Next.js app, no new services

**Performance Goals**: N/A beyond "feels instant for staff use" — a single staff action per enrollment, not a bulk operation.

**Constraints**:
- MUST NOT create a duplicate `student_tier_progress` row or a duplicate `course_enrollments` row (FR-004) — both already have this guarded at the DB level (composite PK / unique constraint per data-model.md, spec 004) but the UI must turn that into a clear message, not a raw constraint-violation error.
- MUST NOT silently lower a student's `current_tier_rank` (FR-005) — needs an explicit confirmation step when the chosen starting Tier's `order` is below the student's existing rank.
- MUST reject standalone-enrollment attempts on a `sequential-locked`-category Course (FR-003) — checked the same way `enrollStudentInCourse` already partially checks it (`course.courseCategory !== 'standalone'` throws), just surfaced as a clear message instead of an unhandled error.
- MUST resolve-or-create the student's `customer_profiles` row when enrolling by Core customer ID and no local record exists yet (FR-009) — a real, non-dev insert (`supabase_user_id: NULL`, `is_seeded: false`), never the dev seeder's synthetic-email/throwaway-password pattern, which is unsafe and disabled in production (research.md §2).
- MUST NOT break the real student login flow for a student who was pre-enrolled before ever logging in — `upsertCustomerProfile`'s conflict target moves from `supabase_user_id` to `core_customer_id` so `login/page.tsx`'s existing `linkAccount` call *adopts* (fills in `supabase_user_id`, refreshes `email`/`first_name`) the pre-existing row instead of colliding with it on insert (research.md §2) — this is a cross-cutting fix to spec 002's original flow, not new behavior gated behind this feature's own UI.
- Access restricted to `staff`/`super_admin` roles (FR-008) — `coach` MUST NOT see or reach this feature, consistent with Credit Watch and the Admin Customer Console.
- No un-enrollment, no Lesson-level enrollment (spec.md Assumptions) — not built in this version.

**Scale/Scope**: A single-student, single-action operation per use — no bulk/batch enrollment in this version.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project (confirmed unchanged since specs 008/011). No gates to evaluate against. Proceeding under the same established conventions already used throughout this codebase: `requireStaffRole()` gating for all staff-only writes, service-role Supabase client instantiated inline per-file, Payload accessed via the shared `getPayloadClient()` cache, and cross-system Payload/Supabase references stored as plain (non-FK) columns (already true of `student_tier_progress`/`course_enrollments`, data-model.md 004).

**Post-design re-check**: No new dependencies, no new services, no new tables — this composes entirely from existing spec 004 tables/functions (extended, not replaced) and the existing spec 002/dev-seeding resolve-or-create pattern. No constitution gates apply.

## Project Structure

### Documentation (this feature)

```text
specs/012-student-enrollment/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   └── server-actions.md                # Phase 1 output — function contracts this feature adds/modifies
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── staff/
│   │   ├── customers/
│   │   │   └── [coreCustomerId]/
│   │   │       └── page.tsx             # MODIFIED — adds enrollment status display (Story 3) and
│   │   │                                 # the two enroll actions (Stories 1 & 2), same page/pattern
│   │   │                                 # as the existing credit-adjustment form
│   │   └── credit-watch/
│   │       └── [coreCustomerId]/
│   │           └── page.tsx             # MODIFIED — same CustomerDetailPanel is shared by this page
│   │                                     # too (FR-009, spec 009); threads the same new props through
│   │                                     # so enrollment is usable from either entry point
│   └── login/
│       └── page.tsx                     # UNCHANGED code, but its existing linkAccount() call to
│                                         # upsertCustomerProfile now behaves differently at the DB
│                                         # level (adopts a pre-enrolled row instead of always
│                                         # inserting) purely because of the conflict-target change below
├── components/
│   └── customers/
│       └── CustomerDetailPanel.tsx      # MODIFIED — adds an "Enrollment" section: current status
│                                         # (Tier rank by name, standalone Course list) + two forms
│                                         # (enroll in Tier sequence at a chosen Tier; enroll in a
│                                         # standalone Course). New required props: `tiers`,
│                                         # `courses`, `tierEnrollment`, `courseEnrollments`,
│                                         # `submitTierEnrollAction`, `submitCourseEnrollAction`
├── lib/
│   ├── progress/
│   │   ├── enrollment.ts                # MODIFIED — enrollStudentInTierSequence and
│   │   │                                 # enrollStudentInCourse both take a Core customer id and
│   │   │                                 # resolve-or-create the local student record first (FR-009);
│   │   │                                 # enrollStudentInTierSequence gains a `startingTierId`
│   │   │                                 # parameter (defaults to lowest, per existing behavior) and
│   │   │                                 # the downgrade guard (FR-005); both gain the
│   │   │                                 # already-enrolled guard (FR-004) as a typed result instead
│   │   │                                 # of relying on a thrown DB constraint error
│   │   └── tier-progress.ts             # UNCHANGED — getStudentTierProgress/advanceTier reused as-is
│   └── auth/
│       └── customer-profile.ts          # MODIFIED — new `createPendingCustomerProfile` (real,
│                                         # non-dev insert with supabase_user_id: NULL) used by
│                                         # enrollment.ts's resolve-or-create step; upsertCustomerProfile's
│                                         # conflict target changes from supabase_user_id to
│                                         # core_customer_id (research.md §2)
```

**Database migration** (not a new file under `src/lib` — a Supabase migration, same mechanism spec 002/008's tables were created with):
- `customer_profiles.supabase_user_id`: `NOT NULL` → nullable.
- No RLS policy change needed — `USING (supabase_user_id = auth.uid())` already correctly denies access to any row where `supabase_user_id IS NULL`.

**Structure Decision**: No new route, no new page — this extends the existing staff customer detail page and its `CustomerDetailPanel` component, the same surface that already hosts the credit-adjustment form (spec 008/009). The only library change is widening `src/lib/progress/enrollment.ts`'s two existing functions to accept a Core customer id (resolving the local student record) and a chosen starting Tier, rather than adding new modules.

## Complexity Tracking

*No constitution violations — table intentionally omitted.*
