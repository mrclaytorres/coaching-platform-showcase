# Contract: Supabase Schema Change

**Branch**: `005-customer-data-integration` | **Date**: 2026-07-15

Extends the `customer_profiles` table defined in `specs/002-supabase-auth-user-data/contracts/supabase-schema.md`. No new tables, no RLS policy changes (the new column is only ever written by the service-role client, same as every other column on this table).

## Column Addition

```sql
ALTER TABLE public.customer_profiles
  ADD COLUMN is_seeded boolean NOT NULL DEFAULT false;
```

## Notes

- Existing rows default to `false` — no backfill needed; every currently-linked account went through the real magic-link flow.
- Not included in `upsertCustomerProfile`'s conflict-update payload path for real logins (`src/app/login/page.tsx`'s `linkAccount` call site never passes `isSeeded: true`), so a real student re-linking can never accidentally flip this to `true`.
- No new index — `customer_profiles` is small (one row per linked student); a full-table scan filtering `is_seeded` is inconsequential at this scale, consistent with the "no premature optimization" posture of the rest of this table's indexing.
- RLS is unaffected: the existing `customers_select_own_profile` / `customers_update_own_profile` policies already scope by `supabase_user_id = auth.uid()`, which applies identically to seeded and real rows.

## Supabase Client Keys

No new keys. Reuses `SUPABASE_SERVICE_ROLE_KEY` (already required, already documented in `specs/002-supabase-auth-user-data/contracts/supabase-schema.md`) for `auth.admin.createUser` and the profile upsert.

## New Environment Variable

```env
# Dev-only account seeding — required to allow the /dev/seed-accounts seeding action to run.
# NEVER set this in production (see docs/production-deployment.md's env var list, which
# intentionally omits it).
ALLOW_DEV_SEEDING=true
```

Add to `.env.example` under a clearly-marked "Development only" section. Do **not** add to `docs/production-deployment.md`'s Step 4 environment variable list.
