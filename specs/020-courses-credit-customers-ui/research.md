# Phase 0 Research: Courses, Credit Watch & Customers UI Redesign

**Branch**: `020-courses-credit-customers-ui` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

No `[NEEDS CLARIFICATION]` markers were left in spec.md. This resolves the remaining technical
unknowns needed before design — almost all of them concentrated in the Credit Watch page
(Story 3), the one genuinely new aggregation in this feature.

## #1 — Courses: Price and status-toggle both already exist, just not surfaced here

**Decision**: Add two columns to the existing `listCourses()`-backed table — `priceCents`/
`isForSale` (already on `CourseSummary`, `src/lib/courses/course-queries.ts`) and an Edit/
Publish-Unpublish action pair backed by the existing `updateCourse(id, { status })` (`src/lib/
courses/course-actions.ts`). No new query, no new mutation.

**Rationale**: Both fields/actions are already fully built for the per-course edit page; this
page simply never exposed them at the list level.

## #2 — New Course: pure restyle

**Decision**: No lib changes — `NewCourseForm`/`createCourseAction` stay exactly as they are;
only the page's JSX/layout changes (breadcrumb, card wrapper).

**Rationale**: Confirmed by reading the full current implementation — every mockup field already
exists with the exact same shape (Title/Slug/Category/Tier → Create Course).

## #3 — Credit Watch: Negative Balance & Low Balance extend the existing fallback sweep

**Decision**: A new function, `getCreditWatchAlerts()`, extends `fetchCreditWatchFallback`'s
existing per-known-student `fetchSnapshot` sweep (`src/lib/credit-watch/fallback.ts`) with a
second bucket — `0 ≤ balance ≤ 1` (Low Balance) alongside the existing `balance < 0` (Negative
Balance) — and also captures each student's most recent `snapshot.activity[0].occurred_at` as
"last activity" (not previously surfaced by the Credit Watch page).

**Rationale**: The real `/pull_credit_watch/` Core endpoint doesn't exist yet (`src/lib/types.ts`'s
own header comment: "This Core endpoint does not exist yet") — every real Credit Watch page
load today already falls through to this fallback sweep, which already fetches each known
student's *full* wallet (`snapshot.credits: SnapshotWallet[]`), not just negative balances. Low
Balance is additive bucketing over data this sweep already pulls, not a new data source.

**Alternatives considered**: Calling the primary `fetchCreditWatch` Core endpoint and adding a
`low_balances` field to its contract — rejected; that endpoint doesn't exist, so there's nothing
to extend, and its eventual contract (`contracts/core-credit-watch-api.md`, spec 008) is owned
by a system this codebase doesn't control.

## #4 — Credit Watch: Failed Payments reuses existing Purchases data

**Decision**: `getCreditWatchAlerts()` also calls the existing `listAllPurchases({ status:
'declined' })` (`src/lib/payments/purchases.ts`) and maps each row into the same alert shape.

**Rationale**: `declined` is a real, already-tracked `PurchaseStatus` — the closest and only
real "failed payment" concept in this codebase (spec.md Assumptions).

## #5 — Credit Watch: Cards Expiring is explicitly not built

**Decision**: A constant empty array — no query, no Stripe call.

**Rationale**: Checking card expiry means calling Stripe's Payment Methods API per customer, a
genuinely new integration no part of this codebase does today (confirmed: no reference to
`stripe.paymentMethods` or `customers.listPaymentMethods` anywhere in `src/lib/payments/`).
Building it silently as part of a UI redesign would be real, unrequested new scope — spec.md's
Assumptions explicitly descope it, mirroring specs/018's "Book Coaching" treatment.

## #6 — Credit Watch: row actions link out, they don't perform new mutations

**Decision**: "Add Credit" links to `/staff/credit-watch/{coreCustomerId}` (the existing
per-student detail page, which already has a working `createCreditAdjustment` form). "Retry
Charge" links to `/staff/purchases` (the existing page, which already has `refundPurchase` for
succeeded purchases — no retry action exists or is added).

**Rationale**: Reuses real, already-built forms instead of duplicating adjustment logic inline;
avoids fabricating a Stripe retry capability that doesn't exist (spec.md Assumptions).

## #7 — Customers: "Recent Lookups" substitutes the closest real data

**Decision**: A new, small function reusing the existing `listCustomerProfiles()` (`src/lib/auth/
customer-profile.ts`), sorted most-recently-created first, capped to a handful of rows — no new
table.

**Rationale**: No per-staff-member lookup-history tracking exists anywhere in this codebase;
building one means a new audit table and a new write path on every lookup — real new scope for
what's meant to be a UI redesign. Mirrors specs/018's Recent Activity panel resolution (substitute
the closest honest real data rather than inventing a new entity).
