---

description: "Task list for Course Sales Pages & Direct Payment Enrollment"
---

# Tasks: Course Sales Pages & Direct Payment Enrollment

**Input**: Design documents from `/specs/006-course-sales-payments/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/supabase-schema.md, contracts/payload-collections.md, contracts/server-actions.md, quickstart.md

**Tests**: Not requested — this repo has no automated test framework (confirmed precedent in `004-course-lesson-management` and `005-customer-data-integration`); validation is manual via `quickstart.md`.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1 = P1, US2 = P2, US3 = P1, US4 = P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Paths are relative to the repository root; `src/` and `collections/` both live at the repo root (confirmed: `collections/Courses.ts`)

## Practical note on story order

US1 (buyer purchases) and US3 (staff price/publish a course) are both P1 and are true co-requisites: US1's own quickstart scenarios cannot be exercised until at least one course has been priced and marked for sale by US3. Phases below still follow spec.md's numbering (US1 first), but **implement Phase 5 (US3) before validating Phase 3 (US1)** — the task IDs and file paths for both are independent of each other, only manual validation order is affected.

---

## Phase 1: Setup

**Purpose**: New dependency and environment scaffolding shared by every story.

- [X] T001 Add `stripe` (Node SDK) to `package.json` / `package-lock.json` via `npm install stripe`
- [X] T002 [P] Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env.example`, documented per `specs/006-course-sales-payments/quickstart.md` (Stripe test-mode keys, `stripe listen --forward-to localhost:3040/api/webhooks/stripe` for local dev)
- [X] T003 [P] Create `src/lib/payments/stripe-client.ts` — server-only Stripe SDK client instantiated from `STRIPE_SECRET_KEY`, per `specs/006-course-sales-payments/contracts/server-actions.md`

**Checkpoint**: Stripe SDK importable from server-only code; no business logic yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema changes and the enrollment-function refactor every user story's implementation calls into. No user story can be completed without this phase.

**⚠️ CRITICAL**: No user story work can be considered done until this phase is complete.

