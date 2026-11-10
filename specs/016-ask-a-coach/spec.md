# Feature Specification: Ask a Coach (VideoAsk Replacement)

**Feature Branch**: `016-ask-a-coach`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Build 'Ask a Coach' — a Academy-owned replacement for VideoAsk, living in apps/ask-a-coach/ as its own standalone Next.js + Payload + Supabase application within the Academy App monorepo. A student taps 'Ask a coach a question,' records a video (or falls back to audio/text/file upload), and a coach replies inside a shared conversation thread. This is the first of three planned builds (Ask a Coach, then Live Coaching scheduling, then a full Academy platform replacing CourseHost); Ask a Coach must work standalone now and later drop into the main Academy app as a feature, not stay a separate site — so it's built API-first, with the UI as just one client of that API." (Full capability list: integration-ready/API-first architecture; student recording experience; contact/upload/storage; notifications and email; coach inbox and replies; coach reply duration tracking; accounts, roles, and permissions; API, webhooks, security, and branding.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student asks a coach a question by video (Priority: P1)

A student wants a quick, personal answer from a coach. They tap "Ask a coach a question," see a friendly camera/mic permission prompt, get a 3-2-1 countdown, record their question, review it, and submit. They immediately see a "your question was sent" confirmation explaining what happens next, and receive a receipt with a secure link to follow the conversation.

**Why this priority**: This is the entire reason the product exists — replacing VideoAsk's core intake flow. Without it, there is nothing for a coach to reply to.

**Independent Test**: Can be fully tested by opening the recorder from a shareable link (no host app, no signed identity), recording and submitting a question, and confirming a conversation record exists with the submitted video attached and a confirmation is shown — delivers standalone value as a working question-intake tool even before any coach ever replies.

**Acceptance Scenarios**:

1. **Given** a student opens the recorder on a phone, **When** they grant camera/mic access and complete the countdown, recording, and review steps, **Then** they can submit and see a confirmation screen.
2. **Given** a student's camera/mic access is denied, **When** they reach the recording screen, **Then** they see clear help explaining how to allow access, and are offered a text or file-upload fallback instead of being stuck.
3. **Given** a student has recorded a take they don't like, **When** they choose to re-record, **Then** the previous take is discarded and they can record again before submitting.
4. **Given** a student is not identified by a host app, **When** they reach the contact screen, **Then** they must provide whichever of name/email/phone are configured as required, accept the consent checkbox, and pass spam checks before the submission is accepted.
5. **Given** a host app has passed a signed student identity, **When** the student opens the recorder, **Then** the contact screen is skipped entirely.

---

### User Story 2 - Coach replies to a student's question (Priority: P2)

A coach gets notified of a new question, opens it from their phone or laptop, watches the student's video along with their contact info, and replies — by video, audio, or text, using the same recorder and countdown the student used. The student is notified and can watch the reply via a secure link, and can respond again in the same thread.

**Why this priority**: Completes the core value loop (a question that's never answered isn't a replacement for anything). Independently valuable and testable once P1 exists.

**Independent Test**: Can be fully tested by taking a submitted conversation from User Story 1, having a coach open it, record and send a reply, and confirming the student receives a notification and can view the reply via a secure link — delivers the "two-way inbox" value distinct from simple intake.

**Acceptance Scenarios**:

1. **Given** a coach opens a conversation, **When** they record and send a video reply, **Then** the reply appears in the thread in chronological order after the original submission, and the student is notified.
2. **Given** a coach starts recording a reply but discards it before sending, **When** they check the thread afterward, **Then** no record of the discarded take exists.
3. **Given** a student receives a reply notification, **When** they open the secure link, **Then** they can watch the reply and submit another message in the same thread without re-entering contact info.
4. **Given** a coach is replying from a phone, **When** they use the coach app, **Then** the experience is fully usable without a desktop browser (installable as a PWA).

---

### User Story 3 - Coach manages their inbox of conversations (Priority: P3)

A coach or admin opens the inbox to see all incoming questions newest-first, with read/unread and open/closed status. They can search by student name, email, or phone; see only their assigned conversations (or all conversations, depending on configuration); leave internal notes visible only to staff; and close, reopen, download, or delete a conversation.

