# Quickstart: Validating Multi-Product Payments

**Branch**: `015-expanded-payments` | **Date**: 2026-09-01

Manual validation guide (no automated test framework in this repo — same precedent as every prior feature). Uses Stripe **test mode** throughout.

## Prerequisites

- Stripe test-mode keys already configured (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) from 006's setup.
- In the Stripe Dashboard (test mode) → **Settings → Payment methods**: enable **PayPal** and **US bank account (ACH direct debit)**. Card, Apple Pay, and Google Pay are already available by default.
- Webhook endpoint (`stripe listen --forward-to localhost:3040/api/webhooks/stripe` in dev, or the deployed endpoint) must be subscribed to the six new event types listed at the end of `contracts/server-actions.md`, alongside the two already configured for 006.
- At least one Tier, one published Course with a published Lesson in it, and staff/super_admin access to price and publish all three plus the Subscription plan.

## Scenario 1 — Tier purchase (US2)

1. As staff: `/staff/tiers` → set a price on a Tier, mark it for sale.
2. Visit `/tiers/[tierId]` logged out → see name/description/price.
3. Complete checkout with Stripe's test card `4242 4242 4242 4242`.
4. Confirm: redirected to `/checkout/success`, then land with Tier-sequence rank at that Tier — every Course in it and below is now unlocked.
5. Revisit `/tiers/[tierId]` → see "already have access," not offered to buy again.

## Scenario 2 — Lesson purchase (US3)

1. As staff: on a Lesson's edit page, set a price and mark it for sale (leave its parent Course NOT for sale).
2. As a buyer with no access to that Lesson's Course/Tier: visit `/lessons/[lessonId]`, complete checkout.
3. Confirm: that one Lesson's content is now viewable directly.
4. Confirm: a *different*, unpurchased Lesson in the same Course is still blocked.

## Scenario 3 — Subscription signup, all-access, and lapse (US4)

1. As staff: `/staff/subscription-plan` → set a monthly price, turn on for sale.
2. As a buyer with zero existing access anywhere: visit `/subscribe`, complete checkout.
3. Confirm: every Tier and every Course is now viewable.
4. As staff: `/staff/purchases` (Subscriptions tab) → cancel the Subscription.
5. Confirm the buyer is told when access actually ends (period end, not immediate) — for a fast test, use Stripe's dashboard/CLI to advance the test clock past `current_period_end`, or directly trigger a `customer.subscription.deleted` test webhook event.
6. Confirm: after the Subscription is actually canceled, the buyer's access reverts to nothing (since none was separately owned) — repeat with a Subscriber who *also* separately owns one Course, and confirm that Course stays accessible after cancellation while everything else locks again.

## Scenario 4 — Payment methods (US5)

1. Complete one Tier/Course/Lesson purchase using PayPal's test flow.
2. Complete one using the test bank account routing/account numbers Stripe's docs provide for `us_bank_account`.
3. Confirm the bank-debit purchase shows a "processing" state immediately after submission, not immediate success.
4. Use the Stripe CLI/dashboard to simulate that ACH payment clearing (`payment_intent.succeeded` after the delay) → confirm access is granted automatically with no further buyer action.
5. Repeat with a simulated ACH failure → confirm no access is left granted and the buyer sees a clear message.

## Scenario 5 — Staff sales list & student purchase history (US6, US7)

1. As staff: `/staff/purchases` → confirm the Tier, Lesson purchases, and the Subscription from Scenarios 1–3 all appear, correctly labeled by type.
2. Refund the Lesson purchase → confirm the buyer's access to that Lesson is revoked, with no effect on their Tier/Subscription access.
3. As the student: `/customer/[id]/purchases` → confirm all product types and the Subscription's current status are visible in one list.

## Regression check (carried over from 006)

- Re-run 006's own quickstart Course-purchase scenario unmodified — confirms `product_id`/`product_type` renaming (data-model.md) didn't break the existing Course flow, and that an active Subscriber correctly sees "already have access" on a Course sales page they haven't individually purchased.