- [X] T004 Apply `CREATE SEQUENCE public.native_customer_id_seq ...`, the `next_native_customer_id()` wrapper function, and `ALTER TABLE public.customer_profiles ADD COLUMN account_origin ...` to the target Supabase project's SQL editor, per `specs/006-course-sales-payments/contracts/supabase-schema.md` — **user applied manually**, verified live (RPC call and column both resolve)
- [X] T005 Apply the `CREATE TABLE public.purchases (...)` statement (with `purchases_buyer_id_idx`, `purchases_course_id_idx`, RLS enabled, `purchases_select_own`, `purchases_select_staff` policies, deliberately no client INSERT/UPDATE policy), including a `needs_review boolean NOT NULL DEFAULT false` column for the Tier-rank-rollback-skipped case (research.md #6), to the same Supabase project, per `specs/006-course-sales-payments/contracts/supabase-schema.md` (depends on T004 for `customer_profiles` shape referenced by RLS policies) — **user applied manually**, verified live (table reachable via service-role client)
- [X] T006 [P] Add `priceCents` (number, min 0) and `isForSale` (checkbox, default false) fields to the `Courses` collection in `collections/Courses.ts`, per `specs/006-course-sales-payments/contracts/payload-collections.md`
- [X] T007 Regenerate Payload types (`payload-types.ts`) so `priceCents`/`isForSale` are typed, per the project's existing Payload type-generation command
- [X] T008 [P] Add `createNativeCustomerProfile(input: { supabaseUserId, email, firstName }): Promise<{ id: string; coreCustomerId: number }>` to `src/lib/auth/customer-profile.ts` — inserts a `customer_profiles` row with `account_origin: 'native'` and `core_customer_id` from `next_native_customer_id()` (T004), per `specs/006-course-sales-payments/data-model.md` and research.md #3
- [X] T009 Refactor `src/lib/progress/enrollment.ts`: extract the write logic of `enrollStudentInCourse` and `enrollStudentInTierSequence` into unexported `enrollStudentInCourseInternal(studentId, courseId)` and `enrollStudentInTierSequenceInternal(studentId, courseOwnerId): Promise<{ grantedRank: number }>`; the existing exported functions become thin `requireStaffRole`-gated wrappers around them, per `specs/006-course-sales-payments/contracts/server-actions.md` and research.md #4 — **no behavior change** for existing manual staff-grant callers
- [X] T010 [P] Guard `fetchSnapshot()` in `src/app/customer/[id]/page.tsx` **and** `src/app/customer/[id]/layout.tsx` (both call it independently) behind `account_origin === 'core-linked'`, skipping the Core API call/profile-sync and rendering existing empty states for `native` accounts, per research.md #3

**Checkpoint**: Schema exists, Payload fields exist, enrollment functions are split, native-account creation is available, and the dashboard no longer assumes every account is Core-linked. User story implementation can now begin.

---

## Phase 3: User Story 1 - Buyer Purchases a Course Directly on Academy (Priority: P1) 🎯 MVP

**Goal**: A buyer (existing Core-linked student or brand-new signup) can view a course's sales page, pay via Stripe Checkout, and be enrolled automatically — for both Standalone and Sequential-Locked courses.

**Independent Test**: Starting logged-out or logged-in, open a for-sale course's sales page, complete a Stripe test-mode purchase, and confirm immediate content access. Requires a course already priced/for-sale (Phase 5, US3) to exercise manually — see quickstart.md Scenarios 1–6, 8.

### Implementation for User Story 1

- [X] T011 [P] [US1] Add `getCourseForSale(slug: string): Promise<ForSaleCourse | null>` to `src/lib/courses/course-queries.ts` — public (no auth check), returns `null` unless `status === 'published' AND isForSale === true`, includes module/lesson titles only (no content/video URLs), per `specs/006-course-sales-payments/contracts/server-actions.md`
- [X] T012 [US1] Create `src/lib/payments/checkout.ts` with `createCheckoutSession(input: { courseId: string; buyerEmail?: string })` — validates the course is published + for-sale, rejects if the caller already has access (`isCourseAccessible`), requires `buyerEmail` when logged out, creates a Stripe Checkout Session (`mode: 'payment'`, price snapshotted now, `success_url`/`cancel_url`, `metadata: { courseId, courseCategory, buyerProfileId?, buyerEmail }`), redirects to the Stripe-hosted URL (matches this repo's existing `redirect()`-from-Server-Action pattern rather than returning `{ redirectUrl }`); pre-inserts a `pending` purchases row only when the buyer is already logged in — a brand-new buyer has no `customer_profiles` row yet, so the webhook (T014) creates the row directly on success, per `specs/006-course-sales-payments/contracts/server-actions.md` (depends on T003, T011)
- [X] T013 [US1] Add `getPurchaseBySessionId(sessionId: string): Promise<PurchaseStatusSummary | null>` to `src/lib/payments/checkout.ts`, backing the success page's brief poll while the webhook lands, per research.md #2 (depends on T012)
- [X] T014 [US1] Create `src/app/api/webhooks/stripe/route.ts` `POST` handler: verify `Stripe-Signature` against the raw body using `STRIPE_WEBHOOK_SECRET` (400 on failure); on `checkout.session.completed` look up the `purchases` row by `stripe_checkout_session_id` (no-op if already `succeeded`), re-validate `isForSale` (mark `error` + auto-refund via Stripe API if it changed, per research.md #5 — for a brand-new buyer with no pre-existing row, just refund with no row/account created at all), create a native `customer_profiles` row via T008 (email-based idempotency check first) + send a magic-link/OTP email if the buyer was logged out, call `enrollStudentInCourseInternal`/`enrollStudentInTierSequenceInternal` (T009) per `course_category_at_purchase`, upsert the `purchases` row (`status: 'succeeded'`, `stripe_payment_intent_id`, `tier_rank_granted`); on `checkout.session.async_payment_failed` set `status: 'declined'` if a row exists; any other event type returns 200 no-op; unhandled exceptions return non-2xx so Stripe retries, per `specs/006-course-sales-payments/contracts/server-actions.md` (depends on T003, T008, T009, T012)
- [X] T015 [US1] Create `src/app/courses/[slug]/page.tsx` — public sales page rendering title, description, curriculum outline (via `getCourseForSale`, T011), and price; shows "already own this" instead of a Buy control when the signed-in viewer already has access; Buy form collects `buyerEmail` only when logged out and calls `createCheckoutSession` (T012), which redirects to Stripe, per FR-003/FR-004/FR-007 and quickstart.md Scenarios 1, 2, 4, 6, 9 (depends on T011, T012)
- [X] T016 [US1] Create `src/app/checkout/success/page.tsx` — reads `?session_id=`, calls `getPurchaseBySessionId` (T013), auto-refreshes (`<meta http-equiv="refresh">`) while no row exists yet or `status === 'pending'`, then shows enrollment confirmation + link into the course (or a clear error state for `declined`/`error`), per quickstart.md Scenarios 2, 3, 8 (depends on T013)
- [X] T017 [P] [US1] Create `src/app/checkout/cancel/page.tsx` — buyer backed out of Stripe Checkout, links back to the course's sales page
- [X] T018 [US1] In `createCheckoutSession` (T012), detect a logged-out `buyerEmail` that already belongs to an existing `customer_profiles` row (`getCustomerProfileByEmail`, added to `src/lib/auth/customer-profile.ts`) and reject with a "sign in instead" error rather than proceeding to Stripe, per FR-019 and quickstart.md Scenario 5 (depends on T012). Also added a double-click guard (spec.md Edge Cases): reuses a still-open Checkout Session created in the last 30 minutes for the same signed-in buyer+course instead of starting a second one (logged-out double-clicks are a documented residual risk, not covered).

**Checkpoint**: A buyer (new or existing) can buy a for-sale Standalone or Sequential-Locked course end-to-end and land on its content. Requires Phase 5 (US3) to have marked at least one course for sale to validate manually.

---

## Phase 4: User Story 2 - Student Reviews Their Purchases (Priority: P2)

**Goal**: A student can see a list of their own purchases (course, date, amount, status).

**Independent Test**: As a student with at least one completed purchase (Phase 3), open the purchase history view and confirm it lists that purchase correctly; as a student with none, confirm an empty state.

### Implementation for User Story 2

- [X] T019 [US2] Create `src/lib/payments/purchases.ts` with `listMyPurchases(): Promise<PurchaseSummary[]>` — `requireCustomerProfile()`-gated, returns only the caller's own `purchases` rows, per `specs/006-course-sales-payments/contracts/server-actions.md`
- [X] T020 [US2] Create `src/app/customer/[id]/purchases/page.tsx` — lists `listMyPurchases()` results (course name, date, amount, status) with an explicit empty state for zero purchases, per spec.md US2 Acceptance Scenarios 1–2

**Checkpoint**: Students can review their purchase history independently of US3/US4.

---

## Phase 5: User Story 3 - Staff Configure a Course for Sale (Priority: P1)

**Goal**: Staff can price a course, mark it for sale (publishing its sales page), change its price, and take it off sale without affecting existing owners.

**Independent Test**: As staff, price and publish a Standalone or Sequential-Locked course; confirm `/courses/[slug]` becomes reachable; take it off sale and confirm it's no longer reachable while existing owners keep access.

### Implementation for User Story 3

- [X] T021 [US3] Add `setCoursePricing(courseId: string, input: { priceCents: number; isForSale: boolean }): Promise<void>` to `src/lib/courses/course-actions.ts` — `requireStaffRole(['super_admin', 'staff'])`-gated (same set as `createCourse`/`updateCourse`), rejects `isForSale: true` with no/zero `priceCents`, revalidates `/staff/courses/[courseId]` and `/courses/[slug]`, per `specs/006-course-sales-payments/contracts/server-actions.md` (depends on T006)
- [X] T022 [US3] Add price/for-sale controls to `src/app/staff/courses/[courseId]/page.tsx`, calling `setCoursePricing` (T021), per spec.md US3 Acceptance Scenarios 1–3 (depends on T021)

**Checkpoint**: Staff can independently control which courses are sellable and at what price — unblocks manual validation of Phase 3 (US1).

---

## Phase 6: User Story 4 - Staff Review Sales & Handle a Refund (Priority: P3)

**Goal**: Staff can see all purchases and refund one, revoking the student's access.

**Independent Test**: As staff, open the purchase list, locate a completed purchase, mark it refunded, and confirm the student's access to that course is revoked while their progress history is preserved.

### Implementation for User Story 4

- [X] T023 [P] [US4] Add `listAllPurchases(filters?: { status?: PurchaseStatus }): Promise<StaffPurchaseSummary[]>` to `src/lib/payments/purchases.ts` — `requireStaffRole(['super_admin', 'staff'])`-gated, per `specs/006-course-sales-payments/contracts/server-actions.md` (depends on T019 file existing)
- [X] T024 [US4] Add `refundPurchase(purchaseId: string): Promise<void>` to `src/lib/payments/purchases.ts` — staff-gated, rejects unless `status === 'succeeded'`, calls the Stripe Refunds API against `stripe_payment_intent_id`, revokes access (deletes the `course_enrollments` row for Standalone, or applies the defensive Tier-rank rollback from research.md #6 for Sequential-Locked — only if `current_tier_rank` still equals `tier_rank_granted`; otherwise leaves rank untouched and sets `needs_review: true` instead of rolling back), sets `status: 'refunded'`, per `specs/006-course-sales-payments/contracts/server-actions.md` (depends on T023)
- [X] T025 [US4] Create `src/app/staff/purchases/page.tsx` — lists `listAllPurchases()` (student, course, date, amount, status) with a refund action wired to `refundPurchase` (T024); added a "Purchases" link to `src/components/StaffSidebar.tsx` for `super_admin`/`staff` roles, per spec.md US4 Acceptance Scenarios 1–3 (depends on T023, T024)

**Checkpoint**: Staff have full sales visibility and can process refunds end-to-end, including access revocation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T026 Run `specs/006-course-sales-payments/quickstart.md` Scenarios 1–10 end-to-end against a Stripe test-mode account, including Scenario 10 (credit-wallet non-interference, FR-015/SC-005) and Scenario 8 (mid-checkout off-sale race, FR-013)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (T003's Stripe client isn't required by T004–T010, but keeping Setup first avoids partial-Stripe-config surprises). **Blocks all user stories.**
- **User Stories (Phase 3–6)**: All depend on Phase 2 completion.
  - US1 (Phase 3) and US3 (Phase 5) have no code-level dependency on each other, but US1 cannot be **manually validated** until US3 exists (a course must be priced/for-sale first).
  - US2 (Phase 4) depends only on Phase 2 + at least one Phase 3 purchase existing to show non-empty state (code has no hard dependency, since the empty state is part of the same task).
  - US4 (Phase 6) depends only on Phase 2 for `refundPurchase`'s access-revocation logic; validating it end-to-end requires a Phase 3 purchase to refund.
- **Polish (Phase 7)**: Depends on all four stories being complete.

### Recommended implementation order

Phase 1 → Phase 2 → **Phase 5 (US3)** → Phase 3 (US1) → Phase 4 (US2) → Phase 6 (US4) → Phase 7. (Implementing US3 just ahead of US1, despite spec.md listing US1 first, avoids building the buy flow against a course that can never legally be for sale yet.)

### Within Each User Story

- Phase 3: T011 (query) before T012 (checkout session, reads it) before T014 (webhook, needs T012's `purchases` row shape) before T015/T016 (pages call the server actions). T017 and T018 are independent add-ons.
- Phase 4: T019 before T020.
- Phase 5: T021 before T022.
- Phase 6: T023 before T024 before T025.

### Parallel Opportunities

- Setup: T002, T003 in parallel (different files).
- Foundational: T006, T008, T010 in parallel (different files); T004 before T005 (same migration target, sequential); T007 after T006; T009 independent of T004–T008.
- Phase 3: T011 and T017 are parallelizable with the rest of the story.
- Phase 6: T023 can start alongside T021/T022 (different files) once Phase 2 is done.
- Different user stories (Phase 3 vs. 4 vs. 5 vs. 6) can be staffed in parallel once Phase 2 is complete, keeping in mind the manual-validation ordering note above.

---

## Parallel Example: Foundational Phase

```bash
# After T004/T005 (sequential, same Supabase project), run in parallel:
Task: "Add priceCents/isForSale fields to collections/Courses.ts"
Task: "Add createNativeCustomerProfile to src/lib/auth/customer-profile.ts"
Task: "Guard fetchSnapshot() behind account_origin in src/app/customer/[id]/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1, with US3 as its unblock)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (schema, Payload fields, enrollment split, native-account creation).
3. Complete Phase 5: User Story 3 (staff can price/publish a course — otherwise nothing is sellable to test US1 against).
4. Complete Phase 3: User Story 1.
5. **STOP and VALIDATE**: Run quickstart.md Scenarios 1–6, 8 independently.
6. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US3 → staff can list courses for sale.
3. US1 → buyers can purchase (MVP complete).
4. US2 → students can review purchases.
5. US4 → staff can review sales and refund.
6. Polish → full quickstart.md pass.

---

## Notes

- No test tasks are included — this repo has no automated test framework (see plan.md Technical Context); `specs/006-course-sales-payments/quickstart.md` is the validation mechanism.
- [P] tasks touch different files and have no unmet dependency.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- Coupons, subscriptions/payment plans, and CourseHost-purchase backfill are explicitly out of scope (contracts/server-actions.md) — no tasks exist for them.
