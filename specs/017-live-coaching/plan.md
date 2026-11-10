# Implementation Plan: Academy Live Coaching (Calendly Replacement)

**Branch**: `017-live-coaching` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-live-coaching/spec.md`

## Summary

Extends 013-coach-session-booking's existing one-on-one/group booking (manual slots, capacity-safe reservation, Tier gating, email notifications) into a full Calendly replacement: a workshop event type with a public master calendar; a real coach-availability engine (recurring weekly schedules + date overrides + cross-category conflict prevention) that generates slots automatically instead of manual entry; a swappable credits adapter that enforces credits live against a Academy-owned placeholder ledger (checking prior spec history — 008-staff-credit-watch/011-credit-watch-fallback — found Core (Django) has no live write endpoint today, so this mirrors 008's proven placeholder-adjustment pattern rather than assuming one exists; a handoff contract documents what a future Core write endpoint would need to look like); auto-created/updated/deleted Zoom meetings; external calendar sync (Google, Microsoft 365, Apple iCloud/CalDAV) for conflict-checking and two-way booking sync; category-tagged session tracking with CSV/XLSX/API export; a stable versioned scheduling API with signed-identity handoff for the future Academy app; per-event-type notification workflows; and a Scheduler/Designer staff role with an audit log. The user explicitly chose to continue extending this feature's existing fully-custom Next.js/Payload/Supabase implementation rather than adopting Cal.com (source spec's own suggestion), to avoid a new self-hosted service and an unresolved AGPL license question. Three generic tables already live in this same Supabase project from the Ask a Coach feature — `audit_log`, `api_keys`, `webhook_subscriptions`/`webhook_deliveries` — and are reused as-is rather than duplicated, since academy-platform's own Supabase project *is* that shared project (Ask a Coach's identity-unification plan moved these there for exactly this kind of cross-feature reuse).

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`) — unchanged from 013.

**Primary Dependencies**:
- Existing (013): PayloadCMS (`getPayloadClient()`), `@supabase/supabase-js` service-role client, `requireStaffRole()`/`requireCustomerProfile()`, Tier comparison (`src/lib/progress/tier-progress.ts`), `resend`.
- Existing, reused from Ask a Coach's identity/infra work in this same Supabase project: the `audit_log`, `api_keys`, and `webhook_subscriptions`/`webhook_deliveries` tables and their access patterns (`writeAuditLog`, `verifyApiKeyFromRequest`/`assertWritable`, `deliverWebhookEvent` — reimplemented as thin academy-platform-side wrappers over the same tables, not imported cross-app, matching 013/016's no-`packages/`-extraction precedent).
- New: Zoom Server-to-Server OAuth (plain `fetch` against Zoom's REST API — Zoom has no actively-maintained meeting-management Node SDK; this mirrors how Ask a Coach wrapped Mux's API directly rather than reaching for a heavy client) — research.md #1.
- New: `googleapis` (Google Calendar API v3 + push channels) — research.md #2.
- New: `@microsoft/microsoft-graph-client` + `@azure/msal-node` (Microsoft Graph, client-credentials/delegated OAuth) — research.md #2.
- New: `tsdav` (CalDAV client, for Apple iCloud — no OAuth, app-specific password) — research.md #2.
- New: `ical-generator` (ICS feed output, FR-013).
- New: `exceljs` (XLSX export, FR-036; CSV is generated natively with no dependency).

