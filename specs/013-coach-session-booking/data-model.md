# Phase 1 Data Model: Coach Session Booking

**Branch**: `013-coach-session-booking` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Booking Event *(Payload collection `booking-events`, research.md #2)*

Staff/Coach-authored session definition — analogous to `Assignments`/`Courses`.

| Field | Type | Notes |
|---|---|---|
| `title` | text, required | FR-001 |
| `description` | richText | FR-001 |
| `durationMinutes` | number, required | Used to compute each Time Slot's end time for overlap checks (research.md #5) |
| `eventType` | select: `one-on-one` \| `group`, required | FR-001 |
| `capacity` | number | Only meaningful when `eventType = group`; forced to `1` for `one-on-one` in `booking-events.ts`, not enforced declaratively (FR-003) |
| `coachId` | text, required | `staff_profiles.id` — plain reference, not a Payload relationship (research.md #1/#9; Staff/Coach accounts live in Supabase, not a Payload `Users` collection) |
| `restrictedTiers` | relationship → `tiers`, hasMany | Empty = open to all Students. Non-empty = Tier-gated (FR-019) |
| `isPublished` | checkbox, default `false` | FR-005 |

**Validation** (enforced in `src/lib/booking/booking-events.ts`, not declaratively — same convention as `course-actions.ts`):
- `capacity >= 1` when `eventType = group`; `capacity` ignored/treated as `1` when `eventType = one-on-one` (FR-003).
- Only `super_admin` / `staff` / `coach` roles may create/update/publish/unpublish (FR-016, research.md #9).

## Time Slot *(Supabase table `booking_time_slots`, research.md #2)*

A specific bookable instance under one Booking Event.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_event_id` | text, not null | Payload `booking-events` doc id — plain reference (research.md #2) |
| `start_time` | timestamptz, not null | FR-002; must be in the future at creation time (FR-004) |
| `capacity` | integer, not null, `CHECK (capacity >= 1)` | Copied from the Booking Event at slot-creation time (so a later capacity edit on the event doesn't retroactively overbook/underbook an already-open slot) |
| `confirmed_count` | integer, not null, default `0`, `CHECK (confirmed_count >= 0 AND confirmed_count <= capacity)` | Denormalized counter, atomically maintained (research.md #3) |
| `status` | text, not null, default `'open'`, `CHECK (status IN ('open','canceled'))` | FR-014 sets this to `canceled` |
| `created_at` | timestamptz, not null, default `now()` | |

**State transitions**:
- `open` → `canceled`: Coach cancels the slot (FR-014). One-way — a canceled slot is never reopened; the Coach adds a new one instead.
- `confirmed_count` only ever moves via the atomic claim/release statements in research.md #3 — never a plain unguarded `UPDATE`.
- A slot is "full" (not bookable) exactly when `confirmed_count = capacity`, computed at read time, not a separate stored flag.

## Booking *(Supabase table `bookings`, research.md #2)*

Links one Student to one Time Slot.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `time_slot_id` | uuid, not null, `REFERENCES booking_time_slots(id) ON DELETE CASCADE` | Real FK — both tables are Supabase-owned, unlike the Payload boundary |
| `student_id` | uuid, not null, `REFERENCES customer_profiles(id) ON DELETE CASCADE` | |
| `status` | text, not null, default `'confirmed'`, `CHECK (status IN ('confirmed','canceled'))` | |
| `created_at` | timestamptz, not null, default `now()` | |
| `canceled_at` | timestamptz, nullable | Set when `status` moves to `canceled` |
| `reminder_sent_at` | timestamptz, nullable | FR-024; set once the reminder Route Handler successfully emails this Booking |
| `UNIQUE (time_slot_id, student_id)` | constraint | A Student can't double-book the same slot (also the compensation target in research.md #3 step 2) |

**State transitions**:
- `confirmed` → `canceled`: Student cancels their own Booking (FR-012), or Coach cancels the whole slot, which cascades to every Booking under it (FR-014) — both paths decrement `booking_time_slots.confirmed_count` (research.md #3).
- No `canceled` → `confirmed` transition — re-booking is a new row (a fresh availability check against current `confirmed_count`), not a resurrection of a canceled one.

## Booking Notification Failure *(Supabase table `booking_notification_failures`, research.md #8)*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_id` | uuid, not null, `REFERENCES bookings(id) ON DELETE CASCADE` | |
| `notification_type` | text, not null, `CHECK (notification_type IN ('confirmation','cancellation','reminder'))` | |
| `error_message` | text, not null | |
| `created_at` | timestamptz, not null, default `now()` | |

Never blocks or rolls back the triggering booking/cancellation action (FR-025) — always inserted from a `catch` block after the booking/cancellation write has already succeeded.

## Reused entities (no schema change)

- **Coach/Staff Account** — existing Supabase `staff_profiles` (`src/lib/auth/staff-profile.ts`); `booking-events.coachId` references `staff_profiles.id`.
- **Student Account** — existing Supabase `customer_profiles` (`src/lib/auth/customer-profile.ts`); `bookings.student_id` references `customer_profiles.id`.
- **Tier** — existing Payload `tiers` collection and existing Supabase `student_tier_progress` table; `booking-events.restrictedTiers` references `tiers`, eligibility checked against `student_tier_progress.current_tier_rank` (research.md #4).

## Relationship diagram

```
tiers (Payload) ◄──────── restrictedTiers ──┐
                                              │
staff_profiles (Supabase) ◄── coachId ── booking-events (Payload)
                                              ▲
                                              │ booking_event_id (plain text ref)
                                              │
                                    booking_time_slots (Supabase)
                                              ▲
                                              │ time_slot_id (real FK)
                                              │
customer_profiles (Supabase) ◄── student_id ── bookings ── booking_id (real FK) ──► booking_notification_failures
```
