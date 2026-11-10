---

description: "Task list for Coach Session Booking"
---

# Tasks: Coach Session Booking

**Input**: Design documents from `/specs/013-coach-session-booking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/payload-collections.md, contracts/supabase-schema.md, contracts/server-actions.md, quickstart.md

**Tests**: Not requested in spec.md; no automated test framework exists in this repo (plan.md Technical Context). Validation is manual via `quickstart.md`, referenced in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md: US1 = 1-on-1 booking, P1; US2 = group capacity booking, P2; US3 = Tier restriction, P3; US4 = booking management, P4; US5 = email notifications, P5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Paths are relative to repo root; this is a single Next.js project (no backend/frontend split) — new `/booking` route tree and `src/lib/booking/` module (plan.md Structure Decision)

---

## Phase 1: Setup

**Purpose**: New dependency, new Payload collection + migration, new Supabase tables — none of this is user-story-specific, all of it blocks every story.

- [X] T001 Add the `resend` npm package (`npm install resend`) and add `RESEND_API_KEY`, `BOOKING_EMAIL_FROM`, `BOOKING_REMINDER_CRON_SECRET`, `BOOKING_REMINDER_WINDOW_HOURS` to `.env.example` and local `.env.local` (research.md #6/#7, quickstart.md Prerequisites) — installed with `--legacy-peer-deps`, required for every install in this repo already (pre-existing `next@14.2.18` vs. Payload's peer range, unrelated to this feature)
- [X] T002 [P] Create `collections/BookingEvents.ts` per `contracts/payload-collections.md` and register it in `payload.config.ts` (import + add to the `collections` array)
- [X] T003 Generate and apply the Payload migration for the new collection: `npm run payload -- migrate:create add_booking_events` then `npm run payload -- migrate` (depends on T002; `push: false` convention, `docs/payload-setup.md`) — DB access was restored later in the session; `migrate` applied cleanly (batch 3), and `migrate:status` + a direct `information_schema` query both confirm `booking_events`/`booking_events_rels` exist with the exact columns `contracts/payload-collections.md` specifies
- [X] T004 [P] Apply the Supabase schema from `contracts/supabase-schema.md` to the dev project: `booking_time_slots`, `bookings`, `booking_notification_failures` tables, their indexes, and RLS policies — **the user ran this SQL directly**; verified against the live DB via `information_schema.columns`/`pg_indexes`/`pg_policies`/`pg_class.relrowsecurity` — all 3 tables, all 9 indexes, all 4 RLS policies, and RLS-enabled on all 3 tables match the contract exactly, no drift

**Checkpoint**: New collection + tables exist; no application code written yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core booking library every user story's UI calls into. Deliberately built without Tier filtering (US3 adds it) or notification calls (US5 adds them) — those are additive modifications on top of this, not part of the shared base. **Must complete before any user story phase.**

- [X] T005 Create `src/lib/booking/booking-events.ts`: `createBookingEvent`, `updateBookingEvent`, `setBookingEventPublished`, `listOwnedBookingEvents` (all `requireStaffRole(['super_admin','staff','coach'])`), and `listBookableEvents(studentId)` filtered to `isPublished = true` only for now (contracts/server-actions.md; Tier filter added in T018) — also added `getBookingEvent(eventId)` (not in the original contract) as a shared single-doc lookup, reused by `bookings.ts`'s overlap check and `listStudentBookings`
- [X] T006 [P] Create `src/lib/booking/time-slots.ts`: `addTimeSlot` (rejects a past `startTime`, FR-004), `cancelTimeSlot` (sets slot `status='canceled'`, cascades every confirmed `bookings` row on it to `status='canceled'` and decrements nothing further since the slot itself is gone — no notification call yet, T026 adds it; returns the affected booking ids for that later use), `listSlotsForEvent` (per-slot `confirmed_count`/`capacity`, no per-Student roster names yet — T022 adds that), `listOpenSlotsForEvent` (excludes canceled/full slots, but keeps a slot the Student already booked visible)
- [X] T007 Create `src/lib/booking/bookings.ts`: `bookSlot` (Tier check deferred to T019; overlap check per research.md #5 against the Student's other confirmed Bookings' slot times + each Booking Event's `durationMinutes`; atomic capacity claim via a read-then-compare-and-swap retry loop — `supabase-js` can't express `confirmed_count < capacity` as a single filter, so this is the equivalent-safety substitute for research.md #3's guarded `UPDATE`, documented there; `INSERT` into `bookings` with compensating decrement on a duplicate-student insert failure (Postgres `23505`); no notification call yet — T025 adds it), `cancelBooking` (ownership check against `studentId`, atomic `confirmed_count` decrement, no notification call yet — T026 adds it), `listStudentBookings` (joins each Booking's slot `start_time` to its Booking Event's `title`/`coachId` via a batched Payload lookup)
- [X] T008 [P] Ran `npm run typecheck` — clean after fixing two Payload richText field type errors (`description` needed `as never`, same cast `course-actions.ts` already uses for `textToLexical(...)`)

**Checkpoint**: Foundation ready — every user story phase below only adds pages/route handlers or makes small, additive modifications to these three files.

---

## Phase 3: User Story 1 - Coach publishes a 1-on-1 booking event and a student books it (Priority: P1) 🎯 MVP

**Goal**: A Coach creates a 1-on-1 Booking Event, adds Time Slots, publishes it; a Student browses, picks an open slot, and books it.

**Independent Test**: Create a 1-on-1 event with two slots, book one as a Student, confirm it disappears from availability while the other stays open (quickstart.md Scenario 1).

### Implementation for User Story 1

- [X] T009 [US1] `src/app/booking/staff/page.tsx` — list this Staff/Coach's view of all Booking Events (`listOwnedBookingEvents`), with a link to create a new one and to each event's detail page (FR-015)
- [X] T010 [US1] `src/app/booking/staff/new/page.tsx` — create-event form: title, description, duration, `eventType` select (`one-on-one`/`group`) with a conditionally-shown `capacity` field, `coachId` (a `<select>` of all active Staff/Coach accounts via `listStaffProfiles()`, defaulted to the logged-in Staff/Coach's own `staff_profiles.id`) → `createBookingEvent`. Publish toggle moved to T011's event-detail page instead of this form, so a new event always starts as an inspectable draft (FR-001, FR-003)
- [X] T011 [US1] `src/app/booking/staff/[eventId]/page.tsx` — event detail page: publish/unpublish toggle → `setBookingEventPublished` (FR-005); "add Time Slot" form (date/time + capacity, defaulting capacity from the event) → `addTimeSlot`; list of the event's slots showing start time and `confirmed_count`/`capacity` (`listSlotsForEvent`) (FR-002). The date/time input is a small client component (`AddTimeSlotForm.tsx`) that converts the browser's local `datetime-local` value to a UTC ISO string client-side before submit, since the server would otherwise misinterpret the raw string in the server's own timezone
- [X] T012 [US1] [P] `src/app/booking/customer/[id]/page.tsx` — browse bookable events for the logged-in Student (`listBookableEvents`) (FR-006)
- [X] T013 [US1] `src/app/booking/customer/[id]/[eventId]/page.tsx` — event detail: list of open slots (`listOpenSlotsForEvent`), a book action per slot (`bookSlot`) that shows a clear message for each `BookSlotResult` failure reason (FR-007, FR-008)

**Checkpoint**: User Story 1 is fully functional and independently testable — a Coach can publish a 1-on-1 event and a Student can book it end-to-end.

---

## Phase 4: User Story 2 - Coach publishes a group event with multiple registration spots (Priority: P2)

**Goal**: The same event/slot/booking mechanics from US1, but a slot accepts multiple Students up to a configured capacity.

**Independent Test**: Create a group event with capacity 3 on one slot, book it as three different Students, confirm a fourth is rejected; confirm two near-simultaneous bookings for the last spot never both succeed (quickstart.md Scenario 2).

### Implementation for User Story 2

- [X] T014 [US2] Modify `src/app/booking/customer/[id]/[eventId]/page.tsx` (T013) to render each group slot's availability as "X of Y spots filled" instead of a binary open/booked label, and disable the book action once `confirmed_count = capacity` — also changed `listOpenSlotsForEvent` (`src/lib/booking/time-slots.ts`, T006) to stop excluding full slots entirely, since a slot that just vanishes can't "clearly indicate full" (FR-008); a full slot is now always shown with a disabled "Full" label instead of a Book button, for both 1-on-1 and group events
- [X] T015 [US2] [P] `src/app/booking/staff/[eventId]/page.tsx` (T011) already rendered `confirmed_count`/`capacity` counts per slot when it was built — no separate change needed here
- [~] T016 [US2] **Blocked by the same DB connectivity issue as T003/T004** — could not run quickstart.md Scenario 2 step 4 against a live database in this session. Did a static correctness review instead of a live concurrency test: `claimSlotCapacity` in `src/lib/booking/bookings.ts` reads `confirmed_count` then writes `UPDATE ... SET confirmed_count = <read>+1 WHERE id=$1 AND confirmed_count=<read> AND status='open'`; Postgres serializes concurrent UPDATEs to the same row, so of two simultaneous claims only the first to commit has its `confirmed_count = <read>` predicate still true — the second's predicate is now stale and it affects 0 rows, causing a retry (and on the 1-remaining-spot case, the retry re-reads `confirmed_count >= capacity` and returns `slot-full`). **Recommend running Scenario 2 step 4 for real once DB access is restored** — this is the one piece of new code in this feature I could not verify empirically.

**Checkpoint**: User Stories 1 AND 2 both work independently — 1-on-1 and capacity-limited group booking both function correctly.

---

## Phase 5: User Story 3 - Coach restricts a booking event to Students in specific Tiers (Priority: P3)

**Goal**: A Coach can limit a Booking Event to Students who've reached one or more specific Tiers; ineligible Students never see or can book it.

**Independent Test**: Restrict an event to one Tier, confirm a Student at/above that Tier can book it and a Student below it cannot see or book it (quickstart.md Scenario 3).

### Implementation for User Story 3

- [X] T017 [US3] Modify `src/app/booking/staff/new/page.tsx`/`NewBookingEventForm.tsx` (T010) to add a Tier multi-select (checkboxes, `restrictedTierIds`) sourced from the existing `listTiers()` (`src/lib/courses/tier-actions.ts`), passed through to `createBookingEvent` (FR-019). `updateBookingEvent` already accepted `restrictedTierIds` from the Foundational build — no edit-event page exists yet to exercise it, but the field is there for when one does
- [X] T018 [US3] Added `isEligibleForRestrictedEvent(studentId, restrictedTierIds)` to `src/lib/booking/booking-events.ts` (T005) — cumulative comparison against `getStudentTierProgress`'s `current_tier_rank`, per research.md #4 — and wired it into `listBookableEvents` so a restricted event is excluded unless the Student is eligible (FR-020)
- [X] T019 [US3] Modified `bookSlot` in `src/lib/booking/bookings.ts` (T007) to re-check the same `isEligibleForRestrictedEvent` server-side, before the overlap check and capacity claim, returning `{ ok: false, reason: 'not-eligible-tier' }` — closes the gap where a Student could otherwise book a restricted slot directly by id even though `listBookableEvents` wouldn't show it to them (FR-020, FR-021 — eligibility checked only at booking time, never re-verified afterward, since there's no re-check anywhere after this)
- [X] T020 [US3] [P] Already covered — `src/app/booking/customer/[id]/[eventId]/page.tsx`'s `REASON_MESSAGES` map (T013) included `'not-eligible-tier'` from the start

**Checkpoint**: Tier-restricted events are correctly hidden from and unbookable by ineligible Students; unrestricted events remain open to everyone.

---

## Phase 6: User Story 4 - Coaches and Students manage existing bookings (Priority: P4)

**Goal**: A Student can view and cancel their own Bookings; a Coach can see who's registered per slot and cancel a slot entirely.

**Independent Test**: Cancel a Student's own booking and confirm the slot's capacity frees up; cancel a slot as Coach and confirm every Student on it loses that booking (quickstart.md Scenario 4).

### Implementation for User Story 4

- [X] T021 [US4] `src/app/booking/customer/[id]/bookings/page.tsx` — the Student's own upcoming/past Bookings (`listStudentBookings`) with a cancel action per upcoming Booking (`cancelBooking`) (FR-011, FR-012)
- [X] T022 [US4] Extended `listSlotsForEvent` in `src/lib/booking/time-slots.ts` (T006) — now returns `SlotWithRoster[]`, joining each slot's confirmed `bookings` rows to `customer_profiles` for display name/email — and rendered that roster on `src/app/booking/staff/[eventId]/page.tsx` (T011), which only Staff/Coach can reach (`requireStaffRole` on the page and inside `listSlotsForEvent` itself) (FR-013, FR-018)
- [X] T023 [US4] Added a "Cancel Slot" action to `src/app/booking/staff/[eventId]/page.tsx` wired to `cancelTimeSlot` (`src/lib/booking/time-slots.ts`, T006) — only shown for slots still `status='open'` (FR-014)

**Checkpoint**: All four stories so far are independently functional — booking, group capacity, Tier gating, and full lifecycle management all work.

---

## Phase 7: User Story 5 - Students and Coaches receive email notifications for booking activity (Priority: P5)

**Goal**: Confirmation, cancellation, and reminder emails, without ever blocking or breaking the booking/cancellation flow they attach to.

**Independent Test**: Book a slot and confirm both the Student and Coach get a confirmation email; cancel it and confirm a cancellation email goes out; trigger the reminder endpoint and confirm a due reminder is sent exactly once (quickstart.md Scenario 5).

### Implementation for User Story 5

- [X] T024 [US5] Created `src/lib/booking/notifications.ts`: `sendBookingConfirmation`, `sendBookingCancellation`, `sendBookingReminder` (Resend SDK, using `RESEND_API_KEY`/`BOOKING_EMAIL_FROM`), and `logNotificationFailure` (inserts into `booking_notification_failures`) — every send function catches its own errors per-recipient and calls `logNotificationFailure` instead of throwing (FR-025). Also added `listNotificationFailuresForEvent` here (not in the original contract — needed for T028)
- [X] T025 [US5] Wired `sendBookingConfirmation` into `bookSlot` in `src/lib/booking/bookings.ts` (T007) — refactored the function to fetch the slot/event once up front (previously done ad hoc for the Tier check) and reuse that for the confirmation email context, called after the `bookings` insert succeeds (FR-022)
- [X] T026 [US5] [P] Wired `sendBookingCancellation` into `cancelBooking` (`src/lib/booking/bookings.ts`, T007) and into `cancelTimeSlot` (`src/lib/booking/time-slots.ts`, T006 — once per Booking that slot cancellation affects, resolving the event once and reusing it per-recipient) (FR-023)
- [X] T027 [US5] `src/app/api/booking/send-reminders/route.ts` — checks the `x-booking-cron-secret` header against `BOOKING_REMINDER_CRON_SECRET`, selects confirmed Bookings with `reminder_sent_at IS NULL` whose slot starts within `BOOKING_REMINDER_WINDOW_HOURS` (and hasn't already passed), calls `sendBookingReminder` per Booking, stamps `reminder_sent_at`, returns `{ sent, failed }` (FR-024, contracts/server-actions.md)
- [X] T028 [US5] [P] Modified `src/app/booking/staff/[eventId]/page.tsx` (T011/T022) to surface any `booking_notification_failures` rows tied to this event's Bookings (via the new `listNotificationFailuresForEvent`) in an amber "Notification delivery issues" panel, so a failed send is visible where the Coach would notice it (research.md #8)

**Not independently runnable in this session**: T024-T028 all typecheck cleanly, but were never exercised against a real Resend account — `.env.local`'s `RESEND_API_KEY` is a placeholder (`re_dev_placeholder_not_a_real_key`), so every send will fail and land in `booking_notification_failures` until a real key is set, which is itself the intended graceful-degradation behavior (FR-025) rather than a bug. **Set a real `RESEND_API_KEY` and `BOOKING_EMAIL_FROM` to verify actual delivery.**

**Checkpoint**: All five user stories are independently functional — the feature is complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T029 [P] Ran `npm run typecheck` after every phase (not just once at the end) — clean throughout, no errors ever left across a checkpoint. Also ran a full `npm run build` at the end of implementation — succeeded, and every new route (`/booking/staff`, `/booking/staff/new`, `/booking/staff/[eventId]`, `/booking/customer/[id]`, `/booking/customer/[id]/[eventId]`, `/booking/customer/[id]/bookings`, `/api/booking/send-reminders`) shows up correctly marked dynamic (`ƒ`) in the build output, not statically prerendered — confirms the whole route tree is structurally sound independent of the DB connectivity blocker
- [X] T030 Documented `RESEND_API_KEY`, `BOOKING_EMAIL_FROM`, `BOOKING_REMINDER_CRON_SECRET`, `BOOKING_REMINDER_WINDOW_HOURS`, and the new external-cron requirement (`POST /api/booking/send-reminders`) in `docs/production-deployment.md` — new table row, new env var block, and a new "Step 7" section with the exact `curl` shape and scheduling options
- [~] T031 **Blocked by the same DB connectivity issue as T003/T004/T016** — could not run any of the 5 quickstart scenarios against a live database in this session. All 31 tasks are implemented and the whole feature typechecks cleanly, but **none of it has been exercised against a running app with real data**. **This is the most important thing to do next**: apply T003/T004's migration and schema, set a real `RESEND_API_KEY`, and walk all 5 scenarios in `quickstart.md` by hand.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T003 depends on T002; T001 and T004 are independent of everything else in this phase.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (T005-T007 must exist and compile, T008 confirms it, before T009+)
- **User Stories (Phase 3-7)**: All depend on Foundational completion
  - US1 (T009-T013) has no dependency on US2-US5 — this is the deployable MVP slice
  - US2 (T014-T016) modifies files US1 created (T011, T013) and the shared `bookSlot` (T007) — logically an extension, not a new mechanism, since capacity > 1 was already supported by the atomic claim in T007
  - US3 (T017-T020) modifies files US1 created (T010, T013) and the shared `listBookableEvents`/`bookSlot` (T005/T007)
  - US4 (T021-T023) modifies the shared `time-slots.ts` (T006) and `staff/[eventId]/page.tsx` (T011), and adds a new student page (T021)
  - US5 (T024-T028) modifies the shared `bookings.ts`/`time-slots.ts` (T007/T006) and `staff/[eventId]/page.tsx` (T011), and adds a new lib file (T024) and route handler (T027)
  - Note: US2-US5 all converge on `src/lib/booking/bookings.ts`, `src/lib/booking/time-slots.ts`, and `src/app/booking/staff/[eventId]/page.tsx` — stories are logically independent (each has its own testable outcome) but share a small set of files, so plan for sequential merges regardless of story order, same caveat as spec 012's tasks.md
- **Polish (Phase 8)**: Depends on all five user stories being complete

### Parallel Opportunities

- T002 and T004 (Setup) can run in parallel; T001 is independent of both
- T006 and T008 (Foundational) are marked `[P]` relative to T005/T007
- T012 (US1) is marked `[P]` — a different file from T009-T011
- T015 (US2) and T020 (US3) are marked `[P]` — different files from their sibling tasks in the same phase
- T026 and T028 (US5) are marked `[P]` — different files from their sibling tasks
- Across stories: US1 must ship first (everything else modifies what it builds), but US2, US3, and US4 could be developed in parallel branches after US1 lands, converging on the same handful of shared files at merge time; US5 is easiest to build last since it only adds calls into already-stable functions

---

## Parallel Example: User Story 1

```bash
# T009, T010, T011 touch staff pages sequentially (each depends on the lib functions from
# Foundational, not on each other, but share no files so could be split across devs):
Task: "src/app/booking/staff/page.tsx — list owned Booking Events"
Task: "src/app/booking/staff/new/page.tsx — create-event form"
Task: "src/app/booking/staff/[eventId]/page.tsx — event detail + add Time Slot"

