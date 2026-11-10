# Phase 1 Data Model: Ask a Coach

Business tables (`conversations`, `coach_submissions`, `replies`, `coach_staff_roles`,
`api_keys`, `webhook_subscriptions`, `webhook_deliveries`, `notification_deliveries`,
`audit_log`) live in `apps/academy-platform`'s existing Supabase Postgres project, with real
foreign keys into that project's shared identity tables (research.md #8). Payload's own
authored content (`SubmissionForm`, `Branding`, `CoachVisibilitySetting`) stays on this app's
own, separate Supabase Postgres project — see the note at the bottom of this file. Full SQL
(constraints, indexes, RLS policies) is in
[`contracts/supabase-schema.md`](./contracts/supabase-schema.md); this file describes the
entities, their relationships, and the rationale behind non-obvious choices.

## Identity: reused from `apps/academy-platform`

Students and staff are **not** separate tables owned by this app — both are the same
`customer_profiles`/`staff_profiles` tables `apps/academy-platform` already owns (full DDL in that
app's own specs: `002-supabase-auth-user-data`, `003-roles-admin-staff`,
`012-student-enrollment`, `014-independent-account-signup`), not redefined here.

- **Students** → `customer_profiles`. An anonymous submitter (no login) becomes a real row
  immediately: `supabase_user_id: null`, a fresh negative `core_customer_id` from the existing
  `next_native_customer_id()` RPC, `account_origin: 'native'`, and a new `source_app:
  'ask-a-coach'` column (added here, additive/nullable) so `apps/academy-platform`'s own admin
  Customer Console can eventually filter these out. Repeat visits are matched by email
  (case-insensitive) or the also-new nullable `phone` column, so one person's conversations
  accumulate on one row. `email`/`first_name` stay `NOT NULL` (not relaxed — several
  `apps/academy-platform` render paths assume non-null strings); when absent, synthesized as
  `'Guest'` / `phone+<digits>@no-email.ask-a-coach.internal`. Implemented in
  `apps/ask-a-coach/src/lib/identity/customer.ts`'s `resolveOrCreateCustomer`.
- **Staff** → `staff_profiles`, keyed by `supabase_user_id` (that row's own `id` is a separate
  generated PK, **not** the Supabase auth uid — unlike this app's old, removed local
  `staff_profiles`, where `id` *was* the auth uid directly). `apps/academy-platform`'s fixed
  3-value role enum is untouched; this app's own role needs are met by `coach_staff_roles`
  below.
- **Host-identity JWT verification** (`verifyHostIdentityToken`,
  `apps/ask-a-coach/src/lib/students/host-token.ts`) is unrelated to this and unchanged — it
  only decodes a signed token from a future host app; it never touches `customer_profiles`
  directly (T063 gets its own design pass for that mapping once a real host app exists).

## `conversations`

One thread per original submission. `status` (`open`/`closed`), `is_read`, and
`assigned_coach_id` (nullable — visible-to-all-coaches by default per spec's resolved
Assumption) live here rather than on `submissions`, since a conversation's lifecycle state is
independent of the immutable submission that started it.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `customer_profile_id` | FK → `customer_profiles.id` (shared, see "Identity" above) |
| `status` | `'open'` \| `'closed'`, default `'open'` |
| `is_read` | boolean, default `false` |
| `assigned_coach_id` | FK → `staff_profiles.id`, nullable |
| `created_at`, `updated_at` | timestamptz |

A student replying to a closed conversation (Edge Case) sets `status` back toward needing
attention — handled at the application layer (not a DB trigger), since "needs attention" is a
derived view (`status = 'open' AND is_read = false`), not a third status value.

## `conversation_notes`

