# Contract: Server Actions / Library Functions

## `src/lib/courses/payload-client.ts`

```ts
export async function getPayloadClient(): Promise<Payload>; // wraps getPayload({ config })
```

## `src/lib/courses/course-queries.ts`

```ts
export async function listCourses(): Promise<CourseSummary[]>;
export async function getCourseTree(courseId: string): Promise<CourseWithModulesAndLessons>;
// BELT_ORDER/beltRank removed (research.md #12) — Tier order now comes from the Tiers Payload
// collection (see tier-actions.ts below), not a static enum
```

## `src/lib/courses/tier-actions.ts` (server actions, staff-role gated — NEW, research.md #12)

```ts
export async function createTier(input: { name: string; description?: unknown; order: number; courseOwnerId?: string }): Promise<{ id: string }>;
// courseOwnerId defaults to 'academy'; throws if `order` already used by another Tier for the same courseOwnerId (FR-027)
export async function updateTier(tierId: string, updates: Partial<{ name: string; description: unknown; order: number }>): Promise<void>;
export async function deleteTier(tierId: string): Promise<void>; // throws if any Course still references this Tier
export async function reorderTier(tierId: string, newOrder: number): Promise<void>;
export async function listTiers(courseOwnerId?: string): Promise<TierSummary[]>; // defaults to 'academy', ordered by `order` ascending
```

## `src/lib/courses/course-actions.ts` (server actions, staff-role gated)

```ts
export async function createCourse(input: { title: string; slug: string; courseCategory: 'sequential-locked'|'standalone'; tierId?: string; courseOwnerId?: string }): Promise<{ id: string }>;
// throws if courseCategory === 'sequential-locked' and tierId is missing or already used by another sequential-locked Course (FR-001, FR-002);
// courseOwnerId defaults to 'academy' (placeholder, FR-028)
export async function updateCourse(courseId: string, updates: Partial<{ title: string; slug: string; tierId: string; status: 'draft'|'published' }>): Promise<void>;
// same tier-uniqueness check as createCourse when tierId is being changed (FR-001)
export async function deleteCourse(courseId: string): Promise<void>;
// does not touch lesson_completions/submissions/course_enrollments rows referencing this course's content (FR-018)

export async function createModule(input: { courseId: string; title: string; order: number }): Promise<{ id: string }>;
export async function updateModule(moduleId: string, updates: Partial<{ title: string; order: number }>): Promise<void>;
export async function deleteModule(moduleId: string): Promise<void>; // FR-018 — history preserved
export async function reorderModule(moduleId: string, newOrder: number): Promise<void>;

export async function createLesson(input: { moduleId: string; title: string; order: number; contentType: 'video'|'audio'|'text-image'; content: unknown }): Promise<{ id: string }>;
export async function updateLesson(lessonId: string, updates: Partial<{ title: string; order: number; content: unknown; isPublished: boolean }>): Promise<void>;
export async function deleteLesson(lessonId: string): Promise<void>; // FR-018 — history preserved
export async function reorderLesson(lessonId: string, newOrder: number): Promise<void>;

export async function createAssignment(input: { type: 'video-response'|'quiz'|'final-assessment'; attachedToLessonId?: string; attachedToModuleId?: string; courseId?: string; title: string }): Promise<{ id: string }>;
// throws if type === 'final-assessment' and courseId already has one, or courseId is not a sequential-locked-category Course (research.md #6);
// throws if type !== 'final-assessment' and attachedToLessonId/attachedToModuleId isn't set exactly once (research.md #11, finding U2)

export async function createQuizQuestion(input: { assignmentId: string; order: number; questionType: 'multiple-choice'|'open-ended'; prompt: string; options?: string[]; correctOptionIndex?: number; required?: boolean }): Promise<{ id: string }>;
```

All of the above call `requireStaffRole(['coach', 'staff'])` (helper in `src/lib/auth/staff-profile.ts`, mirroring the existing role check pattern, added in Foundational) before touching Payload.

## `src/lib/progress/lesson-completions.ts`

