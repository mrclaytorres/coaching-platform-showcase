# Phase 0 Research: Course Sales Pages & Direct Payment Enrollment

## 1. Payment processor and checkout UX

**Decision**: Stripe, using **Stripe Checkout** (Stripe-hosted payment page, created per-purchase via a Stripe Checkout Session) rather than a fully embedded card form (Stripe Elements/PaymentIntents).

**Rationale**: Stripe Checkout keeps the Academy server out of raw card-data handling entirely (PCI SAQ-A, the lightest compliance tier), ships a proven, accessible payment UI for free, and natively supports the "declined payment → clear error → retry" flow (FR-008) and future payment plans/subscriptions without a redesign. The buyer starts on a Academy sales page and is returned to a Academy success/cancel page — they are never sent to CourseHost or any competing storefront, which is FR-005's actual intent. Stripe's webhook system (`checkout.session.completed`) gives an idempotent, retried-on-failure reconciliation point, which is the cleanest way to satisfy FR-014 (payment succeeds but enrollment write fails).

**Alternatives considered**:
- *Stripe Elements/PaymentIntents embedded directly in a Academy-hosted form*: keeps 100% of the UI in Academy's own chrome with no redirect at all, more literally matching FR-005's wording. Rejected for v1 — meaningfully more frontend work (building and validating a card form) and raises PCI compliance scope (SAQ A-EP) for no functional gain over Checkout at this stage. Can replace Checkout later without touching the data model (`purchases` table is processor-agnostic).
- *A different processor (PayPal, Paddle, Lemon Squeezy)*: rejected — Stripe is the de facto standard for this shape of product, has the best Next.js/webhook documentation, and nothing in the spec calls for a merchant-of-record model (Paddle/Lemon Squeezy) that would offload sales tax — which is explicitly out of scope (spec.md Assumptions).

## 2. Reconciling "payment succeeded but enrollment failed" (FR-014)

**Decision**: The Stripe webhook handler (`checkout.session.completed`) is the single source of truth that finalizes a `Purchase` (`status: 'succeeded'`) and performs enrollment. The synchronous browser redirect back to `/checkout/success` only reads the `Purchase` row already written (or being written) by the webhook — it never itself performs the enrollment write. If the webhook's enrollment step throws, Stripe automatically retries webhook delivery (up to ~3 days, exponential backoff) against the same idempotency key (the Stripe event id), so the handler is written to be safely re-runnable: it re-checks "is this buyer already enrolled in this course" before writing, exactly like the existing `enrollStudentInCourse`'s `upsert(..., ignoreDuplicates: true)` pattern.

