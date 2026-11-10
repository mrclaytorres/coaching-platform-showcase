# Contract: Supabase Schema Changes

**Branch**: `015-expanded-payments` | **Date**: 2026-09-01

Widens `purchases` (006-course-sales-payments) and adds one new table. No RLS changes to any other existing table. This file states the contract each piece of code is written against — the **runnable SQL to paste into the Supabase SQL editor is in [data-model.md](../data-model.md#supabase-schema-changes)**, not here.

## `purchases` (widened)

- `product_id` (renamed from `course_id`) + `product_type` (`'tier' | 'course' | 'lesson'`) together identify what was bought. Every write/read site that referenced `course_id`/`courseId` is updated to `product_id`/`productId`:
  - `src/lib/payments/checkout.ts` — `createCheckoutSession`
  - `src/app/api/webhooks/stripe/route.ts` — `handleCheckoutCompleted`
  - `src/lib/payments/purchases.ts` — `listMyPurchases`, `listAllPurchases`, `refundPurchase`
- `course_category_at_purchase` is written only when `product_type === 'course'`; `null` otherwise.
- Idempotency contract is unchanged from 006: `stripe_checkout_session_id` stays the unique anchor the webhook upserts against.

## `subscriptions` (new)

- Exactly one row per `buyer_id` (unique index) — a signup while a row already exists is prevented at the checkout-creation layer (FR-011: an active subscriber is shown "already have access," never reaches Stripe Checkout again), with the unique index as a DB-level backstop against a race.
- Written only by:
  - `src/app/api/webhooks/stripe/route.ts` — `handleSubscriptionEvent` (customer.subscription.created/updated/deleted) and `handleInvoiceEvent` (invoice.paid/invoice.payment_failed), both re-reading the Subscription object's own `.status` from Stripe rather than inferring transitions locally (research.md #2).
  - `src/lib/payments/subscriptions.ts` — `cancelSubscription` (staff action, cancels via Stripe API; the resulting `customer.subscription.updated`/`deleted` webhook is what actually updates the row — the server action itself does not write `status` directly, avoiding a race between the action's own write and the webhook's).
- Read by:
  - `src/lib/progress/course-access.ts` — `hasActiveSubscription`
  - `src/lib/payments/subscriptions.ts` — `getMySubscription` (student purchase-history view), `listAllSubscriptions` (staff sales view)
