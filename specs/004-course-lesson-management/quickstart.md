# Quickstart: Course & Lesson Curriculum Management

## Prerequisites

- Existing `.env`/`.env.local` values (Supabase, `DATABASE_URL`, `PAYLOAD_SECRET`) already configured
- New env vars: `MINIO_ENDPOINT`, `MINIO_REGION`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` (lesson media), `MINIO_SUBMISSIONS_BUCKET` (student/coach runtime uploads)
- A running MinIO instance (local Docker container or hosted) with the two buckets created
- At least one seeded Coach account (per `003-roles-admin-staff` quickstart) and one Customer/Student account (per `001`/`002`)
- `npm install` to pull `@payloadcms/storage-s3`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- `npm run dev`

## Scenario 0a — Define the Tier sequence (Foundational, US1 prerequisite)

1. As Coach, navigate to `/staff/tiers` → create 8 Tiers for the default Course Owner (`academy`): White (order 1), Yellow (2), Orange (3), Green (4), Blue (5), Red (6), Purple (7), Brown (8) (FR-027)
2. Attempt to create a 9th Tier at `order = 3` (colliding with Orange) → expect a blocked/error response (research.md #12)
3. Reorder a Tier and confirm the new order persists

## Scenario 0b — Enrollment (Foundational — must pass before any other scenario)

1. As Coach, use `enrollStudentInTierSequence` on the test Student (defaults to Course Owner `academy`) → confirm a `student_tier_progress` row is created at `current_tier_rank = 1` (White's order) (FR-024)
2. As that Student, attempt to open a Sequential-Locked Course tied to the White Tier → confirm access is granted
3. Create a second, un-enrolled test Student → attempt to open the same White-tier Course → confirm access is **denied** (no `student_tier_progress` row for `(student, 'academy')` = no access, not even the entry Tier) (FR-006, FR-022)
4. Create a Standalone Course (e.g., "Voice Repair Basics", `courseCategory = standalone`, no Tier) → as the un-enrolled Student, attempt to open it → confirm denied
5. As Coach, use `enrollStudentInCourse` to enroll that Student in the Standalone Course → confirm they can now open it, while still being denied any Sequential-Locked Course (FR-025)

## Scenario 1 — Coach builds a course (US1, FR-001–FR-005, FR-018, FR-027)

1. Log in as Coach → navigate to `/staff/courses/new`
2. Create a Course titled "White Belt Basics", `courseCategory = sequential-locked`, `tier = White` (from Scenario 0a)
3. Attempt to create a second Course also tied to the White Tier → expect a blocked/error response (FR-002)
4. Create a Course with `courseCategory = standalone` and confirm no Tier field is required/shown
5. Add two Modules to the White-tier course
6. Add three Lessons to the first Module: one `video`, one `audio`, one `text-image`
7. Reload `/staff/courses/[id]` → confirm both Modules and all three Lessons appear in the order created
8. Edit a Lesson's title and reorder it within the Module → confirm the change and new order persist (FR-004)
9. Delete a Lesson that a Student has already marked complete → confirm the Lesson disappears from the Module for Students, but the Student's historical completion record still exists (FR-018)

## Scenario 2 — Student progresses through lessons (US2, FR-006–FR-008, FR-019)

1. Leave one Lesson's `isPublished = false` → log in as the enrolled Student → confirm that Lesson does not appear (FR-019)
2. Publish the Lesson → confirm it now appears
3. As Student, open a Lesson, mark it complete → reload → confirm status persists (FR-007)
4. Confirm the Module view shows a completion count (e.g., "1/3 complete") (FR-008)
5. As the un-enrolled Student from Scenario 0b, attempt to open this Course directly by URL → expect access denied (FR-006) — this must already work here, not only after Scenario 5/US5

## Scenario 3 — Assignments and quizzes (US3, FR-009–FR-013)

1. As Coach, add a `video-response` Assignment to a Lesson
2. As Student, open the Lesson → see the upload prompt → upload a video → submit → confirm status "awaiting review" (FR-011)
3. As Coach, add a `quiz` Assignment with 2 questions (one multiple-choice, one open-ended), both `required = true`
4. As Student, attempt to submit with one question blank → expect blocked with the missing question highlighted (FR-013)
5. Answer both, submit → confirm quiz marked submitted (FR-012)
6. Revisit the quiz as the same Student → confirm previous answers/status shown, not a blank form (US3 Scenario 5)
7. As the un-enrolled Student, attempt to submit to this Course's assignment via direct action call → expect denied (defense in depth, research.md #10)

## Scenario 4 — Review and feedback (US4, FR-014–FR-018, FR-023)

1. As Coach, open `/staff/submissions` → filter to Pending → open the video-response submission from Scenario 3
2. Upload a feedback video, mark reviewed (FR-015) → confirm Student now sees "Reviewed" and the feedback video (FR-017, FR-018)
3. Filter the same list to "Reviewed" → confirm it now appears there and not under Pending (FR-014)
4. Open the quiz submission → add a written comment, mark reviewed (FR-016) → confirm Student sees the comment
5. As Coach, open a Student's Module page → leave optional Module Feedback (text + video) without any specific Assignment involved → confirm it appears to the Student and does not affect Lesson completion or Tier progression (FR-023)

## Scenario 5 — Final assessment and Tier progression (US5, FR-020–FR-022, FR-024)

1. As Coach, on the White-tier course, create the single Final Assessment activity (`type: final-assessment`) → attempt to create a second one on the same course → expect blocked (research.md #6)
2. Attempt to create a Final Assessment on the Standalone Course from Scenario 0b → expect blocked (Standalone Courses don't participate in Tier progression, FR-020)
3. Create a second Course tied to the Yellow Tier → as the Scenario-0b enrolled Student (currently `current_tier_rank = 1`, White's order), attempt to open the Yellow-tier course → expect locked/denied (FR-022)
4. As Student, submit the White-tier final assessment video
5. As Coach, review it and mark `outcome = fail` → confirm Student's Tier rank does NOT advance and the Yellow-tier course remains locked (FR-021)
6. As Coach, review a resubmission and mark `outcome = pass` → confirm Student's `current_tier_rank` becomes 2 (Yellow's order) and the Yellow-tier course is now unlocked (FR-021, FR-022)

## Expected end state

- 8 Tiers defined for Course Owner `academy` (White…Brown), 3 Courses: one per White/Yellow Tier (White fully built with Modules/Lessons/Assignments/Final Assessment) and a Standalone "Voice Repair Basics" course
- 1 enrolled Student advanced from Tier rank 1 (White) → 2 (Yellow), having completed lessons, submitted a video-response assignment and a quiz, received Coach feedback on both plus optional Module Feedback, passed the White-tier final assessment, and separately been granted access to the Standalone course
- 1 never-enrolled Student confirmed denied access to every Course (Sequential-Locked and Standalone alike) throughout