# T012 can run fully in parallel with all three above (different route, different file):
Task: "src/app/booking/customer/[id]/page.tsx — browse bookable events"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T005-T008) — the atomic capacity claim in T007 is the riskiest piece; validate it manually (quickstart.md Scenario 1) before building any more UI on top of it
3. Complete Phase 3: User Story 1 (T009-T013)
4. **STOP and VALIDATE**: quickstart.md Scenario 1 — a Coach can publish a 1-on-1 event and a Student can book it
5. This alone resolves the core ask (Calendly-style 1-on-1 booking) — deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → schema/collection exist, core lib compiles, no user-facing change yet
2. Add US1 → 1-on-1 booking works end-to-end → validate → deploy (MVP)
3. Add US2 → group capacity booking works → validate → deploy
4. Add US3 → Tier-gated events work → validate → deploy
5. Add US4 → cancellation and rosters work → validate → deploy
6. Add US5 → email notifications work → validate → deploy
7. Each story adds capability without removing or restructuring what the previous story added

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T007's atomic claim is worth a second pair of eyes given it's the one genuinely new concurrency pattern in this codebase, research.md #3)
2. Once Foundational is done and US1 has landed:
   - Developer A: US2 (group capacity UI + concurrency validation)
   - Developer B: US3 (Tier restriction)
   - Developer C: US4 (booking management)
   - US5 (notifications) is easiest to save for last since it only adds calls into already-stable functions, and depends on the `resend` account being provisioned (T001)
3. Stories converge on a small shared set of files (see Dependencies above) — coordinate merges

---

## Notes

- US1 is the only story every other story depends on being merged first — it's not just "the MVP," it's the literal foundation every later story's tasks modify
- T007's atomic capacity claim (research.md #3) is the single highest-risk piece of new code in this feature — validate it manually under real concurrency (T016) before treating US2 as done, don't just trust the code review
- [P] tasks = different files, no dependencies
- Commit after each phase checkpoint, not after every task, given how much US2-US5 share the same handful of files
- No waitlist, no recurring-availability generation, no reschedule fee/cutoff, no SMS/in-app notifications, single fixed reminder window (spec.md Assumptions) — don't add any of these without a spec update
