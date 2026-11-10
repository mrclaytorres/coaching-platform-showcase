# Quickstart: Validating Ask a Coach

**Branch**: `016-ask-a-coach` | **Date**: 2026-09-17

Manual validation guide (no automated test framework — same precedent as every other feature in
this monorepo). Uses Mux's test/sandbox environment and this app's own dedicated Supabase
project throughout.

## Prerequisites

- `apps/ask-a-coach/.env` populated: this app's own Supabase project keys/`DATABASE_URL`, a Mux
  test-environment token pair + webhook signing secret, `RESEND_API_KEY` (test mode/sandbox
  domain), `NEXT_PUBLIC_APP_URL` pointed at wherever this app is running locally (a different
  port from `apps/academy-platform`, per plan.md's Target Platform note).
- At least one active `SubmissionForm` document (Payload) with contact fields configured and
  `isActive: true`.
- At least one staff account seeded with the Owner role (see research.md #5 for Supabase Auth
  setup — the exact seeding mechanism is an implementation-time detail, matching how
  `apps/academy-platform` handles its own first-super-admin auto-provisioning).

## Scenario 1 — Student submits a video question (US1)

1. Visit the hosted form URL (`/ask/[slug]`) logged out.
2. Grant camera/mic access when prompted, complete the 3-2-1 countdown, record a short clip,
   review it, submit.
3. Fill the contact screen (whichever fields the form requires) and accept consent.
4. Confirm: a "your question was sent" confirmation screen appears.
5. Confirm (as staff, or via `GET /api/v1/submissions/:id`): the submission starts `processing`,
   then flips to `ready` once Mux's `video.asset.ready` webhook lands, with a thumbnail set.
6. Confirm the student receipt email sends (FR-004/US4) with a working secure conversation link.

## Scenario 2 — Denied camera access falls back gracefully (US1, Edge Case)

1. Visit the form with camera/mic permissions blocked at the browser level.
2. Confirm: clear help text appears, and a text or file-upload fallback is reachable and
   completable without ever being offered the camera flow again.

## Scenario 3 — Coach replies, student sees it (US2)

1. As a coach (or admin), open the inbox, find the Scenario 1 conversation.
2. Open the thread, confirm the original submission plays back via a signed URL (not a public
   one — inspect the URL).
3. Record and send a video reply.
4. Confirm: `replies.duration_seconds` is populated once Mux processes it — compare against the
   actual clip length; confirm it did **not** come from a client-reported value (e.g. check it's
   absent/`null` immediately after send, before Mux's webhook lands, then appears after).
5. Confirm the student gets a reply-notification email with a secure link.
6. As the student, open that link, watch the reply, and send a follow-up message in the same
   thread — confirm it appears in the thread without re-collecting contact info.

## Scenario 4 — Discarded re-recording is never stored (US2, Edge Case)

1. As a coach, start recording a reply, then discard the take before sending.
2. Confirm: no reply row, no duration record, exists for that discarded take.

## Scenario 5 — Inbox search, assignment, visibility (US3)

1. Create a second conversation from a different student.
2. As a coach, search by the first student's name — confirm only that conversation appears.
3. Assign the second conversation to a specific coach.
4. Toggle `CoachVisibilitySetting` to `assigned_only` — confirm a coach not assigned to the
   second conversation no longer sees it; toggle back to `all` — confirm it reappears for
   everyone.
5. Close the first conversation, then (as the student) send a follow-up — confirm the
   conversation surfaces as needing attention again rather than the reply being lost.

## Scenario 6 — Notification toggles (US4)

1. Disable the "new question" alert template (Payload).
2. Submit a new question — confirm no alert email sends, but the student receipt still does.
3. Re-enable it; confirm the next submission's alert sends again.
4. Check `notification_deliveries` reflects `sent`/`delivered`/`bounced`/`failed` accurately for
   at least one real send (Resend's test mode / sandbox domain).

## Scenario 7 — Roles & deactivation (US5)

1. As Owner, invite a new user with only the Coach role.
2. As that user, confirm you can view/reply/note/close conversations but attempting to edit a
   form, a setting, or another user is refused.
3. Deactivate that coach (don't delete). Confirm their prior replies/durations are still visible
   and correctly attributed.
4. As Owner, attempt to remove the last remaining Owner role — confirm it's refused.
5. Confirm every one of the above (role invite, deactivation, refused last-Owner removal)
   produced an `audit_log` row.

## Scenario 8 — API-first integration (US6)

1. Create an API key (read-only by default).
2. Using only `curl`/Postman and that key (no UI at all), call `POST /api/v1/submissions`
   through to a completed, `ready` submission — confirm it's indistinguishable in the inbox from
   one submitted through the recorder UI.
3. Attempt a write (`PATCH /api/v1/conversations/:id`) with the read-only key — confirm `403`.
4. Register a webhook subscription for `reply.created`; send a reply; confirm a signed delivery
   arrives at a test endpoint (e.g. a temporary `webhook.site` URL) with a valid HMAC signature
   and the correct `durationSeconds`.
5. Kill that test endpoint, trigger another reply, confirm the delivery is retried with backoff
   and eventually logged as `failed` — not silently dropped.
6. Submit a request with a signed student-identity JWT — confirm the contact screen is skipped
   and the resulting `students` row has `external_user_id` set instead of a collected email.

## Regression check

Since this is a new app, there's no prior behavior to regress — the "regression check" here is
confirming `apps/academy-platform` is entirely unaffected: run any of its own quickstart scenarios
(e.g. `specs/015-expanded-payments/quickstart.md` Scenario 1) unmodified, confirming this app's
addition to the monorepo changed nothing about the other one's behavior, database, or deploy.