**Storage**:
- Extends existing Supabase tables `booking_time_slots` and `bookings` (013) with new columns (generation source, status values, Zoom/credit linkage) rather than replacing them.
- New Supabase tables (contracts/supabase-schema.md): `coach_availability_schedules`, `availability_overrides`, `workshop_hosts`, `workshop_waitlist_entries`, `zoom_meetings`, `external_calendar_connections`, `calendar_sync_state`, `credit_transactions`, `notification_workflows`.
- Reused as-is (no new tables): `audit_log`, `api_keys`, `webhook_subscriptions`, `webhook_deliveries` — already exist in this Supabase project from the Ask a Coach feature and are already fully generic (actor/action/target/diff; name/hashed_key/scopes; url/events/signing_secret).
- OAuth tokens (Google/Microsoft) and CalDAV app-specific passwords stored encrypted at rest in `external_calendar_connections` (research.md #3).

**Testing**: No automated test framework exists in this repo (unchanged since 008/011/012/013). Validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app, plus new externally-triggered endpoints requiring cron wiring in production (extends 013's existing `/api/booking/send-reminders` operational pattern): calendar push-channel renewal, iCloud CalDAV polling, placeholder-credit-sync retry (a no-op until Core ships a write endpoint), webhook retry.

**Project Type**: Web application — single existing Next.js app, no new services (matches 013's decision; explicitly not adopting Cal.com as a second service).

**Performance Goals**: Availability-slot generation and the public workshop calendar must feel instant (SC-001, SC-004); no bulk-operation targets otherwise.

**Constraints**:
- MUST NOT generate overlapping availability across mutually exclusive categories for the same Coach (FR-004) — validated at schedule-save time.
- MUST NOT debit or refund a credit more than once for the same booking under retry (FR-024/025, SC-003) — idempotency key = booking id, enforced via a unique constraint on `credit_transactions(booking_id, transaction_type)`; the same idempotency key is designed to carry through to a future Core write call (contracts/core-credits-write-api.md) so the guarantee holds end-to-end once that endpoint exists, not just on the Academy side.
- MUST NOT let a Zoom failure block or roll back a booking, and MUST NOT let a credit failure silently succeed a booking (Edge Cases) — the two are tracked as independent state on the booking, exactly like 013's existing "notification failure never blocks booking" rule extended to two new failure-tolerant integrations.
- MUST keep a Coach's generated availability correct across DST transitions (FR-041, SC-008) — schedules are stored as local wall-clock time + IANA zone, never as a fixed UTC offset (research.md #4).
- MUST renew Google/Microsoft push channels before their expiry and poll iCloud on a fixed schedule (FR-012) — a renewal cron mirroring 013's existing reminder-cron pattern.
- MUST preserve session-record history unchanged after a referenced coach/student/event type is edited or deleted (FR-038) — session records store denormalized snapshot fields (coach name, event title) rather than relying solely on live joins, so a later rename/delete never rewrites history.
- Session category remains admin-controlled only; a Coach cannot change it (FR-039, matches 013's existing staff-only event-management convention).

**Scale/Scope**: A major expansion of 013's MVP — 8 new/extended user stories, 3 new external integrations (Zoom, calendar providers) plus one Academy-internal one (the placeholder credits ledger, not an external Django integration despite appearances), a public unauthenticated surface (workshop calendar), and new staff-facing infrastructure (roles, audit, API keys, export). Three external, non-code prerequisites sit outside this plan's implementable scope: Zoom Marketplace app approval and Google OAuth app verification both block going live and have real lead time; a live Core credits write endpoint (contracts/core-credits-write-api.md) does not block this feature's launch at all (research.md #5) but is tracked here as a known future dependency for whoever owns Core's API — all three are covered in `docs/live-coaching-provisioning.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project (unchanged since 013). No formal gates to evaluate against. Proceeding under the same established conventions used throughout this codebase and carried forward from 013: `requireStaffRole()`/`requireCustomerProfile()` gating for all writes, a service-role Supabase client instantiated per-file, Payload accessed via the shared `getPayloadClient()` cache, cross-system Payload/Supabase references stored as plain (non-FK) columns, and functions owning their own `revalidatePath()` calls.

**Post-design re-check**: Several genuinely new patterns are introduced, flagged here for visibility even with no formal gates to check against: (1) three external OAuth/API integrations (Zoom, Google, Microsoft) plus one non-OAuth external protocol (CalDAV/iCloud) — the codebase's first integrations of this kind beyond Mux/Resend/Supabase; (2) encrypted-at-rest OAuth token storage, a new security pattern this codebase hasn't needed before; (3) a swappable credits adapter interface (a Academy-owned placeholder ledger overlaying Core's read-only snapshot today, per research.md #5's correction; a live Core write endpoint or a future Academy-platform implementation later) — the first formal adapter-pattern abstraction in this codebase; (4) reusing Ask a Coach's `audit_log`/`api_keys`/`webhook_subscriptions`/`webhook_deliveries` tables across two features in the same Supabase project, the first cross-feature schema reuse in this monorepo. All four are justified inline above and in research.md, not blocking, and documented in Complexity Tracking below for visibility.

## Project Structure

### Documentation (this feature)

```text
specs/017-live-coaching/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   ├── payload-collections.md           # Phase 1 output — BookingEvents extensions
│   ├── supabase-schema.md               # Phase 1 output — new/extended tables
│   ├── api.md                           # Phase 1 output — the stable v1 scheduling API (FR-048)
│   └── core-credits-write-api.md       # Phase 1 output — handoff contract, NOT a launch blocker
│                                         # (research.md #5)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
collections/
└── BookingEvents.ts                     # MODIFIED — workshop category, booking questions, buffers/
                                          # limits, cutoff window, hidden/secret flag, notification
                                          # workflow config, credit category / pricing model, coachIds[]
                                          # for workshop co-hosts (contracts/payload-collections.md)

src/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   └── booking/                 # NEW — stable versioned API (FR-048), api.md
│   │   │       ├── coaches/route.ts
│   │   │       ├── event-types/route.ts
│   │   │       ├── slots/route.ts
│   │   │       ├── bookings/route.ts
│   │   │       ├── bookings/[id]/route.ts        # reschedule + cancel (FR-020)
│   │   │       ├── students/[identifier]/bookings/route.ts
│   │   │       └── sessions/route.ts             # session-count/export API (FR-037)
│   │   └── booking/
│   │       ├── send-reminders/route.ts           # EXISTING (013) — extended for per-event-type
│   │       │                                       # workflows instead of one fixed interval (FR-040)
│   │       ├── calendar-sync/
│   │       │   ├── renew/route.ts                # NEW — cron: renew Google/MS push channels
│   │       │   └── poll-icloud/route.ts          # NEW — cron: poll CalDAV connections (FR-013)
│   │       ├── zoom/
│   │       │   └── webhook/route.ts              # NEW — meeting ended / participant joined (FR-032)
│   │       ├── calendar-oauth/
│   │       │   ├── google/route.ts               # NEW — OAuth callback
│   │       │   └── microsoft/route.ts            # NEW — OAuth callback
│   │       └── ics/
│   │           ├── workshops/route.ts            # NEW — public workshop calendar ICS feed
│   │           └── student/[token]/route.ts      # NEW — a Student's own bookings ICS feed
│   └── booking/
│       ├── workshops/
│       │   └── page.tsx                          # NEW — public master workshop calendar, no auth
│       │                                           # (Story 3, FR-007)
│       ├── staff/
│       │   ├── availability/
│       │   │   └── page.tsx                      # NEW — weekly schedules + overrides editor
│       │   │                                       # (Story 1, FR-001–006)
│       │   ├── calendar/
│       │   │   └── page.tsx                      # NEW — connect Google/MS/iCloud (Story 6)
│       │   ├── sessions/
│       │   │   └── page.tsx                      # NEW — own session counts + export (Story 5)
│       │   ├── schedule/
│       │   │   └── page.tsx                      # NEW — Coach's own combined calendar (Story 5, FR-008)
│       │   └── [eventId]/
│       │       └── page.tsx                      # MODIFIED (013) — workshop fields, booking
│       │                                           # questions, cutoff, notification workflow
│       └── admin/
│           ├── roles/
│           │   └── page.tsx                      # NEW — Scheduler/Designer role management (Story 7)
│           ├── api-keys/
│           │   └── page.tsx                      # NEW — reuses Ask a Coach's api_keys table
│           ├── audit-log/
│           │   └── page.tsx                      # NEW — reuses Ask a Coach's audit_log table
│           └── master-calendar/
│               └── page.tsx                      # NEW — Admin combined view (FR-009)
└── lib/
    └── booking/
        ├── booking-events.ts                     # MODIFIED (013)
        ├── time-slots.ts                         # MODIFIED (013) — generated slots, not just manual
        ├── bookings.ts                           # MODIFIED (013) — credit hook, Zoom hook, reschedule
        ├── notifications.ts                      # MODIFIED (013) — per-event-type workflows
        ├── availability.ts                       # NEW — schedule/override CRUD + slot-generation
        │                                           # engine + conflict-explainer (FR-001–006)
        ├── workshops.ts                          # NEW — workshop CRUD, waitlist promotion (Story 3)
        ├── credits.ts                            # NEW — adapter interface + placeholder-ledger
        │                                           # implementation over Core's read-only snapshot
        │                                           # (FR-023–027, research.md #5)
        ├── entitlements.ts                       # NEW — swappable adapter, product/entitlement
        │                                           # restriction (Story 2, FR-028)
        ├── zoom.ts                               # NEW — meeting create/update/delete + webhook
        │                                           # handling (FR-029–033)
        ├── calendar-sync/
        │   ├── google.ts                         # NEW
        │   ├── microsoft.ts                      # NEW
        │   ├── icloud.ts                         # NEW — CalDAV
        │   └── index.ts                          # NEW — shared connection/conflict-check interface
        ├── sessions.ts                           # NEW — session-record CRUD + CSV/XLSX export
        │                                           # (Story 5, FR-034–040)
        ├── roles.ts                              # NEW — Scheduler/Designer checks, extends
        │                                           # requireStaffRole (Story 7)
        ├── audit.ts                              # NEW — thin wrapper over the reused audit_log table
        ├── api-keys.ts                           # NEW — thin wrapper over the reused api_keys table
        ├── identity.ts                           # NEW — host-identity JWT verify + external_user_id
        │                                           # lookup (Story 7, FR-050/FR-051)
        ├── webhooks.ts                           # NEW — thin wrapper over the reused
        │                                           # webhook_subscriptions/webhook_deliveries tables
        └── ics.ts                                # NEW — ICS feed generation (FR-013)
```

**Structure Decision**: Every new module lives inside the existing `/booking` route tree and `src/lib/booking/` (013's established structure), kept additive except for the specific 013 files noted MODIFIED above. No existing route, collection, or table outside `/booking` and `BookingEvents` is touched. `audit.ts`/`api-keys.ts`/`webhooks.ts` are deliberately thin — they read/write the same physical tables Ask a Coach already created in this Supabase project, not new schema, following the same no-`packages/`-extraction, no-cross-app-import precedent 013 and 016 both established (each app/feature gets its own small wrapper module over shared tables, never a shared code import).

## Complexity Tracking

*No constitution violations — table intentionally omitted, per the Constitution Check note above (no ratified gates exist to violate). The four new patterns (external OAuth/CalDAV integrations, encrypted token storage, the credits adapter interface, and cross-feature table reuse) are justified inline in Technical Context and will be detailed further in research.md, not tracked here since there's no gate they'd be an exception to.*
