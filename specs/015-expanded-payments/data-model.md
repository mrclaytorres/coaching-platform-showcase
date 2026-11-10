# Phase 1 Data Model: Multi-Product Payments

**Branch**: `015-expanded-payments` | **Date**: 2026-09-01

## Payload Collections (modified)

### `Tiers` — new fields

| Field | Type | Notes |
|---|---|---|
| `priceCents` | number, min 0 | Required before `isForSale` can be true (enforced in `setTierPricing`, mirrors `setCoursePricing`). |
| `isForSale` | checkbox, default false | Publishes `/tiers/[tierId]`. Independent of any Course inside the Tier. |

### `Lessons` — new fields

| Field | Type | Notes |
|---|---|---|
| `priceCents` | number, min 0 | Required before `isForSale` can be true. |
| `isForSale` | checkbox, default false | Publishes `/lessons/[lessonId]`. Independent of `isPublished`, its parent Course's price, and its parent Course's `isForSale` — both `isPublished` and `isForSale` must be true for the sales page to be reachable (same two-flag pattern Courses already use for status/isForSale). |

## Payload Global (new)

### `subscription-plan`

Singleton — exactly one config object, no `id` list. Read with `payload.findGlobal({ slug: 'subscription-plan' })`, written with `payload.updateGlobal(...)`.

| Field | Type | Notes |
|---|---|---|
| `priceCents` | number, min 0 | Recurring amount per `billingInterval`. |
| `billingInterval` | select: `month` \| `year` | Passed straight into Stripe's inline `recurring.interval` (research.md #6). |
| `isForSale` | checkbox, default false | Publishes `/subscribe`. Requires `priceCents` set first (enforced in `setSubscriptionPlanPricing`). |

## Supabase Schema Changes

### `purchases` — widened from 006-course-sales-payments

```sql
ALTER TABLE public.purchases RENAME COLUMN course_id TO product_id;

ALTER TABLE public.purchases
  ADD COLUMN product_type text NOT NULL DEFAULT 'course'
    CHECK (product_type IN ('tier', 'course', 'lesson'));

ALTER TABLE public.purchases
  ALTER COLUMN course_category_at_purchase DROP NOT NULL;
-- course_category_at_purchase is now meaningful only when product_type = 'course'.

CREATE INDEX purchases_product_type_idx ON public.purchases(product_type);
```

- `product_id` is a plain-text cross-system reference (a Payload `tiers`, `courses`, or `lessons` id depending on `product_type`) — same no-FK convention the column already followed as `course_id`.
- Existing `stripe_checkout_session_id UNIQUE` idempotency anchor, RLS policies (`purchases_select_own`, `purchases_select_staff`), and status enum (`pending`/`succeeded`/`declined`/`refunded`/`error`) are unchanged.
- A `product_type = 'tier'` succeeded row has no separate "enrollment" table to point to — the grant it represents *is* the `student_tier_progress` row `enrollStudentInTierSequenceInternal` already writes (`tier_rank_granted` column, unchanged from 006). A `product_type = 'lesson'` succeeded row **is itself** the access grant — `isLessonAccessible()` (below) queries this table directly, with no separate enrollment table needed for Lessons.

### `subscriptions` — new table

