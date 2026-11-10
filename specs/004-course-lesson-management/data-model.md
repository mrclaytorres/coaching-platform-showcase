# Phase 1 Data Model: Course & Lesson Curriculum Management

Two storage systems, one Postgres database: **Payload collections** for authored curriculum content, **Supabase tables** for per-student runtime state. See [research.md](./research.md) #1–2 for why.

## Payload Collections (authored content)

### Tiers (new — research.md #12)

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | e.g. "White — Diaphragmatic Support" (FR-027) |
| `description` | richText, optional | |
| `order` | number, required | rank within this Tier's owner's sequence (FR-027) |
| `courseOwnerId` | text, required, default `"academy"` | placeholder for future multi-tenancy (FR-028) — see data-model note below; Tiers are scoped per owner, so a future owner defines an entirely separate ordered set |

**Validation**: uniqueness of `order` within a given `courseOwnerId` is enforced in `tier-actions.ts` (application layer), same pattern as Course/Tier uniqueness elsewhere in this feature.

### Courses (extend existing `collections/Courses.ts`)

| Field | Type | Notes |
|---|---|---|
| `title` | text | existing |
| `slug` | text, unique | existing |
| `description` | richText | existing |
| `thumbnail` | upload → media | existing |
| `status` | select (draft/published) | existing |
| `publishedAt` | date | existing |
| `courseCategory` | select (`sequential-locked` / `standalone`), required | **NEW** — determines whether this Course participates in a Tier sequence at all (FR-001) (renamed from `belt`/`standalone` — research.md #12) |
| `tier` | relationship → tiers, required only when `courseCategory = sequential-locked` | **NEW** — replaces the old fixed `beltLevel` select; absent/unused for `standalone` Courses (FR-001, FR-002, FR-027) |
| `courseOwnerId` | text, required, default `"academy"` | **NEW** — placeholder field, FR-028; not consulted by any access-control logic in this feature |

**Validation**: `tier` uniqueness among `sequential-locked`-category Courses (no two Courses sharing the same Tier) is enforced in `createCourse`/`updateCourse` (application layer, not a Payload field-level `unique: true`, since that would also need to tolerate multiple `standalone` Courses with no `tier` at all) (FR-002).

### CourseModules (new)

| Field | Type | Notes |
|---|---|---|
| `course` | relationship → courses, required | |
| `title` | text, required | |
| `order` | number, required | position within course (FR-003) |

### Lessons (new)

| Field | Type | Notes |
|---|---|---|
| `module` | relationship → course-modules, required | |
| `title` | text, required | |
| `order` | number, required | position within module (FR-004) |
| `contentType` | select (`video`/`audio`/`text-image`), required | FR-005 |
| `videoUrl` / `audioUrl` | text | populated when contentType matches; backed by MinIO via Payload media or direct URL |
| `body` | richText | for `text-image` contentType (supports embedded images via existing `media` upload relation) |
| `isPublished` | checkbox, default false | gates FR-019 — not visible to Students until content is set |

### Assignments (new)

| Field | Type | Notes |
|---|---|---|
| `attachedTo` | relationship → lessons OR course-modules (polymorphic) | FR-009/FR-010 |
| `type` | select (`video-response` / `quiz` / `final-assessment`) | `final-assessment` per research.md #6 |
| `course` | relationship → courses (`sequential-locked`-category only), required only when `type = final-assessment` | one per Course, enforced in server action per research.md #6 |
| `title` | text, required | |
| `instructions` | richText | |

**Validation**: exactly one of `attachedToLesson`/`attachedToModule` must be set for `video-response`/`quiz` types; `course` (and neither of the other two) must be set for `final-assessment` type, and only for `sequential-locked`-category Courses (research.md #11, finding U2).

### QuizQuestions (new)

| Field | Type | Notes |
|---|---|---|
| `assignment` | relationship → assignments, required (assignment.type = quiz) | |
| `order` | number, required | |
| `questionType` | select (`multiple-choice` / `open-ended`) | research.md #7 |
| `prompt` | text, required | |
| `options` | array of text | only for `multiple-choice` |
| `correctOptionIndex` | number | only for `multiple-choice`, used for auto-scoring |
| `required` | checkbox, default true | FR-013 |

## Supabase Tables (per-student runtime state, RLS-protected)

### lesson_completions

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `student_id` | uuid, fk → customer_profiles | RLS: student can only read/write own rows |
| `lesson_id` | text | Payload Lesson id (cross-system reference, no FK — different DB engine boundary within same Postgres, referenced by Payload's own id) |
| `completed_at` | timestamptz | FR-007 |

Unique constraint on (`student_id`, `lesson_id`).

### submissions

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `student_id` | uuid, fk → customer_profiles | |
| `assignment_id` | text | Payload Assignment id |
| `video_url` | text, nullable | MinIO object URL, set for `video-response`/`final-assessment` type assignments (FR-011) |
| `status` | select (`pending` / `reviewed`) | FR-014 |
| `outcome` | select (`pass` / `fail`), nullable | only meaningful for `final-assessment` assignments (research.md #6); null for regular assignments; drives Tier advancement (FR-021) |
| `feedback_video_url` | text, nullable | MinIO object URL, Coach feedback (FR-015) |
| `feedback_comment` | text, nullable | Coach written comments (FR-016) |
| `reviewed_by` | uuid, nullable, fk → staff_profiles | |
| `submitted_at` | timestamptz | |
| `reviewed_at` | timestamptz, nullable | |

### quiz_responses

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `submission_id` | uuid, fk → submissions | one submission per quiz attempt |
| `question_id` | text | Payload QuizQuestion id |
| `answer_text` | text | free text or selected option index (stringified) |
| `is_correct` | boolean, nullable | auto-scored for multiple-choice (research.md #7), null for open-ended |

### module_feedback

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `student_id` | uuid, fk → customer_profiles | |
| `module_id` | text | Payload CourseModule id |
| `coach_id` | uuid, fk → staff_profiles | |
| `comment` | text, nullable | FR-023 |
| `video_url` | text, nullable | FR-023 |
| `created_at` | timestamptz | |

### student_tier_progress (renamed from `student_belt_progress` — research.md #12)

| Column | Type | Notes |
|---|---|---|
| `student_id` | uuid, fk → customer_profiles | part of composite pk |
| `course_owner_id` | text | part of composite pk — **NEW**: since Tier is now scoped per Course Owner (research.md #12), a Student's rank is tracked per owner's sequence, not globally |
| `current_tier_rank` | integer, **no default — always inserted at that owner's lowest Tier `order`** | row is created by `enrollStudentInTierSequence(studentId, courseOwnerId)` (FR-024) at the lowest `order` value among that owner's `Tiers` rows (typically `1`, but looked up rather than hardcoded); no row for a given `(student_id, course_owner_id)` means zero access to any Sequential-Locked Course under that owner |
| `updated_at` | timestamptz | bumped on each Tier advancement (FR-021) |

Primary key: (`student_id`, `course_owner_id`).

**State transition**: the row is created (at the owner's lowest Tier rank) by enrollment (FR-024), then `current_tier_rank` only increases, by exactly 1, triggered solely by a Coach marking a Sequential-Locked Course's `final-assessment` Submission `outcome = pass` (FR-021). A Sequential-Locked Course is unlocked when `tier.order <= current_tier_rank` for that Course's `tier.courseOwnerId` (research.md #8, #12) — no "+1" offset, since rank already starts at the entry Tier rather than a "0" pre-enrollment state.

### course_enrollments (NEW — Standalone Courses)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `student_id` | uuid, fk → customer_profiles | |
| `course_id` | text | Payload Course id (must be a `courseCategory = standalone` Course) |
| `enrolled_at` | timestamptz | FR-025 |

Unique constraint on (`student_id`, `course_id`). Rows are only inserted by `enrollStudentInCourse` (staff-role gated, FR-026) — not self-service by the Student, since it represents a fulfilled purchase.

## Cross-system reference note

Payload-managed ids (Lesson, Assignment, CourseModule, QuizQuestion, Course, Tier) are stored as plain `text` columns in Supabase tables rather than foreign keys, since Payload manages its own tables outside of Supabase's schema/RLS layer even though both live in the same physical Postgres instance. Referential integrity for these cross-system references is enforced at the application layer (server actions validate the Payload id exists before writing), consistent with there being no cross-schema FK between Payload's and Supabase's table sets today.

## `courseOwnerId` placeholder note

`Courses.courseOwnerId`, `Tiers.courseOwnerId`, and `student_tier_progress.course_owner_id` all default to/reference the fixed string `"academy"` in this feature. There is no "Course Owners" collection/table — no CRUD, no referential integrity, no tenant-scoped access control. This is intentional (research.md #12): the field exists so a future multi-tenant whitelisting feature doesn't need a backfill migration, not because this feature builds multi-tenancy itself.