**Why this priority**: Necessary for the product to scale past a handful of questions — without it, a coach has no way to triage or track work, but the core question/reply loop (P1/P2) can function without it for a very small volume.

**Independent Test**: Can be fully tested by creating several conversations in different states (new, replied, closed) and confirming the inbox lists, filters, searches, and sorts them correctly, independent of whether notifications or duration tracking exist yet.

**Acceptance Scenarios**:

1. **Given** multiple conversations exist, **When** a coach opens the inbox, **Then** conversations are listed newest-first with visible read/unread and open/closed status.
2. **Given** a coach searches by a student's name, email, or phone, **When** they submit the search, **Then** only matching conversations are shown.
3. **Given** the "coaches see only assigned conversations" setting is on, **When** a coach who is not assigned to a conversation opens the inbox, **Then** that conversation does not appear for them.
4. **Given** a coach closes a conversation, **When** a student later replies to it, **Then** the conversation becomes visible as needing attention again (e.g. reopened or flagged), rather than the reply being silently lost.

---

### User Story 4 - Student and coach/owner receive email notifications (Priority: P4)

When a student submits a question, they get a "we got your question" receipt email, and the coach/owner gets a "new question" alert with the student's contact info, a thumbnail, and a direct link. When a coach replies, the student gets a reply notification email. Each of these can be independently turned on or off and its wording edited.

**Why this priority**: Materially improves responsiveness and trust (nobody has to remember to check the inbox), but the core submit/reply loop works without it — a coach could still find new questions by opening the inbox manually.

**Independent Test**: Can be fully tested by submitting a question and confirming the two expected emails send (receipt to student, alert to coach/owner) with correct content, then replying and confirming the student gets a reply notification — independent of inbox UI or duration tracking.

**Acceptance Scenarios**:

1. **Given** a student submits a question, **When** the submission is accepted, **Then** a receipt email is sent to the student and an alert email is sent to the coach/owner, each using the currently configured template wording.
2. **Given** an admin turns off the "new question" alert email, **When** a new question is submitted, **Then** no alert email is sent, but the receipt and reply-notification emails are unaffected.
3. **Given** an email fails to deliver, **When** an admin checks delivery status, **Then** they can see it was sent/delivered/bounced/failed for that specific notification.

---

### User Story 5 - Owner/admin manages accounts, roles, and API access (Priority: P5)

An owner or admin invites coaches and other staff by email, assigns them one or more roles (Owner, Admin, Designer, Coach), and can deactivate a user without losing their history. Owners/admins also create, name, and revoke API keys for integrations, and can review an audit log of who changed what.

**Why this priority**: Required for the product to be operated safely by more than one person, and required before any external integration (the API-first requirement) can be used securely — but the product can be initially configured and demoed by a single owner account without this being fully built out.

**Independent Test**: Can be fully tested by having an owner invite a new coach, confirming the invitee can set their own password and log in with only Coach-level access (cannot edit forms/settings/users), then deactivating them and confirming their prior replies/durations remain intact and visible.

**Acceptance Scenarios**:

1. **Given** an owner invites a new user by email, **When** the invitee accepts and sets a password, **Then** they can log in with exactly the role(s) assigned to them.
2. **Given** a user holds only the Coach role, **When** they attempt to edit a form, a setting, or another user, **Then** the action is refused.
3. **Given** an admin deactivates a coach, **When** anyone views that coach's past replies or duration records, **Then** the records are still present and correctly attributed.
4. **Given** an owner attempts to remove the last remaining Owner account, **When** they submit the change, **Then** it is refused.
5. **Given** any user changes a form, a setting, a role, or an API key, **When** an owner/admin views the audit log, **Then** that change, who made it, and when, are recorded.

---

### User Story 6 - External system integrates via API and webhooks (Priority: P6)

A developer working on the future Academy app (or the current CourseHost/Django integration) uses documented REST endpoints to start a submission, get an upload URL, submit, reply, and list conversations — the same actions the built-in UI itself uses — and subscribes to webhooks so their system reacts when a submission is created, a coach replies, or a conversation closes.

**Why this priority**: This is the stated reason the product must be built this way at all ("must work standalone now and later drop into the Academy app as a feature, not a separate site, ... built API-first"), but it's an enabling capability, not something an end user directly experiences — the product must be usable by students/coaches (P1-P5) before this has anything to integrate with.

