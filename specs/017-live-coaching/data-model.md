# Phase 1 Data Model: Academy Live Coaching (Calendly Replacement)

**Branch**: `017-live-coaching` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Entities already defined by 013-coach-session-booking (`booking-events` Payload collection, `booking_time_slots`/`bookings` Supabase tables) are extended here, not redefined from scratch — only new/changed fields are listed for them. Four tables (`audit_log`, `api_keys`, `webhook_subscriptions`, `webhook_deliveries`) are reused unchanged from Ask a Coach (research.md #8) and are referenced, not redefined.

## Booking Event *(Payload collection `booking-events`, EXTENDED)*

New/changed fields added to 013's existing collection:

| Field | Type | Notes |
|---|---|---|
| `eventType` | select: `one-on-one` \| `group` \| `workshop`, required | EXTENDS 013's two-value field with `workshop` (FR-014) |
| `coachIds` | array of text | `staff_profiles.id` values. A single-element array for one-on-one/group (replaces 013's single `coachId`, kept backward-compatible by treating a one-element array the same way); multiple entries for a workshop's co-hosts (FR-014) |
| `pricingModel` | select: `free` \| `credit` \| `paid`, required, default `credit` | FR-015. Only meaningful for `eventType = workshop`; one-on-one/group are always credit-based per Story 2 |
| `creditLessonTypeId` | number, nullable | **Implemented in User Story 2**, ahead of the rest of this table (which lands with US3's workshop fields). Core's numeric `lesson_type_id` this event debits/refunds against (research.md #5 correction, `contracts/payload-collections.md`) — not a Academy category string, since Core's wallets are keyed by its own lesson-type taxonomy. Null = this event is free (no credit check), which is also how 013's pre-existing events default without any migration needed. |
| `waitlistEnabled` | checkbox, default `true` for workshops, `false` otherwise | FR-016 |
| `bookingQuestions` | array of `{ label: text, required: checkbox }` | FR-017 |
| `minNoticeMinutes` | number, default `0` | FR-018 |
| `bookingHorizonDays` | number, default `60` | How far ahead Students may book (FR-018) |
| `startTimeIncrementMinutes` | number, default `15` | FR-018 |
| `bufferBeforeMinutes` / `bufferAfterMinutes` | number, default `0` | FR-018 |
| `dailyLimit` / `weeklyLimit` / `monthlyLimit` | number, nullable | Per event type; a separate per-Coach cross-event-type limit is evaluated in `availability.ts`, not stored per event (FR-019) |
| `cancellationCutoffMinutes` | number, default `1440` (24h) | Governs both reschedule/cancel eligibility and credit-refund eligibility — one setting, not two (FR-020/FR-025) |
| `isHidden` | checkbox, default `false` | Excluded from browse/public calendar but bookable via direct link (FR-021) |
| `sessionCategory` | select: `one-on-one` \| `group` \| `workshop`, required, admin-only field permission | Independent of `eventType` in the schema even though they're set equal at creation — kept as its own field specifically so FR-039's "admin-controlled, Coach cannot change" rule has a single, dedicated, permission-locked field rather than overloading `eventType` (which a Coach can otherwise edit) |
| `notificationWorkflowId` | text, nullable | References `notification_workflows.id` (Supabase); nullable = falls back to 013's original fixed-interval behavior |

**Validation** (`src/lib/booking/booking-events.ts`, extended):
- `pricingModel = paid` requires an external checkout integration to exist before publish is allowed (out of scope for this feature to build the checkout itself — flagged in quickstart.md as a launch-readiness check, not a blocking FR here since Story 3's acceptance scenarios only require free/credit-based workshops to work end-to-end).
- `sessionCategory` is set automatically from `eventType` at creation and is only ever editable via a separate Admin-only action (FR-039), never through the normal event-edit form.

## Coach Availability Schedule *(NEW Supabase table `coach_availability_schedules`)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `coach_id` | text, not null | `staff_profiles.id`, plain reference (matches 013's Payload/Supabase boundary convention) |
| `name` | text, not null | e.g. "One-on-one hours" (FR-001) |
| `category` | text, not null, `CHECK (category IN ('one-on-one','group','workshop'))` | FR-001, used by the cross-category conflict check (research.md #11) |
| `timezone` | text, not null | IANA identifier, e.g. `America/New_York` (research.md #4) |
| `day_of_week` | integer, not null, `CHECK (day_of_week BETWEEN 0 AND 6)` | One row per weekday the schedule is active |
| `start_time` | time, not null | Local wall-clock (research.md #4) |
| `end_time` | time, not null, `CHECK (end_time > start_time)` | |
| `is_active` | boolean, not null, default `true` | A Coach can deactivate a schedule without deleting it |
| `created_at` / `updated_at` | timestamptz | |

**Validation**: A new/edited row is rejected server-side if it overlaps an existing active row for the same Coach in a *different* category on the same `day_of_week` (research.md #11, FR-004). Overlap within the *same* category is allowed (a Coach may have multiple concurrent one-on-one schedules if useful).

## Availability Override *(NEW Supabase table `availability_overrides`)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `coach_id` | text, not null | |
| `date` | date, not null | |
| `override_type` | text, not null, `CHECK (override_type IN ('extra_hours','blocked'))` | FR-002 |
| `start_time` / `end_time` | time, nullable | Required when `override_type = 'extra_hours'`; null for a full-day `blocked` override |
| `category` | text, nullable | Which category the override applies to; null = all categories (used for a full vacation-day block) |
| `reason` | text, nullable | Optional note (e.g. "vacation") |
| `created_at` | timestamptz | |

**State transitions**: None — an override is deleted (not soft-cancelled) if a Coach removes it; slot generation re-runs against the standing weekly schedule for that date once removed.

## Time Slot *(Supabase table `booking_time_slots`, EXTENDED)*

New/changed columns added to 013's existing table:

| Column | Type | Notes |
|---|---|---|
| `generation_source` | text, not null, default `'manual'`, `CHECK (generation_source IN ('manual','generated'))` | `manual` = 013's original one-off entry (still supported); `generated` = produced by the availability engine from a schedule/override (FR-003) |
| `source_schedule_id` | uuid, nullable, `REFERENCES coach_availability_schedules(id)` | Set only for `generation_source = 'generated'` rows |
| `category` | text, not null, default `'one-on-one'` | Copied from the owning Booking Event's `sessionCategory` at generation/creation time, used for the cross-category "already booked" conflict explanation (FR-006) |

**Validation**: Generation (`availability.ts`) never creates a `generated` slot that overlaps an existing slot (any source) in a conflicting category for the same Coach — the same guard applied at schedule-save time (research.md #11) is re-checked at generation time in case an override was added after the schedule.

## Booking *(Supabase table `bookings`, EXTENDED)*

New/changed columns added to 013's existing table:

| Column | Type | Notes |
|---|---|---|
| `status` | text, not null, default `'confirmed'`, `CHECK (status IN ('confirmed','canceled','rescheduled','no_show'))` | EXTENDS 013's two-value status (FR-020, Story 5) |
| `rescheduled_from_slot_id` | uuid, nullable | Set on the new Booking row created by a reschedule; the original Booking's status becomes `'rescheduled'` (a reschedule is modeled as cancel-old + create-new, not an in-place time change, so slot capacity accounting stays correct via the existing atomic claim/release from 013 research.md #3) |
| `zoom_meeting_id` | uuid, nullable, `REFERENCES zoom_meetings(id)` | FR-029 |
| `credit_transaction_id` | uuid, nullable, `REFERENCES credit_transactions(id)` | The debit transaction; null for a free workshop booking |
| `answers` | jsonb, nullable | Responses to the event type's `bookingQuestions` (FR-017) |
| `late_cancellation` | boolean, not null, default `false` | Set true if cancellation happens after `cancellationCutoffMinutes` (FR-025); drives both "credit forfeited" and Story 5's session-record status |

## Workshop Waitlist Entry *(NEW Supabase table `workshop_waitlist_entries`)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_event_id` | text, not null | The workshop (Payload doc id) |
| `student_id` | uuid, not null, `REFERENCES customer_profiles(id)` | |
| `position` | integer, not null | Join order, lowest = next to be offered |
| `status` | text, not null, default `'waiting'`, `CHECK (status IN ('waiting','offered','claimed','expired','canceled'))` | research.md #6 |
| `offered_at` / `expires_at` | timestamptz, nullable | Set when promoted from `waiting` to `offered` |
| `created_at` | timestamptz | |
| `UNIQUE (booking_event_id, student_id)` | constraint | A Student can't double-join the same workshop's waitlist |

**State transitions**: `waiting` → `offered` (a seat frees up and this entry is next) → `claimed` (Student books within the hold window, becomes a real `bookings` row) or `expired` (hold window lapses, next entry is offered) — mirrors research.md #6.

## Zoom Meeting *(NEW Supabase table `zoom_meetings`)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_event_id` | text, nullable | Set for a group/workshop's single shared meeting (FR-031) |
| `time_slot_id` | uuid, nullable, `REFERENCES booking_time_slots(id)` | Set for a one-on-one meeting, one per slot |
| `zoom_meeting_id` | text, not null | Zoom's own meeting id |
| `join_url` | text, not null | |
| `host_coach_id` | text, not null | Which Coach's connected Zoom account created it |
| `status` | text, not null, default `'active'`, `CHECK (status IN ('active','failed','deleted'))` | FR-032 |
| `failure_reason` | text, nullable | Set when `status = 'failed'`, surfaced to staff (FR-032) |
| `created_at` / `updated_at` | timestamptz | |

**Validation**: Exactly one of `booking_event_id` / `time_slot_id` is set, matching whether this is a shared group/workshop meeting or a one-on-one meeting (`CHECK ((booking_event_id IS NOT NULL) <> (time_slot_id IS NOT NULL))`).

## External Calendar Connection *(NEW Supabase table `external_calendar_connections`)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `coach_id` | text, not null | |
| `provider` | text, not null, `CHECK (provider IN ('google','microsoft','icloud'))` | FR-010 |
| `encrypted_credentials` | text, not null | Encrypted OAuth tokens (Google/Microsoft) or app-specific password (iCloud) (research.md #3) |
| `conflict_check_calendar_ids` | text[], not null, default `'{}'` | Which of the account's calendars are checked for busy blocks (FR-010) |
| `write_calendar_id` | text, nullable | Which calendar receives new Academy bookings (FR-010) |
| `status` | text, not null, default `'active'`, `CHECK (status IN ('active','needs_reconnect'))` | FR-012 |
| `created_at` / `updated_at` | timestamptz | |

## Calendar Sync State *(NEW Supabase table `calendar_sync_state`)*

| Column | Type | Notes |
|---|---|---|
| `connection_id` | uuid, PK, `REFERENCES external_calendar_connections(id) ON DELETE CASCADE` | |
| `push_channel_id` | text, nullable | Google/Microsoft push subscription id; null for iCloud (poll-only) |
| `push_expires_at` | timestamptz, nullable | Renewal job's trigger threshold (research.md #3) |
| `last_polled_at` | timestamptz, nullable | iCloud only |
| `last_synced_at` | timestamptz, nullable | |

## Credit Transaction *(NEW Supabase table `credit_transactions`)*

Deliberately mirrors 008-staff-credit-watch's `credit_adjustments` table shape and `'placeholder'`/`'synced'` status convention (research.md #5) — this is the same ledger technique, applied to booking-triggered debits/refunds instead of a staff-initiated manual adjustment.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_id` | uuid, not null, `REFERENCES bookings(id) ON DELETE CASCADE` | Real FK, unlike `credit_adjustments.core_customer_id` — every booking-triggered transaction has a real `bookings` row by construction |
| `student_id` | uuid, not null, `REFERENCES customer_profiles(id) ON DELETE CASCADE` | Real FK — same reasoning |
| `core_customer_id` | integer, not null | Denormalized copy of `student_id`'s own `customer_profiles.core_customer_id`, so `checkCredit`/export queries never need to join back to `customer_profiles` just to reach Core's numeric id |
| `lesson_type_id` | integer, not null | Core's numeric lesson type (implementation note above) — copied from the Booking Event's `creditLessonTypeId` at transaction time |
| `transaction_type` | text, not null, `CHECK (transaction_type IN ('debit','refund'))` | |
| `amount_credits` | numeric, not null, `CHECK (amount_credits <> 0)` | Matches `credit_adjustments`' non-zero guard |
| `status` | text, not null, default `'placeholder'`, `CHECK (status IN ('placeholder','synced'))` | `'placeholder'` = enforced by Academy, not yet written to Core (the only state possible until Core ships a write endpoint, research.md #5); `'synced'` reserved for that future cutover, no schema change needed when it happens |
| `created_at` | timestamptz | |
| `UNIQUE (booking_id, transaction_type)` | constraint | Idempotency guard (research.md #5, FR-024/025, SC-003) |

**Effective balance**: `checkCredit` (research.md #5) computes a Student's usable balance as Core's last-known `fetchSnapshot()` wallet balance for that `lesson_type_id`, plus the sum of that Student's own `credit_transactions` for the same `lesson_type_id` (debits negative, refunds positive) regardless of `status` — a `'placeholder'` row is fully enforced, not just recorded for later.

## Session Record *(NEW Supabase table `session_records`)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_id` | uuid, nullable, `REFERENCES bookings(id)` | Nullable because history must survive even a hypothetical future Booking hard-delete (FR-039) — the link is best-effort, the denormalized fields below are authoritative |
| `coach_id` | text, not null | |
| `coach_name_snapshot` | text, not null | Denormalized (research.md #7) |
| `event_type_id` | text, not null | |
| `event_type_title_snapshot` | text, not null | Denormalized |
| `session_category` | text, not null, `CHECK (session_category IN ('one-on-one','group','workshop'))` | Denormalized from the event type at record-creation time — never updated retroactively (FR-039) |
| `scheduled_start` | timestamptz, not null | |
| `duration_minutes` | integer, not null | |
| `attendee_count` | integer, not null, default `1` | FR-034 |
| `status` | text, not null, `CHECK (status IN ('scheduled','completed','cancelled_by_student','cancelled_by_coach','no_show'))` | FR-033 |
| `created_at` | timestamptz | |

**State transitions**: `scheduled` → exactly one of `completed`/`cancelled_by_student`/`cancelled_by_coach`/`no_show`, determined at/after the session's scheduled end time (Zoom webhook data where available, research.md #1; otherwise a Coach/Admin manual mark). One-way — never reverts once set (FR-033 Acceptance Scenario 1).

## Notification Workflow *(NEW Supabase table `notification_workflows`)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_event_id` | text, nullable | Null = a default/global workflow; set = overrides for one event type (FR-041) |
| `trigger` | text, not null, `CHECK (trigger IN ('booked','cancelled','rescheduled','before_start','after_end'))` | |
| `offset_minutes` | integer, nullable | Required when `trigger IN ('before_start','after_end')` |
| `action` | text, not null, default `'email'`, `CHECK (action IN ('email','sms'))` | `sms` accepted by the schema now but not implemented this launch (Assumptions) |
| `recipient` | text, not null, `CHECK (recipient IN ('student','coach','admin'))` | |
| `template_id` | text, not null | References the existing Academy-branded template system (same provider as 013/Ask a Coach, research.md is silent because no new decision is needed here) |
| `is_active` | boolean, not null, default `true` | |

## Booking Staff Role *(NEW Supabase table `booking_staff_roles`)*

Mirrors Ask a Coach's `coach_staff_roles` pattern exactly (research.md's precedent for scoped roles that don't touch the shared 3-value `staff_profiles.role` enum) — a feature-scoped role table, not an extension of the platform-wide role column.

| Column | Type | Notes |
|---|---|---|
| `staff_id` | text, not null | `staff_profiles.id` |
| `role` | text, not null, `CHECK (role IN ('owner','admin','scheduler','coach'))` | FR-045. `scheduler` = the spec's "Scheduler/Designer" |
| `PRIMARY KEY (staff_id, role)` | | A staff member can hold multiple roles, same as Ask a Coach's model |

**Note**: A Coach with no `booking_staff_roles` row at all is still treated as a baseline Coach for this feature if they hold the platform's own `coach` role in `staff_profiles` (so existing Coaches aren't required to be explicitly re-granted a role just to keep using booking) — `owner`/`admin`/`scheduler` are the only roles that must be explicitly granted here.

## Reused, unchanged tables *(from Ask a Coach, research.md #8 — referenced, not redefined)*

- **`audit_log`**: `actor_staff_id`, `action`, `target_type`, `target_id`, `diff`, `created_at`. This feature writes rows with `target_type` values like `coach_availability_schedule`, `booking_event`, `notification_workflow` (FR-047).
- **`api_keys`**: `name`, `hashed_key`, `is_read_only`, `created_by_staff_id`, `revoked_at`, `last_used_at`. This feature's API keys are the same table, same access pattern (FR-048).
- **`webhook_subscriptions`** / **`webhook_deliveries`**: `url`, `events text[]`, `signing_secret` / delivery/retry tracking. This feature adds new event-name values (`booking.created`, `booking.rescheduled`, `booking.cancelled`, `booking.completed`, `booking.no_show`) to the existing free-form `events` array (FR-052).
