# Phase 0 Research: Course & Lesson Curriculum Management

## 1. Where does authored curriculum content live: Payload or Supabase?

**Decision**: Payload CMS collections (`Courses` extended, plus new `CourseModules`, `Lessons`, `Assignments`, `QuizQuestions`).

**Rationale**: A `Courses` Payload collection already exists in this codebase with `richText` (lexical) support and a `media` upload relation — exactly what's needed for Lesson text/image content and thumbnails. Payload's admin UI and Local API give coaches structured authoring (ordering, drafts, relations) without hand-built CRUD forms. Payload and Supabase already share one Postgres instance (`DATABASE_URL` points at the same `supabase.co` host used by `@supabase/supabase-js`), so this isn't adding infrastructure — it's extending an existing collection set.

**Alternatives considered**:
- *Raw Supabase tables for everything*: would require building a custom admin UI for course/module/lesson authoring from scratch — Payload already provides this. Rejected as unnecessary duplication of what Payload already gives for free.
- *Payload for everything, including per-student state*: rejected — Payload access control is user/role-based per its own `users` collection, which doesn't map cleanly to a per-student "only see your own rows" pattern; Supabase RLS is a much better fit for that (see #2).

## 2. Where does per-student runtime data live?

**Decision**: New Supabase Postgres tables — `lesson_completions`, `submissions`, `quiz_responses`, `module_feedback`, `student_belt_progress` — RLS-protected, following the exact pattern of `customer_profiles`/`staff_profiles` from `002-supabase-auth-user-data`/`003-roles-admin-staff`.

**Rationale**: This data is high-write, identity-scoped (a student must only ever see/write their own rows), and doesn't need an editorial workflow — it's transactional, not authored content. Supabase RLS already enforces exactly this shape of access control elsewhere in the app. Keeping it out of Payload avoids overloading Payload's access-control model (built around admin users, not end-customers) with per-row student ownership checks.

**Alternatives considered**:
- *Payload collections with row-level access functions per student*: technically possible via Payload's `access` functions, but Payload access checks run against `req.user` from Payload's own auth, which the Supabase-authenticated student never has. Would require bridging two identity systems for every read/write. Rejected.

## 3. Coach authorization for course authoring: Payload admin login vs. existing Supabase staff roles?

**Decision**: Coaches/Staff never log into Payload's own `/admin` panel. All authoring happens through new pages under `/staff/courses/*` in the existing Next.js app, which call Payload's **Local API** (`getPayload().create/update/find`, server-side only) after checking the caller's Supabase `staff_profiles` role (`coach` or `staff`), exactly like every other `/staff/*` route from `003-roles-admin-staff`.

**Rationale**: Introducing Payload's own `users`/login system as a second identity system for coaches would duplicate the role model already built (Coach/Staff functional parity, Super Admin oversight) and create two places that could drift out of sync. The Local API lets the app treat Payload purely as a headless content store.

**Alternatives considered**:
- *Coaches log into Payload's native admin panel*: rejected — means maintaining Payload `users` records in parallel with `staff_profiles`, duplicated invite/deactivate flows, and a second login surface for coaches to learn.
- *Payload admin panel is not used by anyone in this feature*: Payload's `Courses` collection `access` rules (currently `Boolean(req.user)`) become effectively moot for the coach flow; they're left in place only as a safety net for direct Local-API misuse, but real authorization happens in the Next.js server action before Payload is ever called.

## 4. Media storage: MinIO vs. Supabase Storage vs. local disk

**Decision**: MinIO (self-hosted, S3-compatible object storage) for all media in this feature — Lesson video/audio/text-image assets, student submission videos, and coach feedback videos.

**Rationale**: The current Payload `Media` collection uses local-disk storage (`staticDir: public/media`), which doesn't scale for video content and doesn't survive across deployments/containers. MinIO is S3-compatible, so Payload's official `@payloadcms/storage-s3` plugin works against it with just an endpoint override — no custom upload code needed for coach-authored Lesson media. For student/coach *runtime* uploads (submissions, feedback) that never go through Payload's admin UI, the app issues short-lived presigned PUT URLs directly against the same MinIO instance, so large video files never pass through the Next.js server.

**Alternatives considered**:
- *Supabase Storage*: also S3-compatible-ish and already available (same project as Supabase Auth/Postgres), would avoid standing up MinIO at all. Rejected only because the user specified MinIO as the intended object store; noted here in case infra ownership changes later — the presigned-upload pattern in this plan would transfer to Supabase Storage with minimal change since both are S3-compatible.
- *Local disk (status quo)*: rejected — doesn't scale to video, and current recordings (`001-customer-recording-library`) are external links (Zoom/Vimeo), not platform-hosted files, so there's no existing internal video-hosting precedent to preserve.