**Independent Test**: Can be fully tested by using only documented API endpoints and a valid API key (no UI) to create a submission, fetch its status, and confirm a `submission.created` webhook was delivered to a registered endpoint with a valid signature.

**Acceptance Scenarios**:

1. **Given** a valid API key, **When** an external system calls the documented endpoints to start and complete a submission, **Then** the result is indistinguishable from a submission made through the built-in recorder UI.
2. **Given** a webhook endpoint is registered for `reply.created`, **When** a coach sends a reply, **Then** a signed webhook payload including the reply's duration is delivered, retried with backoff if delivery fails, and logged either way.
3. **Given** an API key is read-only, **When** it's used to attempt a write action, **Then** the action is refused.
4. **Given** a host app passes a valid signed student identity token, **When** the student opens the recorder, **Then** their submission is attributed to the `external_user_id` from that token, not a newly collected email.

---

### Edge Cases

- What happens when a student's upload is interrupted mid-transfer (lost connection, page closed)? The submission must remain recoverable as "processing" rather than silently lost, and the student should be warned before closing the page mid-upload.
- What happens when a student re-opens a shareable link after already submitting once? Each submission creates its own conversation; there is no assumption of one conversation per student.
- What happens when a webhook endpoint is unreachable? Delivery is retried with backoff, and ultimately logged as failed rather than silently dropped, so a host app can reconcile later.
- What happens when a conversation assigned to a coach is later deactivated? The conversation must not become permanently stuck — an admin can reassign it.
- What happens if a student tries to reply after a conversation has been closed? They should not be met with a dead end (see User Story 3, Acceptance Scenario 4).
- What happens when the same API key is used far beyond its rate limit? Requests are refused with a clear rate-limit response rather than degrading service for other keys.
- What happens when a student or coach's device has no available camera/mic at all (not just denied permission)? The text/audio/file-upload fallback must still be reachable.
- What happens when a data deletion request arrives for a student who has open conversations? The deletion request is honored per the configured retention/deletion policy; the specific handling of in-progress conversations is a planning-time detail, not a scope question.

## Requirements *(mandatory)*

### Functional Requirements

**Student submission**

- **FR-001**: Students MUST be able to start a submission from a shareable link, an embeddable component, or an in-app entry point, and the recording experience MUST work in iOS Safari, Android Chrome, desktop browsers, and inside a native app WebView without requiring a download.
- **FR-002**: The system MUST show a permissions-priming screen before requesting camera/mic access, and MUST offer clear guidance plus a non-video fallback (text, audio-only, or file upload) if access is denied or unavailable.
- **FR-003**: The recording experience MUST provide a live camera preview, a 3-2-1 countdown before recording starts, a visible timer, a configurable maximum length (default: 5 minutes for a student submission), and the ability to review a take before choosing to re-record or submit.
- **FR-004**: The system MUST show a confirmation screen after submission explaining what happens next, and MUST send the student a receipt (User Story 4).
- **FR-005**: The system MUST collect name/email/phone on a contact screen — each independently configurable as required, optional, or hidden — unless a host app has supplied a signed student identity, in which case the contact screen MUST be skipped.
- **FR-006**: The system MUST validate email/phone format, require consent (recording + privacy policy) before accepting a submission, and apply spam protection (invisible bot-detection and rate limiting) to the public submission endpoint.
- **FR-007**: Uploads MUST go directly from the student's device to storage via a short-lived signed URL, show upload progress, retry automatically on weak connections, and warn the student if they attempt to leave the page mid-upload.
- **FR-008**: A submission MUST be held in a "processing" state until the uploaded media is confirmed ready for playback.

**Playback and storage**

- **FR-009**: All recorded/uploaded media MUST be played back via private, signed URLs — never a public/unauthenticated link — and MUST play back consistently across iPhone, Android, and desktop regardless of original recording format.
- **FR-010**: Every submission and reply with video MUST have a thumbnail available for inbox display.
- **FR-011**: The system MUST support a configurable retention period and support deleting a student's data on request.

**Coach inbox and replies**

