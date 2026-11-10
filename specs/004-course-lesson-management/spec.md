# Feature Specification: Course & Lesson Curriculum Management

**Feature Branch**: `004-course-lesson-management`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Now I want to implement some major features for the app. First off, imagine you are a singing academy that sells singing lessons, you will have a bunch of coaches that will upload singing video lessons for the students. So I will need a feature where the coaches can create Courses, these courses will be then divided into Course modules. Each course modules will have invididual lessons. These lessons can be a video, auto or text/image contents. The students can then marked these lessons as finished. The coaches can also create assignments/activity/quizes for the students. The students can then answer these by uploaded videos or if it is a quiz, can answer those quizzes. At the end of each lesson, the coaches can give a overall final activity and will give a video feedback based on that overall activity. Each course will be it's own belt level, right now we have 8 levels which are these: White (Diaphragmatic Support), Yellow (Open Throat), Orange (Vocal Tract Shaping), Green (Head Voice), Blue (Passaggio & Mixed Voice), Red (Glottal Compression), Purple (Contiguous Phrase Singing), Brown (Hyper Glottal Compression)."

## Clarifications

### Session 2026-07-04

- Q: Should the ordered belt-style tiers remain the fixed 8 singing-specific levels, or become a fully generic/configurable system? → A: Generalize now — replace the fixed 8-belt enum with a configurable, ordered **Tier** entity (arbitrary name + order per sequence). Academy's 8 singing belts become seed data for one Tier sequence, not a hardcoded requirement.
- Q: Should Course get a course-owner/tenant field now to prepare for future whitelisting of other Course owners? → A: Yes — add a placeholder `courseOwnerId` field to Course (single fixed value for Academy today), not used by any access-control/isolation logic yet — that's a separate future feature.
- Q: Should the new Tier entity be scoped per Course Owner, or remain one global ordered list? → A: Scoped per Course Owner — each owner defines and orders their own named Tiers, with the same placeholder `courseOwnerId` field as Course. Academy's 8 belts become one owner's Tier sequence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coach Builds a Course Curriculum (Priority: P1)

