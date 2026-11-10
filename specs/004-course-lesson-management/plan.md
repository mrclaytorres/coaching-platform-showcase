# Implementation Plan: Course & Lesson Curriculum Management

**Branch**: `004-course-lesson-management` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-course-lesson-management/spec.md`

---

## Summary

Coaches author Courses built from Payload CMS collections — `Tiers`, `CourseModules`, `Lessons`, `Assignments`, `QuizQuestions` — extending the existing `Courses` collection rather than replacing it. A Course is either **Sequential-Locked** (tied to one `Tier` in an ordered, Course-Owner-scoped sequence — Academy's 8 singing belts are seed data for one such sequence) or **Standalone** (no Tier, gated by a simple per-Course enrollment record instead). Coaches interact with this content through new pages under `/staff/courses/*` and `/staff/tiers` (server actions call Payload's Local API), gated by the existing Supabase `staff_profiles` role check — not Payload's own admin login. Students consume Lessons and track progress under `/customer/[id]/courses/*`. Per-student runtime state — Lesson completions, Assignment/Quiz submissions, Module feedback, and Tier progress — lives in new RLS-protected Supabase Postgres tables, mirroring the existing `customer_profiles`/`staff_profiles` pattern. All video/audio media (lesson content, student submissions, coach feedback) is stored in MinIO (S3-compatible object storage): Payload's `@payloadcms/storage-s3` plugin handles coach-authored Lesson media, while student/coach runtime uploads use direct presigned PUT URLs against the same MinIO instance, referenced by URL in Supabase rows. Both `Courses` and `Tiers` carry a placeholder `courseOwnerId` field (fixed to `"academy"` today) in preparation for a future multi-tenant whitelisting feature — this feature does not build any tenant isolation or access logic around it.

## Technical Context

**Language/Version**: TypeScript 5.5 / Node 20 (existing)

**Primary Dependencies**: Next.js 14.2 App Router, PayloadCMS 3.85 (`payload`, `@payloadcms/db-postgres`, `@payloadcms/richtext-lexical` — all existing) + new `@payloadcms/storage-s3` plugin; `@supabase/supabase-js` v2.108.1 and `@supabase/ssr` v0.12.0 (existing); new `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` for direct-to-MinIO presigned uploads of student/coach runtime media

**Storage**:
- PayloadCMS collections (authored content, same Postgres DB as Supabase): `Tiers` (new — named, ordered, Course-Owner-scoped levels, replacing the old fixed 8-belt enum), `Courses` (extend existing — now with `courseCategory`: `sequential-locked`/`standalone`, a conditional `tier` relationship, and a placeholder `courseOwnerId`), `CourseModules`, `Lessons`, `Assignments`, `QuizQuestions`
- Supabase Postgres tables (new, RLS-protected, per-student runtime state): `lesson_completions`, `submissions`, `quiz_responses`, `module_feedback`, `student_tier_progress` (composite-keyed on student + Course Owner, since Tiers are now owner-scoped), `course_enrollments` (grants a Student access to a specific Standalone Course, independent of Tier rank)
- Object storage: MinIO (S3-compatible) — one bucket for Payload-managed Lesson media (via storage-s3 plugin, replacing the current local-disk `public/media` adapter), one bucket for runtime uploads (student assignment/quiz-response videos, coach feedback videos) via presigned URLs

**Testing**: Manual validation via `quickstart.md` scenarios — no automated test suite, consistent with project norms established in `003-roles-admin-staff`

**Target Platform**: Web — same Next.js application, no new deployment target

**Project Type**: Next.js web application (App Router, server components + server actions)

**Performance Goals**: Course/Module/Lesson tree loads in < 1s excluding video buffering; presigned upload URL issuance < 500ms; Tier-lock check on course access < 50ms (single indexed lookup, same budget as the role check in `003-roles-admin-staff`)

**Constraints**:
- MinIO credentials (access/secret key) are server-only — never exposed to the client; all client uploads go through short-lived presigned URLs issued by a server action
- Payload's own `users`/admin-login system is NOT used for Coach/Staff authorization — all course-authoring access control reuses the existing Supabase `staff_profiles` role check (`coach` or `staff`, matching the functional parity from `003-roles-admin-staff`)
- Existing `Courses` collection's `access` rules (`Boolean(req.user)`) must be replaced with checks appropriate for Local-API-only usage from trusted server actions (Payload requests here are server-to-server, authorization happens before calling Payload, not inside Payload's own access control)
- Tier uniqueness (FR-002) and Tier order enforcement (FR-022) are driven by the `Tiers` Payload collection's `order` field (per `courseOwnerId`) — not a static TypeScript enum, since Tiers are now Coach-authored, Course-Owner-scoped data (research.md #12)
- Course access control (FR-006) is a **Foundational**-phase concern, not a late user-story addition: both `isCourseUnlocked` (Sequential-Locked Courses) and the `course_enrollments` check (Standalone Courses) must exist and be enforced starting with the first story that reads Course/Lesson content (US2), per `/speckit-analyze` finding I1 — access control does not get deferred to a later "capstone" phase
- A Student's `student_tier_progress` row does not exist for a given `(student, courseOwnerId)` until they're enrolled in that owner's Tier sequence (FR-024); no row means zero access to any Sequential-Locked Course under that owner, including the entry Tier. Enrollment creates the row at that owner's lowest Tier `order` — there is no "rank 0" state
- `courseOwnerId` on `Courses`/`Tiers`/`student_tier_progress` is a **placeholder only** (fixed default `"academy"`) — no tenant isolation, no "Course Owners" collection, no access-control logic consults it in this feature (research.md #12, FR-028); do not build any of that speculatively during implementation
- `DATABASE_URL` (Supabase Postgres, already used by Payload's postgres adapter) is reused as-is — no new database instance

**Scale/Scope**: 1 Course Owner (Academy) with ~8 Tiers, low tens of Courses, tens of Modules, low hundreds of Lessons; student base same order of magnitude as existing customer base (per `001-customer-recording-library`, hundreds of active students)

## Constitution Check

*No project constitution is in effect (`.specify/memory/constitution.md` is still template placeholders). No gates to evaluate.*

## Project Structure

### Documentation (this feature)

```text
specs/004-course-lesson-management/
├── plan.md              # This file
├── research.md          # Phase 0 — 12 resolved decisions (incl. 2 post-analyze, 1 post-clarify addenda)
├── data-model.md         # Phase 1 — Payload collections + Supabase tables
├── contracts/
│   ├── payload-collections.md   # Payload collection schemas (Tiers, Courses ext., Modules, Lessons, Assignments, QuizQuestions)
│   ├── supabase-schema.md       # SQL DDL for runtime tables, RLS policies
│   └── server-actions.md        # TypeScript function signatures (authoring + student + coach-review actions)
├── quickstart.md         # Phase 1 — validation scenarios
└── tasks.md              # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# New Payload collections
collections/
├── Tiers.ts                             # NEW — name, description, order, courseOwnerId (placeholder); research.md #12
├── Courses.ts                          # MODIFIED — add courseCategory (sequential-locked/standalone) + conditional `tier` relationship (replaces beltLevel, required+unique only for sequential-locked category, validated in course-actions.ts) + placeholder courseOwnerId, reorder access rules
├── CourseModules.ts                    # NEW — belongs to Course, order field
├── Lessons.ts                          # NEW — belongs to Module, contentType (video/audio/text-image), order field
├── Assignments.ts                      # NEW — belongs to Lesson or Module (or Course, for final-assessment), type (video-response/quiz/final-assessment)
└── QuizQuestions.ts                    # NEW — belongs to a quiz-type Assignment

# Modified
payload.config.ts                       # Register new collections (incl. Tiers); add @payloadcms/storage-s3 plugin for `media`

# New Next.js app routes — Coach/Staff authoring
src/app/staff/tiers/
└── page.tsx                            # Define/reorder Tiers for the (single, placeholder) Course Owner — must exist before a Sequential-Locked Course can reference one

src/app/staff/courses/
├── page.tsx                            # Course list (Tier/category, status)
├── new/page.tsx                        # Create course
├── [courseId]/page.tsx                 # Course detail — modules list, add module
├── [courseId]/modules/[moduleId]/page.tsx        # Module detail — lessons list, add lesson
├── [courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx   # Lesson editor (content + attached assignment/quiz)
└── [courseId]/final-assessment/page.tsx  # Configure the course's single final assessment (Sequential-Locked Courses only)

# New Next.js app routes — Coach review queue
src/app/staff/submissions/
├── page.tsx                            # Pending/reviewed submissions list, filterable
└── [submissionId]/page.tsx             # Review a submission — video/quiz answers + leave feedback, pass/fail (final assessment only)

# New Next.js app routes — Student experience
src/app/customer/[id]/courses/
├── page.tsx                            # Catalog filtered to accessible Courses only, via isCourseAccessible (FR-006) — enforced from US2 onward, not deferred
├── [courseId]/page.tsx                 # Denies/redirects if !isCourseAccessible; Modules + progress within a course
├── [courseId]/modules/[moduleId]/page.tsx        # Lessons list + optional coach Module Feedback (FR-023)
├── [courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx  # Lesson viewer, mark-complete, attached assignment/quiz
└── [courseId]/final-assessment/page.tsx  # Submit the course's final assessment video (Sequential-Locked Courses only)

# New libs
src/lib/courses/
├── payload-client.ts                    # Thin wrapper around Payload's Local API (getPayload)
├── course-queries.ts                    # listCourses, getCourseTree
├── tier-actions.ts                      # NEW — createTier/updateTier/deleteTier/reorderTier/listTiers (server actions, staff-role gated, research.md #12)
└── course-actions.ts                    # createCourse/Module/Lesson/Assignment (server actions, staff-role gated)

src/lib/progress/
├── lesson-completions.ts                # markLessonComplete, getLessonCompletions (Supabase, RLS-scoped)
├── submissions.ts                       # createSubmission, listSubmissions, reviewSubmission
├── tier-progress.ts                     # RENAMED from belt-progress.ts (research.md #12). FOUNDATIONAL: getStudentTierProgress, isCourseUnlocked (read); advanceTier added in US5 (write, FR-021)
├── course-access.ts                     # FOUNDATIONAL, NEW — isCourseAccessible(studentId, course): branches sequential-locked (isCourseUnlocked) vs standalone (course_enrollments lookup) (FR-006)
├── enrollment.ts                        # FOUNDATIONAL, NEW — enrollStudentInTierSequence (FR-024), enrollStudentInCourse (FR-025), staff-role gated (FR-026)
└── module-feedback.ts                   # leaveModuleFeedback, getModuleFeedback (FR-023)

src/lib/storage/
└── minio.ts                             # S3 client config + createPresignedUploadUrl(), shared by submissions/feedback uploads
```

**Structure Decision**: Single Next.js application (existing `Option 1`-style monolith, no separate backend). Authored curriculum content lives in Payload collections (reusing the existing Payload+Postgres setup); per-student runtime state lives in new Supabase tables (reusing the existing Supabase+RLS setup from `002`/`003`). No new services or repos — this feature only adds collections, tables, routes, and libs to the current codebase.

## Complexity Tracking

*No constitution gates to violate — table intentionally omitted.*
