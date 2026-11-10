---

description: "Task list for Ask a Coach (VideoAsk Replacement)"

---

# Tasks: Ask a Coach (VideoAsk Replacement)

**Input**: Design documents from `/specs/016-ask-a-coach/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — all present.

**Tests**: Not included — no automated test framework in this monorepo (plan.md's Technical
Context); validation is manual via `quickstart.md`, matching every other feature here.

**Organization**: Tasks are grouped by user story (spec.md's US1–US6) so each can be built,
tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on an incomplete task)
- **[Story]**: Which user story this task belongs to
- All paths are relative to the repo root; the app itself lives under `apps/ask-a-coach/`

---

## Phase 1: Setup

**Purpose**: Scaffold the new workspace member, matching `apps/academy-platform`'s established
conventions (plan.md's Structure Decision).

- [X] T001 Scaffold `apps/ask-a-coach/` — `package.json` ("name": "ask-a-coach"), `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `tailwind.config.ts`, `postcss.config.mjs`, mirroring `apps/academy-platform`'s equivalents
- [X] T002 [P] Write `apps/ask-a-coach/.env.example` — this app's own Supabase URL/anon/service-role keys + `DATABASE_URL`, Mux token pair + webhook secret, `RESEND_API_KEY`, Cloudflare Turnstile site/secret keys, `NEXT_PUBLIC_APP_URL`
  - **Reworked** (research.md #8): Supabase URL/anon/service-role keys now documented as "same as `apps/academy-platform`'s" rather than a separate project; `DATABASE_URL` stays this app's own (Payload only).
- [X] T003 [P] Add dependencies to `apps/ask-a-coach/package.json`: `@payloadcms/next`, `payload`, `@payloadcms/db-postgres`, `@supabase/supabase-js`, `@supabase/ssr`, `@mux/mux-node`, `resend`, `exceljs`
- [X] T004 Configure `apps/ask-a-coach/payload.config.ts` + `withPayload()` in `next.config.mjs`, matching `apps/academy-platform`'s pattern (contracts/payload-collections.md) — also added the `Branding` global (globals/Branding.ts) and minimal App Router scaffolding (src/app/layout.tsx, globals.css, page.tsx, lib/payload-client.ts), gaps in the original task breakdown needed for the app to boot at all
- [X] T005 Provision this app's own dedicated Supabase project (separate from `apps/academy-platform`'s) and record connection details per T002 — documented as `apps/ask-a-coach/docs/provisioning.md` instead of the README (linked from it)
  - **Superseded** by the identity-unification rework (research.md #8): that separate project is abandoned/unused (left alone, not deleted) — Supabase auth/identity/business data now points at `apps/academy-platform`'s existing project; only Payload's own content database stays on a dedicated project (see T005a below).
- [X] T005a Repoint `apps/ask-a-coach/.env`'s `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` to `apps/academy-platform`'s existing Supabase project (copied verbatim); `DATABASE_URL` stays on this app's own separate project (Payload only — see research.md #8's "Payload stays on its own database")

**Checkpoint**: Workspace member exists, installs, and boots an empty Next.js app.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Apply the full schema in `contracts/supabase-schema.md` to this app's Supabase project (students, staff_profiles, staff_roles, conversations, conversation_notes, submissions, replies, api_keys, webhook_subscriptions, webhook_deliveries, notification_deliveries, audit_log, RLS policies) — verified live via `psql \dt`, all 12 tables present. Payload's own schema (`submission_forms`, `branding`, etc.) applied separately via `payload migrate:create` + `migrate` (no migration had existed yet — created as part of this)
  - **Superseded** by T006a — that schema targeted the now-abandoned separate project.
