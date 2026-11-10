# Phase 0 Research: Ask a Coach

## #1 — Video provider: Mux, not self-hosted S3+ffmpeg

**Decision**: Mux, for upload, transcoding, playback, thumbnails, and duration.

**Rationale**: The source dev spec's own "Recommended starting technology" table names Mux
first, specifically because it removes the need to build and run an upload/transcode/thumbnail
pipeline (ffmpeg/ffprobe) in-house — direct-from-device uploads via a short-lived signed URL
(FR-007), a ready-made signed-playback player (FR-009), automatic thumbnails (FR-010), and,
critically, server-measured reply duration for free via the `video.asset.ready` webhook's own
`duration` field (FR-018) — exactly the "never trust the browser's reported length" requirement.
Building this from S3+ffmpeg would mean maintaining a transcoding worker fleet and an ffprobe
duration pipeline ourselves, for a single-tenant, low-volume app — not justified at this scale.

Mux also natively supports **audio-only** assets (covers the audio fallback, FR-002) and
**arbitrary file uploads that aren't video/audio** can still go through Mux's direct-upload flow
as a generic asset if playable, or bypass Mux entirely and store as a plain private Supabase
Storage object if not — see data-model.md's `submissions.file_url` for the narrow non-Mux case
(e.g. a PDF or image "answer" file, which Mux has no reason to touch).

