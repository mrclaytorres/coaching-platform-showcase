# Contract: Supabase Schema Changes

**Branch**: `006-course-sales-payments` | **Date**: 2026-07-28

Extends `customer_profiles` (from `002-supabase-auth-user-data`) and adds one new table. No RLS changes to any existing table.

## New Sequence + Column: Native Buyer Identity

```sql
CREATE SEQUENCE public.native_customer_id_seq START 1 INCREMENT 1;

-- supabase-js has no generic "run arbitrary SQL" call, so nextval() is wrapped in a
-- function the service-role client can invoke via `.rpc('next_native_customer_id')`.
CREATE OR REPLACE FUNCTION public.next_native_customer_id()
RETURNS integer
LANGUAGE sql
AS $$
  SELECT (-nextval('public.native_customer_id_seq'))::integer;
$$;

ALTER TABLE public.customer_profiles
  ADD COLUMN account_origin text NOT NULL DEFAULT 'core-linked'
    CHECK (account_origin IN ('core-linked', 'native'));
```

A native buyer's `core_customer_id` is assigned in application code by calling `next_native_customer_id()` at account-creation time (research.md #3) — always negative, never `0` or positive, so it can never collide with a real Core `customer_id`.

## New Table: purchases

```sql
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.customer_profiles(id),
  course_id text NOT NULL,
  course_category_at_purchase text NOT NULL CHECK (course_category_at_purchase IN ('sequential-locked', 'standalone')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'declined', 'refunded', 'error')),
  stripe_checkout_session_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  tier_rank_granted integer,
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_buyer_id_idx ON public.purchases(buyer_id);
CREATE INDEX purchases_course_id_idx ON public.purchases(course_id);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- A student may read only their own purchases.
CREATE POLICY purchases_select_own ON public.purchases
  FOR SELECT
  USING (
    buyer_id IN (
      SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid()
    )
  );

-- Staff/coach roles may read all purchases (support, refunds, sales reporting).
CREATE POLICY purchases_select_staff ON public.purchases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE supabase_user_id = auth.uid() AND is_active = true
    )
  );

-- No client-side INSERT/UPDATE policy: all writes go through the service-role
-- client (Stripe webhook handler, staff refund server action), never the
-- student's own session.
```

## Notes

- `purchases.course_id` is a plain-text cross-system reference to a Payload `Courses` id, following the same convention as `lesson_completions.lesson_id` etc. (`004-course-lesson-management/data-model.md`'s "Cross-system reference note") — no FK, application-layer integrity only.
- `stripe_checkout_session_id UNIQUE` is the idempotency anchor the webhook handler upserts against (research.md #2) — redundant Stripe webhook deliveries for the same Checkout Session never create a second `purchases` row.
- No RLS `INSERT`/`UPDATE` policy is defined for the `authenticated` role deliberately — a student must never be able to mark their own purchase `succeeded` or `refunded` directly; only the service-role client (used server-side in the webhook handler and the staff refund action) writes to this table.
