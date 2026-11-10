# Contract: Server Actions & Route Handler

**Branch**: `015-expanded-payments` | **Date**: 2026-09-01

Mirrors 006-course-sales-payments' contract pattern. Extends `src/lib/payments/` and `src/app/api/webhooks/stripe/route.ts`; adds staff-pricing actions for Tiers/Lessons/Subscription-plan alongside the existing `setCoursePricing`.

## `src/lib/courses/tier-actions.ts` (extend existing)

### `setTierPricing`

```ts
async function setTierPricing(
  tierId: string,
  input: { priceCents: number; isForSale: boolean },
): Promise<void>
```

- `requireStaffRole(['super_admin', 'staff'])` — same set as `createTier`/`updateTier`.
- Rejects `isForSale: true` with no `priceCents` (or `<= 0`) — same guard as `setCoursePricing`.
- `revalidatePath('/staff/tiers')` and `revalidatePath('/tiers/${tierId}')`.

### `getTierForSale(tierId: string)`

```ts
async function getTierForSale(tierId: string): Promise<ForSaleTier | null>
```

- Public (no auth check) — backs `/tiers/[tierId]`.
- Returns `null` unless `isForSale === true` (Tiers have no draft/published status field, unlike Courses — `isForSale` alone gates reachability).

## `src/lib/courses/course-actions.ts` (extend existing — Lesson writes already live alongside Course writes here; there is no separate `lesson-actions.ts`)

### `setLessonPricing`

```ts
async function setLessonPricing(
  lessonId: string,
  input: { priceCents: number; isForSale: boolean },
): Promise<void>
```

- Same permission/guard pattern as `setCoursePricing`/`setTierPricing`.
- `revalidatePath('.../lessons/${lessonId}')` (staff edit page) and `revalidatePath('/lessons/${lessonId}')` (public sales page).

### `getLessonForSale(lessonId: string)`

```ts
async function getLessonForSale(lessonId: string): Promise<ForSaleLesson | null>
```

- Public. Returns `null` unless the Lesson's `isPublished === true AND isForSale === true`. Includes the parent Course's title (for on-page context) but not its price/for-sale status — a Lesson's own listing is independent (spec Assumptions).

## `src/lib/payments/subscription-plan.ts` (new)

### `setSubscriptionPlanPricing`

```ts
async function setSubscriptionPlanPricing(
  input: { priceCents: number; billingInterval: 'month' | 'year'; isForSale: boolean },
): Promise<void>
```

- `requireStaffRole(['super_admin', 'staff'])`.
- Rejects `isForSale: true` with no `priceCents`.
- Writes via `payload.updateGlobal({ slug: 'subscription-plan', data: input })`.
- `revalidatePath('/staff/subscription-plan')` and `revalidatePath('/subscribe')`.

### `getSubscriptionPlanForSale()`

```ts
async function getSubscriptionPlanForSale(): Promise<{ priceCents: number; billingInterval: 'month' | 'year' } | null>
```

- Public. Returns `null` unless `isForSale === true`.

## `src/lib/payments/checkout.ts` (extend existing)

`createCheckoutSession` (006) is generalized from a Course-only signature to all three one-time product types; a new `createSubscriptionCheckoutSession` handles the recurring product. Both share the buyer-resolution logic (signed-in profile lookup / brand-new-buyer email-uniqueness check) `createCheckoutSession` already implements — factored into an unexported `resolveBuyer()` helper both call.

### `createCheckoutSession` (generalized)

```ts
async function createCheckoutSession(input: {
  productType: 'tier' | 'course' | 'lesson';
  productId: string;
  buyerEmail?: string;
}): Promise<{ error: string } | void>
```

