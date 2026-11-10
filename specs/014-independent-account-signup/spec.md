# Feature Specification: Independent Account Signup

**Feature Branch**: `014-independent-account-signup`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Independent Academy account signup, decoupled from Core (CourseHost's Django backend at core.example.com). A user can create an account on the Academy platform directly, then optionally link that account to their corresponding legacy customer record via a customer ID lookup, verified by an emailed link sent to the legacy record's on-file email before the link takes effect."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign up without an existing account on file (Priority: P1)

A person who wants to use Academy — whether or not they have ever purchased anything through Academy's legacy system — can create a platform account on their own, without needing staff help and without needing to already exist as a customer in that legacy system.

**Why this priority**: This is the entire point of the feature — today, no account can exist on the platform without first existing in the legacy system. Removing that dependency is the foundational capability everything else builds on.

**Independent Test**: A person with no prior relationship to Academy visits the platform, completes signup with just an email, and lands on a working, non-error dashboard under their own account.

**Acceptance Scenarios**:

1. **Given** no existing platform account for an email, **When** a person completes signup with that email, **Then** a new account is created, they are signed in, and they land on their own dashboard — with any section that depends on legacy-system data (Courses, Tiers, credits, session history) showing a clear "nothing yet" state rather than an error.
2. **Given** an email that already has a platform account, **When** a person attempts to sign up with it again, **Then** they are told an account already exists and directed to sign in instead, rather than a second account being created.
3. **Given** a person has completed signup, **When** they return later, **Then** they can sign back into that same account using the platform's existing sign-in method.

---

### User Story 2 - Link the account to an existing legacy customer record (Priority: P1)

A student who already has purchase history, Tier access, or Course access recorded in Academy's legacy system can connect their new platform account to that existing record, so they don't lose access to what they've already been granted.

**Why this priority**: Without linking, independent signup produces an account with no history and no purchased access — for any student who already has a legacy record, that's a strictly worse experience than what exists today. Linking is what makes independent signup safe to ship for Academy's existing student base, not just brand-new signups.

**Independent Test**: A student with a known legacy customer identifier submits it, receives and clicks a verification link at that record's on-file email address, and afterward has the same access they would have had by reaching the platform through the legacy system directly.

**Acceptance Scenarios**:

1. **Given** a legacy customer identifier that exists and is not already linked to any platform account, **When** a student submits it, **Then** the system finds the matching record, sends a verification link to that record's on-file email address, and confirms to the student that an email was sent.
2. **Given** a legacy customer identifier that does not exist, **When** a student submits it, **Then** the system tells them clearly that no matching record was found, and no verification email is sent.
3. **Given** a valid, unexpired, not-yet-used verification link, **When** the student opens it, **Then** their platform account becomes linked to that legacy customer record and they immediately gain access to everything that record is entitled to.
4. **Given** an expired or already-used verification link, **When** it is opened, **Then** the student sees a clear message that the link is no longer valid, with a way to request a new one.
5. **Given** a legacy customer identifier that is already linked to a different platform account, **When** a student attempts to link it to their own account, **Then** the system stops the request and explains that record is already linked, without revealing any details about the account it's linked to.
6. **Given** a legacy customer record that already has a staff-granted Tier or Course enrollment on file from before the student ever signed up independently, **When** the student successfully links to that record, **Then** those staff-granted enrollments carry over to the now-linked account rather than being lost or orphaned.

---

### User Story 3 - Use Academy-native features before linking (Priority: P2)

A student who has signed up independently but hasn't linked (or doesn't yet have) a legacy customer record can still get real value from the platform — specifically, browsing and booking coaching sessions — rather than hitting a dead end.

**Why this priority**: Gives an unlinked account something genuinely useful to do, which is what makes independent signup worth offering on its own instead of only as a companion step to linking. Lower priority than Stories 1 and 2 because it depends on both already working.

**Independent Test**: Sign up, skip linking, browse and book a coaching session, and confirm the booking is correctly attached to the new account.

**Acceptance Scenarios**:

1. **Given** a newly signed-up, unlinked account, **When** the student browses and books a coaching session, **Then** it succeeds the same way it would for a linked student.
2. **Given** an unlinked account, **When** the student views an area of the dashboard that depends on legacy-system data (Courses, Tiers, credits, past session history), **Then** they see an accurate "nothing here yet" state rather than an error, broken page, or fabricated data.

---

### Edge Cases