- **FR-012**: Coaches/admins MUST be able to view a list of conversations sorted newest-first, showing read/unread and open/closed status, with the ability to search by student name, email, or phone.
- **FR-013**: Conversations MUST be assignable to a specific coach, and the system MUST support a configuration toggle controlling whether coaches see all conversations or only their assigned ones (default: all conversations).
- **FR-014**: Coaches/admins MUST be able to add internal notes on a conversation that are never visible to the student, and MUST be able to close, reopen, download, and delete a conversation.
- **FR-015**: A conversation's thread view MUST show the original submission, the student's contact info, and every subsequent reply in chronological order.
- **FR-016**: Coaches MUST be able to reply using the same recording experience (video/audio/text, with countdown) as students, from either a phone or a laptop, with its own configurable maximum length (default: 10 minutes).
- **FR-017**: A student MUST be able to view a coach's reply via a secure link and submit a further message in the same conversation thread.

**Duration tracking**

- **FR-018**: The system MUST record the duration, in seconds, of every coach video or audio reply, measured from the server-processed media (never a value self-reported by the browser). Student submissions are not duration-tracked.
- **FR-019**: A duration record MUST capture the coach, the conversation, the date/time, the reply type, and the duration in seconds, and MUST persist even if the conversation is later deleted or the coach is deactivated.
- **FR-020**: Only a reply that was actually sent counts toward duration; a discarded re-recording MUST NOT be stored.
- **FR-021**: Reply durations MUST be visible on each reply in the thread, exportable as CSV and XLSX filtered by date range and coach, and retrievable via the API.

**Notifications**

- **FR-022**: The system MUST send a student receipt email on submission, a coach/owner alert email on new submission (including contact info, thumbnail, and a direct link), and a student notification email when a coach replies.
- **FR-023**: Each notification type MUST be independently togglable and its wording editable, using branded templates that support variables (student name, coach name, link).
- **FR-024**: The system MUST log delivery status (sent, delivered, bounced, failed) for every notification email sent.

**Accounts, roles, and permissions**

- **FR-025**: The system MUST support individual login per coach/admin (email+password or magic link), admin-driven invitation with self-set password, self-service password reset, and optional (admin-enforceable) two-factor authentication.
- **FR-026**: A user MUST be deactivatable without deleting their account, preserving their history and duration records, and MUST be able to be logged in on multiple devices at once with a "sign out of all devices" option.
- **FR-027**: The system MUST support four roles — Owner, Admin, Designer, Coach — as defined in Key Entities, with a user able to hold more than one role simultaneously, and MUST prevent removing the last remaining Owner.
- **FR-028**: The system MUST maintain an audit log recording who changed forms, settings, roles, or API keys, and when.

**API, webhooks, security, branding**

- **FR-029**: Every action the built-in UI performs (starting a submission, getting an upload URL, submitting, replying, listing conversations) MUST also be available as a documented API endpoint, so an external client can perform the same actions without using the built-in UI.
- **FR-030**: Owners/admins MUST be able to create, name, revoke, and rotate API keys; each key MUST be shown in full only once and stored hashed thereafter; keys MUST default to read-only with write access granted explicitly.
- **FR-031**: The system MUST emit signed webhook events for `submission.created`, `reply.created` (including duration), and `conversation.closed`, with retry-with-backoff on delivery failure and a delivery log.
- **FR-032**: The system MUST accept a signed identity token from a host application identifying a student (skipping the contact form per FR-005), and MUST store an `external_user_id` on every student record in addition to email — email MUST NOT be used as the student's primary identifier.
- **FR-033**: The system MUST enforce HTTPS everywhere, encrypt stored media, apply rate limiting per API key and per IP on public submission endpoints, and support a privacy policy, consent capture, and data-deletion-on-request.
- **FR-034**: Branding (colors, logo, font, favicon) MUST be configurable in one place and MUST apply consistently across the student recorder, the coach app, and all email templates.

### Key Entities

