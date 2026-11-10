# Phase 1 Data Model: Staff-Driven Student Enrollment

No new tables. One migration to an existing table (`customer_profiles`), and new read/write paths over three existing tables/collections.

## Migration: `customer_profiles.supabase_user_id` → nullable

Current schema (`specs/002-supabase-auth-user-data/contracts/supabase-schema.md`):

```sql
CREATE TABLE public.customer_profiles (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id  uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  core_customer_id  integer     NOT NULL UNIQUE,
  email             text        NOT NULL,
  first_name        text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

Migration for this feature:

```sql
ALTER TABLE public.customer_profiles ALTER COLUMN supabase_user_id DROP NOT NULL;
```

- `UNIQUE` is untouched — Postgres treats multiple `NULL`s as distinct by default, so any number of not-yet-logged-in students can coexist with `supabase_user_id IS NULL`.
- `REFERENCES auth.users(id) ON DELETE CASCADE` is untouched — a `NULL` foreign key value is always valid regardless of the referenced table.
- RLS policies (`USING (supabase_user_id = auth.uid())`) are untouched and still correct: `NULL = auth.uid()` is never `true` in SQL, so a pre-enrolled row stays inaccessible to every authenticated user (including the student themself) until it's linked by their real first login.

## `customer_profiles` — new "pending" row shape

A row created by this feature, before the student's first real login:

| Column | Value |
|---|---|
| `supabase_user_id` | `NULL` |
| `core_customer_id` | from the Core snapshot looked up at enroll time |
| `email` | from the Core snapshot |
| `first_name` | from the Core snapshot |
| `is_seeded` | `false` — this is a real student, not a dev/test account (distinct from the existing dev-seeder's rows, which are always `true`) |
| `is_active` | `true` (existing column default — unaffected by this feature) |

**Adoption on first real login** (`login/page.tsx`'s existing `linkAccount`, unchanged code — behavior changes only because `upsertCustomerProfile`'s conflict target changes, see contracts/server-actions.md): the same row is found by `core_customer_id`, and updated in place — `supabase_user_id` set to the real auth user's id, `email`/`first_name` refreshed from that login's snapshot (handles the rare case where a name/email changed in Core between enrollment and first login).

## Tier Enrollment (existing table: `student_tier_progress`, spec 004)

No schema change. This feature's new behavior:

- **Choosing a starting Tier** (FR-001): the `current_tier_rank` an enrollment inserts at is now the `order` of a Tier the staff member picks from `listTiers(courseOwnerId)`, not always the sequence's lowest `order` (previous behavior, still the default when staff don't pick a higher one).
- **Duplicate guard** (FR-004): a `(student_id, course_owner_id)` row already existing is reported back to the caller as `already_enrolled` with the student's current Tier name, not silently ignored and not a thrown constraint error.
- **Downgrade guard** (FR-005): if a row already exists and the chosen starting Tier's `order` is *less than* the existing `current_tier_rank`, the write is skipped and `would_downgrade` (with both the current and requested Tier names) is reported back — staff must choose a Tier at or above the student's current rank to proceed.

## Standalone Course Enrollment (existing table: `course_enrollments`, spec 004)

No schema change. This feature's new behavior:

- **Category guard** (FR-003): attempting this action on a Course whose `courseCategory` is `sequential-locked` (not `standalone`) is reported back as `not_standalone` (with the Course's Tier name, so staff know to use Tier enrollment instead), rather than a thrown error.
- **Duplicate guard** (FR-004): an existing `(student_id, course_id)` row is reported back as `already_enrolled`, replacing today's silent `ignoreDuplicates: true` upsert.

## Enrollment status (read-only, Story 3 / FR-006)

Composed from two existing read paths, no new table:

- **Tier rank**: `getStudentTierProgress(studentId, courseOwnerId)` (existing, `src/lib/progress/tier-progress.ts`) → `{ currentTierRank } | null`, joined against `listTiers(courseOwnerId)` to show the Tier's `name` instead of a bare integer (FR-006 — "by Tier name, not just an internal number").
- **Standalone Courses**: a new small query, `listCourseEnrollmentsForStudent(studentId)` (new function, same file as the guard changes above) — `SELECT course_id FROM course_enrollments WHERE student_id = ...`, joined against `listCourses()` to show each Course's `title`.

## Typed result shape (research.md §4/§5)

Both `enrollStudentInTierSequence` and `enrollStudentInCourse` return one shared discriminated-union shape instead of `Promise<void>`:

```ts
type EnrollResult =
  | { status: 'enrolled' }
  | { status: 'already_enrolled'; currentTierName?: string } // Tier path includes currentTierName
  | { status: 'would_downgrade'; currentTierName: string; requestedTierName: string } // Tier path only
  | { status: 'not_standalone'; tierName: string } // Course path only
  | { status: 'customer_not_found' }; // Core snapshot 404 during resolve-or-create
```

See `contracts/server-actions.md` for the full function signatures.
