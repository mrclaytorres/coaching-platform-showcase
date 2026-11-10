# Contract: Supabase Schema and RLS Policies

**Branch**: `002-supabase-auth-user-data` | **Date**: 2026-06-10

---

## Tables

### `customer_profiles`

```sql
CREATE TABLE public.customer_profiles (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id  uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  core_customer_id  integer     NOT NULL UNIQUE,
  email             text        NOT NULL,
  first_name        text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

> **Amended by `012-student-enrollment`**: `supabase_user_id` is now nullable
> (`ALTER TABLE public.customer_profiles ALTER COLUMN supabase_user_id DROP NOT NULL;`) —
> staff can enroll a student by Core customer ID before they've ever logged into the portal,
> creating a row with `supabase_user_id IS NULL`; their real first login later adopts that row
> in place (see `specs/012-student-enrollment/data-model.md` and `research.md` §2). RLS below
> is unaffected — `supabase_user_id = auth.uid()` is never true for a `NULL` value, so a pending
> row stays inaccessible until it's linked.

### `recording_progress`

```sql
CREATE TABLE public.recording_progress (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id   uuid    NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  core_session_id       integer NOT NULL,
  position_seconds      real    NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  is_reviewed           boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_profile_id, core_session_id)
);
```

---

## Indexes

```sql
-- customer_profiles
CREATE UNIQUE INDEX idx_customer_profiles_supabase_user ON public.customer_profiles (supabase_user_id);
CREATE UNIQUE INDEX idx_customer_profiles_core_id ON public.customer_profiles (core_customer_id);

-- recording_progress
CREATE INDEX idx_recording_progress_lookup ON public.recording_progress (customer_profile_id, core_session_id);
```

---

## Row Level Security Policies

### Enable RLS on both tables

```sql
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_progress ENABLE ROW LEVEL SECURITY;
```

### `customer_profiles` — customers can read and update their own row

```sql
CREATE POLICY "customers_select_own_profile"
  ON public.customer_profiles FOR SELECT
  USING (supabase_user_id = auth.uid());

CREATE POLICY "customers_update_own_profile"
  ON public.customer_profiles FOR UPDATE
  USING (supabase_user_id = auth.uid());

-- INSERT is via service role only (server-side upsert)
-- No DELETE policy — customer accounts are not deleted from the platform
```

### `recording_progress` — customers can manage their own progress rows

```sql
CREATE POLICY "customers_select_own_progress"
  ON public.recording_progress FOR SELECT
  USING (
    customer_profile_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "customers_insert_own_progress"
  ON public.recording_progress FOR INSERT
  WITH CHECK (
    customer_profile_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "customers_update_own_progress"
  ON public.recording_progress FOR UPDATE
  USING (
    customer_profile_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "customers_delete_own_progress"
  ON public.recording_progress FOR DELETE
  USING (
    customer_profile_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );
```

---

## Supabase Client Keys

| Key | Usage | Where |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client (RLS-enforced) | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only upsert (bypasses RLS) | `.env` — **never expose to browser** |

---

## `updated_at` Auto-Update Trigger

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER recording_progress_updated_at
  BEFORE UPDATE ON public.recording_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## Environment Variables Required

Add to `.env` and `.env.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]   # server-only, never NEXT_PUBLIC_

# PayloadCMS (reuses Supabase Postgres connection)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
PAYLOAD_SECRET=[random-32-char-string]
```