## 5. Belt-level modeling and ordering — **superseded by addendum #12**

~~A single ordered enum — White(1)…Brown(8) — defined once in `src/lib/types.ts`.~~ Superseded: the fixed enum is replaced by the Course-Owner-scoped `Tiers` Payload collection (addendum #12). The original motivation still holds — a single source of truth for ordering — but that source of truth is now the `Tiers` table's `order` column (looked up via Payload, not a static TypeScript enum), since Tier sets are now Coach-authored data rather than a fixed list.

## 6. Final Assessment Activity modeling

*Terminology note (addendum #12): "belt" → "Tier"/"Sequential-Locked Course" throughout this section; the underlying decision is unchanged.*

**Decision**: Modeled as a special `Assignment` row per Course, flagged `type: 'final-assessment'`, always `video-response` shaped, with exactly one allowed per Sequential-Locked Course (enforced at creation time in the course-actions server action, not a DB constraint, since Payload doesn't have a straightforward composite-uniqueness-with-filter mechanism out of the box). Its `Submission`s are reviewed with an explicit `pass`/`fail` outcome (not just `pending`/`reviewed`), matching the resolved clarification that passing gates Tier advancement.

**Rationale**: Reuses the existing Assignment/Submission shape (FR-009–FR-017) instead of inventing a parallel entity, while the extra `type` value and pass/fail outcome carry the special gating behavior from FR-020/FR-021.

**Alternatives considered**: A fully separate `FinalAssessments` collection — rejected as needless duplication of the Assignment/Submission review workflow already being built for regular assignments.

## 7. Quiz grading

**Decision**: Objective question types (e.g., multiple choice) are auto-scored at submission time by a server action that fetches the quiz's `QuizQuestions` (with correct answers) from Payload and compares them against the student's `quiz_responses` row; open-ended text questions are always left for manual Coach review/comment. Coaches can still add comments to any quiz submission regardless of auto-score.

**Rationale**: Matches the assumption already documented in `spec.md`; keeps quizzes lightweight for students while still allowing Coach commentary.

**Alternatives considered**: Fully manual grading for all quiz types — rejected as unnecessary Coach workload for objective questions with a single correct answer.

## 8. [Addendum, post-`/speckit-analyze`] Belt Courses vs. Standalone Courses, and where access control lives

*Terminology note (addendum #12): "Belt Course" → "Sequential-Locked Course", "belt rank"/"belt program" → "Tier rank"/"Tier sequence program" throughout this section; the underlying decision (access control lives in Foundational, not deferred to a late story) is unchanged.*

**Context**: `/speckit-analyze` flagged (I1) that FR-006 ("Students see only Courses they're enrolled in") had no backing data model distinct from belt progression, and that the original task plan deferred all access enforcement to the Phase 7/US5 "capstone." The user clarified two things: (1) a Student always starts belt progress at rank 1 (White) the moment they purchase/enroll in the belt program — there is no "rank 0" limbo state; (2) the platform also has Courses that are **not** part of the belt system at all (e.g., voice-repair courses), which need their own independent enrollment gate.

**Decision**:
- `Courses.courseCategory` (`belt` | `standalone`) distinguishes the two. `beltLevel` is required+unique only for `belt`-category Courses; Standalone Courses have no belt level and never participate in FR-020–FR-022 (final assessment, belt gating, sequential locking).
- A new Supabase table, `course_enrollments` (student_id, course_id, enrolled_at), grants a Student access to one specific Standalone Course, independent of belt rank.
- `student_belt_progress` rows are only created when a Student is enrolled in the belt program, always starting at `current_belt_rank = 1` (White). No row = no access to any Belt Course, not even White. `isCourseUnlocked` simplifies to `courseBeltRank <= currentBeltRank` (no more "+1" offset from a rank-0 default).
- **Both** checks — `isCourseUnlocked` (belt) and the `course_enrollments` lookup (standalone), unified behind a single `isCourseAccessible(studentId, course)` — move into the **Foundational** phase (Phase 2 of tasks.md), not US5. Access control is cross-cutting infrastructure every story depends on for correctness, the same way `003-roles-admin-staff`'s role checks live in Foundational, not in a late user story. This is the actual fix for I1: previously, US2 (Phase 4) shipped with zero real access enforcement and a "deferred to Phase 7" note — an MVP that stopped after US2 would have left every Course open to every Student. Moving the read-side check to Foundational means US2 enforces FR-006 correctly from its first implementation, and US5 is left with just the belt*-progression* mechanics (final assessment definition, pass/fail review, `advanceBelt` write) rather than the access check itself.
- Since payment/checkout remains out of scope (per spec.md Assumptions), a Coach/Staff-triggered manual `enrollStudentInBeltProgram`/`enrollStudentInCourse` action (FR-026) is the in-app stand-in for "the purchase happened" — also placed in Foundational, since every story needs some way to grant a test Student access in the first place.

**Alternatives considered**:
- *Keep single `beltLevel` required field, model "standalone" as an unused/placeholder 9th belt*: rejected — conflates two different access models (sequential-lock vs. simple enrollment-gate) into one field, and would force fake belt ranks onto Courses that have nothing to do with belts.
- *Leave access-control checks inside US5 as originally planned*: rejected — this is exactly what `/speckit-analyze` flagged as inconsistent; access control is infrastructure, not a user-facing feature increment, and deferring it undermines every earlier story's claim of independent testability.

## 9. [Addendum] Course/Module/Lesson edit, delete, and reorder (`/speckit-analyze` finding U1)

**Decision**: `course-actions.ts` gains `updateCourse`/`deleteCourse`, `updateModule`/`deleteModule`/`reorderModule`, and `updateLesson`/`deleteLesson`/`reorderLesson` — all staff-role gated, added in US1 (Phase 3) alongside the existing `create*` functions. Deletes never cascade-delete `lesson_completions`/`submissions`/`course_enrollments` rows (FR-018) — those Supabase rows reference Payload ids by plain `text`, so there's no FK to cascade in the first place (see data-model.md's cross-system reference note); the Lesson/Module content simply becomes unreachable to Students going forward while history is preserved by construction.

**Rationale**: FR-001/FR-003/FR-004 explicitly require edit/reorder/delete, and the original task list only contracted `create*` functions — the Lesson-editor UI task implied this functionality without a backing contract. Fixed by adding the functions to `contracts/server-actions.md` before the pages that call them.

## 10. Sequential Tier locking enforcement point (updated post-addendum)

**Decision**: Enforced server-side, and in **Foundational** (not deferred to US5, per addendum #8) via `isCourseAccessible`/`isCourseUnlocked` in `src/lib/progress/course-access.ts`/`tier-progress.ts` (renamed from `belt-progress.ts` per addendum #12), called from the student-facing course routes (`src/app/customer/[id]/courses/[courseId]/*`) before rendering; also enforced defensively in the `lesson_completions`/`submissions` write-path server actions (a student cannot mark a Lesson complete or submit to a Course they don't have access to), not just hidden in the UI.

**Rationale**: FR-022/FR-006 are access-control requirements, not just a UI nicety — matching how `003-roles-admin-staff` enforces role checks at the route/layout level (not just hiding nav links) and in the write path.

**Alternatives considered**: UI-only hiding of locked/unenrolled courses — rejected as insufficient, since a Student could otherwise navigate directly to a locked Course's URL or call a server action directly. Deferring the check itself to a later story — rejected per addendum #8 (this was `/speckit-analyze` finding I1).

## 11. [Addendum] Minor fixes from `/speckit-analyze`

- **U2** (Assignment attachment invariant): `createAssignment`/`updateAssignment` now validate that exactly one of `attachedToLesson`/`attachedToModule` is set for `video-response`/`quiz` types, and that `course` (not either of those) is set for `final-assessment` type — see `contracts/payload-collections.md`.
- **A1** (submission listing naming): `listPendingSubmissions(courseId?)` renamed to `listSubmissions({ courseId?, status? })` in `contracts/server-actions.md` to match FR-014's "filterable by pending/reviewed status" requirement.
- **A2** (FR-014 wording): "for their Courses" reworded to "across the platform's Courses" in spec.md, removing the implication of unbuilt per-coach course ownership.

## 12. [Addendum, post-`/speckit-clarify` session 2 — 2026-07-04] "Belt Course" generalized to "Sequential-Locked Course" + Tier entity + Course Owner placeholder

**Context**: the user asked to generalize the belt-specific naming/modeling into a reusable "sequential-locked course" concept, since the platform will eventually be whitelisted for other Course owners who won't be teaching singing belts at all. Three decisions came out of `/speckit-clarify`: (1) replace the fixed 8-belt enum with a configurable, ordered **Tier** entity; (2) add a placeholder `courseOwnerId` field to Course; (3) scope Tier itself per Course Owner (not one global list), so a future owner defines an entirely different named/ordered sequence.

**Decision**:
- New Payload collection **`Tiers`**: `name` (text), `description` (optional richText), `order` (number — rank within its owner's sequence), `courseOwnerId` (text, default `"academy"`, placeholder — see below). Academy's 8 singing belts become 8 `Tiers` rows (`order` 1–8) rather than a hardcoded select field.
- `Courses.beltLevel` (fixed select) is **replaced** by `Courses.tier` (relationship → `tiers`), required only when `Courses.courseCategory = 'sequential-locked'` (renamed from `'belt'`). `Courses.courseOwnerId` (text, default `"academy"`) is added alongside it.
- Belt-specific naming is replaced platform-wide: `courseCategory: 'belt'` → `'sequential-locked'`; `student_belt_progress` → `student_tier_progress`; `current_belt_rank` → `current_tier_rank`; `enrollStudentInBeltProgram` → `enrollStudentInTierSequence`; `advanceBelt` → `advanceTier`; `belt-progress.ts` → `tier-progress.ts`; `BELT_ORDER`/`beltRank` → dropped (order now comes from the `Tiers` table, not a static enum — see below).
- Because Tier is now Course-Owner-scoped data rather than a fixed enum, a Student's tier-progress row must record **which owner's sequence** the rank applies to: `student_tier_progress` becomes a composite-keyed table on `(student_id, course_owner_id)` with `current_tier_rank`. `isCourseUnlocked(studentId, course)` now resolves the Course's `tier` → that Tier's `order` and `courseOwnerId` → looks up the `(studentId, courseOwnerId)` progress row → compares `tier.order <= current_tier_rank`.
- `enrollStudentInTierSequence(studentId, courseOwnerId)` inserts the progress row at the **lowest `order` value among that owner's Tiers** (not a hardcoded `1`), since Tier ordering is now Coach-authored data, not a fixed enum starting at a known constant. In practice this will be `1` if Tiers are authored starting at `order = 1`, which is the expected authoring convention, but the code must look it up rather than assume it.
- `Courses.tier` uniqueness (no two Courses sharing the same Tier) is enforced in `course-actions.ts`, same pattern as the old `beltLevel` uniqueness check (research.md #8) — not a Payload field-level constraint.
- FR-027 (defining an ordered Tier sequence) needs its own small CRUD surface: `createTier`/`updateTier`/`deleteTier`/`reorderTier`/`listTiers(courseOwnerId)` in a new `src/lib/courses/tier-actions.ts`, staff-role gated, plus a `/staff/tiers` page — scheduled in US1 (Phase 3), since a Coach must be able to define Tiers before creating a Sequential-Locked Course that references one.

**`courseOwnerId` is a plain placeholder field, not a tenancy system** (research.md #FR-028 clarification): it is a `text` field with a fixed default (`"academy"`), **not** a new "Course Owners" Payload collection, not a foreign key with referential integrity, and not consulted by any access-control check in this feature. Building an actual owner-management collection/CRUD UI now, before the real multi-tenant whitelisting feature is scoped, would be speculative — the field exists purely so that when that future feature lands, `Course.courseOwnerId`/`Tier.courseOwnerId` already exist on every row instead of requiring a backfill migration.

**Rationale**: matches the three `/speckit-clarify` answers directly — Tier generalization avoids hardcoding a domain-specific (singing-belt) enum into what's meant to become a general sequential-locked-course mechanism; the owner-scoping on Tier is what actually makes that generalization useful for a future different owner; the placeholder field (vs. a real tenancy system) avoids building infrastructure for a feature that hasn't been scoped yet.

**Alternatives considered**:
- *Keep `beltLevel` as a fixed enum, just relabel `courseCategory` to `'sequential-locked'`*: rejected by the user (chose Option B over Option A in `/speckit-clarify`) — a relabel alone wouldn't let a future owner define their own tier names/count.
- *One global `Tiers` list shared by all Course Owners*: rejected by the user (chose Option A over B in the third clarify question) — would force a future owner to reuse Academy's singing-belt tiers.
- *Build a real "Course Owners" collection + tenant-scoped RLS/access control now*: rejected — explicitly out of scope per the user's "in the future" framing; would be speculative infrastructure with no consumer yet.