Internal, staff-only notes on a conversation (FR-014) — a separate table, not a single text
column on `conversations`, since multiple notes accumulate over a conversation's life and each
needs its own author/timestamp.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `conversation_id` | FK → `conversations.id` |
| `author_staff_id` | FK → `staff_profiles.id`, nullable — a writable API key is a valid author with no specific staff member to attribute it to, same reasoning as `replies.author_staff_id` (found and fixed via live testing, T068: this endpoint accepts API-key auth per `contracts/api.md` but originally couldn't satisfy a `NOT NULL` constraint here) |
| `body` | text |
| `created_at` | timestamptz |

## `coach_submissions`

The student's original question(s). Named `coach_submissions` (not `submissions`) because
`apps/academy-platform`'s shared Supabase project already has its own, unrelated `public.
submissions` table (a course-assignment video-review feature) — see research.md #8. A submission
always opens its conversation (never a reply); immutable once `status` reaches `'ready'` or
`'failed'`.

**Multi-question forms** (post-launch addition, VideoAsk-style "layers" —
`SubmissionForm.questions`, `contracts/payload-collections.md`): a conversation can now have more
than one row here, one per question the form asked, each recorded/typed separately by the
student in sequence. A single-question form (the original, still-default behavior) still
produces exactly one row, `question_index = 0`. Originally `conversation_id` alone was `UNIQUE`
(1:1); that constraint moved to `(conversation_id, question_index)` to allow this.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `conversation_id` | FK → `conversations.id` |
| `question_index` | integer, default `0` — 0-based position among this conversation's questions; unique together with `conversation_id` |
| `question_prompt` | nullable — a snapshot of `SubmissionForm.questions[question_index].prompt` at submission time, so a coach reviewing later still sees which question was answered even if the form's questions changed since |
| `type` | `'video'` \| `'audio'` \| `'text'` \| `'file'` |
| `mux_upload_id` | nullable — set immediately when the direct upload is created; links to the eventual `mux_asset_id` before Mux's webhook can supply it (added during implementation, T014) |
| `mux_asset_id` | nullable — set for `video`/`audio` |
| `text_content` | nullable — set for `type = 'text'` |
| `file_url` | nullable — set for `type = 'file'` when the upload isn't a Mux-playable asset (research.md #1) |
| `thumbnail_url` | nullable, populated from Mux once ready |
| `transcript` | nullable — optional per spec, not required at launch |
| `status` | `'processing'` \| `'ready'` \| `'failed'` |
| `created_at` | timestamptz |

## `replies`

Every subsequent message in a conversation — from either a coach or a student's follow-up.
`duration_seconds` is populated **only** for a coach's video/audio reply (FR-018); always `NULL`
for text replies and for every student reply, per spec ("Student submissions are not
duration-tracked").

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `conversation_id` | FK → `conversations.id` |
| `author_type` | `'coach'` \| `'student'` |
| `author_staff_id` | FK → `staff_profiles.id`, nullable (set iff `author_type = 'coach'`) |
| `type` | `'video'` \| `'audio'` \| `'text'` |
| `mux_upload_id` | nullable — same purpose as `submissions.mux_upload_id` |
| `mux_asset_id` | nullable |
| `text_content` | nullable |
| `duration_seconds` | integer, nullable — coach video/audio replies only (FR-018/FR-020) |
| `status` | `'processing'` \| `'ready'` \| `'failed'` |
| `created_at` | timestamptz |

`duration_seconds` is written once, from the Mux `video.asset.ready` webhook's own `duration`
field (research.md #1) — never computed or accepted from the client, and **persists even if the
conversation is later deleted or the coach deactivated** (FR-019): `replies` rows are never
cascade-deleted when a conversation is deleted (see Deletion below) or a `staff_profiles` row is
deactivated (deactivation is a flag, not a delete — see `staff_profiles`).

**Deletion (FR-014's "delete" action)**: soft-delete via a `deleted_at` timestamptz on
`conversations` — the coach-facing "delete" hides a conversation from the inbox, but its
`replies` rows (and their duration records) are retained, satisfying FR-019 without a hard
`ON DELETE CASCADE`.

## `coach_staff_roles`

A join table, not an enum column, because a user can hold more than one role at once (spec: "A
user can hold more than one role") — `apps/academy-platform`'s own `staff_profiles.role` is a
single-value enum and stays that way; this table is this app's own role assignment, layered on
top of the shared identity row (research.md #8). Anyone whose only reason to have a
`staff_profiles` row is this app still gets one (the shared table's `role` column is `NOT
NULL`) using the generic `'staff'` baseline — their real permissions come entirely from here.

| Column | Notes |
|---|---|
| `staff_id` | FK → `staff_profiles.id` (shared — this row's own PK, not the Supabase auth uid) |
| `role` | `'owner'` \| `'admin'` \| `'designer'` \| `'coach'` |
| PK | `(staff_id, role)` |

**At-least-one-Owner invariant** (FR-027): enforced at the application layer on every role
change/deactivation (check "does at least one *other* active staff_profiles row hold `'owner'`"
before allowing the last one removed or deactivated) — a DB-level constraint can't easily
express "at least one row of this table has role X" without a trigger, and the app layer is
already the enforcement point for every other authorization rule in this monorepo's convention.

## `api_keys`

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `name` | text |
| `hashed_key` | text — the key is shown in full exactly once at creation, never stored plaintext |
| `is_read_only` | boolean, default `true` (FR-030: read-only by default) |
| `created_by_staff_id` | FK → `staff_profiles.id` |
| `revoked_at` | nullable timestamptz |
| `last_used_at` | nullable timestamptz |
| `created_at` | timestamptz |

## `webhook_subscriptions` / `webhook_deliveries`

Outbound webhooks — `submission.created`, `reply.created` (with duration), `conversation.closed`
(FR-031). A delivery row is created per event per subscription, so retry state and the delivery
log are per-attempt, not per-event.

| `webhook_subscriptions` | Notes |
|---|---|
| `id` | uuid PK |
| `url` | text |
| `signing_secret` | text |
| `events` | text[] — which event types this subscription wants |
| `is_active` | boolean |

| `webhook_deliveries` | Notes |
|---|---|
| `id` | uuid PK |
| `subscription_id` | FK |
| `event_type` | text |
| `payload` | jsonb |
| `status` | `'pending'` \| `'delivered'` \| `'failed'` |
| `attempt_count` | integer |
| `next_retry_at` | nullable timestamptz |
| `last_attempted_at` | nullable timestamptz |

## `notification_deliveries`

Per-send delivery-status log for the three email types (receipt, coach alert, reply
notification) — FR-024.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `conversation_id` | FK, nullable |
| `notification_type` | `'receipt'` \| `'alert'` \| `'reply'` |
| `recipient_email` | text |
| `status` | `'sent'` \| `'delivered'` \| `'bounced'` \| `'failed'` |
| `provider_message_id` | text, nullable — Resend's own id, for reconciling delivery webhooks |
| `sent_at` | timestamptz |

## `audit_log`

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `actor_staff_id` | FK → `staff_profiles.id` |
| `action` | text (e.g. `'form.updated'`, `'role.granted'`, `'api_key.revoked'`) |
| `target_type`, `target_id` | text — what was changed |
| `diff` | jsonb, nullable |
| `created_at` | timestamptz |

## Payload-owned content (this app's own separate Supabase project — see research.md #2 and #8)

- **`SubmissionForm`** (collection) — prompt/intro copy, intro video reference, which contact
  fields are required/optional/hidden, max recording length (student side).
- **`NotificationTemplate`** (collection, one doc per notification type) — enabled/disabled
  toggle, subject/body wording with variable placeholders (student name, coach name, link).
- **`Branding`** (global) — colors, logo, font, favicon, applied to recorder/coach app/emails.