```sql
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.customer_profiles(id),
  status text NOT NULL CHECK (status IN (
    'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'paused'
  )),
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  amount_cents integer NOT NULL,
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  -- event.created (seconds) of the last webhook event actually applied to this row, used as a
  -- staleness guard against out-of-order delivery — see upsertSubscriptionRow's comment. Not a
  -- DB-set audit timestamp like updated_at; this one is Stripe's own event time.
  last_event_created_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_buyer_id_idx ON public.subscriptions(buyer_id);
-- One row per buyer: a second signup attempt while a row already exists updates it in
-- place (Stripe Checkout is not even reachable for an already-subscribed buyer — FR-011 —
-- but this index is the DB-level backstop).
--
-- IMPORTANT: every webhook upsert into this table MUST target onConflict: 'buyer_id', never
-- 'stripe_subscription_id'. A buyer who canceled and later re-subscribes gets a brand-new
-- Stripe Subscription object (a different id) — upserting on stripe_subscription_id would
-- try to INSERT a second row and collide with this unique index instead of updating the old
-- one in place. Upserting on buyer_id handles both cases correctly: a redelivered webhook for
-- the same still-current subscription is idempotent either way, and a resubscription
-- correctly overwrites the old row's stripe_subscription_id/status.
--
-- CORRECTION (found via live testing): onConflict: 'buyer_id' alone is not sufficient — Stripe
-- doesn't guarantee delivery ordering, so a delayed/redelivered terminal event for a buyer's
-- now-superseded previous subscription can arrive AFTER their resubscription's own events and
-- silently clobber the current active row. upsertSubscriptionRow additionally guards on
-- last_event_created_at: it rejects any incoming event older than the last one actually
-- applied for that buyer_id, regardless of which stripe_subscription_id it names.

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT
  USING (
    buyer_id IN (SELECT id FROM public.customer_profiles WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY subscriptions_select_staff ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE supabase_user_id = auth.uid() AND is_active = true
    )
  );

-- No client INSERT/UPDATE policy — service-role only (webhook handler, staff cancel action).
```

- `status` mirrors Stripe's own Subscription `.status` field verbatim. **Correction (found via live testing):** `incomplete` IS reachable in normal operation — even a successful card payment through Checkout briefly passes the subscription through `incomplete` before `active` while the first invoice's PaymentIntent confirms, so the constraint must allow it (previously didn't, causing `customer.subscription.created` to 500 on every subscription signup). `incomplete_expired`, `trialing`, and `paused` are allowed for the same "store Stripe's real enum, don't guess which values are reachable" reason, even though this feature doesn't use trials/pauses itself.
- `hasActiveSubscription()` treats `status IN ('active', 'past_due')` as still granting all-access (research.md #3) — `past_due` is Stripe's automatic-retry window (spec FR-010's "ultimately fails after the payment processor's standard retry schedule"); only `canceled`/`unpaid` mean the grant has actually lapsed.
- `current_period_end` and `cancel_at_period_end` back the buyer-facing "when does this end" messaging (User Story 4, Acceptance Scenario 4) and the student purchase-history view (User Story 6).

## Access-Control Function Changes (`src/lib/progress/course-access.ts`)

```ts
export async function hasActiveSubscription(studentId: string): Promise<boolean>
// SELECT status FROM subscriptions WHERE buyer_id = studentId
//   AND status IN ('active', 'past_due') LIMIT 1 → boolean

export async function isCourseAccessible(studentId, course): Promise<boolean>
// UNCHANGED signature. NEW: first line becomes
//   if (await hasActiveSubscription(studentId)) return true;
// ...then falls through to the existing Tier-rank / course_enrollments logic unchanged.

export async function isLessonAccessible(studentId: string, lessonId: string): Promise<boolean>
// NEW. SELECT id FROM purchases WHERE buyer_id = studentId AND product_id = lessonId
//   AND product_type = 'lesson' AND status = 'succeeded' LIMIT 1 → boolean
// Does NOT call hasActiveSubscription itself — its one call site
// (.../lessons/[lessonId]/page.tsx) already checks isCourseAccessible() first, which
// already covers the Subscription case.
```

## Entity Relationship Summary

```
customer_profiles (1) ──< purchases (product_type: tier|course|lesson) >── tiers / courses / lessons (by product_id, no FK)
customer_profiles (1) ──< subscriptions (0..1, unique on buyer_id) >── (Stripe Subscription, by stripe_subscription_id)
customer_profiles (1) ──< student_tier_progress (0..1 per course_owner_id) — written by BOTH a Tier purchase and a Sequential-Locked Course purchase (unchanged from 006)
```