**Alternatives considered**: S3 + ffmpeg + ffprobe (spec's own "fallback if avoiding a video
vendor") — rejected for this build: more infrastructure to run and maintain (transcode workers,
a duration-extraction step) for a benefit (avoiding a vendor) that doesn't matter at this scale.
Cloudflare Stream / api.video (spec's named alternatives to Mux) — not evaluated in depth; Mux
is the spec's explicit top pick and satisfies every requirement, so there was no forcing
function to compare further. Revisit only if Mux's pricing/limits become a real constraint at
higher volume.

## #2 — Payload vs. Supabase split: authored content in Payload, transactional data in Supabase

**Decision**: Mirror `apps/academy-platform`'s existing split exactly. Payload owns:
the submission form's configurable shape (which contact fields are required/optional/hidden,
intro copy/video, max recording length), notification email template wording, and branding
config (colors/logo/font/favicon) — content a Designer role edits (FR: Designer role can "edit
forms: prompts, intro videos, contact fields, time limits, email wording"). Supabase owns
everything transactional/relational: students, conversations, submissions, replies, staff
accounts + roles, API keys, webhook subscriptions/deliveries, notification delivery log, audit
log.

**Rationale**: This is precisely the distinction `apps/academy-platform` already draws (Payload for
Courses/Tiers/Lessons/pricing an admin authors; Supabase for purchases/progress/enrollment a
user's actions generate) — reusing it here means a Designer's form edits go through the same
kind of authoring UI pattern already proven in this monorepo, while every write with a real
authorization/business-logic requirement (who can reply, who owns a conversation, duration
integrity) goes through the Next.js server layer against Supabase, with RLS as defense-in-depth
— not through Payload's own access-control functions (established convention,
`004-course-lesson-management` research.md #3, reused unchanged here).

**Alternatives considered**: Everything in Supabase, including form config — rejected because it
would mean building a bespoke admin-editing UI for form fields from scratch instead of reusing
Payload's. Everything in Payload, including submissions/replies/duration records — rejected
because Payload access control isn't where this monorepo enforces authorization (per the cited
convention), and high-write-volume transactional data (a reply is written on every coach
response) doesn't fit Payload's authored-content model.

## #3 — Email provider: Resend, not Postmark/SendGrid/SES

**Decision**: Resend.

**Rationale**: Already integrated in this monorepo (`apps/academy-platform`'s Coach Session
Booking feature, `specs/013-coach-session-booking`) — `RESEND_API_KEY`/`BOOKING_EMAIL_FROM`
already exist as an established pattern. The source dev spec explicitly notes the email
provider choice is "likely shared with the future Live Coaching app," so picking the vendor
already proven in this codebase, rather than a fresh one, is the lower-risk default and keeps
one transactional-email relationship (domain auth, deliverability reputation) across the whole
Academy App monorepo instead of two.

**Alternatives considered**: Postmark, SendGrid, AWS SES (all named in the source dev spec as
options) — no functional reason to prefer any of them over Resend for this app's needs
(transactional send + delivery-status webhooks, FR-024); introducing a second vendor purely for
this one app would work against the spec's own stated goal of a shared provider later.

## #4 — Spam protection: Cloudflare Turnstile

**Decision**: Cloudflare Turnstile (invisible mode) on the public submission endpoint.

**Rationale**: `apps/academy-platform`'s own `.env.example` already references a Cloudflare WAF
bypass header (`CORE_WAF_BYPASS`) for the legacy Academy API, meaning Cloudflare is already part of
this org's infrastructure — Turnstile is Cloudflare's own invisible CAPTCHA product, free, and
requires no new vendor relationship. Combined with IP+API-key rate limiting (FR-033), satisfies
FR-006's "invisible CAPTCHA and rate limiting" requirement without adding an unrelated vendor.

**Alternatives considered**: hCaptcha, Google reCAPTCHA — both viable, but Turnstile's fit with
existing Cloudflare usage made it the lower-friction default; no other requirement favors one
over another.

## #5 — Coach/admin 2FA: Supabase Auth's built-in TOTP MFA

**Decision**: Use Supabase Auth's native TOTP (authenticator-app) multi-factor auth for the
optional/admin-enforceable 2FA requirement (FR-025).

**Rationale**: The shared Supabase project (see #8 below) already provides auth; Supabase Auth
ships TOTP MFA out of the box, requiring no third-party MFA service or custom implementation —
same "use what the platform already gives you" reasoning as `#3`/`#4` above.

**Alternatives considered**: A custom TOTP implementation, or a third-party MFA provider — both
rejected as unnecessary work duplicating a capability Supabase Auth already provides natively.

## #6 — Duration export: `exceljs` for XLSX, plain CSV serialization for CSV

**Decision**: Hand-serialize CSV (no dependency needed — it's a handful of fixed columns);
use `exceljs` for XLSX generation (FR-021).

**Rationale**: `exceljs` is a widely-used, actively maintained library with no native-binary
build step (important since this needs to run in the same Node/Next.js server process, same as
every other dependency in this monorepo) and supports streaming generation for larger exports.
CSV needs no library at all for a small, fixed set of columns (coach, conversation, date/time,
reply type, duration) — a dependency would be overkill.

**Alternatives considered**: `xlsx` (SheetJS) — also viable, but `exceljs`'s API is more
ergonomic for simple tabular exports and doesn't carry SheetJS's history of restrictive
licensing changes on newer versions.

## #7 — One Next.js app serves student recorder + coach PWA + public API, not three separate deployables

**Decision**: `apps/ask-a-coach/` is a single Next.js App Router application. The "embeddable
student recorder," "hosted page," "WebView-compatible URL," "coach PWA," and "public REST API"
required by the spec (Integration-ready architecture requirements) are all route groups /
components of this one app, not separate builds or services.

**Rationale**: Next.js App Router already serves this well: distinct routes for the hosted
recorder page vs. its embeddable variant (an iframe/WebView-safe route with minimal chrome),
a `manifest.json` + service worker on the coach routes makes that surface installable as a PWA
without a separate project, and `api/v1/*` route handlers are the public REST API — all sharing
one codebase, one deploy, one database connection pool. Splitting these into separate
deployables would multiply operational surface (three things to build/deploy/monitor) for a
single-tenant, low-volume app with no requirement forcing that separation.

**Alternatives considered**: A separate lightweight embed-only build (e.g. a standalone bundled
JS widget) for the "embeddable web component" requirement — deferred, not rejected outright:
the spec explicitly lists "an embeddable web component or React component" as one of three
delivery forms, and a Next.js route rendered inside an iframe satisfies the embeddable
requirement adequately for launch (matches how the current host, CourseHost, would embed it — an
iframe pointed at a hosted URL). A true framework-agnostic embeddable component (importable
into arbitrary host JS without an iframe) can be extracted later if a concrete integration
needs it; building it speculatively now isn't justified.

## #8 — Shared identity with `apps/academy-platform`, not a separate Supabase project

**Decision**: Reversing this feature's original tech-stack decision (own, separate Supabase
project for everything) — this app now authenticates against `apps/academy-platform`'s existing
Supabase Auth (`auth.users`) and reuses its `customer_profiles`/`staff_profiles` tables for ALL
identity, staff and students alike. This app's own business tables (`conversations`,
`coach_submissions`, `replies`, `coach_staff_roles`, `api_keys`, `webhook_subscriptions`,
`webhook_deliveries`, `notification_deliveries`, `audit_log`) now live in
`apps/academy-platform`'s Supabase project too, with real foreign keys into the shared identity
tables. The original `students` table and this app's own local `staff_profiles`/`staff_roles`
tables are removed.

**Rationale**: Explicit, direct user instruction, given after the original separate-project
build was already in progress: "I don't want a separate users for our ask-a-coach application,
users should be universal across all of the apps," scoped on request to "Staff AND students —
one identity for everyone everywhere." Postgres has no cross-database foreign keys, so a real
(not just application-level, string-matched) shared identity requires one shared database —
this was evaluated explicitly against keeping the databases separate (an app-level identity
sync/matching approach) and rejected: it would only ever approximate shared identity, drift over
time, and add sync code, where the shared-database approach gets a real, enforced link for free.

**Reconciling the two apps' different role models**: `apps/academy-platform`'s `staff_profiles`
has a single, fixed 3-value role enum (`super_admin`/`coach`/`staff`) — untouched by this
change. This app's own, already-built 4-role system (`owner`/`admin`/`designer`/`coach`,
genuine multi-role via a join table) is kept as-is, just repointed: the join table is renamed
`coach_staff_roles` and its `staff_id` now references the *shared* `staff_profiles.id` instead
of a locally-owned row. Anyone whose only reason to exist is this app still gets a shared
`staff_profiles` row (the role enum is `NOT NULL`) using the generic `role: 'staff'` baseline —
their real permissions come entirely from `coach_staff_roles`, never from
`apps/academy-platform`'s own `role` column, which this feature never reads or writes.

