# Implementation Plan: Multi-Product Payments — Tiers, Lessons & Subscriptions

**Branch**: `015-expanded-payments` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-expanded-payments/spec.md`

## Summary

Extends 006-course-sales-payments' Stripe-backed, Course-only purchase flow into four sellable product types — Tier, Course (unchanged), Lesson, and a single all-access Subscription — by widening the existing `purchases` table with a product-type discriminator, adding a new `subscriptions` table for the recurring product, and adding one short-circuit (`hasActiveSubscription`) plus one new sibling check (`isLessonAccessible`) to the single existing access-control function every Course/lesson route already calls. Checkout is expanded from card-only to card+wallets, PayPal, and bank debit across every flow. Staff get price/publish controls for Tiers and Lessons (mirroring the existing Course pricing UI) and a new single-page control for the Subscription plan; the existing staff sales list and student purchase-history view are generalized to show all four product types uniformly.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`) — unchanged from 006

**Primary Dependencies**: `stripe` (existing, 006) — adds Subscription API usage (`stripe.subscriptions.update` for cancellation, `checkout.sessions.create({ mode: 'subscription' })`, `invoice.*`/`customer.subscription.*` webhook event types) alongside the existing Checkout/Refund/webhook-verification usage; `@payloadcms/next`/`payload` (Tiers/Lessons collection extension + one new Payload Global); `@supabase/supabase-js` (widened `purchases` table, new `subscriptions` table)

**Storage**: Supabase Postgres — `purchases.course_id` renamed to `product_id` + new `product_type` column; new `subscriptions` table. Payload `Tiers`/`Lessons` collections gain `priceCents`/`isForSale`; new Payload Global `subscription-plan`

**Testing**: No automated test framework (consistent with every prior feature); validation is manual via `quickstart.md`, Stripe test-mode keys, and Stripe's published test card/bank-account numbers

**Target Platform**: Node 22 server running the existing Next.js app; `/api/webhooks/stripe` (existing route, 006) now also subscribes to five additional Stripe event types, still the only public/unauthenticated route in this codebase

**Project Type**: Web application — single existing Next.js app, no new services or external dependencies beyond what 006 already introduced (Stripe)

**Performance Goals**: N/A — matches existing app's low-volume, single-tenant scale

**Constraints**:
- A Lesson purchase must unlock only that Lesson — every other Course/Tier/module-listing gate must be provably unaffected (spec User Story 3, Acceptance Scenario 3; research.md #3)
- A Subscription must be a pure additive access override — its lapse must never revoke anything a buyer separately purchased or earned through Tier-rank progression (FR-010, verified by SC-006)
- `purchases`' existing idempotency contract (`stripe_checkout_session_id UNIQUE`, webhook-as-source-of-truth) must be preserved unchanged while widening the table (FR-022, inherited from 006's FR-014)
- The existing Core-sourced credit/session-booking system MUST NOT be read, written, or otherwise touched by any code in this feature (FR-023, inherited from 006's FR-015)

**Scale/Scope**: Single-tenant (`courseOwnerId = 'academy'`), USD-only, one Subscription plan platform-wide, small catalog — matches 006 and the rest of this codebase's current scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project (consistent with every prior feature's plan). No gates to evaluate. Proceeding under the project's established conventions: server-action-gated staff writes via `requireStaffRole` (003), service-role-only Supabase writes with RLS as defense-in-depth (002 onward), Payload as the authored-content store with real authorization enforced in the Next.js layer, not Payload's own access functions (004 research.md #3), and Stripe-as-webhook-source-of-truth for payment state (006 research.md #2).

**Post-design re-check**: No new external dependency or new public route is introduced beyond what 006 already added (Stripe SDK, `/api/webhooks/stripe`) — this feature only widens their existing usage (more event types, a second Checkout mode) and extends the existing data model. No new architectural departures. See Complexity Tracking for the one schema change (a column rename) that touches already-written 006 code.

## Project Structure

### Documentation (this feature)

```text
specs/015-expanded-payments/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── supabase-schema.md      # purchases widening, new subscriptions table
│   ├── payload-collections.md  # Tiers/Lessons pricing fields, new SubscriptionPlan global
│   └── server-actions.md       # tier/lesson/subscription-plan pricing, generalized checkout, webhook expansion
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── tiers/
│   │   └── [tierId]/page.tsx          # NEW — public Tier sales page
│   ├── lessons/
│   │   └── [lessonId]/page.tsx        # NEW — public Lesson sales/preview page
│   ├── subscribe/
│   │   └── page.tsx                   # NEW — public Subscription signup page
│   ├── checkout/
│   │   ├── success/page.tsx           # MODIFIED — handles a Subscription session_id alongside one-time purchases
│   │   └── cancel/page.tsx            # unchanged
│   ├── api/webhooks/stripe/route.ts   # MODIFIED — mode-aware checkout.completed branch, +4 new event handlers
│   ├── staff/
│   │   ├── tiers/page.tsx             # MODIFIED — add price/for-sale controls (existing list-based edit UI)
│   │   ├── courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/page.tsx  # MODIFIED — add price/for-sale controls
│   │   ├── subscription-plan/page.tsx # NEW — single staff page for the Subscription Global
│   │   └── purchases/page.tsx         # MODIFIED — product-type column + Subscriptions tab + cancel action
│   └── customer/[id]/
│       └── purchases/page.tsx         # MODIFIED — product-type labels + Subscription status block
├── lib/
│   ├── courses/
│   │   ├── tier-actions.ts            # MODIFIED — add setTierPricing, getTierForSale
│   │   ├── course-actions.ts          # MODIFIED — add setLessonPricing, getLessonForSale (Lesson writes already live here alongside Course writes; no separate lesson-actions.ts exists)
│   │   └── course-queries.ts          # unchanged
│   ├── payments/
│   │   ├── checkout.ts                # MODIFIED — generalized createCheckoutSession + new createSubscriptionCheckoutSession
│   │   ├── purchases.ts               # MODIFIED — product_id/product_type rename, Tier/Lesson refund branches
│   │   ├── subscriptions.ts           # NEW — getMySubscription, listAllSubscriptions, cancelSubscription
│   │   └── subscription-plan.ts       # NEW — setSubscriptionPlanPricing, getSubscriptionPlanForSale
│   └── progress/
│       └── course-access.ts           # MODIFIED — hasActiveSubscription short-circuit + new isLessonAccessible
├── collections/
│   ├── Tiers.ts                       # MODIFIED — priceCents, isForSale
│   └── Lessons.ts                     # MODIFIED — priceCents, isForSale
└── globals/
    └── SubscriptionPlan.ts             # NEW — registered in payload.config.ts
```

**Structure Decision**: Adds to the existing single Next.js app — no new project, service, or external dependency. Every new file follows the same `lib/<domain>/` + `app/<route>/page.tsx` + server-action pattern established across 002–006 and 014. The only structurally new Payload concept is a Global (`SubscriptionPlan`) — the first in this codebase — used because the Subscription is a singleton product, not a repeatable collection (research.md #7).

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Renaming `purchases.course_id` → `product_id` (a schema change to 006's already-written table) | A single generic one-time-purchase table is materially simpler to query/refund/display than three parallel tables (research.md #1), and correctly reflects that a row can now be a Tier, Course, or Lesson purchase | Leaving `course_id` named as-is and just reusing it to also hold Tier/Lesson ids was rejected as confusing/misleading for every future reader of the schema, for a rename that costs nothing at this pre-production stage (006 is not yet merged/deployed) |
