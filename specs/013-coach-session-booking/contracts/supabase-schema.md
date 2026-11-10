# Contract: Supabase Schema and RLS Policies

**Branch**: `013-coach-session-booking` | **Date**: 2026-08-21

Applied manually to the Supabase project alongside the existing schema files from specs 002/004/008 (`docs/production-deployment.md` Step 1).

## Tables

### `booking_time_slots`

```sql
CREATE TABLE public.booking_time_slots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_event_id  text        NOT NULL,  -- Payload booking-events doc id, plain reference (data-model.md)
  start_time        timestamptz NOT NULL,
  capacity          integer     NOT NULL CHECK (capacity >= 1),
  confirmed_count   integer     NOT NULL DEFAULT 0 CHECK (confirmed_count >= 0 AND confirmed_count <= capacity),
  status            text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'canceled')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

### `bookings`

```sql
CREATE TABLE public.bookings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  time_slot_id      uuid        NOT NULL REFERENCES public.booking_time_slots(id) ON DELETE CASCADE,
  student_id        uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'canceled')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  canceled_at       timestamptz,
  reminder_sent_at  timestamptz,
  UNIQUE (time_slot_id, student_id)
);
```

### `booking_notification_failures`

```sql
CREATE TABLE public.booking_notification_failures (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  notification_type  text        NOT NULL CHECK (notification_type IN ('confirmation', 'cancellation', 'reminder')),
  error_message      text        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
```

---

## Indexes

```sql
-- booking_time_slots
CREATE INDEX idx_booking_time_slots_event ON public.booking_time_slots (booking_event_id);
CREATE INDEX idx_booking_time_slots_start ON public.booking_time_slots (start_time) WHERE status = 'open';

-- bookings
CREATE INDEX idx_bookings_student ON public.bookings (student_id) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_slot ON public.bookings (time_slot_id) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_reminder_due
  ON public.bookings (reminder_sent_at)
  WHERE status = 'confirmed' AND reminder_sent_at IS NULL;

-- booking_notification_failures
CREATE INDEX idx_booking_notification_failures_booking ON public.booking_notification_failures (booking_id);
```

---

## Row Level Security Policies

All application writes go through the service-role client in server actions (same convention as `submissions`/`course_enrollments`), so RLS here is defense-in-depth, not the primary access-control mechanism (that's `requireStaffRole`/`requireCustomerProfile` in application code).

```sql
ALTER TABLE public.booking_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_notification_failures ENABLE ROW LEVEL SECURITY;

-- booking_time_slots: readable by any authenticated user (Students need to browse availability;
-- Tier-restriction visibility is an application-layer filter, not RLS — same pattern Payload's
-- `read: () => true` already uses for Courses/Assignments, research.md #9).
CREATE POLICY "booking_time_slots_read_authenticated"
  ON public.booking_time_slots FOR SELECT
  TO authenticated
  USING (true);

-- bookings: a Student may only read/insert/update their own rows.
CREATE POLICY "bookings_select_own"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "bookings_insert_own"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "bookings_update_own"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );

-- booking_notification_failures: no direct client access (staff view reads via service-role
-- server action, same as every other staff-only report in this codebase) — no policy grants
-- access beyond the default deny.
```