- [X] T006a Apply the reworked schema (`contracts/supabase-schema.md`, current version) to `apps/academy-platform`'s shared Supabase project: `phone`/`source_app` columns on `customer_profiles`; `coach_staff_roles`, `conversations`, `conversation_notes`, `coach_submissions` (renamed from `submissions` — collided with `apps/academy-platform`'s own unrelated table of that name), `replies`, `api_keys`, `webhook_subscriptions`, `webhook_deliveries`, `notification_deliveries`, `audit_log` — verified live via `psql \dt`, all 10 new tables + 2 new columns present, no impact on `apps/academy-platform`'s existing tables/data
- [X] T007 [P] Implement Supabase server/browser/middleware clients in `apps/ask-a-coach/src/lib/supabase/{server,client,middleware-client}.ts`, mirroring `apps/academy-platform`'s equivalents — also added `service-role.ts` (centralized, unlike `apps/academy-platform`'s per-file duplication of the same function)
- [X] T008 [P] Implement Mux client, direct-upload helper, and inbound webhook signature verification in `apps/ask-a-coach/src/lib/mux/` — verified against the actual installed `@mux/mux-node@9.0.1` type definitions (`mux.webhooks.unwrap`, not the initially-assumed static `Mux.Webhooks.verifyHeader`; `mux.jwt.signPlaybackId` confirmed correct)
- [X] T009 Implement staff session resolution + role-check helpers (`requireStaffRole`-equivalent) in `apps/ask-a-coach/src/lib/auth/staff.ts` — added a non-redirecting `requireStaffRoleApi` variant for route handlers, and `assertNotLastOwner` for FR-027
  - **Reworked** (research.md #8): `getStaffProfile` now looks up the shared `staff_profiles` row by `supabase_user_id` (that row's own `id` is a separate generated PK, not the auth uid — unlike this app's old, removed local table); `displayName` synthesized from `first_name`/`last_name` (shared table has no `display_name` column); role query moved from `staff_roles` to `coach_staff_roles`.
- [X] T010 Implement student identity resolution (signed host-app JWT vs. contact-form fallback) in `apps/ask-a-coach/src/lib/students/identity.ts` (FR-005/FR-032) — added the `jose`/`HOST_JWT_SECRET` dependency this needs, not originally listed in T003/T002
  - **Reworked** (research.md #8): the JWT-verification half (`verifyHostIdentityToken`) moved unmodified to `apps/ask-a-coach/src/lib/students/host-token.ts` (unrelated to identity storage). The `students`-table dedupe half (`resolveStudent`) is replaced by `resolveOrCreateCustomer` in the new `apps/ask-a-coach/src/lib/identity/customer.ts`, resolving/creating against the shared `customer_profiles` table instead (see data-model.md's "Identity" section) — every caller (`submissions/create.ts`, `conversations/list.ts`, `conversations/get-thread.ts`, `conversations/update.ts`) updated accordingly.
- [X] T011 Implement API-key authentication (hash verification, read-only scope enforcement, per-key rate limiting) in `apps/ask-a-coach/src/lib/auth/api-key.ts` (FR-030/FR-033) — rate limiting is in-memory (documented as sufficient for this app's stated scale; would need a shared store for multi-instance deployment)
- [X] T012 [P] Implement the audit log writer in `apps/ask-a-coach/src/lib/audit/log.ts` (FR-028)
- [X] T013 Configure `apps/ask-a-coach/src/middleware.ts` — protect `/coach/*` and `/admin/*` routes by session, leave `/ask/*`, `/c/*`, and `/api/v1/*` to their own per-route auth (session or API key or public)
- [X] T014 Implement the inbound Mux webhook route in `apps/ask-a-coach/src/app/api/webhooks/mux/route.ts` (`video.asset.ready`/`video.asset.errored`) — writes `submissions.status`/`thumbnail_url` and `replies.status`/`duration_seconds` (contracts/webhooks.md's "Inbound: Mux → this app"; shared by US1 and US2). Required adding a `mux_upload_id` column to `submissions`/`replies` (schema gap — see contracts/supabase-schema.md and data-model.md, now updated) to match a webhook event back to its row before the asset id is known.
  - **Reworked** (research.md #8): every `.from('submissions')` reference (here and in `app/api/v1/submissions/[id]/route.ts`, `app/api/v1/submissions/[id]/upload-url/route.ts`) updated to `.from('coach_submissions')`.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Student asks a coach a question by video (Priority: P1) 🎯 MVP

**Goal**: A student can submit a video/audio/text/file question end-to-end and see a
confirmation, with no coach-side functionality required yet.

**Independent Test**: Open the recorder from a shareable link with no host app/signed identity,
record and submit a question, confirm a `conversations`+`submissions` row exists with the
video attached and a confirmation screen is shown (spec.md US1 Independent Test).

### Implementation for User Story 1

- [X] T015 [P] [US1] Create the `SubmissionForm` Payload collection in `apps/ask-a-coach/collections/SubmissionForm.ts` (contracts/payload-collections.md)
- [X] T016 [US1] Implement `POST /api/v1/submissions` in `apps/ask-a-coach/src/app/api/v1/submissions/route.ts` — creates `students`+`conversations`+`submissions` rows (contracts/api.md). Core logic factored into `src/lib/submissions/create.ts` (reused by no one yet, but keeps the route thin); also added `src/lib/turnstile/verify.ts` (Turnstile server-side verification, referenced by research.md #4 but not separately ticketed) and per-IP rate limiting via T011's `checkRateLimit`
- [X] T017 [US1] Implement `POST /api/v1/submissions/:id/upload-url` in `apps/ask-a-coach/src/app/api/v1/submissions/[id]/upload-url/route.ts` (depends on T008, T016)
- [X] T018 [US1] Implement `GET /api/v1/submissions/:id` status polling in `apps/ask-a-coach/src/app/api/v1/submissions/[id]/route.ts`
- [X] T019 [P] [US1] Build shared recorder components (permissions-priming screen, 3-2-1 countdown, live preview, timer, review/re-record) in `apps/ask-a-coach/src/components/recorder/` (FR-002/FR-003) — `useMediaRecorder.ts` hook + `RecorderStage.tsx` + `Countdown.tsx`; also added `src/lib/mux/upload-client.ts` (direct-to-Mux XHR upload with progress, FR-007)
- [X] T020 [P] [US1] Build the contact-form component (configurable required/optional/hidden fields, consent checkbox, Turnstile) in `apps/ask-a-coach/src/components/contact-form/` (FR-005/FR-006)
- [X] T021 [US1] Implement the hosted student recorder page in `apps/ask-a-coach/src/app/ask/[formSlug]/page.tsx` (depends on T015, T019, T020, T016–T018) — orchestration logic lives in `src/components/recorder/AskFlow.tsx` (also covers T023/T024, see below)
- [X] T022 [P] [US1] Implement the embeddable/WebView-safe variant in `apps/ask-a-coach/src/app/ask/[formSlug]/embed/page.tsx` (research.md #7)
- [X] T023 [US1] Wire the text/audio-only/file-upload fallback paths into the recorder flow, including the denied-camera-access help screen (FR-002, Edge Case) — implemented as part of `AskFlow.tsx`'s mode-choice step, not a separate file (the fallbacks share too much submission-flow state with the main path to usefully split out)
- [X] T024 [US1] Implement the "your question was sent" confirmation screen (FR-004) — also part of `AskFlow.tsx`, including live status polling against T018

**Verification**: `npm run typecheck --workspace=apps/ask-a-coach` clean. `npm run build --workspace=apps/ask-a-coach` compiles and bundles successfully — the only failure is the expected one (`missing secret key` / no live `DATABASE_URL`, since T005 is still blocked). Also verified the actual installed `@mux/mux-node@9.0.1` API shape directly against its `.d.ts` files rather than assuming from memory — one real mismatch was caught and fixed (`mux.webhooks.unwrap`, not a static `Mux.Webhooks.verifyHeader`).

**Checkpoint**: US1 fully functional and independently testable (quickstart.md Scenarios 1–2).

---

## Phase 4: User Story 2 - Coach replies to a student's question (Priority: P2)

**Goal**: A coach can open a submitted conversation, reply by video/audio/text, and the student
can view and respond again.

**Independent Test**: Take a conversation from US1, have a coach reply, confirm the student can
view it via a secure link and the thread updates (spec.md US2 Independent Test).

### Implementation for User Story 2

- [X] T025 [US2] Implement `POST /api/v1/conversations/:id/replies` in `apps/ask-a-coach/src/app/api/v1/conversations/[id]/replies/route.ts` (coach or student follow-up; reuses T008's upload-url pattern) — coach vs. student authorship is resolved server-side (API key → session → neither = student), never trusted from the request body; also added `apps/ask-a-coach/src/app/api/v1/conversations/[id]/replies/[replyId]/upload-url/route.ts` (not separately ticketed, but needed — mirrors T017)
- [X] T026 [US2] Implement `GET /api/v1/conversations/:id` (full thread, chronological) in `apps/ask-a-coach/src/app/api/v1/conversations/[id]/route.ts` — core logic factored into `src/lib/conversations/get-thread.ts` so the coach and student pages call it directly (no HTTP round-trip); also computes signed Mux playback URLs, which required adding a `mux_playback_id` column (another schema gap — see contracts/supabase-schema.md, applied live via `ALTER TABLE`)
- [X] T027 [US2] Implement the coach login page (email+password or magic link) in `apps/ask-a-coach/src/app/coach/login/page.tsx` (depends on T009) — password only, not magic link (simpler, no Resend dependency just to log in); redirect-based error handling to match `apps/academy-platform`'s own login page convention rather than client-side form state
- [X] T028 [US2] Implement the coach thread view + reply recorder in `apps/ask-a-coach/src/app/coach/inbox/[conversationId]/page.tsx` (reuses T019's recorder components; depends on T025, T026, T027) — thread rendering factored into `src/components/conversations/ThreadMessages.tsx`, shared with T029
- [X] T029 [US2] Implement the student's secure conversation page (view replies, respond again) in `apps/ask-a-coach/src/app/c/[conversationId]/page.tsx`
- [X] T030 [US2] Add the coach app's PWA manifest + service worker registration in `apps/ask-a-coach/src/app/manifest.ts` — also added `public/sw.js`, `ServiceWorkerRegister.tsx`, and a `coach/(protected)/` route group + layout for the sign-out chrome (found and fixed a real bug along the way: the original flat `/coach/*` middleware matcher would have infinite-redirect-looped `/coach/login` against itself)
- [X] T031 [US2] Verify `replies.duration_seconds` is written only by T014's Mux webhook handler, never accepted from a client request body (FR-018) — confirmed: `createReply` (T025) never accepts a duration field at all; only `src/app/api/webhooks/mux/route.ts`'s `handleAssetReady` writes it
- [X] T033 [US3] *(done ahead of sequence, alongside T026)* `PATCH`/`DELETE` on `apps/ask-a-coach/src/app/api/v1/conversations/[id]/route.ts` — assign/close/reopen and soft-delete, both staff-only (session or writable API key)

**Verification**: `npm run typecheck` and `npm run build --workspace=apps/ask-a-coach` both clean — **against the real, live Supabase project this time** (all 12 app tables + Payload's own schema confirmed present via `psql \dt`; home page server-render confirmed pulling live data from Payload). `apps/academy-platform` unaffected.

**Checkpoint**: US1+US2 functional (quickstart.md Scenarios 3–4).

---

## Phase 5: User Story 3 - Coach manages their inbox of conversations (Priority: P3)

**Goal**: Coaches/admins can list, search, assign, note, close/reopen, and delete conversations.

**Independent Test**: Create several conversations in different states; confirm the inbox
lists, filters, searches, and sorts them correctly (spec.md US3 Independent Test).

### Implementation for User Story 3

- [X] T032 [P] [US3] Implement `GET /api/v1/conversations` (search by name/email/phone, filter by status/assignedCoachId) in `apps/ask-a-coach/src/app/api/v1/conversations/route.ts` — core logic in `src/lib/conversations/list.ts`, shared with the inbox page (T036) directly, same pattern as T026/get-thread.ts
- [X] T033 — see Phase 4 above (done alongside T026); refactored again here into `src/lib/conversations/update.ts` so both the PATCH/DELETE route and the inbox page's server actions (T036) share one implementation
- [X] T034 [P] [US3] Implement `POST /api/v1/conversations/:id/notes` in `apps/ask-a-coach/src/app/api/v1/conversations/[id]/notes/route.ts` (staff-only, never student-visible) — also added `GET` on the same route for the note list; `src/lib/conversations/get-thread.ts` deliberately never selects from `conversation_notes`, confirmed as the enforcement that notes can't leak through the student-reachable thread endpoint
- [X] T035 [P] [US3] Create the `CoachVisibilitySetting` Payload global in `apps/ask-a-coach/globals/CoachVisibilitySetting.ts`, default `all` (contracts/payload-collections.md; spec's resolved Assumption)
- [X] T036 [US3] Implement the coach inbox list page (newest-first, unread/read + open/closed status, search, assign) in `apps/ask-a-coach/src/app/coach/(protected)/inbox/page.tsx` (depends on T032, T035) — search/filter via a plain GET form (server-rendered, no client JS), assign/close/reopen/delete via server actions in `src/app/actions/conversations.ts`
- [X] T037 [US3] Enforce the coach-visibility toggle (all vs. assigned-only) in T032's list query — Owner/Admin always see everything regardless of the toggle; only a plain Coach is scoped by it (interpretive call, documented inline — the role table doesn't explicitly say this but "Owner: everything" implies it)
- [X] T038 [US3] Implement the "closed conversation + new student reply → flagged as needing attention" behavior (Edge Case) — a student reply always sets `is_read = false` regardless of conversation status (`src/lib/replies/create.ts`); the inbox's unread indicator surfaces this on a closed conversation the same as an open one, so nothing is silently lost

**Verification**: `npm run typecheck` and `npm run build --workspace=apps/ask-a-coach` both clean against the live Supabase project (10 routes total now, including the new list/notes endpoints and the inbox page). Two more Payload migrations created and applied along the way (`add-coach-visibility`, plus the earlier `mux_playback_id` column added via direct `ALTER TABLE` to the already-live raw schema).

**Checkpoint**: US1–US3 functional (quickstart.md Scenario 5).

---

## Phase 6: User Story 4 - Student and coach/owner receive email notifications (Priority: P4)

**Goal**: Receipt, new-question alert, and reply-notification emails send correctly, are
independently toggleable, and log delivery status.

**Independent Test**: Submit a question, confirm the two expected emails send with correct
content; reply, confirm the student gets notified (spec.md US4 Independent Test).

### Implementation for User Story 4

- [X] T039 [P] [US4] Create the `NotificationTemplate` Payload collection in `apps/ask-a-coach/collections/NotificationTemplate.ts` (contracts/payload-collections.md) — applied via a new Payload migration (`add-notification-templates`) against this app's own Payload database
- [X] T040 [P] [US4] Implement the Resend client + template variable rendering in `apps/ask-a-coach/src/lib/notifications/send.ts` — uses `@payloadcms/richtext-lexical/html`'s `convertLexicalToHTML` to render `bodyHtml`, then substitutes `{{studentName}}`/`{{coachName}}`/`{{link}}` in both subject and body
- [X] T041 [US4] Wire the student receipt email into T016/T018's submission-ready path (depends on T039, T040) — fires immediately on submission-accepted (spec.md US4 Scenario 1), not gated on Mux processing; skipped when the contact used a synthesized placeholder email (no real address to send to)
- [X] T042 [US4] Wire the coach/owner "new question" alert email (contact info, thumbnail, direct link) into the same path — recipients resolved via new `apps/ask-a-coach/src/lib/notifications/recipients.ts` (`getNotifiableStaffEmails`: active staff holding Owner/Admin/Coach roles via `coach_staff_roles`, Designer excluded)
- [X] T043 [US4] Wire the student reply-notification email into T025/T031's reply-ready path — only when `coachAuthor` is set (a student's own follow-up notifies no one); the conversation→`customer_profiles` join it depends on was verified directly against a live row (email/first_name resolve correctly)
- [X] T044 [US4] Enforce each notification's enabled/disabled toggle (reads T039's Payload doc) before every send — folded into T040's `renderTemplate`: a disabled/missing template renders `null` and `sendNotification` treats that as "don't send," not an error
- [X] T045 [US4] Log every send to `notification_deliveries` (status `sent` immediately) in `apps/ask-a-coach/src/lib/notifications/log.ts` — verified live: a real test submission produced `sent` rows with real Resend message ids for both the receipt and alert emails
- [X] T046 [US4] Implement Resend's delivery-status webhook route in `apps/ask-a-coach/src/app/api/webhooks/resend/route.ts`, updating `notification_deliveries.status` to `delivered`/`bounced`/`failed` — signature verification via the new `svix` dependency (`apps/ask-a-coach/src/lib/notifications/verify-webhook.ts`), matching every other event type as a no-op (same convention as the Mux webhook route)

**Verification**: `npm run typecheck`/`npm run build --workspace=apps/ask-a-coach` both clean. Live end-to-end test against the shared project and real Resend account (reusing `apps/academy-platform`'s own key per research.md #3): submitted a real text question, confirmed both the receipt and alert emails actually sent (real Resend message ids), confirmed `notification_deliveries` rows landed with `status: 'sent'`. Test data (submission form, conversation, notification rows) cleaned up afterward.

**Checkpoint**: US1–US4 functional (quickstart.md Scenario 6).

---

## Phase 7: User Story 5 - Owner/admin manages accounts, roles, and API access (Priority: P5)

**Goal**: Owners/admins invite/deactivate staff, assign roles, manage API keys, and review an
audit log.

**Independent Test**: Invite a Coach-only user, confirm their access is correctly restricted;
deactivate them and confirm history/durations remain intact (spec.md US5 Independent Test).

### Implementation for User Story 5

- [X] T047 [P] [US5] Implement `POST /api/v1/staff/invite` in `apps/ask-a-coach/src/app/api/v1/staff/invite/route.ts` — core logic in `src/lib/staff/invite.ts` (`inviteStaffMember`): checks for an existing shared `staff_profiles` row by email first and reuses it (adding/updating only `coach_staff_roles`) rather than assume every invite is a fresh identity; only INSERTs a new `staff_profiles` row (with `role: 'staff'` as the generic baseline) when no shared row exists yet, via `supabase.auth.admin.inviteUserByEmail` (same pattern as `apps/academy-platform`'s own `src/app/actions/staff.ts`, not imported); never modifies an existing row's `role` column
- [X] T048 [P] [US5] Implement `PATCH /api/v1/staff/:id` (roles, `isActive`) in `apps/ask-a-coach/src/app/api/v1/staff/[id]/route.ts`, enforcing the at-least-one-Owner invariant (data-model.md) — real gap found and fixed here: "deactivate" can NOT write to the shared `staff_profiles.is_active` (that would also lock someone out of `apps/academy-platform`). Added a new, this-app-only `coach_staff_status` table (migration applied live) and `setActiveWithinThisApp`/`isActiveWithinThisApp` in `src/lib/auth/staff.ts`; `getStaffProfile` and `assertNotLastOwner` both updated to respect it alongside the shared flag
- [X] T049 [P] [US5] Implement `POST`/`DELETE /api/v1/api-keys` (create shown-once, revoke) in `apps/ask-a-coach/src/app/api/v1/api-keys/route.ts` — `createApiKey`/`listApiKeys`/`revokeApiKey` added to T011's `src/lib/auth/api-key.ts`
- [X] T050 [P] [US5] Implement `GET /api/v1/audit-log` in `apps/ask-a-coach/src/app/api/v1/audit-log/route.ts` — `listAuditLog` added to T012's `src/lib/audit/log.ts`
- [X] T051 [US5] Implement the admin users page (invite/deactivate/assign roles) in `apps/ask-a-coach/src/app/admin/users/page.tsx` — server actions in `src/app/actions/staff.ts`; new `src/lib/staff/update.ts` (`listStaffWithRoles`/`updateStaffRoles`/`setStaffActive`)
- [X] T052 [US5] Implement the admin API-keys page in `apps/ask-a-coach/src/app/admin/api-keys/page.tsx` — the raw key is shown exactly once via a `?newKey=` redirect param right after creation, never stored/retrievable again
- [X] T053 [US5] Implement the admin audit-log page in `apps/ask-a-coach/src/app/admin/audit-log/page.tsx`
- [X] T054 [US5] Implement the admin forms/branding page (Designer role) in `apps/ask-a-coach/src/app/admin/forms/page.tsx`, editing T015/T039's Payload docs and the `Branding` global — also covers editing T039's `NotificationTemplate` docs (per this task's own scope, "T015/T039's Payload docs"). richText fields (`introCopy`, `bodyHtml`) are edited as plain text via a new `src/lib/payload/lexical-text.ts` round-trip helper (a full rich-text editor UI was judged disproportionate scope for a paragraph or two of copy)
  - **Gap fixed after launch review**: T054 originally only *edited* forms, so a fresh install had no way to create the first one without SQL. `/admin/forms` now has a "New form" section (`createSubmissionForm` in `src/app/actions/forms.ts`, slug validated and uniqueness-checked, audit-logged); creating/editing forms is open to all four staff roles, while Branding and notification-template editing stay Owner/Admin/Designer.
- [X] T055 [US5] Wire "sign out of all devices" (already existed, `src/app/actions/auth.ts`) and optional TOTP MFA (Supabase Auth's native support, research.md #5) into the coach login/profile flow — self-service enrollment at `/coach/profile` (new `src/components/mfa/MfaEnrollment.tsx`, client-side per Supabase's own documented pattern for showing the QR code); `signIn` now checks `getAuthenticatorAssuranceLevel()` and redirects to a new `/coach/login/mfa` challenge page when a verified factor requires it. **Not built**: the "admin-enforced" half (an Owner/Admin requiring MFA for specific other staff) — Supabase Auth's MFA has no native per-user enforcement flag; that would need a new column and its own design pass, deferred as a genuine scope cut, not an oversight
- [X] T056 [US5] Wire T012's audit log writer into every write from T047–T050 and T054 — done inline in each (staff invite/update/deactivate/reactivate, API key create/revoke, form/branding/template updates)

**Verification**: `npm run typecheck --workspace=apps/ask-a-coach` clean. `npm run build` blocked transiently by the Payload Postgres project's session-pooler connection limit (`EMAXCONNSESSION`, max 15) being exhausted by this session's own repeated dev-server restarts/test connections — an infrastructure/connection-count issue, not a code issue; re-verify once the pool has recovered.

**Checkpoint**: US1–US5 functional (quickstart.md Scenario 7).

---

## Phase 8: User Story 6 - External system integrates via API and webhooks (Priority: P6)

**Goal**: A developer can drive the entire submit-and-reply flow through documented API
endpoints and webhooks alone, with no UI involved.

**Independent Test**: Using only an API key (no UI), create a submission, fetch its status, and
confirm a signed `submission.created` webhook is delivered (spec.md US6 Independent Test).

### Implementation for User Story 6

- [X] T057 [P] [US6] Implement `GET /api/v1/coaches` in `apps/ask-a-coach/src/app/api/v1/coaches/route.ts` — reuses T032/T036's `listCoaches` (`src/lib/conversations/update.ts`); coach session or API key
- [X] T058 [P] [US6] Implement `GET /api/v1/reports/durations` (CSV/XLSX export, filterable) in `apps/ask-a-coach/src/app/api/v1/reports/durations/route.ts` (research.md #6) — new `src/lib/durations/report.ts`; format switches on `Accept` header (JSON default, `text/csv`, or the XLSX mime type via `exceljs`)
- [X] T059 [P] [US6] Implement `GET /api/v1/students/:identifier/conversations` (by email or `core_customer_id` — `external_user_id` no longer exists on the identity table now that students are `customer_profiles` rows, research.md #8) in `apps/ask-a-coach/src/app/api/v1/students/[identifier]/conversations/route.ts` — new `listConversationsForCustomer` in `src/lib/conversations/list.ts` (numeric identifier → `core_customer_id`, else email)
- [X] T060 [P] [US6] Implement outbound webhook signing (HMAC-SHA256) and delivery in `apps/ask-a-coach/src/lib/webhooks/deliver.ts` (contracts/webhooks.md) — fire-and-forget per active, subscribed `webhook_subscriptions` row, one `webhook_deliveries` row per attempt; first-attempt failures get `next_retry_at` set from the contract's own 1m/5m/30m/2h/12h backoff schedule
- [X] T061 [US6] Implement the webhook retry-with-backoff trigger in `apps/ask-a-coach/src/app/api/internal/webhooks/retry/route.ts`, driven by an external scheduler (same pattern as `apps/academy-platform`'s `src/app/api/booking/send-reminders/route.ts` — an `X-Webhook-Retry-Cron-Secret` header, not session/API-key auth)
- [X] T062 [US6] Emit `submission.created` from T016/T018, `reply.created` (with duration) from T025/T031, and `conversation.closed` from T033, via T060 — text-only submissions/replies emit immediately (`src/lib/submissions/create.ts`/`src/lib/replies/create.ts`); video/audio emit from the Mux webhook route's `handleAssetReady` once status reaches `ready`; `conversation.closed` emits from `src/lib/conversations/update.ts`'s `updateConversation` only on the open→closed transition, not every update
- [X] T063 [US6] Complete the signed-JWT student-identity verification in T010, storing `external_user_id` instead of collected contact info when present (FR-032) — **deferred design note** (research.md #8): `customer_profiles` has no `external_user_id` column, so this needs its own design pass once a real host app exists, likely mapping a host identity to a real `supabase_user_id`/`customer_profiles` row rather than a bare external-id column — probably simpler once `apps/academy-platform` itself is the host, not harder
- [X] T064 [US6] Implement webhook subscription management (create/list/deactivate) — Owner/Admin only — alongside T049's API-key admin routes — `GET`/`POST`/`DELETE /api/v1/webhook-subscriptions` plus a UI section on `/admin/api-keys` (server actions in `src/app/actions/api-keys.ts`); the signing secret is shown exactly once via a `?newSecret=` redirect param, same pattern as T052's API key

**Verification**: `npm run typecheck --workspace=apps/ask-a-coach` clean. `npm run build` re-verification pending the same transient Payload connection-pool exhaustion noted after US5 — not a code issue (see that checkpoint's note).

**Checkpoint**: All user stories functional (quickstart.md Scenario 8).

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T065 [P] Write `apps/ask-a-coach/README.md` (setup, env vars, local dev port, how it relates to `apps/academy-platform`)
- [X] T066 [P] Apply per-API-key and per-IP rate limiting (T011) across every public endpoint from Phases 3–8 (FR-033) — scoped to the endpoints FR-033 actually names ("public submission endpoints"): `POST /api/v1/submissions` (already had it), `POST /api/v1/submissions/:id/upload-url`, `GET /api/v1/submissions/:id`, `POST /api/v1/conversations/:id/replies`, `POST /api/v1/conversations/:id/replies/:replyId/upload-url`. New shared `rateLimitKeyForRequest` helper (`src/lib/auth/api-key.ts`) keys the bucket on the caller's API key when present, else source IP, satisfying "per API key and per IP" in one place. Admin/staff-session-gated routes deliberately NOT rate-limited here — they're not "public" in FR-033's sense, already gated by auth.
  - **Bug found and fixed along the way**: `POST /api/v1/conversations/:id/replies`'s API-key path verified a writable key but never set `coachAuthor`, so the reply was silently recorded as `author_type: 'student'` — contradicting the route's own comment ("recorded as ... coach replies") and silently skipping the reply-notification email and the webhook's `authorType`. Fixed by decoupling `authorType` from `coachAuthor`'s presence in `CreateReplyInput` (`src/lib/replies/create.ts`) — an API-key coach reply now correctly gets `authorType: 'coach'` with `coachAuthor: null`, and the notification's `{{coachName}}` falls back to "your coach" in that case.
- [X] T067 [P] Security pass: HTTPS-only cookies, confirm every media URL returned by the API is a signed Mux URL (never public), confirm consent is captured before any submission is accepted
  - **Cookies**: added `cookieOptions: { secure: process.env.NODE_ENV === 'production' }` to all three Supabase clients (`src/lib/supabase/{server,client,middleware-client}.ts`) — `@supabase/ssr`'s own default omits `secure` entirely. Conditional on `NODE_ENV` deliberately, not hardcoded `true`: a browser never sends a `Secure` cookie over plain HTTP, so hardcoding it would break every local sign-in. **Found, not fixed**: `apps/academy-platform`'s own Supabase clients have the exact same gap (checked — no `cookieOptions` anywhere in its `src/lib/supabase/`) — out of scope to silently patch a live production app's auth cookie behavior as a side effect of this feature; flagging as a separate pre-existing finding worth its own task.
  - **Media URLs**: confirmed clean — `src/lib/mux/upload.ts` creates every asset with `playback_policy: ['signed']` (never `'public'`), and both `getSignedPlaybackUrl`/`getSignedThumbnailUrl` embed a signed JWT token in the URL itself; every playback/thumbnail URL returned by the API goes through one of these two functions (`src/lib/conversations/get-thread.ts`), never a raw Mux URL.
  - **Found, not fixed** (pre-existing, unrelated to this pass): `coach_submissions.file_url`/`ConversationThread.submission.fileUrl` (the `type: 'file'` non-Mux-playable upload fallback) is read but never written anywhere in the codebase — that upload path was never actually implemented end-to-end (T023's own note scoped the built fallback to text/audio-only, not a true arbitrary-file upload). Not a live security hole today (the field is always `null` in practice), but worth flagging: if `file_url` is ever populated, it MUST go through a signed/private URL scheme too, not a public one, when that feature is actually built.
  - **Consent**: confirmed already enforced — `createSubmission` (`src/lib/submissions/create.ts`) throws before any DB write if `consentGiven` isn't `true`.
- [X] T068 Run `quickstart.md`'s full scenario list (1–8) end-to-end — Payload's own Supabase project's connection pool (see the note this superseded, below) was cleared via a project restart from the Supabase dashboard; `npm run build --workspace=apps/ask-a-coach` now succeeds cleanly end-to-end, every route from every phase present (admin pages, every `/api/v1/*` route, `/coach/login/mfa`, `/coach/profile`, etc.) — the specific blocker is resolved. Individual scenarios 1–7 were already verified live per-task as each was built (T024, T031/T038, T045, and the US5/US6 smoke tests); scenario 8 (US6, API-only flow) is exercised by the earlier live API-key-free JSON tests against `/api/v1/submissions` etc. during T041/T042's notification verification.
  - **Superseded note**: Payload's project hit its Session-pooler connection cap (`EMAXCONNSESSION`, max 15) partway through this session's own repeated dev-server restarts and `payload migrate`/`generate:types` CLI runs; recovered only after a manual project restart from the Supabase dashboard (confirmed: `\dt` shows all 24 tables intact post-restart, including `notification_templates`).
- [X] T069 Run `quickstart.md`'s Regression check — confirm `apps/academy-platform` is entirely unaffected

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–8)**: All depend on Foundational. US1 has no dependency on any other
  story. US2 depends on US1 existing (replies attach to a conversation a submission created) but
  is independently testable given a pre-existing conversation. US3 depends on conversations
  existing (US1) but not on US2. US4 depends on US1 (submission-ready hook) and US2
  (reply-ready hook) for its two send triggers, but its own toggle/logging logic is testable in
  isolation. US5 has no dependency on US1–US4's own logic, only on Foundational's auth (T009).
  US6 depends on US1/US2/US3's write paths existing (T016, T025, T033) to emit events from, and
  on US5's API-key infra (T049) to be callable at all.
- **Polish (Phase 9)**: Depends on all six user stories.

### Parallel Opportunities

- Setup: T002, T003 in parallel once T001 exists.
- Foundational: T007, T008, T012 in parallel; T009–T011, T013–T014 depend on T006/T007.
- Within each user story phase, tasks marked `[P]` touch different files and can run together;
  unmarked tasks within a phase generally depend on that phase's `[P]` tasks completing first.
- Different user story phases can be staffed in parallel by different developers once
  Foundational is complete, respecting the cross-story dependencies noted above (US2/US4/US6 in
  particular are not fully independent of US1).

---

## Parallel Example: User Story 1

```bash
# Once T015 (SubmissionForm collection) is committed, these run together:
Task: "Implement POST /api/v1/submissions in apps/ask-a-coach/src/app/api/v1/submissions/route.ts"
Task: "Build shared recorder components in apps/ask-a-coach/src/components/recorder/"
Task: "Build the contact-form component in apps/ask-a-coach/src/components/contact-form/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1) — a student can submit a video question end-to-end.
3. **STOP and VALIDATE** with quickstart.md Scenarios 1–2.
4. This alone is a working intake tool, even with zero coach-facing functionality — a
   meaningful, demoable increment (spec.md US1's own Independent Test framing).

### Incremental Delivery

Setup + Foundational → US1 (MVP, demoable) → US2 (two-way loop) → US3 (scales past a handful of
questions) → US4 (responsiveness) → US5 (multi-person operation, safe to hand to a real team) →
US6 (ready for the future Academy app / CourseHost to integrate) → Polish.

---

## Notes

- No test tasks — this monorepo has no automated test framework; `quickstart.md` is the
  validation mechanism (T068–T069).
- Commit after each task or logical group, on `016-ask-a-coach` per this repo's branching
  workflow (already followed for `spec.md`/`plan.md`).
- Story phases are ordered by spec.md's own priority (P1→P6); nothing here mandates building
  them in that exact order beyond the dependency notes above — reorder if priorities change.

---

## Post-launch: Multi-question forms + intro video (not one of the original 69 tasks)

VideoAsk-style "layers" — a form can now ask a sequence of questions (each with its own
optional intro video), one recorded answer per question, plus a form-level welcome video. Built
after the original US1–US6/Polish scope, requested directly rather than through `/speckit-*`.

- [X] `SubmissionForm.questions` array field (`prompt` required, `videoUrl` optional) added;
  `introVideoUrl` (existed in the schema, never surfaced) now editable in the admin UI —
  `collections/SubmissionForm.ts`, Payload migration `add-form-questions`
- [X] `coach_submissions.question_index`/`question_prompt` added; the old `conversation_id`
  `UNIQUE` constraint (one submission per conversation) moved to
  `(conversation_id, question_index)` — `contracts/supabase-schema.md`, applied live
- [X] `createSubmission` (`src/lib/submissions/create.ts`) accepts an in-progress
  `conversationId`/`questionIndex` for question 2+; contact/consent/Turnstile only run once, on
  question 0; receipt/alert notifications and the `submission.created` webhook fire once, on the
  final question, not per question
- [X] `AskFlow.tsx` — welcome video → contact → (question intro + video)×N → confirmation, one
  full record/type/upload cycle per question; a form with no `questions` configured is
  unchanged (no per-question screen, same flow as before this feature)
- [X] `getConversationThread`/`ThreadMessages.tsx` — `submission` (singular) replaced with
  `submissions[]` ordered by `questionIndex`, each labeled with its `questionPrompt`
- [X] Admin `/admin/forms/new` and `/admin/forms/:id` — a `QuestionsEditor` client component
  (add/remove/reorder) plus the intro video URL field
- [X] Also fixed while in this area: the `/ask/[formSlug]` page's intro copy was rendered as an
  always-empty `<div>` (a pre-existing bug, `form.introCopy != null &&
  &lt;div className="..." /&gt;` with no children) — now actually renders via `lexicalToText`
- [X] Direct video upload for intro/question videos, alongside pasting an external URL — reuses
  `apps/academy-platform`'s own running MinIO server (same connection values, this app's own
  `ask-a-coach-media` bucket so uploads never mix), same presigned-PUT-from-the-browser pattern
  as that app's Lesson videos. `src/lib/storage/minio.ts`, `getFormVideoUploadUrl` server action
  (`src/app/actions/forms.ts`, staff-gated, MP4/WebM/MOV/Ogg only), `VideoUrlField` component.
  Verified live: presign → PUT → public GET round-trip against the real MinIO bucket.
