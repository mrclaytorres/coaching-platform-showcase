# Contract: Supabase Schema and RLS Policies

**Branch**: `017-live-coaching` | **Date**: 2026-09-22

Applied manually to the same Supabase project as every other academy-platform migration (`docs/production-deployment.md` Step 1). Four tables referenced here (`audit_log`, `api_keys`, `webhook_subscriptions`, `webhook_deliveries`) already exist from the Ask a Coach feature and are **not** recreated — see data-model.md's "Reused, unchanged tables" section.

## Extensions to existing tables (013)

```sql
ALTER TABLE public.booking_time_slots
  ADD COLUMN generation_source text NOT NULL DEFAULT 'manual' CHECK (generation_source IN ('manual', 'generated')),
  ADD COLUMN source_schedule_id uuid REFERENCES public.coach_availability_schedules(id),
  ADD COLUMN category text NOT NULL DEFAULT 'one-on-one';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check,
  ADD CONSTRAINT bookings_status_check CHECK (status IN ('confirmed', 'canceled', 'rescheduled', 'no_show')),
  ADD COLUMN rescheduled_from_slot_id uuid,
  ADD COLUMN zoom_meeting_id uuid REFERENCES public.zoom_meetings(id),
  ADD COLUMN credit_transaction_id uuid REFERENCES public.credit_transactions(id),
  ADD COLUMN answers jsonb,
  ADD COLUMN late_cancellation boolean NOT NULL DEFAULT false;
```

Run the `coach_availability_schedules`/`zoom_meetings`/`credit_transactions` `CREATE TABLE` statements below **before** this block, since the new FK columns above reference them.

## New tables

### `coach_availability_schedules`

```sql
CREATE TABLE public.coach_availability_schedules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    text        NOT NULL,
  name        text        NOT NULL,
  category    text        NOT NULL CHECK (category IN ('one-on-one', 'group', 'workshop')),
  timezone    text        NOT NULL,
  day_of_week integer     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  time        NOT NULL,
  end_time    time        NOT NULL CHECK (end_time > start_time),
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_availability_schedules_coach_id_idx ON public.coach_availability_schedules(coach_id);
```

### `availability_overrides`

```sql
CREATE TABLE public.availability_overrides (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      text        NOT NULL,
  date          date        NOT NULL,
  override_type text        NOT NULL CHECK (override_type IN ('extra_hours', 'blocked')),
  start_time    time,
  end_time      time,
  category      text,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (override_type = 'blocked' OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);
CREATE INDEX availability_overrides_coach_id_date_idx ON public.availability_overrides(coach_id, date);
```

### `workshop_waitlist_entries`

```sql
CREATE TABLE public.workshop_waitlist_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_event_id text        NOT NULL,
  student_id       uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  position         integer     NOT NULL,
  status           text        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'claimed', 'expired', 'canceled')),
  offered_at       timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_event_id, student_id)
);
CREATE INDEX workshop_waitlist_entries_event_status_idx ON public.workshop_waitlist_entries(booking_event_id, status, position);
```

### `zoom_meetings`

```sql
CREATE TABLE public.zoom_meetings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_event_id text,
  time_slot_id     uuid        REFERENCES public.booking_time_slots(id) ON DELETE CASCADE,
  zoom_meeting_id  text        NOT NULL,
  join_url         text        NOT NULL,
  host_coach_id    text        NOT NULL,
  status           text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'failed', 'deleted')),
  failure_reason   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((booking_event_id IS NOT NULL) <> (time_slot_id IS NOT NULL))
);
```

### `external_calendar_connections`

```sql
CREATE TABLE public.external_calendar_connections (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id                  text        NOT NULL,
  provider                  text        NOT NULL CHECK (provider IN ('google', 'microsoft', 'icloud')),
  encrypted_credentials     text        NOT NULL,
  conflict_check_calendar_ids text[]    NOT NULL DEFAULT '{}',
  write_calendar_id         text,
  status                    text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_reconnect')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX external_calendar_connections_coach_id_idx ON public.external_calendar_connections(coach_id);
```

### `calendar_sync_state`