```ts
export async function markLessonComplete(studentId: string, lessonId: string): Promise<void>;
// throws if isCourseAccessible(studentId, lesson's course) is false (FR-006, FR-022, research.md #10)

export async function getLessonCompletions(studentId: string, moduleId: string): Promise<Record<string, boolean>>;
```

## `src/lib/progress/submissions.ts`

```ts
export async function createVideoSubmission(studentId: string, assignmentId: string, videoUrl: string): Promise<{ id: string }>;
export async function submitQuiz(studentId: string, assignmentId: string, answers: { questionId: string; answerText: string }[]): Promise<{ id: string }>;
// both throw if isCourseAccessible(studentId, assignment's course) is false; auto-scores multiple-choice questions against
// Payload QuizQuestions (research.md #7); submitQuiz throws if a `required` question is missing (FR-013)

export async function listSubmissions(input: { courseId?: string; status?: 'pending'|'reviewed' }): Promise<SubmissionSummary[]>; // staff-role gated (renamed from listPendingSubmissions — research.md #11, finding A1)
export async function reviewSubmission(submissionId: string, input: { feedbackVideoUrl?: string; feedbackComment?: string; outcome?: 'pass'|'fail' }): Promise<void>;
// staff-role gated; when the submission is for a `final-assessment` assignment and outcome === 'pass', calls advanceTier()
```

## `src/lib/progress/tier-progress.ts` (renamed from `belt-progress.ts` — research.md #12; read functions Foundational, `advanceTier` added in US5)

```ts
export async function getStudentTierProgress(studentId: string, courseOwnerId: string): Promise<{ currentTierRank: number } | null>; // null = not enrolled in that owner's Tier sequence
export async function isCourseUnlocked(studentId: string, tier: { order: number; courseOwnerId: string }): Promise<boolean>;
// true iff a student_tier_progress row exists for (studentId, tier.courseOwnerId) AND tier.order <= currentTierRank (FR-022) — no row means false, even for the entry Tier

export async function advanceTier(studentId: string, courseOwnerId: string, newRank: number): Promise<void>; // service-role write, called only from reviewSubmission on pass (FR-021)
```

## `src/lib/progress/course-access.ts` (Foundational, NEW)

```ts
export async function isCourseAccessible(studentId: string, course: { courseCategory: 'sequential-locked'|'standalone'; tier?: { order: number; courseOwnerId: string }; id: string }): Promise<boolean>;
// courseCategory === 'sequential-locked' -> isCourseUnlocked(studentId, course.tier)
// courseCategory === 'standalone' -> exists a course_enrollments row for (studentId, course.id)
// backs FR-006; called from every student-facing course/lesson route AND from lesson-completions.ts/submissions.ts write paths
```

## `src/lib/progress/enrollment.ts` (Foundational, NEW)

```ts
export async function enrollStudentInTierSequence(studentId: string, courseOwnerId?: string): Promise<void>;
// courseOwnerId defaults to 'academy'; idempotent: inserts student_tier_progress at that owner's lowest Tier `order`
// (looked up via listTiers(courseOwnerId), not hardcoded — FR-024); staff-role gated (FR-026)

export async function enrollStudentInCourse(studentId: string, courseId: string): Promise<void>;
// inserts a course_enrollments row; throws if courseId is not a courseCategory = 'standalone' Course (FR-025); staff-role gated (FR-026)
```

## `src/lib/progress/module-feedback.ts`

```ts
export async function leaveModuleFeedback(coachId: string, studentId: string, moduleId: string, input: { comment?: string; videoUrl?: string }): Promise<void>; // FR-023, staff-role gated
export async function getModuleFeedback(studentId: string, moduleId: string): Promise<ModuleFeedback[]>;
```

## `src/lib/storage/minio.ts`

```ts
export async function createPresignedUploadUrl(input: { bucket: 'lesson-media' | 'submission-media'; keyPrefix: string; contentType: string }): Promise<{ uploadUrl: string; publicUrl: string }>;
// used by student submission upload UI and coach feedback-video upload UI; short-lived (e.g. 5 min expiry)
```
