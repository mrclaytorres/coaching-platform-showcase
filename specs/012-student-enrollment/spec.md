# Feature Specification: Staff-Driven Student Enrollment

**Feature Branch**: `012-student-enrollment`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "I want a feature where I can enroll any student to any existing Tier, Course or Lesson. Right now we don't have this feature yet."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enroll a student into a Tier sequence (Priority: P1)

A staff member opens a student's account and grants them access to a Sequential-Locked Course track by enrolling them into that track's Tier sequence, starting at a Tier of the staff member's choosing — representing a purchase or manual grant that happened outside the app.

**Why this priority**: Sequential-Locked Courses are completely inaccessible to a student with no Tier enrollment today, and there is currently no way for staff to grant that access at all — this is the core capability the feature exists to deliver.

**Independent Test**: Pick a student with no existing Tier enrollment, enroll them at a specific Tier, and confirm that Tier's Course (and any earlier Tier's Course) becomes visible and accessible to that student, while later Tiers remain locked.

**Acceptance Scenarios**:

1. **Given** a student with no Tier enrollment for a Course Owner's sequence, **When** staff enroll them starting at the sequence's first Tier, **Then** the student gains access to that Tier's Course and no later Tier's Course.
2. **Given** at least two Tiers exist in a sequence, **When** staff enroll a student starting at the second Tier instead of the first, **Then** the student immediately has access to both the first and second Tier's Courses (their progress reflects having already reached that rank).
3. **Given** a student is already enrolled in a sequence, **When** staff attempt to enroll them again, **Then** the system tells staff they're already enrolled and does not create a duplicate or silently downgrade their current rank.

---

### User Story 2 - Enroll a student into a standalone Course (Priority: P1)

A staff member grants a student direct access to one specific standalone Course, independent of any Tier sequence.

**Why this priority**: Equally core to the feature's purpose as Tier enrollment — standalone Courses have their own, separate access rule (direct enrollment, not Tier rank), and staff need the same manual-grant capability for them.

**Independent Test**: Pick a student with no access to a given standalone Course, enroll them into it, and confirm the Course (and its published Lessons) becomes visible and accessible to that student.

**Acceptance Scenarios**:

1. **Given** a standalone Course a student has no access to, **When** staff enroll the student into it, **Then** the student gains access to that Course and its published Lessons.
2. **Given** a student is already enrolled in a standalone Course, **When** staff attempt to enroll them again, **Then** the system tells staff they're already enrolled and takes no duplicate action.
3. **Given** a Course that belongs to a Tier sequence (not standalone), **When** staff try to use this direct-enrollment action on it, **Then** the system explains that this Course is reached via Tier enrollment instead and does not create an inconsistent access grant.

---

### User Story 3 - See a student's current enrollment status (Priority: P2)

A staff member viewing a student's account can see, at a glance, which Tier sequence rank (if any) and which standalone Courses that student currently has access to, before deciding what to enroll them in next.

**Why this priority**: Without this visibility, staff risk enrolling a student who is already enrolled, or missing that a student already has broader access than they realized. It makes Stories 1 and 2 safe and efficient to use, but the enroll actions themselves deliver the core value even without it.

**Independent Test**: Open a student's account and confirm their current Tier rank (or "not enrolled") and their list of standalone Course enrollments are both visible without needing to attempt an enrollment first.

**Acceptance Scenarios**:

1. **Given** a student enrolled in a Tier sequence, **When** staff view their account, **Then** the student's current Tier rank is shown by name, not just an internal number.
2. **Given** a student enrolled in one or more standalone Courses, **When** staff view their account, **Then** each enrolled Course is listed by name.
3. **Given** a student with no enrollments at all, **When** staff view their account, **Then** the page clearly shows "not enrolled" rather than an empty or blank section.

---

### Edge Cases