**Rationale**: Making the webhook (not the user's browser redirect) authoritative means a buyer closing their browser tab immediately after paying still gets enrolled — the browser is never in the critical path. Reusing Stripe's own retry mechanism avoids building a custom job queue for a single-step reconciliation.

**Alternatives considered**: A background cron/reconciliation job that periodically scans for `succeeded`-payment/`no`-enrollment mismatches — rejected as unnecessary; Stripe's built-in webhook retry already provides this, and this repo has no existing job-scheduling infrastructure to hang a cron task off of.

## 3. Identity for a brand-new buyer with no Core `customer_id`

**Decision**: Add `customer_profiles.account_origin` (`'core-linked' | 'native'`, default `'core-linked'` — existing rows are unaffected). A brand-new buyer is assigned a `core_customer_id` from a new dedicated Postgres sequence that produces **negative** integers (`-nextval('native_customer_id_seq')`), guaranteeing no collision with Core's positive-integer `customer_id` space without needing to know or coordinate with Core's actual id range. `core_customer_id` stays `NOT NULL` and the column's type/shape is unchanged — every existing route, dashboard, and admin list that keys off `core_customer_id` (e.g. `/customer/[id]`) continues to work unmodified for the *routing* concern; the only new code is a guard around the one place that assumes every `core_customer_id` is a valid Core `customer_id`: the dashboard's `fetchSnapshot()` call.

**Rationale**: Making `core_customer_id` nullable and auditing every consumer for null-safety would be a much larger, riskier change than minting a disjoint id range. This mirrors the precedent already set by `005-customer-data-integration`'s synthetic `dev+customer-<id>@example.invalid` emails — reserve a slice of an existing identifier space rather than restructuring the schema.

**Consequence for the dashboard**: `src/app/customer/[id]/page.tsx` MUST check `account_origin` before calling `fetchSnapshot()`. For a `native` account, it skips the Core API call entirely and renders the Credits/Sessions/Activity sections in their existing empty states (these sections already handle zero-data per FR-010 of `004-course-lesson-management`/existing dashboard code) rather than attempting to fetch a Core snapshot for an id Core has never heard of.

**Alternatives considered**:
- *Nullable `core_customer_id` + refactor every consumer*: rejected as disproportionate — most consumers (routes, admin lists) don't actually need to distinguish origin, only the Core-fetching code path does.
- *Provision a real Core `customer_id` for native buyers via some write API*: not possible — Core's API is a single read-only endpoint (`POST /pull_portal_snapshot/`), confirmed in `docs/onboarding.md`; there is no create/write path into Core's system from Academy.

## 4. Granting access on purchase — reusing vs. bypassing the existing staff-gated enrollment functions

**Decision**: `enrollStudentInCourse` and `enrollStudentInTierSequence` (`src/lib/progress/enrollment.ts`, built in `004-course-lesson-management` explicitly as "the in-app stand-in for 'the purchase happened'") are each split into a `requireStaffRole`-gated public wrapper (unchanged, still used by any manual staff-side "grant access" affordance) and an internal, unexported `*Internal` function containing the actual write logic. The Stripe webhook handler calls the internal functions directly — it is a trusted server-to-server context authenticated by Stripe's webhook signature, not a Supabase-authenticated staff user, so `requireStaffRole` does not apply and must not be bypassed with a fake staff session.

**Rationale**: This is the smallest change that lets a real purchase now trigger the exact same enrollment logic the manual staff stand-in always used, preserving 004's data model and access-check code (`isCourseAccessible`) completely unchanged.

**Alternatives considered**: Duplicating the enrollment-write logic inside the webhook handler — rejected, would create two divergent copies of "how a student gets access to a Standalone Course" / "how Tier rank advances."

## 5. Taking a course off sale mid-checkout (FR-013)

**Decision**: The Stripe Checkout Session is created with the course's `priceCents` captured **at session-creation time**, and the webhook handler re-validates `isForSale` on the course **at fulfillment time** (when `checkout.session.completed` arrives), not just at session-creation time. If the course was taken off sale in between, the handler marks the `Purchase` `status: 'error'` (instead of `'succeeded'`), does **not** enroll the buyer, and triggers an automatic Stripe refund via the API for the just-completed charge, since the buyer already paid before the race was caught.

**Rationale**: Stripe Checkout Sessions can be created seconds before a slow buyer actually pays; re-validating at the point access would actually be granted is the only reliable way to prevent "took off sale mid-checkout" (edge case in spec.md) from silently granting access to a since-unpublished course. Auto-refunding (rather than leaving a charged-but-unenrolled buyer, which FR-014 forbids) reuses the same "never charged without access, or refunded" guarantee FR-014 already requires for the ordinary transient-failure case.

**Alternatives considered**: Blocking checkout-session *creation* only (checking `isForSale` once, up front) — rejected alone, since it does not close the race where staff take the course off sale during the buyer's time on Stripe's hosted page.

## 6. Refunding a Sequential-Locked (Tier) course purchase

**Decision**: Refunding a Purchase for a Sequential-Locked course rolls the buyer's `current_tier_rank` back to one rank below the refunded course's Tier **only if** their rank has not since advanced further (i.e., only if `current_tier_rank` still equals the rank the purchase granted). If the student has since passed a real assessment and progressed further, the refund is processed as a financial-only refund (Purchase marked `refunded`, payment reversed via Stripe) and Tier rank is left untouched, with a flag on the Purchase for staff to review manually.

**Rationale**: A student's Tier rank is also earned through assessment progression (`004-course-lesson-management`), not solely purchases; blindly rolling rank back on any refund risks undoing real, unrelated progress. This defensive check keeps the common case (immediate refund, no progress since) simple while never silently erasing earned progress.

**Alternatives considered**: Never revoking Tier rank on refund (financial-only refunds always) — rejected, since SC-with-refund expectations (spec.md US4 Acceptance Scenario 3: "denied access, consistent with never having purchased it") require access revocation to actually happen in the common case.

## 7. Sales page routing

**Decision**: Public sales pages live at `/courses/[slug]`, reusing the `slug` field that already exists (unique) on the Payload `Courses` collection from `004-course-lesson-management`. This route is **not** under `src/middleware.ts`'s protected matcher (`/customer/:path*`, `/admin/:path*`, `/staff/:path*`), so it's reachable while logged out, as required for a public sales page.

**Rationale**: Reuses an existing unique, human-readable identifier instead of introducing a second slug/id scheme for sales pages.

**Alternatives considered**: `/store/[slug]` or `/buy/[slug]` as a distinct namespace — rejected as an unnecessary extra segment; `/courses/[slug]` reads naturally as "the course's page" whether or not the viewer owns it yet.
