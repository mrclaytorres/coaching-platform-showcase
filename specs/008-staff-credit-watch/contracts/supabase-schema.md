# Contract: Supabase Schema Changes

**Branch**: `008-staff-credit-watch` | **Date**: 2026-07-31

Adds one new table. No changes to any existing table.

## New Table: credit_adjustments

```sql
CREATE TABLE public.credit_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_customer_id integer NOT NULL,
  lesson_type_id integer NOT NULL,
  lesson_type_name text NOT NULL,
  amount_credits numeric NOT NULL CHECK (amount_credits <> 0),
  reason text NOT NULL CHECK (char_length(reason) > 0),
  status text NOT NULL DEFAULT 'placeholder'
    CHECK (status IN ('placeholder', 'synced')),
  created_by uuid NOT NULL REFERENCES public.staff_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_adjustments_customer_lesson_idx
  ON public.credit_adjustments(core_customer_id, lesson_type_id);

ALTER TABLE public.credit_adjustments ENABLE ROW LEVEL SECURITY;

-- No client-side SELECT/INSERT policy: all reads and writes go through the
-- service-role client in staff-only server actions, gated by
-- requireStaffRole(['super_admin', 'staff']). No student or coach session
-- should ever query this table directly.
```

## Notes

- `core_customer_id` is a plain-integer cross-system reference to Core's customer id, following the same "no FK, application-layer integrity only" convention used elsewhere for cross-system references in this codebase — not every Core customer has a `customer_profiles` row (many have never logged into the Academy portal), so a foreign key here would be incorrect.
- `created_by` **is** a real foreign key — `staff_profiles` is entirely Academy-owned, so referential integrity is meaningful and enforceable here.
- `status` defaults to `'placeholder'` because live write access to Core's API doesn't exist yet (research.md §3); `'synced'` is reserved for the future cutover and requires no schema change when that happens — only a new code path that flips the value once an adjustment is actually pushed to Core.
- `amount_credits <> 0` and `reason` non-empty are enforced at the database level, not just in the UI, since this table is the audit trail of record for every credit adjustment (FR-014, SC-007).
