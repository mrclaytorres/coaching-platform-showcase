# Phase 0 Research: Multi-Product Payments

**Branch**: `015-expanded-payments` | **Date**: 2026-09-01

## #1 — Generalizing `purchases` to a product-type discriminator, rather than parallel tables

**Decision**: Extend the existing `purchases` table (006-course-sales-payments) with a `product_type` column (`'tier' | 'course' | 'lesson'`) and rename its `course_id` column to `product_id`, rather than adding `tier_purchases`/`lesson_purchases` tables alongside it.

**Rationale**: A one-time purchase's lifecycle (pending → succeeded/declined/refunded, Stripe Checkout Session as idempotency anchor, staff refund flow) is identical across all three one-time product types — only what the successful row *grants* differs (Tier-rank advance vs. Course enrollment vs. a standalone Lesson-access row). One table with a discriminator keeps `listMyPurchases`/`listAllPurchases`/`refundPurchase` and the webhook's idempotency check as single implementations instead of three near-duplicates. `course_category_at_purchase` (sequential-locked/standalone) remains meaningful only when `product_type = 'course'` and becomes nullable.

**Alternatives considered**: Separate `tier_purchases`/`lesson_purchases` tables — rejected because it triples the staff sales-list query (three unions) and the refund logic for no real benefit; the existing table has no FK on `course_id` today (plain-text cross-system reference, per 006's schema notes), so widening it to any product id is a compatible, low-risk change at this pre-production stage (006 is not yet merged/deployed).

## #2 — Subscription is a separate table, not a `purchases` row

**Decision**: A new `subscriptions` table (one row per buyer, upserted from Stripe subscription-lifecycle webhooks), not another `product_type` value on `purchases`.

**Rationale**: A Subscription isn't a single completed transaction — it has its own recurring lifecycle (`active` / `past_due` / `canceled`/`unpaid`) that Stripe itself tracks and pushes via `customer.subscription.*` and `invoice.*` events, distinct from the one-shot `checkout.session.completed` model `purchases` is built around. Mirroring Stripe's own subscription object as its own row is simpler than contorting the `pending → succeeded → refunded` status machine to fit a recurring product.

**Alternatives considered**: Modeling each renewal as its own `purchases` row (`product_type: 'subscription'`) — rejected; it would need a new row inserted by a webhook on every single renewal indefinitely, when all any access check actually needs is "is there currently an active-or-past-due row for this buyer" — a single upserted row answers that in one lookup.

**Implementation note**: every upsert into `subscriptions` must use `onConflict: 'buyer_id'`, not `'stripe_subscription_id'` — a re-subscribing buyer gets a new Stripe Subscription id, which would otherwise collide with the table's one-row-per-buyer unique index instead of updating the old row (see data-model.md). Separately, the exact field path for "which subscription does this invoice belong to" (`invoice.subscription` vs. a nested `invoice.parent.subscription_details.subscription` shape) depends on the pinned `stripe` SDK's API version — verify against the installed `stripe@22.3.2` type definitions when implementing `handleInvoiceEvent`, don't assume the flat field.

## #3 — Access-control integration point

**Decision**: `isCourseAccessible()` (the sole existing gate, called from every Course/lesson/tier-progress route today) gets one added short-circuit at its top: if the buyer has an active-or-past-due Subscription, return `true` immediately, before evaluating Tier rank or Course enrollment. A new sibling function `isLessonAccessible(studentId, lessonId)` checks a succeeded `purchases` row with `product_type: 'lesson'`; the one route that renders a single Lesson's own content (`.../lessons/[lessonId]/page.tsx`) is the only call site that needs to additionally check it (`isCourseAccessible(...) || isLessonAccessible(...)`) — every other Course/Tier/module-listing page's gate is intentionally left untouched, since a Lesson purchase must not unlock anything beyond that one Lesson (spec's User Story 3, Acceptance Scenario 3).

**Rationale**: Funneling the Subscription check through `isCourseAccessible()` means every one of its ~8 existing call sites (dashboard peeks, course/module pages, lesson-completions, submissions) gets all-access-while-subscribed for free, with a single added query, instead of needing to be individually updated.

**Alternatives considered**: A new top-level `hasAccess()` wrapper called everywhere instead of modifying `isCourseAccessible()` — rejected; it would require touching all 8 existing call sites for no behavioral difference, just to avoid adding one early-return to a function whose entire purpose is already "does this student have access."

## #4 — Payment methods via `payment_method_types`, not `automatic_payment_methods`

**Decision**: Every Checkout Session (Tier/Course/Lesson one-time, and the Subscription) explicitly sets `payment_method_types: ['card', 'paypal', 'us_bank_account']`. Apple Pay and Google Pay are not separate entries — they surface automatically as wallet buttons wherever `'card'` is offered, on a supporting device/browser, once enabled in the Stripe Dashboard's payment method settings.

**Rationale**: An explicit list is simplest to reason about and matches the four methods actually decided on, rather than `automatic_payment_methods: { enabled: true }`, which would let Stripe silently surface any method enabled in the Dashboard (including ones never decided on here, e.g. Klarna/Afterpay) without a corresponding code-level decision to match.

**Risk flagged for implementation**: PayPal's availability as a **recurring** (subscription-mode) payment method on Stripe has historically been narrower than its one-time-payment support and depends on the connected Stripe account's country/configuration. If `payment_method_types: ['card', 'paypal', 'us_bank_account']` is rejected by Stripe for a `mode: 'subscription'` Checkout Session at implementation time, the fallback is `['card', 'us_bank_account']` for the Subscription flow specifically, keeping all four for the three one-time flows. This must be verified against the live Stripe account during implementation, not assumed here.

## #5 — Bank debit ("processing") settlement, generalized from 006

**Decision**: Reuse 006's existing `pending` → `succeeded`/`declined` status flow and its `checkout.session.async_payment_failed` webhook handler unmodified for one-time Tier/Course/Lesson purchases paid by `us_bank_account` — that handler already exists precisely because ACH-style delayed payment methods were anticipated as a "if a payment method other than card is added later" concern in 006's own design. For the Subscription's first payment and renewals paid by bank debit, the equivalent signal is `invoice.payment_failed` / `invoice.paid` against the Subscription's own status (research #2's `subscriptions` row), not a Checkout Session event.

**Rationale**: No new state machine is needed for one-time purchases — `pending` already reads as "processing" to the buyer (checkout/success page's existing polling-until-webhook-lands UX), and `declined` already reads as "did not succeed." Only the copy shown while `pending` needs to acknowledge the multi-day case explicitly (research covers behavior, not wording — left to implementation/UI).

## #6 — Stripe Subscription pricing stays inline (`price_data`), no pre-created Stripe Price object

**Decision**: The Subscription Checkout Session is created with `mode: 'subscription'` and an inline `line_items[].price_data` (currency, `unit_amount`, `recurring: { interval }`), the same `price_data`-inline pattern 006 already uses for one-time Course prices — not a persistently-stored Stripe Price ID.

**Rationale**: Stripe Checkout supports inline `price_data` for subscription-mode Sessions exactly as it does for payment-mode ones. This means the Subscription plan's price/interval can live as plain fields on a Payload Global (see data-model.md) with no separate Stripe-side object to keep in sync when staff change the price — consistent with how Course/Tier/Lesson pricing already works, and avoiding a second source of truth (a stored Stripe Price ID that could drift from the Payload-side price).

**Alternatives considered**: Pre-creating and archiving a Stripe Price object on every staff price change — rejected as unnecessary indirection with no benefit here (no promotional/multi-tier pricing requiring persistent Price IDs elsewhere in this feature).

## #7 — The Subscription Plan is a Payload Global, not a collection

**Decision**: A new Payload **Global** (singleton config, not a list of documents) named `subscription-plan`, holding `priceCents`, `billingInterval` (`month`/`year`), and `isForSale`.

**Rationale**: The spec is explicit that there is exactly one platform-wide Subscription product (Assumptions: "single, platform-wide plan at one price/interval for this version"). Payload Globals are the built-in construct for exactly this shape (one configuration object, not a repeatable collection), avoiding a `subscription-plans` collection that would need application-code enforcement of "there must be exactly one row."