**Reconciling students with `customer_profiles`**: the original `students` table allowed a
fully anonymous submitter (no login, possibly only a phone number, no unique constraint on
email). `customer_profiles` requires `email`/`first_name` (`NOT NULL`, relied on by several
`apps/academy-platform` render paths as non-null strings — not relaxed). An anonymous submitter
becomes a real, immediate `customer_profiles` row — the same shape
`createPendingCustomerProfile`/`createNativeCustomerProfile` already use elsewhere in
`apps/academy-platform` for pre-enrollment/native signups (`supabase_user_id: null`, a fresh
negative id from the existing `next_native_customer_id()` RPC, `account_origin: 'native'`) —
with absent `email`/`first_name` synthesized (`'Guest'`, a `phone+<digits>@no-email.
ask-a-coach.internal` placeholder) rather than relaxing the shared table's constraints. Repeat
visits are matched by email (case-insensitive) or phone so one person's conversations
accumulate on one row. A new nullable `phone` column was added to `customer_profiles` for this
(additive, zero impact on existing rows).

**Guest-row visibility in `apps/academy-platform`'s own admin Customer Console**: flagged and
confirmed with the user before implementing — every anonymous Ask-a-Coach submitter becomes a
row in the same table `apps/academy-platform` staff use for their own customer list/search.
Resolved by adding a second additive, nullable `source_app` column (`'ask-a-coach'` on rows this
app creates, `NULL` for `apps/academy-platform`'s own rows) so its admin UI can filter these out in
a future pass, at zero cost to existing rows/queries today.

**Table-name collision found during migration**: `apps/academy-platform`'s Supabase project
already had its own, unrelated `public.submissions` table (a course-assignment video-review
feature, `student_id`/`assignment_id`/`reviewed_by` — nothing to do with this feature). This
app's own submissions table is named `coach_submissions` throughout the schema and codebase to
avoid the collision.

**Code-sharing approach**: `apps/academy-platform/src/lib/auth/customer-profile.ts` and
`staff-profile.ts` are not imported directly — both are `server-only`, redirect to
`apps/academy-platform`'s own routes (e.g. `/login`), and are woven into that app's own call graph,
so importing them would mean touching academy-platform's working, in-production import graph for
a much bigger blast radius than this task calls for. Instead, `apps/ask-a-coach/src/lib/
identity/customer.ts` and the reworked `src/lib/auth/staff.ts` query the same shared tables
directly via this app's own service-role Supabase client, intentionally mirroring
`apps/academy-platform`'s function shapes without importing them. A `packages/` extraction was
considered and rejected — there is still no second real consumer to justify the abstraction,
and the duplicated logic here is a few dozen lines, narrower in scope than academy-platform's own
versions (no Core-linking, no display-name search, etc.).

**Payload stays on its own, separate database**: only the raw Supabase identity/business data
moved to the shared project — Payload's own content (`submission-forms`, `Branding`,
`CoachVisibilitySetting`) has no FK relationship to `customer_profiles`/`staff_profiles` and
stays on this app's own Postgres project via its own `DATABASE_URL`. Running Payload's own
migrations against `apps/academy-platform`'s project was ruled out during implementation: Payload's
bookkeeping tables (`payload_migrations`, `payload_kv`, `payload_preferences`,
`payload_locked_documents`) already exist there for `apps/academy-platform`'s own Payload instance,
and a second `payload migrate` run against the same database risks colliding with them.

**Alternatives considered**: Keeping two separate Supabase projects and syncing identity at the
application layer (matching by email/external id) — rejected per the rationale above, real FKs
over approximated sync. Extracting `apps/academy-platform`'s identity functions into a shared
`packages/` library — rejected for now per the code-sharing approach above; revisit if a third
consumer ever needs the same logic.
