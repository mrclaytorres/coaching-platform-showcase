# Tasks: Course & Lesson Curriculum Management

**Input**: Design documents from `specs/004-course-lesson-management/`

**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/ ✅, research.md ✅, quickstart.md ✅

**Tests**: Not requested — manual validation via quickstart.md (Scenarios 0a, 0b + 5 numbered scenarios), consistent with `003-roles-admin-staff`.

**Organization**: Tasks grouped by user story (US1–US4 from spec.md, plus US5 covering the final-assessment/Tier-progression requirements FR-020–FR-021/FR-024 added during clarification). **Revision history**:
- v2 restructured Phase 2 (Foundational) and Phase 4 (US2) per `/speckit-analyze` findings I1 and U1 — access control moved to Foundational; Course/Module/Lesson edit/delete/reorder added to US1.
- v3 generalizes "Belt Course" → **Sequential-Locked Course** and the fixed 8-belt enum → a Course-Owner-scoped **Tier** entity, and adds a placeholder `courseOwnerId` field to Course/Tier, per the second `/speckit-clarify` session (research.md #12). `belt-progress.ts` → `tier-progress.ts`; `student_belt_progress` → `student_tier_progress`; new `Tiers` Payload collection and `tier-actions.ts` added to Foundational/US1.
- v4 (this version) adds **Phase 9**, capturing fixes made after Phases 1–8 were run against a real dev environment for the first time: Payload/Postgres production-readiness (config bug, dev-push vs. migrations, pooler connectivity, `idType`), a Super Admin/Staff/Coach course-authoring permission split that was never specified in the original phases, loading states on every Create/Edit button, and a missing Lesson media upload UX. T003 and T011 (previously unchecked manual steps) are also now confirmed done.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies within the phase)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are exact — adjust nothing unless the project structure changes

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and environment/infra needed before any code changes.

- [X] T001 Add `@payloadcms/storage-s3`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` to `package.json` dependencies; run `npm install`
- [X] T002 [P] Add `MINIO_ENDPOINT`, `MINIO_REGION`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_SUBMISSIONS_BUCKET` to `.env.example` with a comment marking them server-only (never `NEXT_PUBLIC_`)
- [X] T003 [P] ⚠️ MANUAL — Provision a MinIO instance (local Docker or hosted) and create the two buckets referenced by `MINIO_BUCKET` and `MINIO_SUBMISSIONS_BUCKET`; add real values to `.env`/`.env.local`

