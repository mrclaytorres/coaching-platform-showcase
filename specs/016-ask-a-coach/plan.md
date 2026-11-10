# Implementation Plan: Ask a Coach (VideoAsk Replacement)

**Branch**: `016-ask-a-coach` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-ask-a-coach/spec.md`

## Summary

Builds a standalone, API-first video Q&A service — students record a question, a coach
replies inside a shared conversation thread — as a new sub-application (`apps/ask-a-coach/`)
in the Academy App monorepo, alongside the existing `apps/academy-platform/`. Reuses this monorepo's
established stack (Next.js 14 App Router + TypeScript, Payload CMS for authored/admin content,
Supabase for auth + relational data) rather than introducing a new one. **Identity is shared**
with `apps/academy-platform`: both apps authenticate against the same Supabase Auth
(`auth.users`) pool and the same `customer_profiles`/`staff_profiles` tables, realizing
spec FR-025's "built so staff login can move to a future Academy-wide SSO without a rework" now
rather than later (superseding FR-025–FR-028's original "self-contained accounts" framing — see
"Identity-unification decision" below). This app's own business data (conversations,
submissions, replies, roles, API keys, webhooks, audit log) lives in `apps/academy-platform`'s
Supabase project too, with real foreign keys into the shared identity tables — Postgres has no
cross-database foreign keys, so a real (not just application-level) link required one shared
database. Only Payload's own authored-content database (form config, branding) stays on this
app's own, separate Supabase project — it has no identity/FK relationship to any of this. Video
is handled by
Mux (direct uploads, automatic transcoding, signed private playback, server-measured duration
via its `video.asset.ready` webhook) rather than a self-hosted S3+ffmpeg pipeline. Email is
Resend, already integrated in this monorepo for Coach Session Booking, reused here to keep one
transactional-email vendor across both apps as the spec itself anticipates ("likely shared with
the future Live Coaching app").

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type":
"module"`) — matches `apps/academy-platform`'s stack for consistency across the monorepo.

