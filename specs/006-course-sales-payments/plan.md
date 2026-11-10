# Implementation Plan: Course Sales Pages & Direct Payment Enrollment

**Branch**: `006-course-sales-payments` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-course-sales-payments/spec.md`

## Summary

Add public, per-course sales pages (`/courses/[slug]`) covering both Standalone and Sequential-Locked Courses (`004-course-lesson-management`), backed by Stripe Checkout for payment. A successful payment — reconciled authoritatively via a Stripe webhook, not the browser redirect — automatically grants access through the existing `enrollStudentInCourse`/`enrollStudentInTierSequence` mechanisms (previously staff-only manual stand-ins for "the purchase happened"), and creates a native Academy account for brand-new buyers who have no prior Core/CourseHost relationship (assigned a disjoint negative-range identifier so the rest of the app's Core-`customer_id`-keyed routing is untouched). Staff get a sales page price/publish toggle and a purchase list with refund capability. The existing Core-sourced coaching-session credit wallet is never read or written by any part of this feature.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`)

**Primary Dependencies**: `stripe` (new — Node SDK, Checkout Sessions + Refunds + webhook signature verification), existing `@payloadcms/next`/`payload` (Courses collection extension), existing `@supabase/supabase-js` (service-role writes to the new `purchases` table and `customer_profiles`), existing `src/lib/progress/enrollment.ts` and `src/lib/progress/course-access.ts` (reused, lightly refactored per research.md #4)

**Storage**: Supabase Postgres — new `purchases` table, new `native_customer_id_seq` sequence, `customer_profiles.account_origin` column addition; Payload `Courses` collection gains `priceCents`/`isForSale` fields

**Testing**: No automated test framework exists in this repo (confirmed precedent: `004-course-lesson-management`, `005-customer-data-integration`); validation is manual via `quickstart.md`, using Stripe test-mode keys and published test card numbers

**Target Platform**: Node 22 server running the existing Next.js app; the new `/api/webhooks/stripe` Route Handler must be reachable from the public internet in any deployed environment (Stripe delivers webhooks over HTTPS), unlike every other route in this codebase which sits behind Supabase-session middleware

**Project Type**: Web application — single existing Next.js app, no new services. One new external dependency: Stripe (payment processor)

**Performance Goals**: N/A — no unusual throughput expectations; matches existing app's low-volume, single-tenant scale

**Constraints**:
- Checkout MUST NOT redirect buyers to CourseHost or any competing storefront (FR-005) — Stripe Checkout satisfies this; see research.md #1 for why a Stripe-hosted payment step is still considered "within Academy" for this requirement's intent
- A buyer must never end up charged without access and without a clear resolution path (FR-014) — solved via webhook-as-source-of-truth + idempotent retry (research.md #2), not the synchronous request/response cycle
- The existing Core-sourced credit/session-booking system MUST NOT be read, written, or otherwise touched by any code in this feature (FR-015)
- `core_customer_id`'s existing shape (`NOT NULL` integer, drives every `/customer/[id]`-style route) must not require a breaking schema/type change to support native buyers (research.md #3)

**Scale/Scope**: Single-tenant (`courseOwnerId = 'academy'`, per `004-course-lesson-management`), USD-only, one-time payments only, small course catalog — matches the rest of this codebase's current scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project, consistent with `004-course-lesson-management` and `005-customer-data-integration`'s plans. No gates to evaluate. Proceeding under the project's established conventions: server-action-gated staff writes via `requireStaffRole` (`003-roles-admin-staff`), service-role-only Supabase writes with RLS as defense-in-depth (`002-supabase-auth-user-data` onward), Payload as the authored-content store with real authorization enforced in the Next.js layer, not Payload's own access functions (`004-course-lesson-management` research.md #3).

**Post-design re-check**: The one new external dependency (Stripe) and one new public, unauthenticated Route Handler (`/api/webhooks/stripe`) are both required by the feature's core purpose (accepting real payment) and have no simpler in-repo alternative — see Complexity Tracking. No other new services, cross-cutting patterns, or architectural departures were introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-course-sales-payments/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   ├── supabase-schema.md      # purchases table, account_origin column, native id sequence
│   ├── payload-collections.md  # Courses.priceCents / isForSale
│   └── server-actions.md       # checkout, webhook, purchases list/refund, enrollment refactor
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── courses/
│   │   └── [slug]/
│   │       └── page.tsx          # NEW — public sales page, unauthenticated, outside middleware's protected matcher
│   ├── checkout/
│   │   ├── success/page.tsx      # NEW — reads Purchase by Stripe session id, polls briefly until webhook lands
│   │   └── cancel/page.tsx       # NEW — buyer backed out of Stripe Checkout
│   ├── api/
│   │   └── webhooks/
│   │       └── stripe/route.ts   # NEW — Route Handler (not a Server Action; needs raw body + signature verification)
│   ├── staff/
│   │   ├── courses/[courseId]/page.tsx  # MODIFIED — add price/for-sale controls
│   │   └── purchases/page.tsx    # NEW — staff purchase list + refund action (US4)
│   └── customer/[id]/
│       ├── page.tsx              # MODIFIED — guard fetchSnapshot() behind account_origin === 'core-linked' (research.md #3)
│       └── purchases/page.tsx    # NEW — student purchase history (US2)
├── lib/
│   ├── courses/
│   │   ├── course-actions.ts     # MODIFIED — add setCoursePricing
│   │   └── course-queries.ts     # MODIFIED — add getCourseForSale
│   ├── payments/
│   │   ├── stripe-client.ts      # NEW — thin Stripe SDK wrapper, server-only
│   │   ├── checkout.ts           # NEW — createCheckoutSession, getPurchaseBySessionId
│   │   └── purchases.ts          # NEW — listMyPurchases, listAllPurchases, refundPurchase
│   ├── progress/
│   │   └── enrollment.ts         # MODIFIED — split into public wrapper + internal fn (research.md #4)
│   └── auth/
│       └── customer-profile.ts   # MODIFIED — createNativeCustomerProfile (account_origin='native', native id sequence)
└── middleware.ts                  # unchanged — /courses, /checkout, /api/webhooks/stripe intentionally NOT added to the protected matcher
```

**Structure Decision**: Adds to the existing single Next.js app — no new project or service, one new external dependency (Stripe). New code follows the same `lib/<domain>/` + `app/<route>/page.tsx` + server-action pattern established across `002`–`005`. The only structurally new concept is the `/api/webhooks/stripe` Route Handler, required because Server Actions cannot access the raw request body Stripe's signature verification needs.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| New external dependency: Stripe | Core feature requirement — real payment processing entirely within Academy (FR-005), which this codebase has no existing capability for | Building custom PCI-compliant payment handling in-house is categorically out of proportion to this feature and every other reviewed processor option was rejected for domain-fit reasons (research.md #1) |
| New unauthenticated public route: `/api/webhooks/stripe` | Stripe's webhook delivery model requires a public HTTPS endpoint outside normal session auth; this is also the only reliable fix for FR-014 (research.md #2) | A polling-only approach (no webhook) would leave the "payment succeeded but browser never returns" case permanently unresolved, directly violating FR-014 |