```sql
CREATE TABLE public.calendar_sync_state (
  connection_id   uuid        PRIMARY KEY REFERENCES public.external_calendar_connections(id) ON DELETE CASCADE,
  push_channel_id text,
  push_expires_at timestamptz,
  last_polled_at  timestamptz,
  last_synced_at  timestamptz
);
```

### `credit_transactions`

Mirrors `credit_adjustments` (specs/008-staff-credit-watch/contracts/supabase-schema.md) — same `'placeholder'`/`'synced'` status convention, since live Core write access still doesn't exist (research.md #5, data-model.md).

**Implementation note (discovered during `/speckit-implement`)**: `category` (`one-on-one`/`group`/`workshop`) was replaced with `lesson_type_id integer` before this table was first populated. Core's credit wallets (`fetchSnapshot()`'s `SnapshotWallet[]`, `src/lib/types.ts`) are keyed by Core's own numeric `lesson_type_id`/`lesson_type_name` (e.g. `1` = "One on One Coaching Lesson"), not by Academy's booking category — a Academy category is a many-to-one grouping over Core's actual lesson types, not a synonym for one. `checkCredit`/`debitCredit`/`refundCredit` need the real Core key to read/write the correct wallet, so each credit-gated Booking Event now stores which specific `creditLessonTypeId` it draws against (`contracts/payload-collections.md`), and this table mirrors that same integer, not the coarser category.

```sql
CREATE TABLE public.credit_transactions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  student_id        uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  core_customer_id integer     NOT NULL,
  lesson_type_id    integer     NOT NULL,
  transaction_type  text        NOT NULL CHECK (transaction_type IN ('debit', 'refund')),
  amount_credits    numeric     NOT NULL CHECK (amount_credits <> 0),
  status            text        NOT NULL DEFAULT 'placeholder' CHECK (status IN ('placeholder', 'synced')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, transaction_type)
);
CREATE INDEX credit_transactions_core_customer_lesson_idx ON public.credit_transactions(core_customer_id, lesson_type_id);
```

### `session_records`

```sql
CREATE TABLE public.session_records (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  coach_id                 text        NOT NULL,
  coach_name_snapshot      text        NOT NULL,
  event_type_id            text        NOT NULL,
  event_type_title_snapshot text       NOT NULL,
  session_category         text        NOT NULL CHECK (session_category IN ('one-on-one', 'group', 'workshop')),
  scheduled_start          timestamptz NOT NULL,
  duration_minutes         integer     NOT NULL,
  attendee_count           integer     NOT NULL DEFAULT 1,
  status                   text        NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled_by_student', 'cancelled_by_coach', 'no_show')),
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_records_coach_category_idx ON public.session_records(coach_id, session_category, scheduled_start);
```

### `notification_workflows`

```sql
CREATE TABLE public.notification_workflows (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_event_id text,
  trigger          text        NOT NULL CHECK (trigger IN ('booked', 'cancelled', 'rescheduled', 'before_start', 'after_end')),
  offset_minutes   integer,
  action           text        NOT NULL DEFAULT 'email' CHECK (action IN ('email', 'sms')),
  recipient        text        NOT NULL CHECK (recipient IN ('student', 'coach', 'admin')),
  template_id      text        NOT NULL,
  is_active        boolean     NOT NULL DEFAULT true,
  CHECK (trigger NOT IN ('before_start', 'after_end') OR offset_minutes IS NOT NULL)
);
```

### `booking_staff_roles`

```sql
CREATE TABLE public.booking_staff_roles (
  staff_id text NOT NULL,
  role     text NOT NULL CHECK (role IN ('owner', 'admin', 'scheduler', 'coach')),
  PRIMARY KEY (staff_id, role)
);
```

### `booking_settings`

**Added during `/speckit-implement` (User Story 7)**, not in the original design — FR-044's single "coaches may create their own event types" toggle needed somewhere to live, and no generic settings surface exists elsewhere in this codebase yet.

```sql
CREATE TABLE public.booking_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
```

## RLS

Service-role bypasses RLS, same convention as 013 and every other table in this project — `ENABLE ROW LEVEL SECURITY` with no policies beyond that:

```sql
ALTER TABLE public.coach_availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_staff_roles ENABLE ROW LEVEL SECURITY;
```
