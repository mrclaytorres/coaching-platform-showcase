# Phase 1 Data Model: Course Sales Pages & Direct Payment Enrollment

Extends the Payload/Supabase split established in `004-course-lesson-management`. No new storage system — one new Supabase table (`purchases`), one new Postgres sequence, two extended existing entities (`Courses`, `customer_profiles`).

## Payload Collection (extend existing)

### Courses (extend `collections/Courses.ts`)

| Field | Type | Notes |
|---|---|---|
| `priceCents` | number, nullable | **NEW** — price in US cents (e.g. `4900` = $49.00). Null/unset means "no price configured yet"; a course cannot be marked `isForSale` without a `priceCents` set (FR-001). |
| `isForSale` | checkbox, default `false` | **NEW** — gates whether `/courses/[slug]` is publicly reachable and purchasable (FR-001, FR-002, FR-004). Independent of `status` (draft/published) — both must hold for the sales page to be reachable (a draft course is never for sale regardless of this flag). |

**Validation** (application layer, `course-actions.ts`, same pattern as existing Tier-uniqueness check): setting `isForSale = true` without a `priceCents` value is rejected.

No changes to `CourseModules`, `Lessons`, `Assignments`, `QuizQuestions`, or `Tiers` — this feature only adds a for-sale/price layer on top of the existing `Courses` collection.

## Supabase Tables

### customer_profiles (extend existing, from `002-supabase-auth-user-data`)

| Field | Type | Notes |
|---|---|---|
| `account_origin` | text, `NOT NULL DEFAULT 'core-linked'` | **NEW** — `'core-linked'` (existing magic-link/seeded accounts tied to a real Core `customer_id`) or `'native'` (created during checkout by a buyer with no prior CourseHost/Core relationship, research.md #3). Existing rows all default to `'core-linked'`, no backfill ambiguity. |

**New sequence**: `native_customer_id_seq` (Postgres `CREATE SEQUENCE`, starting at 1, incrementing by 1). A native buyer's `core_customer_id` is assigned as `-nextval('native_customer_id_seq')` — negative, guaranteed disjoint from Core's positive-integer `customer_id` space, no coordination with Core needed (research.md #3).

### purchases (NEW)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `buyer_id` | uuid, fk → `customer_profiles.id` | The purchasing student — either a pre-existing `core-linked` profile or a `native` profile created during this checkout. |
| `course_id` | text | Payload Course id (cross-system reference, plain text — same pattern as `lesson_completions.lesson_id` etc. in `004-course-lesson-management`'s data model; no FK across the Payload/Supabase boundary). |
| `course_category_at_purchase` | text (`sequential-locked` \| `standalone`) | Snapshotted at purchase time — which access-granting path this Purchase used (Course Enrollment vs. Tier-sequence rank), so refund logic (research.md #6) doesn't need to re-look-up a Course that may have since changed category. |
| `amount_cents` | integer | Snapshotted at Checkout Session creation (research.md #5) — the price actually charged, independent of later `Courses.priceCents` changes (spec.md US3 Acceptance Scenario 3). |
| `currency` | text, default `'usd'` | FR-016 — USD only for v1. |
| `status` | text (`pending` \| `succeeded` \| `declined` \| `refunded` \| `error`) | `pending` on Checkout Session creation; `succeeded` set by the webhook on fulfillment (research.md #2); `declined` if Stripe reports the payment failed; `refunded` when staff process a refund (US4); `error` for the take-off-sale-mid-checkout race (research.md #5), which also triggers an automatic Stripe refund. |
| `stripe_checkout_session_id` | text, unique | Idempotency anchor — the webhook handler upserts on this column so redundant Stripe webhook retries never double-enroll (research.md #2). |
| `stripe_payment_intent_id` | text, nullable | Set once payment completes; used to issue refunds via the Stripe API (US4). |
| `tier_rank_granted` | integer, nullable | Only set for `sequential-locked` purchases — the Tier rank this specific purchase advanced the buyer to, used by the defensive refund-rollback check (research.md #6). |
| `needs_review` | boolean, default `false` | **NEW** — set `true` by `refundPurchase` when a Sequential-Locked Tier-rank rollback can't be safely applied (buyer's rank advanced further via real assessment progress since purchase, research.md #6). The financial refund still proceeds (`status → refunded`); only the rank rollback is skipped, flagged for staff to review manually. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Bumped on every status transition. |

RLS: buyer can read only their own `purchases` rows (`buyer_id` maps to `customer_profiles.supabase_user_id = auth.uid()`, same pattern as every other student-scoped table); staff/coach roles can read all rows (mirrors `staff_profiles`-gated reads elsewhere); only the service-role client (webhook handler, staff refund action) ever writes.

**State transitions**: `pending` → `succeeded` (webhook, grants access) | `declined` (webhook, no access) | `error` (webhook, take-off-sale race, auto-refunded, no access). `succeeded` → `refunded` (staff action, US4, revokes access per research.md #6). No other transitions are valid — e.g. a `refunded` Purchase can never move back to `succeeded`.

## Relationship to existing entities

- **Course Enrollment** (`course_enrollments`, from `004-course-lesson-management`): unchanged table shape. A `succeeded` Purchase for a `standalone` Course writes one `course_enrollments` row via `enrollStudentInCourseInternal` (research.md #4) — this table's *only* writer is now this path plus the pre-existing staff manual-grant action, both funneling through the same internal function.
- **student_tier_progress** (from `004-course-lesson-management`): unchanged table shape. A `succeeded` Purchase for a `sequential-locked` Course calls `enrollStudentInTierSequenceInternal` (creating the row at the sequence's entry Tier if absent) and, if the purchased course's Tier rank is higher than the buyer's current rank, advances `current_tier_rank` to that Tier's `order` (FR-020).
- **customer_profiles**: a `native`-origin row is created (not upserted against an existing Core-sourced record) the first time a brand-new buyer completes checkout; its `email` is the address they provide during Stripe Checkout, and its `core_customer_id` comes from `native_customer_id_seq` (see above) — there is no "matching Core snapshot email" step for these rows, since FR-003's linking rule only applies to Core-sourced customers.

## Cross-system reference note

`purchases.course_id` follows the same convention documented in `004-course-lesson-management/data-model.md`'s "Cross-system reference note": Payload-managed ids are stored as plain `text` in Supabase tables, with referential integrity enforced at the application layer (the checkout server action validates the Course id exists and `isForSale = true` before creating a Stripe Checkout Session).
