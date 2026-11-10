# Phase 1 Data Model: Independent Account Signup

## Reused, already-live foundation (branch 006-course-sales-payments, research.md §0)

No migration in this section — all of it is already applied to the shared database, ahead of branch 006 merging its application code. Documented here because this feature depends on it and it isn't reflected in any spec currently merged into `develop`.

```sql
-- Already live:
ALTER TABLE public.customer_profiles
  ADD COLUMN account_origin text NOT NULL DEFAULT 'core-linked'
    CHECK (account_origin IN ('core-linked', 'native'));

CREATE SEQUENCE public.native_customer_id_seq;

CREATE FUNCTION public.next_native_customer_id() RETURNS integer AS $$
  SELECT (-nextval('public.native_customer_id_seq'))::integer;
$$ LANGUAGE sql;
```

`customer_profiles.core_customer_id` stays `integer NOT NULL UNIQUE` — completely unchanged from spec 002. A native account's id is always negative (via `next_native_customer_id()`), a Core-linked account's id is always positive (Core's own `customer_id` space) — the two ranges are disjoint by construction, so `UNIQUE` alone prevents any collision between them.

`public.purchases` also already exists (006's own table) — irrelevant to this feature, not touched.

## `customer_profiles` — the "native, unlinked" row shape (created by this feature's signup path)

| Column | Value |
|---|---|
| `supabase_user_id` | set — the real auth user created by `signInWithOtp` |
| `core_customer_id` | a negative integer from `next_native_customer_id()` |
| `account_origin` | `'native'` |
| `email` | the auth user's email (the signup email, not necessarily any Core record's on-file email) |
| `first_name` | collected inline in the "Continue without linking" step |
| `is_seeded` | `false` |
| `is_active` | `true` (default, unaffected) |

Created via `createNativeCustomerProfile()`, ported unmodified from branch 006 (research.md §0) — this feature does not write its own version of this function.

**On successful link** (`linkCoreAccount()`, no pre-existing pending row — the common case): the same row is updated in place — `core_customer_id` set to the real Core id, `account_origin` set to `'core-linked'`. `email`/`first_name` are left as-is (unlike a Core-sourced row, which refreshes these from the snapshot on every login) — they already reflect a real, user-provided identity, and this feature doesn't overwrite what the person entered at signup with whatever happens to be on file in Core.

**On successful link, merge case** (a spec-012 pending row already exists for that Core id — research.md §3): the native row is deleted after its `bookings.student_id` rows are reassigned to the pending row's `id`; the pending row's `supabase_user_id` is set to the caller's auth uid. The student ends up on the pending row's `id`.

## New table: `core_link_requests`

```sql
CREATE TABLE public.core_link_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  core_customer_id    integer     NOT NULL,
  token_hash          text        NOT NULL,
  requested_ip        text,
  expires_at          timestamptz NOT NULL,
  consumed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX core_link_requests_profile_created_idx
  ON public.core_link_requests (customer_profile_id, created_at);

CREATE INDEX core_link_requests_ip_created_idx
  ON public.core_link_requests (requested_ip, created_at);

CREATE UNIQUE INDEX core_link_requests_token_hash_idx
  ON public.core_link_requests (token_hash);

ALTER TABLE public.core_link_requests ENABLE ROW LEVEL SECURITY;
-- No policies — service-role access only, same convention as booking_notification_failures.
```

**Fields**:
- `core_customer_id` here is always the **real, positive** Core id being requested — distinct from the requester's own (negative) `customer_profiles.core_customer_id` at request time.
- `token_hash` — SHA-256 of the raw token (`crypto.randomBytes(32)`, base64url-encoded, hex-hashed for storage). The raw token exists only in the emailed URL and in memory for the duration of one request; it is never persisted.
- `requested_ip` — best-effort, read from `x-forwarded-for` via `headers()`; nullable.
- `expires_at` — `created_at + 24h`, set at insert time.
- `consumed_at` — set the moment a token is successfully used; a consumed or expired row is never valid again (FR-007).

**Rate limiting** (FR-009, research.md §5) reads this same table — no separate counter:
- Per account: `count(*) WHERE customer_profile_id = $1 AND created_at > now() - interval '1 hour'` — cap 5.
- Per IP: `count(*) WHERE requested_ip = $1 AND created_at > now() - interval '1 hour'` — cap 20.

## No changes to existing tables beyond what's already live

`bookings`, `booking_time_slots`, `booking_events` (Payload), `student_tier_progress`, `course_enrollments` — all keyed by `customer_profiles.id`, which never changes for the common (no-pending-row) link case, and is deliberately preserved across the merge case (research.md §3).