**Checkpoint**: MinIO reachable, env vars set, new npm packages installed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Payload collections (including the new `Tiers` collection), Supabase schema, and shared libs every user story depends on — **including full access control** (Tier-unlock + Standalone Course enrollment), per `/speckit-analyze` finding I1, so it's enforced from the first story that reads Course content onward, not deferred to a late "capstone" phase.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Create `collections/Tiers.ts` — `name` (text, required), `description` (richText, optional), `order` (number, required — rank within its owner's sequence), `courseOwnerId` (text, required, default `"academy"` — placeholder only, FR-028) per `specs/004-course-lesson-management/contracts/payload-collections.md` (FR-027, research.md #12)
- [X] T005 Modify `collections/Courses.ts` — add required `courseCategory` select (`sequential-locked`/`standalone`), a conditional `tier` relationship (→ `tiers`, shown only when `courseCategory = sequential-locked`, no field-level `unique`/`required` — validated in `course-actions.ts`), and `courseOwnerId` (text, default `"academy"`, placeholder) (FR-001, FR-002, FR-028) — depends on T004
- [X] T006 [P] Create `collections/CourseModules.ts` — `course` relationship (→ `courses`, required), `title` (text, required), `order` (number, required)
- [X] T007 [P] Create `collections/Lessons.ts` — `module` relationship (→ `course-modules`, required), `title`, `order`, `contentType` select (`video`/`audio`/`text-image`), conditional `videoUrl`/`audioUrl`/`body` fields, `isPublished` checkbox (default false, FR-019)
- [X] T008 [P] Create `collections/Assignments.ts` — `type` select (`video-response`/`quiz`/`final-assessment`), `attachedToLesson` relationship (→ `lessons`), `attachedToModule` relationship (→ `course-modules`), `course` relationship (→ `courses`, shown only when type is `final-assessment`), `title`, `instructions` richText
- [X] T009 [P] Create `collections/QuizQuestions.ts` — `assignment` relationship (→ `assignments`, required), `order`, `questionType` select (`multiple-choice`/`open-ended`), `prompt`, `options` array, `correctOptionIndex`, `required` checkbox (default true, FR-013)
- [X] T010 Update `payload.config.ts` — register `Tiers`, `CourseModules`, `Lessons`, `Assignments`, `QuizQuestions` in the `collections` array; add the `s3Storage` plugin from `@payloadcms/storage-s3` for the `media` collection, configured from the `MINIO_*` env vars with `forcePathStyle: true` (depends on T004–T009)
- [X] T011 ⚠️ MANUAL — Apply SQL in the Supabase SQL Editor per `specs/004-course-lesson-management/contracts/supabase-schema.md`, in dependency order: (1) `lesson_completions`, (2) `submissions`, (3) `quiz_responses`, (4) `module_feedback`, (5) `student_tier_progress` (composite pk `student_id, course_owner_id`; no default rank), (6) `course_enrollments` — each with RLS enabled and the listed policies
- [X] T012 [P] Create `src/lib/courses/payload-client.ts` — `getPayloadClient()` wrapping `getPayload({ config })`
- [X] T013 [P] Create `src/lib/storage/minio.ts` — S3 client from `MINIO_*` env vars; `createPresignedUploadUrl({ bucket, keyPrefix, contentType }): Promise<{ uploadUrl, publicUrl }>` with a 5-minute expiry
- [X] T014 [P] Add `requireStaffRole(allowedRoles: StaffRole[])` to `src/lib/auth/staff-profile.ts` — server-only helper using `getUser()` + `getStaffProfile()`, mirroring the role checks already in `src/app/staff/layout.tsx`/`src/app/admin/layout.tsx`; throws/redirects when the caller's role isn't in `allowedRoles`
- [X] T015 [P] Create `src/lib/progress/tier-progress.ts` (read-only here; `advanceTier` added in US5) — `getStudentTierProgress(studentId, courseOwnerId): Promise<{currentTierRank:number}|null>`, `isCourseUnlocked(studentId, tier: {order, courseOwnerId}): Promise<boolean>` — `false` when no `student_tier_progress` row exists for `(studentId, courseOwnerId)`, else `tier.order <= currentTierRank` (FR-022, FR-024, research.md #8, #12)
- [X] T016 [P] Create `src/lib/progress/course-access.ts` — `isCourseAccessible(studentId, course): Promise<boolean>`: `course.courseCategory === 'sequential-locked'` → delegates to `isCourseUnlocked(studentId, course.tier)`; `'standalone'` → checks for a `course_enrollments` row (FR-006, research.md #8, #12)
- [X] T017 [P] Create `src/lib/progress/enrollment.ts` — `enrollStudentInTierSequence(studentId, courseOwnerId = 'academy')` (idempotent insert into `student_tier_progress` at that owner's **lowest `order`** Tier — looked up via `listTiers`, not hardcoded — FR-024), `enrollStudentInCourse(studentId, courseId)` (insert into `course_enrollments`, throws if the Course isn't `courseCategory = 'standalone'`, FR-025); both staff-role gated via `requireStaffRole` (FR-026)

**Checkpoint**: `npm run typecheck` passes; Payload admin shows `Tiers` + the 4 other new collections; Supabase has the 6 new tables with RLS; `isCourseAccessible`/enrollment functions are importable and enforce access from the very first story onward. Run quickstart.md **Scenario 0a** (Tier setup) then **Scenario 0b** (enrollment) now, before starting US1.

---

## Phase 3: User Story 1 — Coach Builds a Course Curriculum (Priority: P1) 🎯 MVP

**Goal**: A Coach can define an ordered Tier sequence, then create a Sequential-Locked or Standalone Course, add Modules, add Lessons (video/audio/text-image), and edit/reorder/delete any of them.

**Independent Test**: Define 8 Tiers; create a Sequential-Locked Course tied to one, add 2 Modules, add 3 Lessons (one per content type) to the first Module; reload and confirm the full structure appears in order; edit and reorder a Lesson; delete a Lesson that has a completion record and confirm the record survives (see quickstart.md Scenarios 0a and 1).

- [X] T018 [P] [US1] Create `src/lib/courses/tier-actions.ts` — `createTier(input)` (staff-role gated; throws if `order` already used by another Tier for the same `courseOwnerId` — FR-027), `updateTier(tierId, updates)`, `deleteTier(tierId)` (throws if any Course still references it), `reorderTier(tierId, newOrder)`, `listTiers(courseOwnerId = 'academy')` (ordered by `order` ascending)
- [X] T019 [P] [US1] Create `src/app/staff/tiers/page.tsx` — list/create/edit/reorder Tiers for the (single, placeholder) Course Owner, via `tier-actions.ts`
- [X] T020 [P] [US1] Create `src/lib/courses/course-queries.ts` — `listCourses()`, `getCourseTree(courseId)` (Course + ordered Modules + ordered Lessons, with `tier` populated for `sequential-locked` Courses)
- [X] T021 [US1] Create `src/lib/courses/course-actions.ts` — `createCourse(input)` (staff-role gated; validates `tierId` required+unique only when `courseCategory === 'sequential-locked'` — FR-001, FR-002), `createModule(input)`, `createLesson(input)` (depends on T012, T014, T018, T020)
- [X] T022 [US1] Extend `src/lib/courses/course-actions.ts` — `updateCourse(courseId, updates)`, `deleteCourse(courseId)`, `updateModule(moduleId, updates)`, `deleteModule(moduleId)`, `reorderModule(moduleId, newOrder)`, `updateLesson(lessonId, updates)`, `deleteLesson(lessonId)`, `reorderLesson(lessonId, newOrder)` — all staff-role gated; deletes never touch `lesson_completions`/`submissions`/`course_enrollments` rows (FR-001, FR-003, FR-004, FR-018, research.md #9)
- [X] T023 [P] [US1] Create `src/app/staff/courses/page.tsx` — list Courses with category/Tier + status, via `listCourses()`
- [X] T024 [P] [US1] Create `src/app/staff/courses/new/page.tsx` — form with `courseCategory` choice; Tier picker (from `listTiers()`) shown only for Sequential-Locked Courses; surfaces Tier-uniqueness error inline (US1 Scenario 5)
- [X] T025 [US1] Create `src/app/staff/courses/[courseId]/page.tsx` — Course detail: edit/delete Course, ordered Modules list + Add/Edit/Delete/Reorder Module actions
- [X] T026 [US1] Create `src/app/staff/courses/[courseId]/modules/[moduleId]/page.tsx` — Module detail: edit/delete Module, ordered Lessons list + Add/Edit/Delete/Reorder Lesson actions
- [X] T027 [US1] Create `src/app/staff/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx` — Lesson editor: edit title/order/content, delete, reorder within Module (FR-004), backed by T022

**Checkpoint**: Coach can define Tiers, then build, edit, reorder, and delete a full Course → Modules → Lessons tree end-to-end, for both Sequential-Locked and Standalone Courses.

---

## Phase 4: User Story 2 — Student Progresses Through Lessons (Priority: P2)

**Goal**: A Student can view only the Courses they have access to (Tier-unlocked or Standalone-enrolled — fully enforced, not deferred), consume Lesson content, and mark Lessons complete with progress persisting.

**Independent Test**: An enrolled Student opens an accessible Course, views a Lesson, marks it complete; reload confirms persistence. A non-enrolled Student is denied access to the same Course by direct URL (see quickstart.md Scenario 2).

- [X] T028 [P] [US2] Create `src/lib/progress/lesson-completions.ts` — `markLessonComplete(studentId, lessonId)` (throws if `isCourseAccessible` is false for the Lesson's Course — FR-006), `getLessonCompletions(studentId, moduleId)` against the `lesson_completions` Supabase table (RLS-scoped, not service role) (FR-007, FR-008)
- [X] T029 [US2] Create `src/app/customer/[id]/courses/page.tsx` — catalog showing **only** Courses where `isCourseAccessible(studentId, course)` is true, for both Sequential-Locked and Standalone Courses (FR-006) — real enforcement from this task onward, not deferred
- [X] T030 [US2] Create `src/app/customer/[id]/courses/[courseId]/page.tsx` — denies/redirects if `!isCourseAccessible`; Modules list with per-module completion count via `getLessonCompletions` (FR-008)
- [X] T031 [US2] Create `src/app/customer/[id]/courses/[courseId]/modules/[moduleId]/page.tsx` — Lessons list; hides Lessons where `isPublished = false` (FR-019)
- [X] T032 [US2] Create `src/app/customer/[id]/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx` — Lesson viewer (video/audio player or rich text) + "Mark Complete" button wired to `markLessonComplete` (FR-006, FR-007)

**Checkpoint**: Student can browse only accessible Courses, consume Lessons by content type, and progress persists across sessions; inaccessible Courses are denied for both Sequential-Locked and Standalone types.

---

## Phase 5: User Story 3 — Coach Creates Assignments and Quizzes, Student Responds (Priority: P3)

**Goal**: A Coach attaches a video-response Assignment or Quiz to a Lesson/Module; a Student submits a video or answers.

**Independent Test**: Coach creates a 2-question quiz on a Lesson; Student answers and submits; Coach sees the answers. Separately, Coach creates a video-response Assignment; Student uploads a video; Coach sees the submission (see quickstart.md Scenario 3).

- [X] T033 [P] [US3] Extend `src/lib/courses/course-actions.ts` — add `createAssignment(input)` (validates exactly one of `attachedToLesson`/`attachedToModule` set for `video-response`/`quiz` types, staff-role gated — research.md #11, finding U2) and `createQuizQuestion(input)` (staff-role gated)
- [X] T034 [US3] Add Assignment/Quiz builder UI to `src/app/staff/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx` — form to attach a video-response Assignment or a Quiz with N questions (FR-009, FR-010)
- [X] T035 [P] [US3] Create `src/lib/progress/submissions.ts` — `createVideoSubmission(studentId, assignmentId, videoUrl)`, `submitQuiz(studentId, assignmentId, answers)` — both throw if `isCourseAccessible` is false for the Assignment's Course; blocks on missing `required` answers (FR-013); auto-scores multiple-choice questions via `getPayloadClient()` lookup (research.md #7)
- [X] T036 [US3] Add Assignment/Quiz display + submission UI to the student Lesson viewer (`src/app/customer/[id]/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx`) — video upload widget (via `createPresignedUploadUrl`) for video-response type, quiz form for quiz type; shows the prior submission/status on revisit rather than a blank form (US3 Scenario 5)

**Checkpoint**: Coach can attach assignments/quizzes; Student can submit a video or quiz answers and sees status on return; access-denied enforced for non-enrolled Students.

---

## Phase 6: User Story 4 — Coach Reviews Submissions and Gives Feedback (Priority: P4)

**Goal**: A Coach reviews Student submissions (video feedback for video-response, comments for quizzes) and can optionally leave general Module-level feedback (FR-023).

**Independent Test**: Coach opens a pending video-response submission, uploads a feedback video, marks it reviewed; Student sees the feedback video. Coach also leaves optional Module Feedback for a Student outside any Assignment (see quickstart.md Scenario 4).

- [X] T037 [P] [US4] Extend `src/lib/progress/submissions.ts` — add `listSubmissions({ courseId?, status? })` and `reviewSubmission(submissionId, { feedbackVideoUrl?, feedbackComment?, outcome? })`, both staff-role gated (FR-014, FR-015, FR-016)
- [X] T038 [P] [US4] Create `src/lib/progress/module-feedback.ts` — `leaveModuleFeedback(coachId, studentId, moduleId, input)`, `getModuleFeedback(studentId, moduleId)` (FR-023)
- [X] T039 [US4] Create `src/app/staff/submissions/page.tsx` — pending/reviewed submissions list, filterable, via `listSubmissions`
- [X] T040 [US4] Create `src/app/staff/submissions/[submissionId]/page.tsx` — shows Student's response (video or quiz answers), form to upload feedback video and/or add comments, calls `reviewSubmission`
- [X] T041 [US4] Add optional Module Feedback UI to `src/app/staff/courses/[courseId]/modules/[moduleId]/page.tsx` — Coach picks a Student and leaves text/video feedback via `leaveModuleFeedback`
- [X] T042 [US4] Surface reviewed status/feedback on the student side: update `.../lessons/[lessonId]/page.tsx` to show "Reviewed" label + feedback video/comments (FR-017, FR-018); update `.../modules/[moduleId]/page.tsx` to show any Module Feedback (FR-023)

**Checkpoint**: Coach can review any pending submission and respond; Student sees feedback; Coach can leave optional Module-level feedback.

---

## Phase 7: User Story 5 — Final Assessment & Tier Progression (Priority: P5)

**Goal**: Each Sequential-Locked Course has exactly one Final Assessment activity; passing it (Coach-reviewed) advances the Student's Tier rank and unlocks the next Course in that Tier sequence. (Access control itself — `isCourseUnlocked`/`isCourseAccessible` — already exists from Phase 2; this phase adds only the progression *mechanics*: defining the final assessment and advancing rank on pass.)

**Independent Test**: Student is locked out of the Yellow-tier Course until passing the White-tier Course's final assessment; Coach fails a submission (no advancement, Yellow stays locked); Coach passes a resubmission (Tier rank advances, Yellow unlocks) (see quickstart.md Scenario 5).

- [X] T043 [US5] Extend `src/lib/courses/course-actions.ts` `createAssignment` — block creating a second `type: 'final-assessment'` Assignment on the same `course`, and block it entirely for `courseCategory = 'standalone'` Courses (research.md #6, FR-020)
- [X] T044 [US5] Create `src/app/staff/courses/[courseId]/final-assessment/page.tsx` — Coach configures the Sequential-Locked Course's single Final Assessment Assignment
- [X] T045 [US5] Create `src/app/customer/[id]/courses/[courseId]/final-assessment/page.tsx` — Student submits the final assessment video via `createVideoSubmission`
- [X] T046 [US5] Extend `src/lib/progress/tier-progress.ts` with `advanceTier(studentId, courseOwnerId, newRank)` (service-role write); update `src/lib/progress/submissions.ts` `reviewSubmission()` — when reviewing a `final-assessment` Submission with `outcome: 'pass'`, resolve the Course's `tier.order + 1`/`courseOwnerId` and call `advanceTier(...)` (FR-021)

**Checkpoint**: Coach can define one final assessment per Sequential-Locked Course; passing it advances the Student's Tier rank and unlocks the next Course (access-control plumbing was already enforced since Phase 2).

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T047 [P] Add current Tier + accessible-course list to the Student dashboard/nav (SC-005)
- [X] T048 [P] Add a "next unlocked course" indicator to `src/app/customer/[id]/courses/page.tsx` (SC-005)
- [ ] T049 Run `npm run typecheck` and `npm run lint` across all new/modified files — `npm run typecheck` passes clean as of 2026-07-08; `npm run lint` still blocked by no ESLint config existing anywhere in this repo (pre-existing gap, not introduced by this feature — needs a one-time interactive `next lint` setup or a hand-written `.eslintrc`)
- [ ] T050 Execute quickstart.md Scenarios 0a, 0b, and all 5 numbered scenarios end-to-end

---

## Phase 9: Post-Implementation Fixes & Hardening (2026-07-08)

**Purpose**: Issues found only after Phase 1–8 code existed and was actually run against a real dev environment/browser for the first time — Payload had never successfully booted against the database until this session, and two real functional gaps (role access, Lesson media upload) surfaced from manual testing. Captured here rather than silently folded into earlier phases so the history of what broke and why is preserved.

- [X] T051 [P] Fix `payload.config.ts` — removed the invalid `admin.user: 'users'` config (no `users` collection was ever registered, so Payload's config sanitizer threw `InvalidConfiguration` on every boot); disabled dev auto-push (`push: false`) since Supabase's Session pooler cannot execute drizzle-kit's live schema-diff introspection query (`there is no parameter $1` / `42P02`); set `idType: 'uuid'` on the Postgres adapter so Payload document ids match the string typing already assumed throughout `course-actions.ts`/`course-queries.ts`/`tier-actions.ts` (default is auto-incrementing integer ids, which would have broken all of it)
- [X] T052 [P] Switched schema management from dev auto-push to explicit migrations — added `"type": "module"` to `package.json` (required for the Payload CLI's config loader to avoid `ERR_REQUIRE_ASYNC_MODULE`), added a `payload` npm script, generated + applied the initial migration (`src/migrations/`) — see `docs/payload-setup.md`
- [X] T053 [P] Switched local dev `DATABASE_URL` to Supabase's Session pooler connection string — the Direct connection host is IPv6-only and unreachable from this dev machine (no IPv6 route, confirmed via WSL2 mirrored-networking test); documented in `docs/supabase-setup.md`
- [X] T054 [P] Added `docs/payload-setup.md` and `docs/production-deployment.md`; fixed the stale "PayloadCMS Admin Panel" section in `docs/supabase-setup.md` and the `lesson-media`-stays-private guidance in `docs/minio-setup.md` (superseded by T058)
- [X] T055 Split staff-role permissions for course authoring, since `super_admin` had no way to reach course tools at all and `coach` had unrestricted structural CRUD, neither of which was intended: `super_admin`/`staff` now get full Tier/Course/Module/Lesson CRUD + enrollment management (`requireStaffRole(['super_admin', 'staff'])`); `coach` is restricted to Assignment/QuizQuestion creation, Submission review, and Module feedback (`requireStaffRole(['super_admin', 'staff', 'coach'])`) — updated call sites across `tier-actions.ts`, `course-actions.ts`, `enrollment.ts`, `submissions.ts`, `module-feedback.ts`; hid the now-restricted edit/delete forms from the Coach role in `/staff/courses/*` pages (`canManageStructure` flag)
- [X] T056 Let `super_admin` reach `/staff/*` — `src/app/staff/layout.tsx` previously hard-redirected `super_admin` straight to `/admin/dashboard`, so Tiers/Courses/Submissions were completely unreachable for that role; removed the redirect, added role-aware nav filtering to `StaffSidebar.tsx` (hides Tiers from Coach), and cross-links between `AdminSidebar.tsx` and the staff pages
- [X] T057 [P] Added `src/components/SubmitButton.tsx` — shared loading-spinner/disabled-state button (via `useFormStatus`, with an explicit `pending` prop override for the few forms that submit manually instead of via a native form action) — applied to every Create/Edit/Save/Add/Submit-type button across the app (Tiers, Courses, Modules, Lessons, Assignments, Quiz Questions, staff invites, role changes, module/submission feedback, student lesson completion, quiz/assignment submission). Standing convention going forward — see project memory.
- [X] T058 [US1] Fixed missing Lesson media upload — "Add a Lesson"/the Lesson editor only ever had a plain textarea asking the Coach to paste a video/audio URL, with no way to actually get one; completes the upload UX that T007/T027 implied but never built. New `AddLessonForm.tsx` and `EditLessonForm.tsx` client components upload video/audio files directly to MinIO (`lesson-media` bucket, now made public-read to match `submission-media`) via the existing presigned-PUT pattern, replacing the manual URL paste; Add/Save buttons stay disabled until the upload completes

**Checkpoint**: Payload boots cleanly against Supabase Postgres via the Session pooler; schema changes go through migrations, not dev auto-push; Super Admin, Staff, and Coach each have the intended level of course-authoring access; every Create/Edit action shows a loading state; Coaches can actually upload Lesson video/audio instead of hand-typing a URL that nothing ever provided.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. Now includes the `Tiers` collection, full access-control (Tier-unlock + Standalone enrollment), and manual enrollment actions, since every subsequent story needs all of these to be tested meaningfully and correctly (per `/speckit-analyze` finding I1 and the Tier generalization in research.md #12)
- **US1 (Phase 3)**: Depends on Foundational only. Includes Tier CRUD (T018–T019) since a Coach must define Tiers before creating a Sequential-Locked Course
- **US2 (Phase 4)**: Depends on Foundational (specifically T015–T017); enforces FR-006 correctly from this phase onward, not deferred
- **US3 (Phase 5)**: Depends on Foundational + US1 (Lessons/Modules must exist to attach Assignments to)
- **US4 (Phase 6)**: Depends on Foundational + US3 (reviews submissions created in US3)
- **US5 (Phase 7)**: Depends on Foundational + US1 (Courses/Tiers) + US3/US4 (Assignment/Submission review plumbing, which it extends) — but NOT responsible for access control itself, only progression mechanics
- **Polish (Phase 8)**: Depends on all desired stories being complete

### Within Each User Story

- Libs (`src/lib/...`) before pages that call them
- Tier CRUD (T018–T019) before Course CRUD (T021+) within US1, since Course creation needs `listTiers()` for its Tier picker
- Coach-authoring pages (US1, US3 builder UI) before the student-facing consumption of that same content (US2, US3 submission UI) — though the code itself has no hard import dependency, only a data dependency

### Parallel Opportunities

- All `[P]` tasks within Phase 1 and Phase 2 can run in parallel
- Within Phase 2: T006–T009 (collection files, after T004/T005) are independent of each other; T012–T017 (shared libs, including the access-control/enrollment libs) are independent of each other and of T006–T009
- Once Phase 2 completes: US1 can start immediately; US2 can start in parallel with US1 (different files) but needs US1-created data and Phase 2's access-control libs for a meaningful manual test
- US3 and US4 have a real code dependency (US4 reviews what US3 creates) and should be done in order
- US5 should be done last since it extends `course-actions.ts`, `tier-progress.ts`, and `submissions.ts` from US1/US3/US4

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch independent Payload collection files together (after T004/T005):
Task: "Create collections/CourseModules.ts"
Task: "Create collections/Lessons.ts"
Task: "Create collections/Assignments.ts"
Task: "Create collections/QuizQuestions.ts"

# Launch independent shared-lib files together:
Task: "Create src/lib/courses/payload-client.ts"
Task: "Create src/lib/storage/minio.ts"
Task: "Add requireStaffRole() to src/lib/auth/staff-profile.ts"
Task: "Create src/lib/progress/tier-progress.ts (read-only)"
Task: "Create src/lib/progress/course-access.ts"
Task: "Create src/lib/progress/enrollment.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories; validate with quickstart.md Scenario 0b)
3. Complete Phase 3: US1 — Coach can define Tiers and build a full Course (validate with quickstart.md Scenario 0a, then 1)
4. **STOP and VALIDATE**: Run quickstart.md Scenarios 0a and 1
5. Demo the curriculum-authoring experience to stakeholders

### Incremental Delivery

1. Setup + Foundational → schema, access control, and enrollment actions ready and enforced
2. US1 → Coaches can define Tiers and author (and edit/delete/reorder) Course content → demo
3. US2 → Students can consume content, correctly gated by access, and track progress → demo
4. US3 → Assignments/quizzes + submissions → demo
5. US4 → Coach review/feedback loop closes → demo
6. US5 → Final assessment + Tier progression mechanics, the capstone tying it all together → demo
7. Polish → dashboard/nav Tier display, full quickstart validation

---

## Notes

- No automated tests requested for this feature — validate via `quickstart.md`'s scenarios, consistent with `003-roles-admin-staff`
- `[P]` tasks touch different files with no dependency on incomplete same-phase work
- US5 was not one of the four original spec.md user stories — it packages the final-assessment/Tier-progression *mechanics* (FR-020, FR-021) into its own independently testable phase; the *access-control* half of what was originally bundled into "US5" (FR-006, FR-022, FR-024) lives in Foundational per `/speckit-analyze` finding I1
- This revision resolves `/speckit-analyze` findings I1/U1 (and the smaller U2/A1/A2), **and** generalizes "Belt Course"/fixed-8-belt-enum into "Sequential-Locked Course"/Course-Owner-scoped `Tier` entity plus a placeholder `courseOwnerId` field, per the second `/speckit-clarify` session (research.md #12) — this is *not* a multi-tenancy implementation, just data-model preparation for one
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
