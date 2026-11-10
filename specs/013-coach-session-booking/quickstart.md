# Quickstart: Coach Session Booking

**Branch**: `013-coach-session-booking` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Manual validation only — no automated test framework exists in this repo (consistent with specs 008/011/012).

## Prerequisites

1. Apply the new schema (`contracts/supabase-schema.md`) to your dev Supabase project — same manual-apply flow as every prior feature's schema file (`docs/supabase-setup.md`).
2. Add the new Payload collection (`contracts/payload-collections.md`) to `payload.config.ts`, then:
   ```bash
   npm run payload -- migrate:create add_booking_events
   npm run payload -- migrate
   ```
3. New env vars (add to `.env.local`, and to production per `docs/production-deployment.md` once this ships):
   ```env
   RESEND_API_KEY=[from resend.com dashboard]
   BOOKING_EMAIL_FROM=bookings@yourdomain.com
   BOOKING_REMINDER_CRON_SECRET=[generate with: openssl rand -base64 32]
   BOOKING_REMINDER_WINDOW_HOURS=24
   ```
4. `npm run dev` (port 3040, per `package.json`).
5. Two dev Student accounts at different Tier ranks and one Staff/Coach account — reuse `/dev/seed-accounts` (`ALLOW_DEV_SEEDING=true` in dev) the same way prior specs' quickstarts do.

## Scenario 1 — 1-on-1 booking (User Story 1, P1)

1. As Staff/Coach, go to `/booking/staff`, create a Booking Event: type `1-on-1`, title "Technique Review", duration 30 min. Add two future Time Slots.
2. Publish the event.
3. As Student A, go to `/booking/customer/[id]`, open the event, confirm both slots are listed as open.
4. Book one slot. **Expect**: booking confirmed, that slot no longer appears as open for other Students, Student A sees it under "My Bookings."
5. As Student B, view the same event. **Expect**: the booked slot is gone from the list; the other slot is still open.
6. Check Student A's and the Coach's inbox (or Resend's dev dashboard). **Expect**: both received a confirmation email (FR-022).

## Scenario 2 — Group capacity (User Story 2, P2)

1. As Staff/Coach, create a `group` event with capacity 3 on one slot.
2. Book it as three different Students. **Expect**: all three succeed.
3. Attempt a fourth Student's booking. **Expect**: rejected, UI clearly states the slot is full (FR-008).
4. Fire two booking attempts for a capacity-1-remaining slot at effectively the same time (e.g. two browser tabs, near-simultaneous submit). **Expect**: exactly one succeeds (SC-003) — validates the atomic claim in `research.md` #3.

## Scenario 3 — Tier restriction (User Story 3, P3)

1. Set Student A's `current_tier_rank` at or above some Tier X's `order`; leave Student B below it.
2. As Staff/Coach, create a Booking Event restricted to Tier X, publish it.
3. As Student A, confirm the event is visible and bookable.
4. As Student B, confirm the event does **not** appear in their bookable list (FR-020).

## Scenario 4 — Booking management (User Story 4, P4)

1. As a Student with a confirmed booking, cancel it from "My Bookings." **Expect**: it disappears from their list, and the slot's remaining capacity increases by one for other Students (FR-012).
2. As Staff/Coach, open a slot's roster (`/booking/staff/[eventId]`). **Expect**: an accurate list of currently-registered Students (FR-013).
3. Cancel that slot entirely as Staff/Coach. **Expect**: any remaining Bookings on it disappear from their Students' lists (FR-014), and each affected Student receives a cancellation email (FR-023).

## Scenario 5 — Notifications (User Story 5, P5)

1. Repeat a booking + cancellation from Scenarios 1/4 while watching Resend's dashboard (or a caught-mail dev inbox). **Expect**: confirmation and cancellation emails arrive within a few minutes (SC-008).
2. Create a Booking with its slot's `start_time` inside the reminder window, then call the cron endpoint manually:
   ```bash
   curl -X POST http://localhost:3040/api/booking/send-reminders \
     -H "x-booking-cron-secret: $BOOKING_REMINDER_CRON_SECRET"
   ```
   **Expect**: `{ "sent": 1, "failed": 0 }`, the Student receives a reminder email, and re-calling the endpoint does not re-send it (`reminder_sent_at` now set) (FR-024).
3. Temporarily set `RESEND_API_KEY` to an invalid value, repeat a booking. **Expect**: the booking still succeeds (FR-025) and a row appears in `booking_notification_failures`, visible on the event's staff roster view.

## Regression check

- `npm run typecheck` clean.
- Existing Course/Lesson/Assignment pages unaffected — this feature adds a new `booking-events` Payload collection and new Supabase tables only; nothing in `collections/Courses.ts`, `Assignments.ts`, etc. is modified.