- What happens if the rate limit on legacy-record lookup attempts is hit? The student sees a generic "too many attempts, try again later" message; the system does not reveal whether any of the throttled attempts were valid or invalid identifiers.
- What happens if the student's platform signup email is different from the legacy record's on-file email? This is expected and allowed — ownership is established only through the emailed verification step, not by comparing the two addresses.
- What happens if a person's platform signup email happens to match a legacy record's on-file email by coincidence? No automatic linking occurs — a matching email at signup is not treated as proof of ownership; the student must still go through the identifier lookup and email verification steps like anyone else.
- What happens to an account that never links? It remains a normal, working account restricted to Academy-native features indefinitely — there is no deadline or forced prompt to link in this version.
- What happens if someone tries to sign up again with an email that's already fully linked to a legacy record through the existing (non-independent) path? They're told an account already exists and directed to sign in, same as any other duplicate-email signup attempt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a person to create a new platform account without requiring any pre-existing legacy customer record.
- **FR-002**: New account signup MUST be verified using the same email-based verification approach already used for platform sign-in, so a signed-up account is confirmed to belong to a real, reachable email address.
- **FR-003**: An account not yet connected to a legacy customer record MUST be a fully usable account under its own identity — reachable and navigable the same way any account is, not routed into a separate holding area.
- **FR-004**: From that area, a student MUST be able to submit a legacy customer identifier to request linking their account to the matching legacy customer record.
- **FR-005**: Legacy customer record lookup for linking MUST be performed by identifier only; lookup by email address is out of scope for this version (see Assumptions).
- **FR-006**: The system MUST NOT complete a link until the student proves they control the legacy record's on-file email address, via a one-time verification step tied to that specific link request.
- **FR-007**: A link-verification link MUST expire after a bounded period and MUST be usable at most once.
- **FR-008**: The system MUST prevent a single legacy customer record from being linked to more than one platform account.
- **FR-009**: The system MUST rate-limit legacy-record lookup and link-request attempts, both per account and per originating request source, to deter systematic guessing of legacy customer identifiers.
- **FR-010**: Once linked, a student's access to legacy-system-sourced data (Courses, Tiers, credits, session history) MUST work exactly as it does today for a student who reached the platform through the legacy system directly.
- **FR-011**: If a legacy customer record already has staff-granted Tier or Course enrollments recorded against it before the student links, those enrollments MUST carry over intact once linking succeeds.
- **FR-012**: An account not yet connected to a legacy customer record MUST be able to use Academy-native functionality — for this version, that is limited to browsing and booking coaching sessions.
- **FR-013**: An unlinked account viewing any part of the dashboard that depends on legacy-system data MUST see an accurate "nothing here yet" state, not an error, broken page, or fabricated data.
- **FR-014**: When a legacy customer record is already linked to a different platform account, the system MUST reject a new link attempt against it without disclosing any information about the account it's already linked to.

### Key Entities *(include if feature involves data)*

- **Platform Account**: A person's identity on Academy, independent of any legacy customer record. May exist unlinked, or connected to exactly one Legacy Customer Record.
- **Legacy Customer Record**: An existing customer record in Academy's legacy system, identified by a legacy customer identifier, holding purchase, Tier, and Course access history that may predate this feature — including access staff may have already granted before the student ever signs up independently.
- **Link Verification Request**: A single, time-boxed attempt to prove a Platform Account's owner controls a specific Legacy Customer Record's on-file email address, before the two are connected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from having no account to browsing coaching sessions in a working area of the product in under 2 minutes.
- **SC-002**: A student with an existing legacy customer record can go from submitting their identifier to having full linked access, including the email round trip, in under 5 minutes.
- **SC-003**: 100% of link-verification links older than their validity window are rejected when opened, verified by testing.
- **SC-004**: 100% of legacy-record lookup/link-request attempts beyond the defined rate limit are blocked, verified by testing.
- **SC-005**: Zero legacy customer records ever end up linked to more than one platform account, verified by an ongoing data-integrity check.
- **SC-006**: An unlinked account can complete a coaching-session booking with the same success rate as a linked account, measured against the same test scenarios.

## Assumptions

- An account not yet linked to a legacy customer record still has its own working identity in the product from the moment it's created (not a placeholder or a separate lightweight state) — Core-sourced areas simply show nothing yet, the same way they already do for other zero-data states.
- Legacy-record lookup, for this version, is by identifier only — the legacy system does not currently expose a way to search by email address. Email-based lookup is a future enhancement, dependent on that capability existing on the legacy side.
- New-account signup reuses the platform's existing email-based sign-in verification approach rather than introducing a separate password-based signup, keeping the two consistent.
- A platform signup email coincidentally matching a legacy record's on-file email is never treated as proof of ownership on its own — linking always requires the explicit identifier-lookup-plus-verification flow.
- Buying or enrolling into paid content without ever linking a legacy customer record is out of scope for this version — noted as likely future work once independent signup exists as a foundation.
- The set of Academy-native features usable before linking is limited to coaching-session booking for this version. Other native features can be added to the unlinked area later without revisiting this feature's core linking mechanics.
- There is no deadline or forced prompt requiring an unlinked account to eventually link — remaining unlinked indefinitely is a supported, permanent state if the student chooses.
- Detecting or merging duplicate platform accounts belonging to the same real person (e.g., someone who accidentally signs up twice with different emails) is out of scope for this version.
- Verification links carry a fixed validity window (industry-standard short-lived, e.g. on the order of a day) rather than being indefinitely valid.
