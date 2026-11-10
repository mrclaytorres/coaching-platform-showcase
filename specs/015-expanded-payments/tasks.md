# Tasks: Multi-Product Payments — Tiers, Lessons & Subscriptions

**Input**: Design documents from `/specs/015-expanded-payments/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: No automated test framework exists in this repo (consistent with every prior feature) — validation is manual via `quickstart.md`. No test tasks are generated.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md's US1–US7
- File paths are exact and repo-relative

---

## Phase 1: Setup

**Purpose**: Apply the schema changes every later phase reads/writes against.

- [x] T001 Apply the Supabase schema changes in `specs/015-expanded-payments/contracts/supabase-schema.md` / `data-model.md` via the Supabase SQL editor: rename `purchases.course_id` → `product_id`, add `purchases.product_type`, drop `NOT NULL` on `purchases.course_category_at_purchase`, add `purchases_product_type_idx`, and create the full `subscriptions` table with its indexes and RLS policies.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data-model and access-control primitives every user story depends on. **No user story work can begin until this phase is complete.**

- [x] T002 [P] Add `priceCents` (number, min 0) and `isForSale` (checkbox, default false) fields to `collections/Tiers.ts`, mirroring `collections/Courses.ts`'s existing fields.
- [x] T003 [P] Add `priceCents` and `isForSale` fields to `collections/Lessons.ts`, mirroring `collections/Courses.ts`.
- [x] T004 Create `globals/SubscriptionPlan.ts` per `contracts/payload-collections.md` (fields: `priceCents`, `billingInterval` select `month`/`year`, `isForSale`) and register it in the `globals` array of `payload.config.ts`.
- [x] T005 In `src/lib/payments/checkout.ts`, rename every `course_id`/`courseId` reference to `product_id`/`productId` in `createCheckoutSession`'s Payload lookup, the double-click-guard query, the `purchases` insert, and the Stripe metadata keys — behavior for the existing Course flow must be unchanged after this rename (regression check: 006's own quickstart Course-purchase scenario still passes).
- [x] T006 In `src/app/api/webhooks/stripe/route.ts`'s `handleCheckoutCompleted`, rename every `course_id`/`courseId` reference to `product_id`/`productId` in the idempotency lookup, the re-validation Payload fetch, and the `purchases` insert/update — depends on T005's metadata key rename.
- [x] T007 In `src/lib/payments/purchases.ts`, rename `course_id`/`courseId` to `product_id`/`productId` throughout `PurchaseSummary`, `toSummary`, `listMyPurchases`, `listAllPurchases`, and `refundPurchase`'s lookup query.
- [x] T008 [P] Add `hasActiveSubscription(studentId: string): Promise<boolean>` to `src/lib/progress/course-access.ts`, querying `subscriptions` for a row with `status IN ('active', 'past_due')`.
- [x] T009 In `src/lib/progress/course-access.ts`, add a `hasActiveSubscription` short-circuit as the first line of `isCourseAccessible` (returns `true` immediately if the buyer has one) — depends on T008.
- [x] T010 [P] Add `isLessonAccessible(studentId: string, lessonId: string): Promise<boolean>` to `src/lib/progress/course-access.ts`, querying `purchases` for a `succeeded` row with `product_type: 'lesson'` and `product_id: lessonId`.

**Checkpoint**: `npm run typecheck` passes; 006's existing Course-purchase flow still works end-to-end (T005–T007 were pure renames). Tiers/Lessons/Subscription-plan have their schema fields (T002–T004). Every access-control primitive later phases need exists (T008–T010).

---

## Phase 3: User Story 1 - Staff Configure Tiers, Lessons & the Subscription Plan for Sale (Priority: P1) 🎯 MVP prerequisite

**Goal**: Staff can price and publish a Tier, a Lesson, and the Subscription plan, independently of each other and of any Course.

**Independent Test**: As staff, set a price and turn on for-sale for a Tier, a Lesson, and the Subscription plan; confirm each becomes reachable, then take each off sale and confirm it stops accepting new buyers.

### Implementation for User Story 1

- [x] T011 [P] [US1] Add `setTierPricing(tierId, { priceCents, isForSale })` and `getTierForSale(tierId)` to `src/lib/courses/tier-actions.ts`, per `contracts/server-actions.md` (same staff-role gate and price-before-for-sale guard as `setCoursePricing`).
- [x] T012 [P] [US1] Add `setLessonPricing(lessonId, { priceCents, isForSale })` and `getLessonForSale(lessonId)` to `src/lib/courses/course-actions.ts`, per `contracts/server-actions.md` (`getLessonForSale` requires both `isPublished` and `isForSale`).
- [x] T013 [P] [US1] Create `src/lib/payments/subscription-plan.ts` with `setSubscriptionPlanPricing({ priceCents, billingInterval, isForSale })` and `getSubscriptionPlanForSale()`, reading/writing the `subscription-plan` Payload Global via `payload.updateGlobal`/`payload.findGlobal`.
- [x] T014 [US1] Add price/billing-interval/for-sale controls to the existing Tier edit UI in `src/app/staff/tiers/page.tsx`, wired to `setTierPricing` (T011).
- [x] T015 [US1] Add price/for-sale controls to `src/app/staff/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx` and its `EditLessonForm.tsx`, wired to `setLessonPricing` (T012).
- [x] T016 [US1] Create `src/app/staff/subscription-plan/page.tsx` — a single staff page with a form for price/billing interval/for-sale, wired to `setSubscriptionPlanPricing` (T013).
- [x] T017 [US1] Add a "Subscription Plan" nav item to `src/components/StaffSidebar.tsx` linking to `/staff/subscription-plan`, restricted the same way as other financial/account-adjacent items (`role !== 'coach'`).

**Checkpoint**: quickstart.md Scenario 1 step 1, Scenario 2 step 1, and Scenario 3 step 1 all pass.

---

## Phase 4: User Story 2 - Buyer Purchases a Tier Directly (Priority: P1) 🎯 MVP

**Goal**: A buyer can view a Tier's own sales page and buy entry into it directly, immediately advancing their Tier-sequence rank.

**Independent Test**: Open a Tier's sales page, complete a test purchase, confirm the buyer's Tier rank reaches that Tier immediately.

### Implementation for User Story 2

- [x] T018 [US2] Generalize `createCheckoutSession` in `src/lib/payments/checkout.ts` to accept `{ productType: 'tier' | 'course' | 'lesson', productId, buyerEmail? }`, branching product-loading/for-sale-validation per `contracts/server-actions.md` (Course branch's behavior must exactly match 006's current behavior; Tier branch validates only `isForSale && priceCents`, since Tiers have no draft/published status). Include the Tier branch's own checkout-time "already own" guard (current Tier rank ≥ this Tier's `order` → return the FR-011 error), the server-side equivalent of the sales page's display-only check in T022 — this must reject the request *before* a Stripe Checkout Session is created, not just hide the buy button in the UI. Also factor the existing buyer-resolution logic (signed-in profile lookup / brand-new-buyer email-uniqueness check) out into an unexported `resolveBuyer()` helper in this file, so `createSubscriptionCheckoutSession` (T029) can reuse it without duplicating it.
- [x] T019 [US2] In `createCheckoutSession`, add the "already has access via active Subscription" pre-check (calls `hasActiveSubscription`, T009) before any product-specific ownership check, returning the FR-011 error message.
- [x] T020 [US2] In `createCheckoutSession`'s Stripe Checkout Session creation, add `payment_method_types: ['card', 'paypal', 'us_bank_account']`.
- [x] T021 [US2] In `src/app/api/webhooks/stripe/route.ts`'s `handleCheckoutCompleted`, add the `productType === 'tier'` branch: **first re-validates the Tier is still `isForSale` at fulfillment time** (same "may have been taken off sale while the buyer was on Stripe's hosted page" re-check 006 already does for Course, auto-refunding via `refundPayment` and marking the row `error` if it's no longer for sale — FR-021), then calls `enrollStudentInTierSequenceInternal(buyerProfileId, tier.courseOwnerId, tier.order)` and writes the `purchases` row with `product_type: 'tier'`.
- [x] T022 [US2] Create `src/app/tiers/[tierId]/page.tsx` — public Tier sales page using `getTierForSale` (T011), showing name/description/price, an "already have access" state (Tier-rank check), and a checkout form posting to `createCheckoutSession({ productType: 'tier', productId: tierId })`.
- [x] T023 [US2] Update `getPurchaseBySessionId` in `checkout.ts` and `src/app/checkout/success/page.tsx` to resolve and display a Tier purchase's name/redirect generically alongside the existing Course case.

**Checkpoint**: quickstart.md Scenario 1 fully passes.

---

## Phase 5: User Story 3 - Buyer Purchases a Single Lesson (Priority: P1)

**Goal**: A buyer can buy access to one Lesson directly, independent of Course/Tier ownership.

**Independent Test**: As a buyer with no access to a Lesson's Course/Tier, buy that Lesson and confirm only it becomes viewable.

### Implementation for User Story 3

- [x] T024 [US3] In `createCheckoutSession`, add the `productType === 'lesson'` branch: loads the Lesson via Payload, validates `isPublished && isForSale && priceCents`, and checks "already own" via `isLessonAccessible` (T010).
- [x] T025 [US3] In `handleCheckoutCompleted`, add the `productType === 'lesson'` branch: **first re-validates the Lesson is still `isPublished && isForSale` at fulfillment time** (same re-check as the Tier/Course branches, auto-refunding and marking the row `error` if not — FR-021), then writes the `purchases` row with `product_type: 'lesson'` and **no** enrollment call — the succeeded row is itself the grant (data-model.md).
- [x] T026 [US3] Create `src/app/lessons/[lessonId]/page.tsx` — public Lesson sales/preview page using `getLessonForSale` (T012), showing title/parent-Course-name/price, an "already have access" state (`isLessonAccessible` OR `isCourseAccessible`), and a checkout form posting to `createCheckoutSession({ productType: 'lesson', productId: lessonId })`.
- [x] T027 [US3] In `src/app/customer/[id]/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx`, change the access gate from `isCourseAccessible(...)` alone to `isCourseAccessible(...) || isLessonAccessible(student.id, lesson.id)`, so a buyer who purchased only this Lesson can reach it directly even though the surrounding Course/module pages remain locked to them.

**Checkpoint**: quickstart.md Scenario 2 fully passes, including Acceptance Scenario 3 (a *different*, unpurchased Lesson in the same Course stays blocked).

---

## Phase 6: User Story 4 - Buyer Subscribes to the All-Access Plan (Priority: P1)

**Goal**: A buyer can subscribe to the one recurring plan and get all-access while it's active; lapsing reverts exactly to their own separately-earned/purchased access.

**Independent Test**: Subscribe with no other existing access, confirm every Tier/Course is viewable; cancel (or simulate a failed renewal past Stripe's retry schedule) and confirm access reverts to nothing.

### Implementation for User Story 4

- [x] T028 [US4] Create `src/lib/payments/subscriptions.ts` with `getMySubscription()`, `listAllSubscriptions()`, and `cancelSubscription(subscriptionId)` per `contracts/server-actions.md` (`cancelSubscription` calls `stripe.subscriptions.update(..., { cancel_at_period_end: true })` and does not write `status` locally).
- [x] T029 [US4] Add `createSubscriptionCheckoutSession({ buyerEmail? })` to `src/lib/payments/checkout.ts` — `mode: 'subscription'`, inline `price_data` with `recurring: { interval }` from the Subscription Plan global (T013), the "already subscribed" pre-check against `subscriptions`, reusing the `resolveBuyer()` helper T018 extracted (do not duplicate that logic here).
- [x] T030 [US4] In `handleCheckoutCompleted`, add a `session.mode === 'subscription'` branch: resolves/creates the buyer the same way as the one-time flow, then upserts a `subscriptions` row (**`onConflict: 'buyer_id'`, per data-model.md's note — never `stripe_subscription_id`**) from the newly-created Stripe Subscription object (status, `current_period_end`, `cancel_at_period_end`, `stripe_subscription_id`, `stripe_customer_id`).
- [x] T031 [US4] Add a `handleSubscriptionEvent` handler to `src/app/api/webhooks/stripe/route.ts` for `customer.subscription.created` / `.updated` / `.deleted`, upserting the `subscriptions` row (**`onConflict: 'buyer_id'`**, same reasoning as T030) with the event object's own `status`/`current_period_end`/`cancel_at_period_end` verbatim.
- [x] T032 [US4] Add a `handleInvoiceEvent` handler for `invoice.paid` / `invoice.payment_failed` that re-fetches the associated Subscription from Stripe and delegates to T031's upsert logic.
- [x] T033 [US4] Extend `getPurchaseBySessionId` in `checkout.ts` to also resolve a Subscription session (`stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })`) when no `purchases` row matches.
- [x] T034 [US4] Create `src/app/subscribe/page.tsx` — public Subscription signup page using `getSubscriptionPlanForSale` (T013) and `getMySubscription` (T028) for the "already subscribed" state, submitting to `createSubscriptionCheckoutSession`.
- [x] T035 [US4] Update `src/app/checkout/success/page.tsx` to render a Subscription-specific success state (uses T033's extended lookup).

**Checkpoint**: quickstart.md Scenario 3 fully passes, including the lapse-preserves-separately-owned-access check — this relies entirely on Phase 2's `hasActiveSubscription` short-circuit being a pure additive check (T009), so no further code is needed for that guarantee beyond Phase 2.

---

## Phase 7: User Story 5 - Buyer Pays With Their Preferred Method (Priority: P2)

**Goal**: Every checkout flow offers card/wallets, PayPal, and bank debit, with bank debit clearly shown as processing until it clears.

**Independent Test**: Complete one purchase by card, one by PayPal, one by bank debit; confirm the first two grant access immediately and the third shows "processing" until it clears.

### Implementation for User Story 5

- [x] T036 [US5] Update `src/app/checkout/success/page.tsx` to show a distinct "payment processing — access begins once your bank transfer clears (2–5 business days)" state when the underlying `purchases`/`subscriptions` row is still `pending` and the payment method was bank debit (vs. the brief pre-webhook polling state for instant methods).
- [x] T037 [US5] Verify `handleAsyncPaymentFailed` in the webhook route needs no Course-specific changes (it already updates by `stripe_checkout_session_id` alone) — confirm it correctly marks a Tier/Lesson `pending` purchase `declined` the same way it already does for Course, and add a matching `invoice.payment_failed`-driven path for a Subscription's first payment failing to clear (covered by T032; add a test note here, not new code, if T032 already handles it).
- [x] T038 [US5] Add `payment_method_types` to `createSubscriptionCheckoutSession` (T029) per `research.md` #4 — attempt `['card', 'paypal', 'us_bank_account']` against the live Stripe test account; if Stripe rejects PayPal for `mode: 'subscription'`, fall back to `['card', 'us_bank_account']` for this flow only and note the fallback in a code comment referencing research.md #4.

**Checkpoint**: quickstart.md Scenario 4 fully passes.

---

## Phase 8: User Story 6 - Student Reviews All Purchases & Subscription Status in One Place (Priority: P2)

**Goal**: A student's purchase history shows every product type plus current Subscription status, uniformly.

**Independent Test**: As a student with a Tier purchase, a Lesson purchase, and an active Subscription, open purchase history and confirm all three appear correctly labeled.

### Implementation for User Story 6

- [x] T039 [US6] Update `PurchaseSummary`/`listMyPurchases` in `src/lib/payments/purchases.ts` to include `productType` and resolve the correct title per row (Tier name / Course title / Lesson title, via the appropriate Payload collection lookup per `product_type`).
- [x] T040 [US6] Update `src/app/customer/[id]/purchases/page.tsx` to render each row's product-type label and add a Subscription status block (active/past-due/canceled, next renewal or lapse date) using `getMySubscription` (T028).

**Checkpoint**: quickstart.md Scenario 5's student-facing half passes.

---

## Phase 9: User Story 7 - Staff Review All Sales & Handle Refunds/Cancellations (Priority: P3)

**Goal**: Staff can see every purchase and Subscription across all product types and revoke access via refund or cancellation.

**Independent Test**: Refund a Tier purchase and cancel a Subscription from the staff sales list; confirm each buyer's corresponding access is revoked appropriately.

### Implementation for User Story 7

- [x] T041 [US7] Update `StaffPurchaseSummary`/`listAllPurchases` in `purchases.ts` to include `productType` and resolved product title across all three one-time types (reuses T039's title-resolution logic).
- [x] T042 [US7] Add `product_type === 'tier'` and `product_type === 'lesson'` branches to `refundPurchase` in `purchases.ts`: the Tier branch reuses the exact Tier-rank-rollback logic already written for a sequential-locked Course refund (both roll back the same `student_tier_progress` row); the Lesson branch simply updates that one `purchases` row to `refunded` (no separate table to clean up).
- [x] T043 [US7] Update `src/app/staff/purchases/page.tsx` to show a product-type column across the purchases list (uses T041).
- [x] T044 [US7] Add a Subscriptions section to `src/app/staff/purchases/page.tsx` using `listAllSubscriptions` (T028), with a cancel action wired to `cancelSubscription`.

**Checkpoint**: quickstart.md Scenario 5's staff-facing half passes — all seven user stories are now independently verifiable end-to-end.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T045 [P] Run `npm run typecheck` and resolve any type errors introduced across all phases.
- [x] T046 [P] Run `npm run build` to confirm a production build succeeds with the new routes (`/tiers/[tierId]`, `/lessons/[lessonId]`, `/subscribe`, `/staff/subscription-plan`) and the new Payload Global.
- [ ] T047 Run every scenario in `quickstart.md` end-to-end against Stripe test mode, including the regression check (006's original Course-purchase scenario still passes unmodified).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — apply the SQL first, before any code in later phases can run against it.
- **Foundational (Phase 2)**: Depends on Phase 1. **Blocks every user story.**
- **User Stories (Phase 3–9)**: All depend on Phase 2. Story dependency notes:
  - **US1 (Phase 3)** has no dependency on other stories, but US2/US3/US4's sales pages each call a `getXForSale` function US1 introduces (T011/T012/T013) — so while US1 is independently testable on its own, US2/US3/US4 are easiest to implement *after* US1 lands, even though they don't strictly require its staff UI (T014–T017), only its query/action functions.
  - **US2 (Phase 4)**, **US3 (Phase 5)**, **US4 (Phase 6)** each generalize/extend the *same* shared files (`checkout.ts`, the webhook route, `purchases.ts`) — they are independently testable once implemented, but should be implemented sequentially in priority order (not in parallel by different people) to avoid merge conflicts within those shared files.
  - **US5 (Phase 7)** depends on US2/US4 already having added `payment_method_types` plumbing (T020, T029) — it completes/verifies that work rather than starting it from scratch.
  - **US6 (Phase 8)** and **US7 (Phase 9)** both depend on US2/US3/US4 having populated real `product_type` variety to display/manage, and on US4's `subscriptions.ts` (T028).
- **Polish (Phase 10)**: Depends on every phase intended for this release being complete.

### Parallel Opportunities

- T002, T003 (Payload field additions) in parallel.
- T008, T010 (new access-control functions) in parallel; T009 depends on T008.
- T011, T012, T013 (US1's three staff action modules) in parallel.
- T045, T046 (Polish) in parallel.
- Within Phases 4–6, the "generalize shared file" tasks (T018/T024/T029 etc.) are **not** parallel with each other (same files) even though they carry different Story labels — treat Phases 4→5→6 as sequential despite all being P1.

## Implementation Strategy

### MVP Scope

Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) is the smallest fully-demonstrable increment: staff can price a Tier and a buyer can purchase it end-to-end. Phases 5–6 (Lesson, Subscription) are equally P1 in the spec but structurally independent additions on top of that same foundation — deliver in the order US1 → US2 → US3 → US4 → US5 → US6 → US7 to keep each checkpoint's regression surface small, given Phases 4–6 share files sequentially rather than in parallel (see Parallel Opportunities above).
