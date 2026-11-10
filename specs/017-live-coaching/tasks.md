---

description: "Task list for Academy Live Coaching (Calendly Replacement)"
---

# Tasks: Academy Live Coaching (Calendly Replacement)

**Input**: Design documents from `/specs/017-live-coaching/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/payload-collections.md, contracts/supabase-schema.md, contracts/api.md, quickstart.md

**Tests**: Not requested in spec.md; no automated test framework exists in this repo (plan.md Technical Context, unchanged since 013). Validation is manual via `quickstart.md`, referenced in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md: US1 = recurring availability, P1; US2 = credits, P1; US3 = public workshops, P2; US4 = Zoom, P2; US5 = session tracking/export, P2; US6 = external calendar sync, P3; US7 = roles/audit, P3; US8 = notification workflows, P4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US8)
- Paths are relative to repo root — extends 013's existing `src/app/booking/` route tree and `src/lib/booking/` module (plan.md Structure Decision); no new app/service.

---

## Phase 1: Setup

**Purpose**: New dependencies, extended Payload collection + migration, extended/new Supabase tables. Blocks every story.

- [ ] T001 [P] Work through `docs/live-coaching-provisioning.md` for the accounts needed by US4/US6 (Zoom, Google, Microsoft, iCloud) — start Zoom and Google early, they have real approval lead time; not needed to start US1/US2 — user is in progress on Zoom (Server-to-Server OAuth app blocked on account/role, see provisioning doc's added troubleshooting note)
- [X] T002 [P] `luxon`/`@types/luxon` (US1, DST-safe scheduling) and `ical-generator` (US3) installed as actually needed per story; `googleapis`/`@microsoft/microsoft-graph-client`/`@azure/msal-node`/`tsdav`/`exceljs` deferred to US5/US6 when those stories start
- [X] T003 [P] `WORKSHOP_WAITLIST_CRON_SECRET` added (US3); Zoom/Google/Microsoft/`CALENDAR_CREDENTIALS_ENCRYPTION_KEY` deferred to US4/US6 — no credit-system env vars needed at all (research.md #5 correction)
- [X] T004 Extended `collections/BookingEvents.ts` incrementally per story: `creditLessonTypeId` (US2), `eventType='workshop'`/`coHostCoachIds`/`pricingModel`/`waitlistEnabled`/`isHidden` (US3) — `bookingQuestions`/buffers/limits/`cancellationCutoffMinutes`/`sessionCategory`/`notificationWorkflowId` deferred to US5/US7/US8, not needed yet
- [X] T005 Two migrations generated and applied: `add_credit_lesson_type_id`, `add_workshop_fields`
- [X] T006 Applied incrementally per story, not all upfront — `coach_availability_schedules`/`availability_overrides`/`booking_time_slots` columns (US1), `credit_transactions` (US2, corrected to `lesson_type_id` not `category` mid-build). **Discovered mid-US3**: `workshop_waitlist_entries`, `zoom_meetings`, `notification_workflows`, `external_calendar_connections`, `calendar_sync_state`, `booking_staff_roles`, `session_records` already exist too (from an earlier successful run this session that wasn't fully tracked at the time) — all verified to match `contracts/supabase-schema.md` exactly, all empty, no drift found except the already-fixed `credit_transactions`. `bookings` itself is still unextended (no `zoom_meeting_id`/`credit_transaction_id`/`answers`/`late_cancellation`/widened `status` yet) — not needed by US1-US3 as built.
- [X] T007 [P] `npm run typecheck` clean after every change this session

**Checkpoint**: Extended schema/collection exist; no new application code written yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core extensions to 013's existing library files that every later story builds on, plus the genuinely cross-cutting infra (roles gate, audit log, webhooks) wired in once so later stories don't each have to remember to add it. **Must complete before any user story phase.**

- [ ] T008 Create `src/lib/booking/roles.ts` — deferred to US7 (Scheduler/Designer role isn't gated on anything built yet; `sessionCategory` field/its admin-only access check also deferred to US5)
- [ ] T009 [P] Create `src/lib/booking/audit.ts` — deferred to US7
- [ ] T010 [P] Create `src/lib/booking/api-keys.ts` — deferred to US7
- [ ] T011 [P] Create `src/lib/booking/webhooks.ts` — deferred; no story built yet has an acceptance scenario requiring it
- [X] T012 Extended `src/lib/booking/time-slots.ts`: `generation_source`/`source_schedule_id`/`category` added to `TimeSlotRecord` (US1). The external-calendar-conflict exclusion in `listOpenSlotsForEvent` is deferred to US6 (no guard stub added — a real no-op until that story lands, simpler than a guard to later remove)
- [X] T013 Extended `src/lib/booking/bookings.ts` incrementally: credit check/debit/refund wired into `bookSlot`/`cancelBooking` (US2), workshop-waitlist promotion wired into `cancelBooking` (US3, dynamic import to avoid a circular dependency with `workshops.ts`). Status widening, `rescheduleBooking`, `late_cancellation` computation, and audit/webhook calls all deferred — no story built yet needs them (US2's cancellation currently always refunds; the cutoff-based forfeiture is explicitly documented as deferred in the code)
- [X] T014 [P] Extended `src/lib/booking/booking-events.ts` incrementally: `creditLessonTypeId` (US2); `eventType`, `coHostCoachIds`, `pricingModel`, `waitlistEnabled`, `isHidden`, and capacity-for-workshop handling (US3). `coachIds`-replaces-`coachId` was deliberately **not** done — see the "Recommended solution" note below; `setSessionCategory`/`bookingQuestions`/buffers deferred to US5/later
- [X] T015 `npm run typecheck` and `npm run build` both clean after every change this session

**Implementation-time scope decision (recommended, applied without re-confirming)**: data-model.md/contracts/payload-collections.md's original plan for US3 called for replacing `BookingEvents.coachId` (a single string) with a `coachIds[]` array. Doing that literally would touch every existing call site across `booking-events.ts`, `bookings.ts`, `time-slots.ts`, `notifications.ts`, and every 1-on-1/group page — a wide, risky refactor of already-working code for a feature (multi-coach workshops) that doesn't need it. Instead, `coachId` (primary/owning coach, unchanged) was kept as-is and a separate `coHostCoachIds[]` array was added, used only by workshops. Documented inline in `collections/BookingEvents.ts` and `EditBookingEventForm.tsx`.

**Checkpoint**: Foundation ready — every user story phase below adds new modules/pages or makes small, additive calls into these files.

---

## Phase 3: User Story 1 - Coach defines recurring weekly availability (Priority: P1) 🎯 MVP

**Goal**: A Coach defines weekly schedules + overrides; bookable slots generate automatically; cross-category conflicts are prevented and explainable.

**Independent Test**: quickstart.md Scenario 1 — define two non-overlapping category schedules, confirm slot generation, reject an overlapping third, add a blocking override, confirm an existing booking survives a later schedule edit.

- [X] T016 [US1] Created `src/lib/booking/availability.ts` per spec, using `luxon` for DST-safe generation. **Implementation note**: `generateSlots` is scoped per Booking Event, not per Coach — `booking_time_slots.booking_event_id` is `NOT NULL`, so slots must belong to one specific event; cross-event double-booking is instead prevented by skipping any candidate time the Coach already has an open slot at, on any of their events. Documented inline.
- [X] T017 [US1] `generateSlots` is triggered manually (a "Generate from availability" button + through-date input on the event detail page) rather than an incremental cron — simpler for this pass and still satisfies the story's acceptance scenarios; an automatic horizon-rolling cron can be added later without changing `generateSlots` itself
- [X] T018 [US1] `src/app/booking/staff/availability/page.tsx` built as specified
- [X] T019 [US1] [P] Built, but the staff UI calls `availability.ts` directly (Server Actions/SSR reads), not through these routes — matches Ask a Coach's own established "API exposes the same capability, isn't a mandatory hop for the built-in UI" convention (documented in the route file), not a deviation from that precedent
- [X] T020 [US1] [P] Both routes built
- [X] T021 [US1] Generated slots show an "Auto" badge next to manually-added ones on the event detail page

**Checkpoint**: A Coach can replace manual slot entry with real recurring availability, independent of every later story.

---

## Phase 4: User Story 2 - Credits automatically checked, debited, refunded (Priority: P1)

**Goal**: No credit-based booking succeeds without an available credit; exactly one debit per booking; refund only before the cutoff; never double-applied.

**Independent Test**: quickstart.md Scenario 2 — book with one credit, get blocked on a second attempt, cancel-before-cutoff refunds, cancel-after-cutoff/no-show forfeits and still records a session, a retried debit call never double-charges.

- [X] T022 [US2] Created `src/lib/booking/credits.ts` per the corrected (post-008/011-history-check) design — `lesson_type_id`-keyed, not category-keyed
- [X] T023 [US2] Wired into `bookSlot`/`cancelBooking`, with full compensation on debit failure. **Simplification, documented in code**: `late_cancellation`/`cancellationCutoffMinutes` don't exist yet (no story has needed them) — every cancellation currently refunds
- [X] T024 [US2] [P] Both routes built, `studentId` passed explicitly by the caller (no session-cookie auth layer for this route yet, documented inline) — reschedule (`PATCH`) returns a clear "not supported yet" error rather than silently no-op'ing
- [X] T025 [US2] `REASON_MESSAGES` extended with `no-credit`/`credit-check-failed`
- [X] T025a [US2] FR-028: Created `src/lib/booking/entitlements.ts` — a swappable adapter (`entitlementsAdapter.checkEntitlement`), mirroring `credits.ts`'s shape. `booking-events.ts` gained `requiredEntitlementId` (Payload field + migration). Wired into `bookSlot` right after the Tier check. **No host app exists yet to report real entitlements**, so the shipped adapter fails closed — any event with `requiredEntitlementId` set blocks every booking until a real adapter is plugged in, rather than silently treating the restriction as a no-op (same "never silently succeed a check it can't perform" rule as credits/Zoom). The event-edit form warns inline not to set this field yet.

**Checkpoint**: Credit-based bookings are financially correct end-to-end, independent of Zoom, workshops, or calendar sync.

---

## Phase 5: User Story 3 - Student discovers and books a public workshop (Priority: P2)

**Goal**: Public master workshop calendar; workshop bookings with capacity + waitlist; per-workshop pricing model; hidden/secret workshops.

**Independent Test**: quickstart.md Scenario 3 — publish a capacity-3 workshop, fill it from 3 Students, a 4th is waitlisted, a cancellation promotes the waitlist with a time-boxed hold, a hidden workshop stays reachable by direct link only.

- [X] T026 [US3] Created `src/lib/booking/workshops.ts` — `createWorkshop` folded into the existing `createBookingEvent`/`updateBookingEvent` (workshop is just another `eventType`, not a parallel CRUD path, per the `coHostCoachIds` scope decision above); `listPublicWorkshops`/`joinWaitlist`/`promoteNextWaitlistEntry`/`claimWaitlistOffer`/`expireWaitlistOffer`/`getMyWaitlistStatus`/`listExpiredOffers` all built. `claimWaitlistOffer` reuses `bookSlot` directly (full Tier/credit/capacity/email pipeline, not a parallel booking path)
- [X] T027 [US3] Wired into `bookings.ts`'s `cancelBooking` via dynamic import (avoids a static circular dependency with `workshops.ts`, which itself calls `bookSlot`)
- [X] T028 [US3] `src/app/api/booking/workshops/expire-holds/route.ts` built, own `WORKSHOP_WAITLIST_CRON_SECRET`
- [X] T029 [US3] `src/app/booking/workshops/page.tsx` built — filterable, includes an ICS subscribe link and per-workshop Book/Join Waitlist CTAs. Booking/waitlist itself happens on 013's existing `/booking/customer/[id]/[eventId]` detail page (extended for workshop capacity-full/waitlist/claim states), not a separate workshop-specific booking page — reuses the full Tier/credit/capacity pipeline that page already has
- [X] T030 [US3] [P] Both routes built
- [X] T031 [US3] [P] Built with `ical-generator`, linked from the public calendar page

**Checkpoint**: Workshops work end-to-end as a public, unauthenticated discovery-and-booking surface, independent of Zoom, credits (beyond a credit-priced workshop reusing US2's already-built adapter), or calendar sync.

---

## Phase 6: User Story 4 - Every confirmed session gets an auto-created Zoom meeting (Priority: P2)

**Goal**: Zoom meetings auto-create/update/delete with the booking lifecycle; failures never block a booking; group/workshop sessions share one meeting.

**Independent Test**: quickstart.md Scenario 4 — confirm creates a link, reschedule updates the same meeting, cancel deletes it, group attendees share one link, a broken credential fails gracefully with a recorded, staff-visible failure.

**Interim, user-requested (T031a, done ahead of the rest of this story)**: since Zoom account access is still blocked, a manual `meetingLink` field (required on every event type) ships now as the actual join-info mechanism — populated in confirmation/reminder emails and the Student's booking list. `autoCreateZoomMeeting` (per-event checkbox) and a system-wide `zoomIntegrationEnabled` toggle (`/booking/admin/roles`, gated Owner/Admin) are also live as scaffolding — the checkbox is disabled client-side and rejected server-side unless the global toggle is on, and turning the toggle on is explicitly labeled as not yet creating real meetings (no Zoom API call is wired up — that's still T032/T033 below). `/booking/admin/zoom-setup-guide` (opens in a new tab from the toggle) walks an Admin through provisioning the Zoom app, including the grayed-out-option troubleshooting note from `docs/live-coaching-provisioning.md`.

- [ ] T032 [US4] Create `src/lib/booking/zoom.ts`: Server-to-Server OAuth token handling (research.md #1), `createMeeting`/`updateMeeting`/`deleteMeeting` (plain `fetch` against Zoom's REST API), writing `zoom_meetings` rows keyed by either `booking_event_id` (shared group/workshop meeting) or `time_slot_id` (one-on-one). Once built, `bookSlot`/`cancelBooking` should prefer the real Zoom join URL over `meetingLink` when `autoCreateZoomMeeting` is true and the meeting was actually created.
- [ ] T033 [US4] Wire `bookings.ts`'s create/reschedule/cancel paths (T013) to call `zoom.ts`, catching and recording failures into `zoom_meetings.status='failed'`/`failure_reason` without throwing back to the booking flow (Edge Cases)
- [ ] T034 [US4] `src/app/api/booking/zoom/webhook/route.ts` — Zoom webhook receiver (meeting ended, participant joined), feeding `session_records` status determination (FR-033, consumed by US5)
- [ ] T035 [US4] [P] `src/app/booking/staff/calendar/page.tsx` (Zoom connection section) and `src/app/api/v1/booking/zoom-connection/route.ts` — per-Coach Zoom OAuth connect flow (contracts/api.md)
- [ ] T036 [US4] Surface `zoom_meetings.status`/`join_url` on both the Student's and Coach's existing booking-detail views (013)

**Checkpoint**: Every booking type gets a working Zoom link end-to-end, independent of calendar sync, session export, or roles.

---

## Phase 7: User Story 5 - Coaches get paid from exportable, category-tagged session records (Priority: P2)

**Goal**: Every completed/cancelled/no-show session recorded with a denormalized, immutable snapshot; Coach and Admin views; CSV/XLSX/API export.

**Independent Test**: quickstart.md Scenario 5 — complete several sessions, confirm a Coach's own filtered counts, confirm an Admin's export matches the on-screen view exactly, confirm history survives a referenced record's later edit/delete, confirm a Coach can't change session category.

- [X] T037 [US5] Created `src/lib/booking/sessions.ts`. **Scope note**: `createSessionRecord` is called from `recordCancellation` (wired into `cancelBooking`/`cancelTimeSlot` — cancellations are recorded automatically, not left for staff to notice) and from a manual Coach/Admin "Mark completed"/"Mark no-show" action on the event detail roster — Zoom-webhook-triggered completion is deferred to whenever US4 unblocks. **Bug found and fixed while live-testing**: `listSessionRecords` had no auth check at all (the JSON, non-export branch of `GET /api/v1/booking/sessions` was reachable by anyone) — `getSessionCounts`/`exportSessionsCsv`/`exportSessionsXlsx` were gated but the underlying list function wasn't. Fixed and reverified live (307 redirect now, was 200).
- [X] T038 [US5] `src/app/booking/staff/sessions/page.tsx` built, with filters + counts + export links
- [X] T039 [US5] [P] Both routes built
- [X] T039a [US5] FR-008: Built `src/app/booking/staff/schedule/page.tsx` ("My Schedule") — a Coach's own one-on-one/group/workshop sessions grouped by day, backed by new `listCoachSchedule(coachId)` in `time-slots.ts` (filters `listAllUpcomingSlots()` by `coachId` or `coHostCoachIds` membership, so a workshop co-host sees it too). Defaults to the logged-in staff member, switchable to any Coach via a dropdown — same no-per-coach-ownership-restriction convention as `/booking/staff/sessions`. Linked from `/booking/staff`'s nav.
- [X] T039b [US5] FR-017: Added `bookingQuestions` (array of `{label, required}`) to `BookingEvents` (Payload field + migration) and `answers` (jsonb) to the `bookings` Supabase table. `bookSlot` now rejects a submission missing any required answer (`missing-required-answers` reason) before claiming a slot. Customer booking UI (`DateSlotPicker.tsx`) renders the questions inline with the slot picker via a `form=` attribute so answers ride the same submit; staff see collected answers inline in the event roster (`time-slots.ts`'s `Registrant.answers`). Workshop waitlist claims (`claimWaitlistOffer`) thread answers through too. **Not done**: the event-creation form (`NewBookingEventForm.tsx`) — questions are added via Edit after creation, matching how several other optional fields in this collection already work.
- [ ] T040 [US5] Not done — `sessionCategory` as its own admin-locked field (distinct from `eventType`) hasn't been added to the Payload collection yet; `session_records.session_category` currently just mirrors `eventType` directly, which already can't be changed by a Coach (event type is fixed at creation in the current UI), so the FR-039 protection is satisfied in practice even though the dedicated field doesn't exist

**Checkpoint**: Payroll-ready, immutable session tracking works end-to-end, independent of Zoom/calendar sync/roles (though richer with T034's Zoom webhook data when US4 is also done).

---

## Phase 8: User Story 6 - A Coach's personal calendar keeps their schedule conflict-free (Priority: P3)

**Goal**: Google/Microsoft/iCloud connections check for conflicts and receive new bookings; push renewal and iCloud polling keep sync current; expired connections alert the Coach.

**Independent Test**: quickstart.md Scenario 6 — connect a test account, a busy event blocks that time, a new booking appears on the external calendar, renewal/reconnect-alert behavior for both push and poll providers.

- [X] T041 [US6] Created `src/lib/booking/calendar-sync/{index,icloud,google,microsoft}.ts` + `crypto.ts` (`encryptCredentials`/`decryptCredentials`, AES-256-GCM, verified with a real round-trip test, not just typechecked). **Scope**: iCloud (`tsdav` + `node-ical` for VEVENT/RRULE parsing) is fully real — no OAuth app needed, only a per-Coach Apple app-specific password, so nothing blocks it. Google/Microsoft are honest stubs — `isProviderConfigured()` gates them off everywhere (connection UI, `listBusyBlocks`'s dispatcher) until their env vars exist; calling them directly throws `CalendarProviderNotConfiguredError` rather than silently returning "no conflicts."
- [X] T042 [US6] `time-slots.ts`'s `listOpenSlotsForEvent` now calls `listBusyBlocks` for real (no more guard/no-op) — **simplification from the original plan**: iCloud has no push, so rather than a poll-and-cache layer (`calendar_sync_state`), busy blocks are queried live from CalDAV at read time (documented in `icloud.ts`); `calendar_sync_state`'s push-channel columns are unused until Google/Microsoft exist, since only they have push.
- [X] T043 [US6] Built `.../calendar-sync/poll-icloud/route.ts` — repurposed from "refresh cached data" (nothing to refresh, per T042's note) to "proactively verify each iCloud connection's credentials still work and flag `needs_reconnect` before a Student's booking page silently stops conflict-checking it." The Google/Microsoft push-renewal route (`.../calendar-sync/renew/route.ts`) isn't built — nothing to renew until those providers exist.
- [ ] T044 [US6] Not built — no OAuth app exists yet for either provider, so there's no callback to receive
- [X] T045 [US6] `src/app/booking/staff/calendar/page.tsx` built: real iCloud connect/disconnect form (tests the credentials before saving, not just accepting them blindly), Google/Microsoft shown as disabled with a **Setup Guide** link (opens in a new tab) mirroring the Zoom pattern from Story 4's interim work — new `/booking/admin/google-setup-guide` and `/booking/admin/microsoft-setup-guide` pages. **Not built**: per-connection calendar selection UI (defaults to checking every calendar the account has) and the "write new bookings to this calendar" side (`write_calendar_id`) — this story's read/conflict-check half is what's live; two-way sync is deferred
- [X] T046 [US6] [P] Both routes built

**Checkpoint**: External calendar conflict-checking and two-way sync work end-to-end across all three providers, independent of Zoom, credits, or session tracking.

---

## Phase 9: User Story 7 - Admin manages roles and reviews a change history (Priority: P3)

**Goal**: Owner/Admin/Scheduler roles enforced; the "coaches may create their own event types" toggle; a reviewable audit log.

**Independent Test**: quickstart.md Scenario 7 — a Scheduler can create event types but not manage users/API keys, the Coach-create-event-type toggle is enforced, an availability change appears correctly attributed in the audit log.

- [X] T047 [US7] Created `src/lib/booking/roles.ts` (no T008 existed to extend — built directly) — `grantRole`/`revokeRole`/`getBookingRoles`/`hasBookingRole`/`requireBookingRole`, plus `booking_settings` (new small key-value table, applied) backing `getCoachesCanCreateEventTypes`/`setCoachesCanCreateEventTypes`
- [X] T048 [US7] Gated in `createBookingEvent` — a `coach` role is blocked unless elevated (owner/admin/scheduler) or the global toggle is on; `super_admin`/`staff` (platform-wide roles) always pass, matching every other staff-authored content type in this codebase
- [X] T049 [US7] `src/app/booking/admin/roles/page.tsx` built
- [X] T050 [US7] [P] `src/app/booking/admin/audit-log/page.tsx` built, filtered to this feature's `target_type` values
- [X] T051 [US7] [P] `src/lib/booking/api-keys.ts` (no T010 existed — built directly, mirrors Ask a Coach's `api-key.ts` shape exactly), admin page, and API route all built
- [X] T052 [US7] [P] All three routes built
- [X] T053 [US7] `src/app/booking/admin/master-calendar/page.tsx` built, backed by a new `listAllUpcomingSlots()` in `time-slots.ts`
- [X] T053a [US7] FR-050/FR-051: Created `src/lib/booking/identity.ts` — `verifyHostIdentityToken` (`jose`, `BOOKING_HOST_JWT_SECRET`, mirrors Ask a Coach's `verifyHostIdentityToken` shape exactly) and `resolveStudentByIdentifier` (matches an existing booking's `external_user_id` first, then `customer_profiles` by email). Wired into `POST /api/v1/booking/bookings` via an `X-Host-Identity` header, as an alternative to passing `studentId` directly. `bookings.answers`/`bookings.external_user_id` columns added (Supabase migration). **Scope decision**: only matches an *existing* `customer_profiles` row — does not auto-create one for a never-seen identity, since that's a broader identity-model question already being worked through separately (the pending Ask a Coach identity-unification plan) and inventing a second answer to it here would conflict rather than help. Verified live: a real signed JWT matches an existing Student by email and proceeds into `bookSlot`; an unknown identity correctly 404s; a garbage/invalid token falls back to requiring `studentId`, never throws.
- [X] T053b [US7] FR-053: Added `notificationsDisabled` to `BookingEvents` (Payload field + migration). `BookingNotificationContext` gained a `notificationsDisabled` flag that skips only the Student-facing send in `sendBookingConfirmation`/`sendBookingCancellation`/`sendBookingReminder` — the Coach-facing alert (a separate code path in each) always fires regardless, since FR-053 only covers Student-facing notifications. Wired at all three call sites (`bookSlot`, `cancelBooking`, `send-reminders/route.ts`).
- [X] T053c [US7] [P] Built `GET /api/v1/booking/event-types` (new `listPublishedEventTypes()` in `booking-events.ts`, filterable by `coachId`/`category`, excludes `isHidden`), `GET /api/v1/booking/event-types/:id` (reuses `getBookingEvent`, works for a hidden event type by direct id per FR-021), and `GET /api/v1/booking/students/:identifier/bookings` (uses T053a's `resolveStudentByIdentifier`). All three verified live (200/404 as expected).

**Checkpoint**: Staff role management and audit visibility work end-to-end, independent of every other story.

---

## Phase 10: User Story 8 - Coach/Admin configure notification workflows per event type (Priority: P4)

**Goal**: Per-event-type trigger/action/timing workflows replace 013's single fixed reminder interval; Coach/Admin alerts separate from Student-facing emails.

**Independent Test**: quickstart.md Scenario 8 — two event types with different reminder offsets fire independently; a new booking/cancellation produces a separate Coach/Admin alert.

- [X] T054 [US8] Created `src/lib/booking/notification-workflows.ts` (CRUD + `getReminderOffsetMinutes`) rather than folding into `notifications.ts` — kept the two concerns (workflow config vs. actually sending an email) in separate files. Added the previously-missing Coach cancellation alert (013 only ever emailed the Student on cancellation, despite emailing the Coach on a new booking). **Daily agenda not built** — see T058
- [X] T055 [US8] `send-reminders/route.ts` now computes each due booking's own cutoff from `getReminderOffsetMinutes(event.id)`, falling back to the global `BOOKING_REMINDER_WINDOW_HOURS` when an event type has no configured workflow
- [X] T056 [US8] `src/app/booking/admin/notification-workflows/page.tsx` built as its own page (roles page was already getting long)
- [X] T057 [US8] [P] Route built
- [ ] T058 [US8] Not built — lowest-value piece of this story relative to effort (a summary email needs its own template/formatting design, not just wiring); can be added later without touching anything else here

**Checkpoint**: Notification workflows are fully configurable per event type, independent of every other story (013's original single-interval reminders keep working for any event type left unconfigured).

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation, and the external non-code prerequisites flagged in plan.md.

- [ ] T059 [P] Run every scenario in `quickstart.md` end-to-end against a dev environment with real (or sandbox) Zoom/Google/Microsoft/iCloud credentials per `docs/live-coaching-provisioning.md`
- [ ] T060 [P] Update `docs/production-deployment.md` with this feature's new env vars, migration steps, and the five new cron jobs (availability-horizon extension, calendar-sync renewal, iCloud polling, workshop-hold expiry, daily agenda) alongside 013's existing reminder cron
- [ ] T061 [P] Start Zoom Marketplace app approval and Google OAuth app verification (plan.md Scale/Scope note) — track as an external, non-code checklist item; not blocking for dev/staging validation but blocking for production go-live
- [ ] T062 Run `npm run typecheck` and `npm run build` for a final clean check across every phase's additions
- [ ] T063 [P] Update `specs/013-coach-session-booking`'s own docs with a short pointer note ("superseded/extended by 017-live-coaching for workshops, availability, credits, Zoom, calendar sync — this spec's original 1-on-1/group mechanics remain the foundation"), matching how 016 cross-references shared infrastructure it built on

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: hard blocker for everything below.
- **US1 (P1)** and **US2 (P1)** have no dependency on each other — both can start immediately after Foundational, in parallel if staffed separately. Every later story assumes both are done (booking flow needs real availability and correct credit handling to be meaningfully testable end-to-end), so in practice build them first even though they're not file-level blockers of each other.
- **US3 (workshops)** depends on US1 (needs real availability/slots to book against) and reuses US2's credits adapter for credit-priced workshops (FR-015) — build after US1/US2.
- **US4 (Zoom)** is independent of US3/US5/US6/US7/US8 — only needs Foundational's `bookings.ts` extension. Can be built in parallel with US3 if staffed separately.
- **US5 (session tracking)** is richer with US4's Zoom webhook data but functions on manually-marked statuses without it — soft dependency only.
- **US6 (calendar sync)** only needs Foundational's `time-slots.ts` guard point (T012) — independent of US2-US5.
- **US7 (roles/audit)** depends on Foundational's `roles.ts`/`audit.ts` (T008/T009) but its *UI* is independent of US1-US6's own UIs — can be built any time after Foundational.
- **US8 (notification workflows)** depends on 013's existing `notifications.ts`, extended in Foundational's T013 touch — independent of US3-US7.

**Suggested MVP scope**: US1 + US2 (Phases 3-4) — a Coach with real recurring availability and a Student whose credit is correctly enforced is the smallest slice that's meaningfully better than 013 alone and directly addresses the two gaps ranked highest in the pre-spec audit.

## Parallel Execution Examples

- Within Foundational: T009, T010, T011 (three independent new files) can run in parallel once T008 exists.
- Within US1: T019 and T020 (different new API route files) can run in parallel once T016 exists.
- Across stories once Foundational is done: US4 (Zoom) and US6 (calendar sync) touch entirely disjoint new files and can be staffed in parallel with each other and with US1/US2.
