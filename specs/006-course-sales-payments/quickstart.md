# Quickstart: Course Sales Pages & Direct Payment Enrollment

Manual validation scenarios (this repo has no automated test framework — see `004-course-lesson-management/plan.md` Technical Context for precedent). Requires a Stripe **test-mode** account and its test API keys/webhook secret in `.env`; use [Stripe's published test card numbers](https://docs.stripe.com/testing) for all scenarios below.

**Prerequisites**:
- `ALLOW_DEV_SEEDING=true` and at least one seeded demo account (`005-customer-data-integration`), for the existing-Core-linked-buyer scenarios.
- A staff account (`003-roles-admin-staff`).
- At least one Standalone Course and one Sequential-Locked Course already created (`004-course-lesson-management`), each with at least one published Module/Lesson.
- Stripe CLI (`stripe listen --forward-to localhost:3040/api/webhooks/stripe`) running locally to receive webhook events during dev testing.

## Scenario 1 — Staff price and publish a course for sale (US3, FR-001)

1. Sign in as staff, open a Standalone Course's edit page.
2. Set a price and mark it for sale.
3. Visit `/courses/[slug]` logged out — confirm the sales page is reachable and shows title, description, curriculum outline, and price.

## Scenario 2 — Existing Core-linked student buys a Standalone Course (US1, FR-005–FR-007)

1. Sign in as a seeded/Core-linked student who does not already own the course from Scenario 1.
2. Visit its sales page, click Buy, complete Stripe Checkout with a successful test card.
3. Confirm redirect to `/checkout/success`, then confirm the student can immediately open the course's content.
4. Revisit the sales page — confirm it now shows "already own this" instead of a Buy button.

## Scenario 3 — Declined payment (US1, FR-008)

1. Repeat Scenario 2 for a different, not-yet-owned course, using Stripe's decline test card.
2. Confirm a clear error is shown, no enrollment occurred, and the buyer can retry.

## Scenario 4 — Brand-new buyer signs up during checkout (US1, FR-017–FR-019)

1. Logged out, visit a for-sale course's sales page using an email address with no existing Academy account.
2. Complete checkout with a successful test card.
3. Confirm a new account is created (`account_origin = 'native'`), the buyer receives a magic-link/OTP email, and after signing in they have access to the purchased course.
4. Confirm their dashboard renders without error and without attempting to fetch Core data (Credits/Sessions/Activity sections show their existing empty states).

## Scenario 5 — Duplicate-email signup is blocked (Edge Case)

1. Logged out, attempt checkout using the email address of an existing Core-linked student.
2. Confirm the buyer is told an account already exists and directed to sign in rather than a second account being created.

## Scenario 6 — Purchase a Sequential-Locked (Tier) course (US1, FR-020)

1. As a student with no Tier-sequence enrollment, buy a Sequential-Locked Course.
2. Confirm their Tier rank is enrolled at the sequence's entry Tier and advanced to at least the purchased course's Tier.
3. Confirm they can access that course and every Tier below it in the same sequence.
4. Repeat as a student whose current rank is already at or above that Tier — confirm the sales page shows "already own this" and they are never charged (Edge Case).

## Scenario 7 — Staff take a course off sale (US3, FR-002, SC-006)

1. As staff, take a currently-for-sale course off sale.
2. Confirm `/courses/[slug]` is no longer reachable to new buyers.
3. Confirm a student who purchased it earlier still has access.

## Scenario 8 — Race: taken off sale mid-checkout (Edge Case, FR-013, research.md #5)

1. Start checkout for a for-sale course; before completing payment on Stripe's page, have staff take it off sale in another session.
2. Complete payment with a successful test card anyway.
3. Confirm the webhook marks the Purchase `error`, automatically refunds the charge, and the buyer is not enrolled.

## Scenario 9 — Staff view purchases and process a refund (US4, FR-011, FR-012)

1. As staff, open the purchase list and confirm Scenario 2's purchase is listed with correct student, course, amount, date.
2. Mark it refunded.
3. Confirm the Purchase's status updates, the Stripe test-mode charge shows refunded, and the student's access to that course is revoked.

## Scenario 10 — Credit wallet is unaffected (FR-015, SC-005)

1. Before Scenario 2, record the buyer's Core-sourced credit balances and session list from their dashboard.
2. After completing the purchase (and again after the refund in Scenario 9), confirm those balances and session list are byte-for-byte unchanged.