**Primary Dependencies**: `@payloadcms/next`/`payload` (form/branding/notification-template
authoring — see research.md #2); `@supabase/supabase-js` + `@supabase/ssr` (shared with
`apps/academy-platform`: auth, customer/staff identity, and this app's own business tables —
research.md #8); `@mux/mux-node` (direct uploads, asset/webhook handling, signed playback URLs —
research.md #1); `resend` (transactional email — research.md #3); a CSV/XLSX export library for
duration reports (research.md #6).

**Storage**: `apps/academy-platform`'s existing Supabase Postgres project hosts this app's
relational data — `conversations`, `coach_submissions`, `replies`, `coach_staff_roles`, API
keys, webhook subscriptions/deliveries, notification delivery log, audit log (data-model.md) —
with real foreign keys into that project's shared `customer_profiles`/`staff_profiles` tables
(students and staff both; research.md #8). `coach_submissions`/`replies` are named to avoid
colliding with `apps/academy-platform`'s own, unrelated `submissions` table (a course-assignment
review feature already live there). Payload (embedded in the same Next.js app) keeps its **own**
separate Supabase Postgres project/`DATABASE_URL` for authored/admin-managed content only — the
submission form's configurable fields, intro video/branding config — since it has no
identity/FK relationship to the shared data and its own bookkeeping tables would otherwise
collide with `apps/academy-platform`'s own Payload instance in the same database. All
recorded/uploaded media (video, audio, and file-upload fallbacks) lives in Mux, not Supabase
Storage or MinIO/S3 — no self-hosted object storage needed for this app (research.md #1).

**Testing**: No automated test framework, consistent with every feature in this monorepo;
validation is manual via `quickstart.md`, using Mux's test/sandbox environment.

**Target Platform**: Node 22 server running its own Next.js app process — a separate pm2
process/port from `apps/academy-platform` (this feature does not touch that app's deploy), with
its own `apps/ask-a-coach/ecosystem`-style entry once deployed; local dev on a distinct port to
run alongside `apps/academy-platform` (research.md #7).

**Project Type**: Web application — single Next.js app under `apps/ask-a-coach/`, a new npm
workspace member alongside `apps/academy-platform` (root `package.json`'s `workspaces` field
already covers `apps/*`, no root config change needed). One app serves all three required
surfaces (student recorder, coach PWA, public REST API) as different route groups of the same
Next.js app — not three separate deployables (research.md #7).

**Performance Goals**: N/A — matches this monorepo's low-volume, single-tenant scale (spec
Assumptions: current host is CourseHost, one Academy coaching team).

**Constraints**:
- Every UI action must also be a documented, independently callable REST endpoint (FR-029) —
  the built-in UI (student recorder, coach inbox) is implemented as just another client of
  that API, calling it the same way an external integration would, not through server-action-only
  internal logic the way `apps/academy-platform` uses for staff-only screens.
- HTTPS required everywhere (camera access, FR-033); all media playback via Mux signed URLs,
  never public (FR-009).
- Coach reply duration MUST be sourced from Mux's own processed-asset `duration` field, never a
  browser-reported value (FR-018) — mirrors this monorepo's established "webhook is the
  authoritative source of truth" pattern from `006-course-sales-payments`/`015-expanded-payments`
  (Stripe there, Mux here).
- Students are the shared `customer_profiles` table (research.md #8), not a separate `students`
  table — email is never the primary key there either (`id` is the natural key); an anonymous
  submitter's `email`/`first_name` are synthesized when absent, since those columns are `NOT
  NULL` on the shared table and are relied on elsewhere in `apps/academy-platform`.
- **Identity-unification decision** (supersedes the original FR-025–FR-028 "self-contained
  accounts" framing, per explicit user direction — "one identity for everyone everywhere"):
  this app shares `apps/academy-platform`'s Supabase Auth, `customer_profiles`, and
  `staff_profiles` for ALL identity (staff and students alike). `apps/academy-platform`'s own
  staff role enum (`super_admin`/`coach`/`staff`) is untouched; this app's own four-role system
  (`owner`/`admin`/`designer`/`coach`) is kept, via `coach_staff_roles` — a join table keyed to
  the shared `staff_profiles.id`, not a separate identity. See research.md #8 for the full
  rationale, including why a `packages/` extraction was rejected in favor of a small,
  independent `apps/ask-a-coach/src/lib/identity/` module that queries the same shared tables
  directly.

**Scale/Scope**: Single-tenant (one Academy coaching team), small initial coach roster, low-to-
moderate submission volume — matches the rest of this monorepo's current scale. No multi-org/
multi-tenant support in this build.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist
for this project (consistent with every prior feature's plan in this repo). No gates to
evaluate. Proceeding under this monorepo's established conventions, applied to the new app:
Payload as the authored-content store with real authorization enforced in the Next.js layer,
not Payload's own access functions (`004-course-lesson-management` research.md #3, reused
here for forms/branding/notification templates); provider-webhook-as-source-of-truth for
externally-processed state (`006`/`015`'s Stripe convention, applied to Mux here); server-role-
only Supabase writes with RLS as defense-in-depth (`002-supabase-auth-user-data` onward).

**Post-design re-check**: No architectural departure from the above. The one new pattern this
feature introduces — API-key-authenticated public REST endpoints, since nothing in
`apps/academy-platform` has needed this before — is inherent to the feature's own explicit
API-first requirement (spec FR-029), not an added complexity; see Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/016-ask-a-coach/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── supabase-schema.md      # Students/conversations/submissions/replies/staff/API keys/webhooks/audit schema
│   ├── payload-collections.md  # Form config, branding, notification templates
│   ├── api.md                   # Public REST API (student + coach + admin actions)
│   └── webhooks.md              # Outbound webhook events, signing, retry contract
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/ask-a-coach/                       # NEW — sibling to apps/academy-platform, its own workspace member
├── src/
│   ├── app/
│   │   ├── ask/[formSlug]/page.tsx           # Hosted student recorder entry (shareable link)
│   │   ├── ask/[formSlug]/embed/page.tsx     # Embeddable-component variant (WebView/iframe-safe)
│   │   ├── c/[conversationId]/page.tsx       # Student's secure conversation link (view replies, respond again)
│   │   ├── coach/login/page.tsx              # Coach/admin login (email+password or magic link)
│   │   ├── coach/inbox/page.tsx              # Conversation list — search, assign, filter (PWA shell)
│   │   ├── coach/inbox/[conversationId]/page.tsx  # Thread view + reply recorder
│   │   ├── admin/forms/page.tsx              # Designer role — edit form config (delegates to Payload)
│   │   ├── admin/users/page.tsx              # Owner/Admin — invite/deactivate/assign roles
│   │   ├── admin/api-keys/page.tsx           # Owner/Admin — create/revoke/rotate API keys
│   │   ├── admin/audit-log/page.tsx          # Owner/Admin — audit log view
│   │   ├── api/v1/submissions/route.ts       # POST start submission, GET list (API-key or session auth)
│   │   ├── api/v1/submissions/[id]/upload-url/route.ts  # POST get Mux direct-upload URL
│   │   ├── api/v1/conversations/route.ts     # GET list (coach/API-key scoped)
│   │   ├── api/v1/conversations/[id]/route.ts       # GET thread, PATCH (close/reopen/assign)
│   │   ├── api/v1/conversations/[id]/replies/route.ts  # POST reply (coach or student follow-up)
│   │   ├── api/v1/coaches/route.ts           # GET coach list (id → name)
│   │   ├── api/v1/reports/durations/route.ts # GET reply durations, filterable, CSV/XLSX
│   │   └── api/webhooks/mux/route.ts         # Mux asset.ready / errored events (signature-verified)
│   ├── components/
│   │   ├── recorder/                          # Shared recorder: permissions screen, countdown, review, fallbacks
│   │   ├── coach-inbox/                        # Inbox list, thread view, notes
│   │   └── contact-form/                       # Name/email/phone screen, consent, spam check
│   └── lib/
│       ├── mux/                                # Mux client, direct-upload helper, webhook verification
│       ├── auth/                                # Coach/admin session + role checks; API-key verification
│       ├── identity/                            # Resolve-or-create against the shared customer_profiles table
│       ├── students/                            # Host-app JWT identity verification only (host-token.ts)
│       ├── conversations/                       # Submission/reply/assignment/status logic
│       ├── durations/                           # Duration recording + CSV/XLSX export
│       ├── notifications/                       # Resend client + template rendering + delivery logging
│       ├── webhooks/                            # Outbound webhook signing, delivery, retry
│       └── audit/                               # Audit log writer
├── collections/           # Payload: SubmissionForm (prompts, contact-field config, time limits), NotificationTemplate
├── globals/                # Payload: Branding (colors, logo, font, favicon)
├── payload.config.ts
├── next.config.mjs
├── package.json           # own workspace member — "name": "ask-a-coach"
└── tsconfig.json
```

**Structure Decision**: New workspace member under `apps/`, mirroring `apps/academy-platform`'s
established internal layout (`src/app` + `src/lib/<domain>` + `src/components`, Payload
`collections/`/`globals/` at the app root) so the two apps stay consistent to work in — remaining
independent deployables (own `package.json`, own process/port) that now share identity and
business data via the same Supabase project (research.md #8), while Payload's own content
database stays separate. `packages/` (monorepo root) stays empty — `apps/ask-a-coach/src/lib/
identity/` intentionally mirrors, rather than imports, `apps/academy-platform`'s
`customer-profile.ts`/`staff-profile.ts` (server-only, redirect to academy-platform's own routes,
woven into its own call graph), since extracting a shared package for one small, narrower
consumer was judged a worse trade than the small duplication — see research.md #8.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Public, API-key-authenticated REST endpoints (`apps/ask-a-coach/src/app/api/v1/*`) — the first time this monorepo has needed externally-authenticated public API routes, vs. `apps/academy-platform`'s server-actions-only internal pattern | Spec FR-029 requires every UI action to also be an independently usable, documented API endpoint — an explicit, non-negotiable requirement of this feature, not incidental scope | Server Actions (this monorepo's existing pattern) are Next.js-internal RPC calls tied to a browser session — they cannot be called by an external system with an API key, so they cannot satisfy FR-029 regardless of how the internal logic is organized |