- **Student**: The person submitting a question. Identified by email (until a host app supplies identity) and always carries an `external_user_id` field for future host-app attribution; email is never the primary key. Has contact info (name/email/phone, per configuration) and a consent record.
- **Coach / Agent**: A staff member who can be assigned conversations and reply to them. "Coach" and "Agent" refer to the same underlying role.
- **Conversation**: A thread tying together one original student submission and all subsequent replies (from either side). Has read/unread status, open/closed status, an optional assigned coach, and staff-only internal notes.
- **Submission**: The student's original question — video, audio, text, or an uploaded file — with associated contact info, consent, and processing status.
- **Reply**: A coach's (or student's follow-up) response within a conversation — video, audio, or text. A coach's video/audio reply carries a measured duration in seconds; student replies do not.
- **User Account**: A coach/admin/designer/owner login, holding one or more roles: **Owner** (full control including hosting/API keys; at least one must always exist), **Admin** (manage users, roles, API keys, email sender, retention — cannot remove the last Owner), **Designer** (edit forms: prompts, intro videos, contact fields, time limits, email wording — cannot manage users or API keys), **Coach** (view conversations, reply, add internal notes, close conversations — cannot edit forms, settings, or users).
- **API Key**: A named, revocable, rotatable credential scoped read-only by default, shown in full only once and stored hashed thereafter.
- **Webhook Subscription**: A registered endpoint receiving signed event payloads (`submission.created`, `reply.created`, `conversation.closed`), with an associated delivery log.
- **Notification**: A configurable, togglable email (receipt, new-question alert, reply notification) with editable template wording and per-send delivery status.
- **Audit Log Entry**: A record of who changed a form, setting, role, or API key, and when.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time student can go from opening the recorder to seeing a submission confirmation in under 2 minutes on a typical mobile connection.
- **SC-002**: At least 95% of submission attempts on supported devices/browsers (iOS Safari, Android Chrome, desktop Chrome/Safari/Firefox, and in-app WebViews) complete successfully without the student needing to retry due to a technical failure.
- **SC-003**: A coach can locate a specific student's conversation via search in under 10 seconds, regardless of total conversation volume.
- **SC-004**: 100% of sent coach replies have a correctly recorded, server-measured duration available in the thread and via export within one minute of the reply being sent.
- **SC-005**: An external system integrating purely through the documented API and webhooks can replicate the full submit-and-reply flow without needing to use, or reverse-engineer, the built-in UI.
- **SC-006**: A deactivated coach's historical replies and durations remain 100% intact and correctly attributed, verifiable at any point after deactivation.
- **SC-007**: Every notification email's delivery outcome (sent/delivered/bounced/failed) is visible to an admin within a few minutes of the send attempt.
- **SC-008**: No student-submitted or coach-reply media is ever reachable via an unauthenticated/public URL.

## Assumptions

- **Video provider and hosting technology** (e.g. a managed video API vs. self-hosted storage + transcoding) is an implementation decision deferred to the planning phase (`/speckit-plan`) — this specification describes required behavior (direct signed-URL upload, server-measured duration, private signed playback, thumbnails), not a specific vendor.
- **Email delivery provider** is likewise an implementation decision deferred to planning; this spec only requires a transactional sender on a Academy domain with standard authentication (SPF/DKIM/DMARC) and per-notification delivery logging.
- **Transcription is out of scope for the initial launch.** The source material calls it "optional," and no current user story depends on search/skim-by-transcript — it can be added later as an enhancement to FR-009/FR-010 without changing this spec's other requirements.
- **This build does not need to implement Academy's single sign-on** — accounts are self-contained for now (FR-025), built so staff login can move to a future Academy-wide SSO without a rework.
- **The current host application is CourseHost**, reached via the embeddable/hosted-page/WebView entry points in FR-001; deep integration with the future Academy app is enabled by the API-first requirements (FR-029-FR-034) but is not itself part of this build.
- **How Academy uses reply-duration data downstream** (e.g. coach performance/payroll) is explicitly out of scope for this build — this spec only covers capturing, storing, displaying, and exporting it accurately (FR-018-FR-021).
- **Push notifications are a future enhancement**, not required at launch — FR-022-FR-024 cover email only, designed so another channel can be added later without changing the notification model.
- **Maximum recording length defaults to 5 minutes for a student submission and 10 minutes for a coach reply** — configurable per FR-003/FR-016, but this is the launch default.
- **Coach visibility defaults to "all conversations"** — a newly configured coach sees every conversation, not just ones assigned to them (FR-013); per-conversation assignment remains available as an optional workflow refinement, not a visibility gate, unless later toggled off.
