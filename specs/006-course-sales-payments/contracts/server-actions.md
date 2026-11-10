# Contract: Server Actions & Route Handler

**Branch**: `006-course-sales-payments` | **Date**: 2026-07-28

Mirrors the server-action contract pattern from `004-course-lesson-management/contracts/server-actions.md`. New module: `src/lib/payments/`. One new Next.js Route Handler (not a Server Action, since Stripe webhooks need raw-body signature verification, which Server Actions can't do).

## `src/lib/courses/course-actions.ts` (extend existing)

### `setCoursePricing`

```ts
async function setCoursePricing(
  courseId: string,
  input: { priceCents: number; isForSale: boolean },
): Promise<void>
```

- `requireStaffRole(['super_admin', 'staff'])` — same permission set as `createCourse`/`updateCourse` (FR-001).
- Rejects `isForSale: true` with no `priceCents` (or `priceCents <= 0`).
- `revalidatePath('/staff/courses/${courseId}')` and `revalidatePath('/courses/${slug}')`.

## `src/lib/courses/course-queries.ts` (extend existing)

### `getCourseForSale(slug: string)`

```ts
async function getCourseForSale(slug: string): Promise<ForSaleCourse | null>
```

- Public (no auth check) — backs `/courses/[slug]` (FR-003, FR-004).
- Returns `null` (→ page calls `notFound()`) unless `status === 'published' AND isForSale === true`, satisfying FR-004 regardless of caller.
- Includes modules/lessons titles only (curriculum outline, spec.md FR-003) — never full Lesson content/video URLs, which stay behind the existing `isCourseAccessible` gate.

## `src/lib/progress/enrollment.ts` (refactor existing, per research.md #4)

Existing `enrollStudentInCourse`/`enrollStudentInTierSequence` are split:

```ts
// Unexported — the actual write logic, callable from a trusted server context
// (the Stripe webhook handler) OR from the staff-facing wrapper below.
async function enrollStudentInCourseInternal(studentId: string, courseId: string): Promise<void>
async function enrollStudentInTierSequenceInternal(studentId: string, courseOwnerId: string): Promise<{ grantedRank: number }>

// Unchanged public signature/behavior — still requireStaffRole-gated, for any
// manual staff "grant access" affordance. Now just a thin wrapper.
export async function enrollStudentInCourse(studentId: string, courseId: string): Promise<void>
export async function enrollStudentInTierSequence(studentId: string, courseOwnerId?: string): Promise<void>
```

`enrollStudentInTierSequenceInternal` additionally returns the rank actually granted, so the webhook handler can record `purchases.tier_rank_granted` (data-model.md).

## `src/lib/payments/checkout.ts` (NEW)

### `createCheckoutSession`

```ts
async function createCheckoutSession(input: {
  courseId: string;
  buyerEmail?: string; // required only when the caller is logged out
}): Promise<{ redirectUrl: string }>
```

**Behavior**:
1. Look up the Course (Payload); reject if not found, not `published`, or not `isForSale` (FR-004) — do not create a Stripe session for an unpurchasable course.
2. If the caller is signed in (`getCustomerProfile` resolves): reject if they already have access to this course (`isCourseAccessible`, FR-007) — surfaces as "you already own this" in the UI rather than reaching Stripe at all.
3. If the caller is logged out, `buyerEmail` is required (collected on the sales page's Buy form) — passed to Stripe Checkout as `customer_email`. No `customer_profiles` row is created yet at this step; that happens in the webhook, only once payment actually succeeds (a buyer must never get a native account created for an abandoned/failed checkout).
4. Create a Stripe Checkout Session: `mode: 'payment'`, one line item at the Course's **current** `priceCents` (captured now — research.md #5), `success_url` → `/checkout/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url` back to `/courses/[slug]`, `metadata: { courseId, courseCategory, buyerProfileId? }`.
5. Insert a `purchases` row, `status: 'pending'`, with the new session's id (idempotency anchor).
6. Return the Stripe-hosted Checkout URL for the page to redirect to.

### `getPurchaseBySessionId`

```ts
async function getPurchaseBySessionId(sessionId: string): Promise<PurchaseSummary | null>
```

- Backs `/checkout/success` — reads the `purchases` row's current `status` (may still be `pending` if the webhook hasn't landed yet; the success page polls briefly, matching the pattern of "webhook is authoritative," research.md #2).

## `src/app/api/webhooks/stripe/route.ts` (NEW — Route Handler, not a Server Action)

```ts
export async function POST(request: Request): Promise<Response>
```

**Behavior**:
1. Verify the `Stripe-Signature` header against the raw request body using the webhook signing secret (`STRIPE_WEBHOOK_SECRET`, new env var) — reject with 400 on failure, before touching any data.
2. On `checkout.session.completed`:
   - Look up the `purchases` row by `stripe_checkout_session_id` (the idempotency anchor — data-model.md). If it's already `succeeded`, return 200 immediately (duplicate delivery, no-op).
   - Re-validate the Course is still `isForSale` (research.md #5). If not: set `status: 'error'`, issue a Stripe refund for the payment, return 200 (handled, not a retry-worthy failure).
   - If the buyer was logged out at checkout (no existing `buyerProfileId` in session metadata): create a Supabase auth user + a `customer_profiles` row with `account_origin: 'native'` and a `core_customer_id` from `native_customer_id_seq` (data-model.md), then send them a Supabase magic-link/OTP email so they can access their new account (reuses existing Supabase Auth email delivery, no new email infrastructure).
   - Call `enrollStudentInCourseInternal` or `enrollStudentInTierSequenceInternal` depending on `course_category_at_purchase`.
   - Update the `purchases` row: `status: 'succeeded'`, `stripe_payment_intent_id`, `tier_rank_granted` (if applicable).
3. On `checkout.session.async_payment_failed` (or an expired session): set `status: 'declined'`.
4. Any other event type: return 200, no-op (only these events are handled).
5. Any unhandled exception during steps 2–3: return a non-2xx status so Stripe retries delivery (the handler is idempotent per step 2's first check, so retries are safe).

## `src/lib/payments/purchases.ts` (NEW)

### `listMyPurchases`

```ts
async function listMyPurchases(): Promise<PurchaseSummary[]>
```

- Student-facing (US2) — `requireCustomerProfile()`-gated, returns only the caller's own `purchases` rows (also enforced by RLS as defense-in-depth).

### `listAllPurchases`

```ts
async function listAllPurchases(filters?: { status?: PurchaseStatus }): Promise<PurchaseSummary[]>
```

- Staff-facing (US4) — `requireStaffRole(['super_admin', 'staff'])`-gated.

### `refundPurchase`

```ts
async function refundPurchase(purchaseId: string): Promise<void>
```

- `requireStaffRole(['super_admin', 'staff'])`-gated (US4).
- Rejects if the Purchase's `status !== 'succeeded'` (can't refund something not successfully charged, or already refunded).
- Calls the Stripe Refunds API against `stripe_payment_intent_id`.
- Revokes access: deletes the `course_enrollments` row (standalone) or applies the defensive Tier-rank rollback (research.md #6) — only if `current_tier_rank` still equals `tier_rank_granted`; otherwise leaves rank untouched and flags the Purchase for manual review.
- Sets `status: 'refunded'`.

## Explicitly Out of Scope

- No coupon/discount-code server actions (spec.md Assumptions).
- No subscription/payment-plan Checkout mode — always `mode: 'payment'` (one-time).
- No CourseHost-purchase import/backfill server action (spec.md Clarifications, Q3).