- Loads the product from the corresponding Payload collection based on `productType`; validates it's for-sale the same way 006 already validates a Course (`isForSale && priceCents`, plus `status === 'published'` for Course, `isPublished` for Lesson — Tiers have neither flag to check beyond `isForSale`).
- Resolves the buyer via `resolveBuyer()` (unchanged logic from 006, factored out).
- **New check, all three product types**: if `resolveBuyer()` yields a signed-in buyer, checks `hasActiveSubscription(buyerProfileId)` first — an active subscriber already has access to everything, so this returns `{ error: 'You already have access to this via your Subscription.' }` before any product-specific ownership check (FR-011).
- Product-specific "already own this" check: `isCourseAccessible(...)` for `course`, `isCourseUnlocked(...)`-equivalent Tier-rank check for `tier`, `isLessonAccessible(...)` for `lesson`.
- Builds the Stripe Checkout Session with `mode: 'payment'`, `payment_method_types: ['card', 'paypal', 'us_bank_account']` (research.md #4), and `metadata: { productType, productId, buyerProfileId, buyerEmail }` (renamed from 006's `courseId`/`courseCategory` keys — `courseCategory` is now read from Payload at webhook-fulfillment time instead of round-tripped through metadata, since it's only needed for the `course` branch).
- Double-click guard (006, unchanged in spirit): keyed on `(buyerProfileId, productType, productId)` instead of `(buyerProfileId, courseId)`.

### `createSubscriptionCheckoutSession` (new)

```ts
async function createSubscriptionCheckoutSession(input: {
  buyerEmail?: string;
}): Promise<{ error: string } | void>
```

- Loads the Subscription Plan global; validates `isForSale && priceCents`.
- Resolves the buyer via the same `resolveBuyer()` helper.
- If the buyer already has a `subscriptions` row with `status IN ('active', 'past_due')`, returns `{ error: 'You already have an active Subscription.' }` (FR-011) — never reaches Stripe.
- Builds the Stripe Checkout Session with `mode: 'subscription'`, `line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Academy All-Access Subscription' }, unit_amount: plan.priceCents, recurring: { interval: plan.billingInterval } }, quantity: 1 }]`, `payment_method_types` per research.md #4's risk note, and `metadata: { buyerProfileId, buyerEmail }`.
- No pre-inserted `pending` row (unlike one-time purchases) — a `subscriptions` row is created entirely from the webhook side once Stripe confirms the subscription object exists (research.md #2).

### `getPurchaseBySessionId` (extended)

```ts
async function getPurchaseBySessionId(sessionId: string): Promise<PurchaseStatusSummary | SubscriptionStatusSummary | null>
```

- Unchanged for one-time sessions (looks up `purchases` by `stripe_checkout_session_id`).
- New: if no `purchases` row matches, also checks `subscriptions.stripe_subscription_id` via a session→subscription lookup (`stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })`) — backs `/checkout/success` for a Subscription signup the same "still processing, keep polling" way 006 already handles a brand-new buyer's first Course purchase.

## `src/lib/progress/enrollment.ts` (extend existing, no signature changes)

No new exports — `enrollStudentInTierSequenceInternal` (006) is reused as-is by the webhook's `tier` branch, called with the purchased Tier's own `order` directly instead of a Course's `tier.order`.

## `src/lib/payments/purchases.ts` (extend existing)

`PurchaseSummary`/`listMyPurchases`/`listAllPurchases`/`refundPurchase` are updated for the renamed `product_id`/`product_type` columns (contracts/supabase-schema.md); `refundPurchase`'s existing Course-specific branch (standalone vs. sequential-locked rollback) gains a `product_type === 'tier'` branch that reuses the exact same Tier-rank-rollback logic already written for a sequential-locked Course refund (both ultimately roll back a `student_tier_progress` row the same way), and a `product_type === 'lesson'` branch that simply deletes/marks the one `purchases` row (no separate table to clean up, per data-model.md).

## `src/lib/payments/subscriptions.ts` (new)

```ts
async function getMySubscription(): Promise<SubscriptionSummary | null>       // student-facing (US6)
async function listAllSubscriptions(): Promise<StaffSubscriptionSummary[]>   // staff-facing (US7)
async function cancelSubscription(subscriptionId: string): Promise<void>     // staff-facing (US7)
```

- `cancelSubscription`: `requireStaffRole(['super_admin', 'staff'])`, calls `stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true })` — matches the buyer-facing self-service cancellation timing (spec Assumptions: takes effect at the end of the already-paid period, never a silent immediate cutoff or a surprise re-charge). Does not write `status` locally; the resulting `customer.subscription.updated` webhook is the single writer (contracts/supabase-schema.md).

## `src/app/api/webhooks/stripe/route.ts` (extend existing)

- `handleCheckoutCompleted` (006): branches on `event.data.object.mode` first. `mode === 'payment'` keeps 006's flow, generalized to `metadata.productType`/`metadata.productId` (three branches: `tier` calls `enrollStudentInTierSequenceInternal` directly with the Tier's own `order`; `course` is 006's existing branch unchanged; `lesson` inserts/updates the `purchases` row only — no separate enrollment call, since a succeeded `product_type: 'lesson'` row *is* the grant). `mode === 'subscription'` is new: resolves/creates the buyer the same way, then upserts a `subscriptions` row from the just-created Stripe Subscription object. **Bugfix (found via live testing):** the one-time branch (`handleOneTimeCheckoutCompleted`) now checks `session.payment_status === 'paid'` before granting anything and returns early otherwise — a delayed method (`us_bank_account`) fires this same event on submission with `payment_status: 'unpaid'`, and was previously granting access before the payment had actually cleared.
- `handleAsyncPaymentFailed` (006, unchanged): still fires for a one-time (`mode: 'payment'`) Checkout Session paid by a delayed method (`us_bank_account`) that later fails to clear.
- `checkout.session.async_payment_succeeded` (new) — fires when a delayed method's payment actually clears. Routed to the same `handleCheckoutCompleted` used by `checkout.session.completed`; the `payment_status` check above is what makes this safe to reuse rather than needing a separate handler.
- `handleSubscriptionEvent` (new) — `customer.subscription.created` / `.updated` / `.deleted`: upserts the `subscriptions` row keyed on `buyer_id` (see `data-model.md`'s `onConflict: 'buyer_id'` note — not `stripe_subscription_id`, which would collide with the one-row-per-buyer unique index on resubscription instead of updating in place), copying the event object's own `status`, `current_period_end`, and `cancel_at_period_end` verbatim (research.md #2 — never inferred locally). **Bugfix (found via live testing):** also passes `event.created` through to `upsertSubscriptionRow`, which now rejects any event older than the last one already applied for that buyer — Stripe doesn't guarantee delivery ordering, and a delayed/redelivered terminal event for a buyer's superseded previous subscription could otherwise clobber their current active one.
- `handleInvoiceEvent` (new) — `invoice.paid` / `invoice.payment_failed`: re-fetches the associated Subscription object from Stripe (`invoice.subscription`) and re-runs the same upsert `handleSubscriptionEvent` uses, so a renewal's outcome is always reflected via the Subscription's own authoritative status rather than inferred from the invoice event type alone.
- New Stripe webhook events to subscribe to (Stripe Dashboard configuration, not code): `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, and `checkout.session.async_payment_succeeded` — alongside the two already configured for 006 (`checkout.session.completed`, `checkout.session.async_payment_failed`).