A Coach creates a new Course tied to one Tier in an ordered Tier sequence (e.g., Academy's "White — Diaphragmatic Support" tier), then organizes it into Course Modules, and within each Module adds individual Lessons. Each Lesson can contain a video, an audio recording, or text/image content. The Coach can edit, reorder, or remove Modules and Lessons at any time.

**Why this priority**: Nothing else in this feature can exist without a Course to contain it. This is the foundational content-authoring capability every other story builds on.

**Independent Test**: A Coach creates a Course, adds two Modules, and adds three Lessons (one video, one audio, one text/image) to the first Module. Reloading the course as the Coach shows the full structure in the order it was created.

**Acceptance Scenarios**:

1. **Given** a logged-in Coach, **When** they create a new Course and assign it a Tier from the relevant Tier sequence, **Then** the Course is saved and appears in the Coach's course list with its Tier shown.
2. **Given** an existing Course, **When** the Coach adds a Module to it, **Then** the Module appears nested under that Course in the defined order.
3. **Given** an existing Module, **When** the Coach adds a Lesson and selects a content type (video, audio, or text/image), **Then** the Lesson is saved with that content and appears in the Module in order.
4. **Given** an existing Lesson, **When** the Coach edits its content or reorders it within the Module, **Then** the changes are reflected immediately for future viewers.
5. **Given** two Courses, **When** the Coach attempts to assign the same Tier to both, **Then** the system warns that the Tier is already in use by another Course.

---

### User Story 2 - Student Progresses Through Lessons (Priority: P2)

A Student (existing customer account) views the Courses they are enrolled in, opens a Module, and consumes each Lesson (watches the video, listens to the audio, or reads the text/image content). After finishing a Lesson, the Student marks it as complete. Their progress is visible at the Course and Module level.

**Why this priority**: Once content exists, students need to consume it and track progress — this is the core value loop of the academy.

**Independent Test**: A Student opens an enrolled Course, views a Lesson, and marks it complete. Reloading the Course shows that Lesson as completed and updates the Module's completion count.

**Acceptance Scenarios**:

1. **Given** a Student enrolled in a Course, **When** they open a Module, **Then** they see all Lessons in that Module along with each Lesson's completion status.
2. **Given** a Student viewing a Lesson, **When** they mark it as finished, **Then** the Lesson's status updates to complete and persists across sessions.
3. **Given** a Student who has completed some but not all Lessons in a Module, **When** they view the Module, **Then** they see a progress indicator reflecting the number of completed Lessons.
4. **Given** a Student not enrolled in a Course, **When** they attempt to access its Modules or Lessons, **Then** access is denied.

---

### User Story 3 - Coach Creates Assignments and Quizzes, Student Responds (Priority: P3)

A Coach attaches an assignment/activity or a quiz to a Lesson or Module. An assignment/activity requires the Student to upload a video response; a quiz presents questions the Student answers directly in the platform. The Student submits their response, and the submission is recorded for the Coach to review.

**Why this priority**: Practice and assessment are what differentiate an academy from a plain video library, but they depend on Courses/Lessons already existing (US1) and are secondary to the core viewing loop (US2).

**Independent Test**: A Coach creates a quiz with two questions on a Lesson. A Student answers both questions and submits. The Coach can see the Student's submitted answers. Separately, a Coach creates a video-response assignment; a Student uploads a video; the Coach sees the submission listed with a link to the video.

**Acceptance Scenarios**:

1. **Given** a logged-in Coach, **When** they create an assignment on a Lesson or Module and set its type to "video response", **Then** Students attached to that Lesson/Module see a prompt to upload a video answer.
2. **Given** a logged-in Coach, **When** they create a quiz with one or more questions on a Lesson or Module, **Then** Students see the quiz questions and can submit answers.
3. **Given** a Student viewing a video-response assignment, **When** they upload a video and submit, **Then** the submission is saved and marked as awaiting review.
4. **Given** a Student viewing a quiz, **When** they answer all questions and submit, **Then** their answers are saved and the quiz is marked as submitted.
5. **Given** a Student who already submitted an assignment, **When** they revisit it, **Then** they see their previous submission and its review status rather than a blank form.

---

### User Story 4 - Coach Reviews Submissions and Gives Feedback (Priority: P4)

A Coach opens a Student's submitted assignment or quiz and reviews it. For video-response assignments, the Coach records or uploads a video response giving feedback. For quizzes, the Coach can see whether answers were correct and add comments. The Student is notified their submission has been reviewed and can view the feedback. Separately, a Coach can optionally leave general feedback (text and/or video) on a whole Module for a Student, even without a specific assignment to review.

**Why this priority**: Review and feedback close the loop on assignments created in US3, but the platform still delivers value (content viewing, self-marked progress) without it.

**Independent Test**: A Coach opens a pending video-response submission, uploads a feedback video, and marks it reviewed. The Student then sees the feedback video attached to their submission.

**Acceptance Scenarios**:

1. **Given** a Coach viewing a list of pending submissions, **When** they open one, **Then** they see the Student's response (video link or quiz answers) in full.
2. **Given** a Coach reviewing a video-response submission, **When** they upload a feedback video and mark it reviewed, **Then** the Student can see the feedback video attached to their submission.
3. **Given** a Coach reviewing a quiz submission, **When** they add written comments and mark it reviewed, **Then** the Student can see those comments attached to their quiz results.
4. **Given** a submission has been reviewed, **When** the Coach or Student views it again, **Then** it is clearly labeled "Reviewed" rather than "Pending".
5. **Given** a Coach viewing a Student's progress in a Module, **When** they choose to leave optional Module-level feedback (text and/or video), **Then** the Student can see that feedback attached to the Module, without it affecting Lesson completion or Tier progression.

---

### Edge Cases

- What happens when a Coach deletes a Module or Lesson that Students have already completed or submitted assignments against? Existing completion/submission records are preserved for history, but the content becomes inaccessible to Students going forward.
- How does the system handle a Student who abandons a video upload mid-way (e.g., closes the browser)? The system must not create a partial/corrupt submission; the Student can retry the upload.
- What happens if a Coach assigns a Tier to a new Course that's already used by another Course? The system blocks it and requires a different Tier (see US1, Scenario 5).
- What happens if a Lesson has no content set yet (Coach created it but hasn't uploaded media)? Students should not see it as available/published until it has content.
- What happens when a Student tries to submit a quiz with unanswered required questions? The system blocks submission and highlights the missing answers.
- What happens when a Student attempts to open a Course that is locked because they haven't passed the final assessment of the preceding Tier? Access is denied and the Student sees which Course/Tier they still need to complete.
- What happens when a Coach rejects (fails) a Student's final assessment submission? The Student's Tier rank does not advance, the Course remains their current one, and the Student can see the Coach's feedback and resubmit.
- What happens when a Student who has never been enrolled in a Tier sequence's program tries to access any Sequential-Locked Course in it, including the entry Tier? Access is denied — enrollment in that Tier sequence (FR-024) is required even for the entry Tier.
- What happens when a Student tries to access a Standalone Course they have not been enrolled in? Access is denied, the same as an inaccessible Sequential-Locked Course (FR-006, FR-025).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Coaches MUST be able to create, edit, and delete Courses. Each Course is either a **Sequential-Locked Course**, associated with exactly one Tier from an ordered Tier sequence (FR-027), or a **Standalone Course**, which has no Tier and sits outside any sequence entirely (e.g., a voice-repair course).
- **FR-002**: The system MUST prevent two Sequential-Locked Courses from being assigned the same Tier at the same time. Tier uniqueness does not apply to Standalone Courses, which have no Tier.
- **FR-003**: Coaches MUST be able to create, edit, reorder, and delete Modules within a Course.
- **FR-004**: Coaches MUST be able to create, edit, reorder, and delete Lessons within a Module.
- **FR-005**: Each Lesson MUST support exactly one content type: video, audio, or text/image.
- **FR-006**: Students MUST be able to view Lessons only for Courses they have access to: for a Sequential-Locked Course, access requires the Student's current Tier rank (within that Course's Tier sequence) to be at or above that Course's Tier (FR-022, FR-024); for a Standalone Course, access requires an explicit Course Enrollment record for that Student and that Course (FR-025).
- **FR-007**: Students MUST be able to mark a Lesson as finished, and this status MUST persist and be visible on return visits.
- **FR-008**: The system MUST display Module- and Course-level completion progress for a Student based on their finished Lessons.
- **FR-009**: Coaches MUST be able to create assignments/activities of type "video response" attached to a Lesson or Module.
- **FR-010**: Coaches MUST be able to create quizzes (one or more questions) attached to a Lesson or Module.
- **FR-011**: Students MUST be able to submit a video response to a video-response assignment.
- **FR-012**: Students MUST be able to answer and submit a quiz's questions.
- **FR-013**: The system MUST block quiz submission when required questions are left unanswered.
- **FR-014**: Coaches MUST be able to view all submissions (video-response and quiz) across the platform's Courses, filterable by pending/reviewed status.
- **FR-015**: Coaches MUST be able to attach a video-based feedback response to a Student's video-response submission and mark it reviewed.
- **FR-016**: Coaches MUST be able to attach written comments to a Student's quiz submission and mark it reviewed.
- **FR-017**: Students MUST be able to view the Coach's feedback (video or comments) on their own reviewed submissions.
- **FR-018**: Deleting a Course, Module, or Lesson MUST NOT delete historical Lesson-completion, submission, or Course Enrollment records already tied to it.
- **FR-019**: The system MUST NOT mark a Lesson as available to Students until its content has been set by the Coach.
- **FR-020**: The system MUST present exactly one designated final assessment activity per Sequential-Locked Course (a single capstone per Tier), of type "video response", reviewed by the Coach with video feedback, distinct from the regular per-lesson/module assignments in FR-009–FR-010. Standalone Courses do not have a final assessment and do not participate in Tier progression.
- **FR-021**: The system MUST gate the Student's Tier progression on the Coach's review outcome of a Sequential-Locked Course's final assessment activity — the Student's Tier rank only advances once the Coach marks that submission as passed; a rejected or not-yet-reviewed submission MUST NOT advance the Tier rank.
- **FR-022**: The system MUST enforce strictly sequential Course access by Tier order within each Tier sequence — a Sequential-Locked Course MUST remain locked and inaccessible to a Student until the Student's current Tier rank (in that Course's Tier sequence) is at or above that Course's Tier. A Student's Tier rank starts at the lowest-ordered Tier in the sequence (rank 1) as soon as they are enrolled in that sequence's program (FR-024), so the entry Tier is accessible immediately with no prerequisite.
- **FR-023**: Coaches MAY optionally leave feedback (text and/or video) for a Student on a Module as a whole, independent of any specific Assignment/Submission. This Module-level feedback is not required and does not gate progression or Lesson completion.
- **FR-024**: The system MUST create a Student's Tier-progress record starting at the lowest-ordered Tier (rank 1) of the relevant Tier sequence at the point the Student is enrolled in that sequence's program, so the entry Tier is immediately accessible with no additional prerequisite. A Student with no Tier-progress record for a given sequence has no access to any Sequential-Locked Course in it.
- **FR-025**: The system MUST support enrolling a Student in a Standalone Course independently of Tier progress, granting that Student access to only that Course (FR-006).
- **FR-026**: Coaches/Staff MUST be able to manually enroll a Student in a Tier sequence's program (FR-024) or in a specific Standalone Course (FR-025). This manual action is the in-app record of a completed purchase; the payment/checkout transaction itself remains out of scope (see Assumptions).
- **FR-027**: The system MUST support defining an ordered sequence of named Tiers (e.g., Academy's White/Yellow/Orange/Green/Blue/Red/Purple/Brown singing belts) — each Tier has a name, an optional description, and a strict rank/order within its sequence. Sequential-Locked Courses attach to exactly one Tier in a sequence (FR-001).
- **FR-028**: Every Course, Tier, and Student Tier Progress record MUST carry a Course Owner identifier. For this feature, the Course Owner is a single fixed value (Academy) — this field is a placeholder for future multi-tenant whitelisting of other Course owners (out of scope here; see Assumptions) and is not used to enforce any data isolation or access control within this feature.

### Key Entities

- **Course**: A top-level unit of curriculum containing an ordered list of Modules, and carrying a Course Owner identifier (FR-028). Either a **Sequential-Locked Course**, tied to exactly one Tier within an ordered Tier sequence, or a **Standalone Course**, with no Tier and no sequence participation (e.g., a voice-repair course).
- **Tier**: A named, ordered level within a Tier sequence (e.g., Academy's White/Yellow/.../Brown singing belts), scoped to a Course Owner (FR-027, FR-028). Sequential-Locked Courses attach to a Tier; Student Tier Progress advances through a sequence's Tiers in rank order.
- **Course Enrollment**: A record granting a specific Student access to a specific Standalone Course, independent of Tier progress (FR-025).
- **Module**: An ordered grouping of Lessons within a Course.
- **Lesson**: An individual unit of content within a Module; has a content type (video, audio, or text/image) and the underlying media/content.
- **Lesson Completion**: A record of a specific Student having marked a specific Lesson as finished.
- **Assignment**: A coach-created task attached to a Lesson or Module, of type "video response" or "quiz"; includes one or more Quiz Questions when it's a quiz.
- **Quiz Question**: A single question belonging to a quiz-type Assignment, with the expected answer format.
- **Submission**: A Student's response to an Assignment (an uploaded video, or a set of quiz answers), with a status (pending/reviewed) and, once reviewed, Coach feedback (video and/or written comments).
- **Final Assessment Activity**: A special, Course-level Assignment (one per Sequential-Locked Course) whose Coach-reviewed pass/fail outcome gates Tier progression for the Student.
- **Student Tier Progress**: A record of a Student's current Tier rank within a specific Tier sequence, starting at that sequence's lowest-ordered Tier once enrolled (FR-024) and advancing one rank at a time as Final Assessment Activities are passed; a Sequential-Locked Course is accessible once its Tier is at or below the Student's current rank in that sequence.
- **Module Feedback**: Optional Coach-authored feedback (text and/or video) attached to a specific Student's progress through a Module, independent of any Assignment/Submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Coach can build a full Course (Course, 2+ Modules, 3+ Lessons) in under 15 minutes.
- **SC-002**: 95% of Students can locate and mark a Lesson complete without assistance on their first attempt.
- **SC-003**: Coaches can identify and open any pending submission awaiting review in under 3 clicks/taps from their dashboard.
- **SC-004**: 100% of Student progress (lesson completions, quiz/assignment submissions, Tier rank) is preserved and accurately displayed across sessions and devices.
- **SC-005**: A Student always knows which Tier/Course they currently hold in each Tier sequence they're enrolled in, and which Course is next, without needing to ask a Coach.

## Assumptions

- "Student" refers to the existing customer account/role already present in the platform (see `001-customer-recording-library`); no new account type is introduced.
- The actual payment/checkout transaction remains out of scope. However, this feature does include the in-app record of enrollment: a Coach/Staff-triggered manual action (FR-026) that starts a Student's Tier progress at rank 1 (FR-024) or grants access to a specific Standalone Course (FR-025), standing in for "the purchase has been fulfilled." A future feature may automate this from an external checkout/webhook, but that integration itself is out of scope here.
- Both "Coach" and "Staff" roles (per `003-roles-admin-staff`) share identical permissions for authoring Courses/Modules/Lessons/Assignments and reviewing submissions, consistent with the functional parity established in that feature.
- Quiz question formats support both objective types (e.g., multiple choice, suitable for automatic scoring) and open-ended text, at the Coach's choice when building the quiz; automatic scoring applies only to objective question types, and the Coach can still add manual comments to any quiz submission.
- Academy's 8 singing belts (White through Brown) are seed data for one Tier sequence under Academy's Course Owner — not a hardcoded requirement of this system. A 9th tier ("Black Belt: Master Sensei" for Academy) referenced in existing academy materials is awarded by coach recommendation outside this system and is not modeled as a Tier row a Student progresses through automatically.
- The `courseOwnerId` placeholder on Course and Tier (FR-028) exists purely to ease a future multi-tenant "whitelist other Course owners" feature; this feature does not build tenant-scoped data isolation, tenant-aware roles, billing, or any UI for managing Course Owners — there is exactly one Course Owner (Academy) in practice today, set as a fixed default.
- Video/audio uploads (for lessons, assignment submissions, and feedback) reuse the platform's existing media storage and playback approach (as already used for recordings in `001-customer-recording-library`).