- What happens when staff try to enroll a student who has no Academy account on file yet? Their account-on-file record is created automatically as part of the enrollment action (FR-009) — staff don't need a separate step first.
- What happens if the CourseHost/Core customer ID staff enter doesn't exist at all? Staff see a clear "customer not found" message rather than a broken enrollment or a record created for a nonexistent customer.
- What happens when no Tiers or no standalone Courses exist yet to enroll into? Staff see a clear "nothing to enroll into yet" message instead of a broken or empty picker.
- What happens if a student was already progressing through a Tier sequence (past the entry Tier) and staff re-enroll them at a lower Tier than they've already reached? Staff are warned this would lower the student's access before it happens, since enrollment is meant to grant access, not take it away.
- What happens to a student's existing Lesson-level progress/submissions if they're enrolled into a Course after already having some (e.g., via a prior standalone enrollment that was later changed)? Out of scope — this feature only grants initial access; it does not touch progress or submission history.
- Un-enrolling or revoking a grant made through this feature is out of scope for this version — consistent with how credit adjustments and Tier advancement already work elsewhere in the app (append-only actions; a correction is a new action, not an edit or delete).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Staff MUST be able to enroll a student into a Course Owner's Tier sequence, choosing which Tier the student starts at from among that sequence's existing Tiers.
- **FR-002**: Staff MUST be able to enroll a student directly into a specific standalone Course.
- **FR-003**: The system MUST prevent using the standalone-Course enrollment action on a Course that belongs to a Tier sequence, and must explain why.
- **FR-004**: The system MUST prevent duplicate enrollment (Tier sequence or standalone Course) and MUST inform staff when a student is already enrolled, rather than silently doing nothing or creating a second grant.
- **FR-005**: The system MUST warn staff before an enrollment action would lower a student's current Tier rank, since enrollment is meant to grant access, not remove it.
- **FR-006**: Staff MUST be able to see a student's current Tier rank (by Tier name) and their list of standalone Course enrollments before choosing what to enroll them in.
- **FR-007**: Enrolling a student into a Course (directly, or by reaching its Tier) MUST grant access to that Course's published Lessons — there is no separate, Lesson-specific enrollment action, since Lesson access is entirely determined by Course access plus the Lesson's own publish state (consistent with how Lesson visibility already works).
- **FR-008**: This capability MUST be restricted to staff roles that already manage financial/account-adjacent actions in this app (super_admin and staff, not coach) — consistent with how Credit Watch and the Admin Customer Console are already restricted.
- **FR-009**: Staff MUST be able to enroll a student by their CourseHost/Core customer ID directly, whether or not that student has ever logged into the student portal before — if the student has no Academy account on file yet, the system MUST create it automatically as part of enrolling, the same way the account gets created on a student's first portal login. This applies equally to paid and free enrollments (e.g., a promo Course, a free Tier, a support exception) — the enrollment action itself does not need to know or record why access was granted.

### Key Entities *(include if feature involves data)*

- **Tier Enrollment**: A student's current rank within one Course Owner's Tier sequence — determines which Sequential-Locked Courses (up to that rank) the student can access. A student has at most one rank per Course Owner; enrolling for the first time creates it, re-enrolling at a lower rank than already reached is blocked (FR-005).
- **Standalone Course Enrollment**: A grant of access to one specific standalone Course, independent of any Tier. A student can have any number of these, one per Course.
- **Tier**: An existing, staff/coach-authored step in a Course Owner's sequence; this feature only ever enrolls into a Tier that already exists — it does not create new Tiers.
- **Course**: An existing, already-authored Course (either Sequential-Locked, reached via Tier Enrollment, or standalone, reached via Standalone Course Enrollment); this feature only ever enrolls into a Course that already exists — it does not create new Courses.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff member can grant a student access to any existing Tier or standalone Course in under 30 seconds, without needing engineering help.
- **SC-002**: 100% of enrollment actions are reflected in what the student can actually access on their very next page load — no delay, no manual refresh step required.
- **SC-003**: Staff never accidentally create a duplicate enrollment or accidentally lower a student's Tier rank — both are caught and explained before they happen, verified by attempting each on a test student.
- **SC-004**: Staff can correctly state a student's current enrollment status (Tier rank and standalone Courses) just by looking at their account page, without asking engineering or checking a database.

## Assumptions

- Enrollment represents access granted outside the app — which may or may not involve a purchase (a CourseHost purchase, a promo Course, a free Tier, a support exception) — this feature does not process payment, verify purchase, or distinguish paid from free grants; it only records that access was granted, matching how the existing (currently unused) `enrollStudentInTierSequence`/`enrollStudentInCourse` backend functions from the course-authoring feature are already described.
- Enrolling by CourseHost/Core customer ID resolves-or-creates the student's Academy account-on-file record as part of the same action (FR-009) — reusing the same "look up in Core, then create the local record if missing" pattern the existing dev account-seeding tool already uses, just made available as a normal staff console action instead of a dev-only one.
- There is no such thing as enrolling a student into a single Lesson on its own — the data model only tracks access at the Course level (plus each Lesson's own publish/draft state); enrolling in a Course's Tier or the Course directly is what makes its Lessons reachable (FR-007).
- Staff can choose which Tier a student starts at (not always the lowest/entry Tier) — this is a deliberate expansion of the existing enrollment function's current always-start-at-the-bottom behavior, since staff need to represent students who are already partway through a sequence (e.g., a transfer from an outside program).
- Removing or correcting an enrollment (un-enrolling) is out of scope for this version — matches the append-only convention already used for credit adjustments (008) and Tier advancement (004); a future version could add this if needed.
- This is a staff console capability, not a developer-only tool — it does not require any special local/dev environment flag, unlike the account-seeding tool used for local testing.
