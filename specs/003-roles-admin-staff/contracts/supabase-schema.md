# Contract: Supabase Schema — Staff Profiles and RLS

**Branch**: `003-roles-admin-staff` | **Date**: 2026-06-16

---

## Role Enum

```sql
CREATE TYPE public.staff_role AS ENUM ('super_admin', 'coach', 'staff');
```

---

## Table: `staff_profiles`

```sql
CREATE TABLE public.staff_profiles (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id  uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text        NOT NULL UNIQUE,
  first_name        text        NOT NULL,
  last_name         text        NOT NULL,
  role              staff_role  NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  invited_by        uuid        REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

---

## Indexes

```sql
CREATE UNIQUE INDEX idx_staff_profiles_supabase_user ON public.staff_profiles (supabase_user_id);
CREATE UNIQUE INDEX idx_staff_profiles_email         ON public.staff_profiles (email);
CREATE INDEX        idx_staff_profiles_role          ON public.staff_profiles (role);
CREATE INDEX        idx_staff_profiles_active        ON public.staff_profiles (is_active);
```

---

## Row Level Security

```sql
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

-- Staff can read their own row (for profile display in sidebar)
CREATE POLICY "staff_select_own_profile"
  ON public.staff_profiles FOR SELECT
  TO authenticated
  USING (supabase_user_id = auth.uid());
```

All other operations (INSERT, UPDATE, DELETE, and admin list reads) use the service role key server-side — no client-side mutations to this table.

---

## `updated_at` Trigger

Reuses the `set_updated_at()` function already created for `customer_profiles`:

```sql
CREATE TRIGGER staff_profiles_updated_at
  BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## New Environment Variable

Add to `.env` and `.env.example`:

```env
# First Super Admin — auto-provisioned on first login (no seed script needed)
INITIAL_SUPER_ADMIN_EMAIL=your-admin@example.com
```

This variable is **server-only**. Never prefix with `NEXT_PUBLIC_`.

---

## Run Order

Apply in this order in the Supabase SQL Editor:

1. `CREATE TYPE public.staff_role ...`
2. `CREATE TABLE public.staff_profiles ...`
3. Indexes
4. RLS `ALTER TABLE` + `CREATE POLICY`
5. Trigger (only if `set_updated_at()` function already exists — it does from spec 002 schema)
