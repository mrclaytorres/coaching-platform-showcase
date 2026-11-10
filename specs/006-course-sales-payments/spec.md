# Feature Specification: Course Sales Pages & Direct Payment Enrollment

**Feature Branch**: `006-course-sales-payments`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Now the current system rely heavily on CourseHost for Course creation and course sales pages. Now we want to change that and instead use the Academy platform for both course creation and course sales pages. We already have the initial course creation, now we need the initial Sales pages for these courses so that students can buy directly on Academy platform rather that relying on a 3rd party system like CourseHost. So now students will be able to buy the course through the Academy platform app, pay using integrated payment scheme/system and then have them enrolled to the courses. Of course the credit system for the assessment should still be there."

## Clarifications

### Session 2026-07-28

- Q: Which Course category is sellable through this feature — Standalone Courses only, Sequential-Locked (Tier) Courses only, or both? → A: Both. A Sequential-Locked Course purchase grants Tier-sequence access consistent with the platform's existing "current rank ≥ course's Tier" rule (enrolling the buyer into that Tier sequence at the entry Tier if not already enrolled, and advancing their rank to at least that course's Tier if it's lower) — unlocking that course and every Tier below it in the same sequence, exactly as if earned through assessment progression.
- Q: Must this feature support a brand-new buyer with no prior CourseHost/Core relationship (no existing `customer_id`), or is v1 scoped to existing Core-linked students only? → A: Both must be supported. The system must always continue supporting existing Core-linked students (sign in, buy, enrollment ties to their existing profile), *and* must additionally support a brand-new buyer who has no prior CourseHost/Core relationship creating a Academy account as part of checkout.
- Q: Is backfilling/importing pre-existing CourseHost purchases as Academy Purchase/Enrollment records in scope for this initial version? → A: Out of scope. This feature covers only purchases made going forward on the Academy platform; any CourseHost-era access a student already has continues to be handled outside Academy until a separate migration effort, if any.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buyer Purchases a Course Directly on Academy (Priority: P1)

A prospective or existing student browses a course's sales page on the Academy platform — seeing its description, curriculum outline, and price — and completes the purchase entirely within the Academy app, paying with a card (or other supported method) without ever being redirected to CourseHost. Immediately after payment succeeds, the student is enrolled and can start the course right away. This works the same way whether the buyer is an existing Core-linked student (already has a Academy account) or a brand-new buyer who has never had any relationship with CourseHost/Core and creates their Academy account as part of checkout.

**Why this priority**: This is the entire point of the feature — without a working buy-and-get-access flow, nothing else here has value. It replaces the core commerce function CourseHost currently performs.

**Independent Test**: Starting from a logged-out or logged-in state, open a course's sales page, complete a test purchase with a valid payment method, and confirm the student lands on that course's content with full access immediately after payment.

**Acceptance Scenarios**:

1. **Given** a published, for-sale course, **When** a buyer views its sales page, **Then** they see the course's title, description, curriculum outline, and price clearly displayed.
2. **Given** a buyer on a course's sales page, **When** they submit valid payment details and the charge succeeds, **Then** they are enrolled in the course and redirected to its content within the same session.
3. **Given** a buyer submits payment details that are declined or fail, **When** the failure occurs, **Then** they see a clear error message, are not enrolled, and are not charged, and can retry with a different payment method.
4. **Given** a buyer who already owns a course, **When** they revisit that course's sales page, **Then** they see that they already have access instead of being offered to buy it again.
5. **Given** a successful purchase, **When** it completes, **Then** the buyer receives an on-screen confirmation and a retrievable receipt/record of the transaction.
6. **Given** a logged-out buyer with no prior CourseHost/Core relationship, **When** they choose to buy a course, **Then** they can create a Academy account as part of the checkout flow and complete the purchase without needing any pre-existing customer record.
7. **Given** an existing Core-linked student who is signed in, **When** they buy a course, **Then** the purchase and resulting enrollment are tied to their existing account — they are never prompted to create a second, separate account.
8. **Given** a buyer purchasing a Sequential-Locked (Tier) course, **When** payment succeeds, **Then** their Tier-sequence rank is enrolled/advanced to at least that course's Tier, giving them access to that course and every Tier below it in the same sequence.
9. **Given** a buyer whose current Tier rank already meets or exceeds a Sequential-Locked course's Tier, **When** they view that course's sales page, **Then** they see they already have access rather than being offered to buy it (same as Scenario 4).

---

### User Story 2 - Student Reviews Their Purchases (Priority: P2)

A student who has bought one or more courses can see a list of everything they've purchased, along with each purchase's date, price paid, and access status, in one place in their account.

**Why this priority**: Once purchases exist, students need a way to confirm what they own and refer back to receipts — this is expected baseline commerce functionality but isn't required for the core buy flow to work.

**Independent Test**: As a student who has completed at least one purchase, open the purchase history view and confirm it lists that course with correct date and price.

**Acceptance Scenarios**:

1. **Given** a student with one or more completed purchases, **When** they open their purchase history, **Then** they see each purchase's course name, date, amount paid, and status.
2. **Given** a student with no purchases yet, **When** they open their purchase history, **Then** they see an empty state rather than an error.

---

### User Story 3 - Staff Configure a Course for Sale (Priority: P1)

A staff member (or coach with the appropriate permission) takes an existing course — already created through the platform's course-creation tooling — and sets its price and marks it as available for sale, which publishes its sales page. They can later change the price or take the course off sale, which removes its sales page from public access without affecting students who already purchased it.

**Why this priority**: Nothing is sellable until it has a price and is explicitly published for sale — this is a co-requisite of User Story 1, not a nice-to-have. Ranked alongside US1 as core to the MVP.

**Independent Test**: As staff, set a price on an existing course and mark it for sale; confirm its sales page becomes publicly reachable. Then take it off sale and confirm the sales page is no longer reachable while previously-enrolled students keep access.

**Acceptance Scenarios**:

1. **Given** an existing course with no price set, **When** staff set a price and mark it for sale, **Then** the course's sales page becomes publicly viewable and purchasable.
2. **Given** a course currently for sale, **When** staff take it off sale, **Then** its sales page is no longer reachable by new buyers, but students who already purchased it retain their access.
3. **Given** a course for sale, **When** staff change its price, **Then** new purchases use the new price while past purchases are unaffected.

---

### User Story 4 - Staff Review Sales & Handle a Refund (Priority: P3)

Staff can see a record of all course purchases (who bought what, when, for how much) and, when a refund is warranted, mark a purchase as refunded, which revokes that student's access to the course.

**Why this priority**: Necessary for running the business day-to-day (support requests, accounting, disputes), but the platform delivers its core value (selling and granting access) without it — refunds are a lower-frequency operational need.

**Independent Test**: As staff, open the sales/purchase list, locate a specific purchase, mark it refunded, and confirm the student's access to that course is revoked.

**Acceptance Scenarios**:

1. **Given** staff with appropriate permissions, **When** they open the purchase list, **Then** they see every purchase with student, course, date, amount, and status.
2. **Given** a completed purchase, **When** staff mark it refunded, **Then** the purchase's status updates to "refunded" and the student's access to that course is revoked.
3. **Given** a refunded purchase, **When** the student attempts to access that course's content, **Then** they are denied access, consistent with never having purchased it.

---

### Edge Cases

- What happens if a buyer's payment succeeds but the enrollment step fails immediately after (e.g., a transient system error)? The student must not be left charged without access — the system must reconcile this so the student ends up enrolled, or the charge is automatically reversed and the buyer is clearly informed.
- What happens if the same buyer tries to purchase the same course twice in quick succession (e.g., double-clicking "Buy")? Only one charge and one enrollment must result.
- What happens if staff take a course off sale while a buyer is mid-checkout on its sales page? Access is never granted for that purchase; if the charge already succeeded before the system caught the change, it is automatically refunded and the buyer is informed the course is no longer available for purchase.
- What happens if a buyer attempts to reach a course's sales page for a course that was never published or never marked for sale? The sales page is not reachable, consistent with how unpublished course content is already hidden from students.
- What happens to a student's in-progress lesson completions, quiz answers, or assessment history if their purchase is later refunded? That history is preserved for record-keeping, but access to view/continue it is revoked along with course access, consistent with how removed course content already behaves (see 004-course-lesson-management's edge cases).
- What happens if a payment is disputed by the buyer's bank (a chargeback) rather than refunded through the platform? It is treated the same as a staff-initiated refund for access purposes — access is revoked — with the dispute itself handled through the payment processor's existing tooling, not rebuilt in Academy.
- What happens to a student's existing coaching-session credit wallet (sourced from Core's API) when they purchase a course? It is completely unaffected — course purchases neither consume nor grant session credits, and the credit/session-booking system continues operating exactly as it does today.
- What happens to a student who already has access to a course because they bought it through CourseHost before this feature existed? Out of scope for this version — this feature only covers purchases made going forward on Academy; their existing CourseHost-era access continues to be handled outside Academy until a separate migration effort, if any.
- What happens if a brand-new buyer signs up during checkout using an email address that already belongs to an existing (Core-linked) student? The system must not create a second, conflicting account — the buyer is told an account already exists for that email and directed to sign in instead of completing checkout as a new account.
- What happens if a buyer purchases a Sequential-Locked course whose Tier is lower than a Tier they've already reached? Treated the same as already owning a course (FR-007) — they already have access via their current rank, so they are not charged or offered the purchase.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Staff (or coaches with appropriate permission) MUST be able to set a price on an existing course and mark it as available for sale, which makes that course's sales page publicly reachable. This applies to both Standalone Courses and Sequential-Locked (Tier) Courses.
- **FR-002**: Staff MUST be able to take a course off sale, which removes its sales page from public reachability without revoking access for students who already purchased it.
- **FR-003**: Each for-sale course MUST have a sales page displaying its title, description, curriculum outline, and current price.
- **FR-004**: A course's sales page MUST NOT be reachable if that course is not published or not currently marked for sale.
- **FR-005**: Buyers MUST be able to complete payment for a course entirely within the Academy platform, without being redirected to CourseHost or any other third-party storefront.
- **FR-006**: Upon a successful payment, the system MUST automatically enroll the buyer in the purchased course with no manual staff action required.
- **FR-007**: The system MUST NOT charge a buyer or grant/duplicate access for a course they already own.
- **FR-008**: When a payment is declined or fails, the system MUST NOT enroll the buyer and MUST show a clear, actionable error allowing retry.
- **FR-009**: The system MUST record every purchase attempt's outcome (succeeded, declined, refunded) along with the student, course, amount, and date, for staff review and student receipts.
- **FR-010**: Students MUST be able to view their own purchase history, including course, date, amount paid, and status.
- **FR-011**: Staff MUST be able to view a complete list of all purchases across all students and courses.
- **FR-012**: Staff MUST be able to mark a completed purchase as refunded, which immediately revokes the student's access to that course while preserving their historical progress records (lesson completions, submissions, assessment results) for that course.
- **FR-013**: If a course is taken off sale after a buyer begins checkout but before payment is confirmed, the system MUST NOT grant access for that purchase. If the charge already succeeded before the system detected the change, it MUST be automatically reversed and the buyer clearly informed — the same "never charged without access or a clear resolution path" guarantee as FR-014.
- **FR-014**: If enrollment fails after a successful payment, the system MUST either automatically complete the enrollment on retry/reconciliation or reverse the charge — a buyer must never be left charged without access and without a clear path to resolution.
- **FR-015**: The existing coaching-session credit wallet system (sourced from Core's API) MUST NOT be read, written, or otherwise affected by any course purchase, enrollment, or refund in this feature.
- **FR-016**: Course prices MUST be displayed and charged in US Dollars (USD) for this initial version.
- **FR-017**: The system MUST support purchase by both an existing Core-linked student (signing in with their existing account) and a brand-new buyer with no prior CourseHost/Core relationship (creating a Academy account as part of checkout); a purchase must never require a buyer to already exist in Core's system.
- **FR-018**: A brand-new buyer's account MUST be fully usable to access their purchased course(s) immediately after purchase, independent of any data from Core's API — Core-sourced data (credits, sessions, activity) simply does not exist for that account and this MUST NOT block or degrade their course access.
- **FR-019**: A brand-new buyer signing up during checkout with an email address already used by an existing account MUST be prevented from creating a duplicate account and directed to sign in instead.
- **FR-020**: Purchasing a Sequential-Locked (Tier) Course MUST grant the buyer access consistent with the platform's existing Tier-rank access rule: the buyer is enrolled into that course's Tier sequence at the entry Tier if not already enrolled, and their rank is advanced to at least that course's Tier if their current rank is lower — unlocking that course and every Tier below it in the same sequence.

### Key Entities

- **Course Listing**: The for-sale state of an existing Course — adds a price and a published/for-sale flag to the Course entity already introduced in 004-course-lesson-management. Controls whether a sales page is publicly reachable. Applies to both Standalone and Sequential-Locked Courses.
- **Purchase**: A record of one buyer's attempt to buy one course — captures the buyer, course, amount charged, payment outcome (succeeded/declined/refunded), and timestamps. One completed Purchase is what grants access — either a Course Enrollment (Standalone) or a Tier-sequence rank enrollment/advancement (Sequential-Locked).
- **Course Enrollment**: Already exists (see 004-course-lesson-management's `course_enrollments` for Standalone Courses); this feature becomes its primary creation path for Standalone Courses — enrollment is granted automatically by a successful Purchase rather than only by direct staff action.
- **Buyer**: A person completing a purchase — either an existing Core-linked student (their existing account/profile) or a brand-new buyer with no prior CourseHost/Core relationship, who becomes a Academy account holder as part of checkout. Both are "students" once purchased; a brand-new buyer's account simply has no Core-sourced credit/session data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A buyer can go from viewing a course's sales page to having full access to that course's content in under 5 minutes, including payment, with zero manual staff intervention.
- **SC-002**: 100% of successful payments result in the buyer being enrolled without any staff action.
- **SC-003**: 0% of declined or failed payments result in the buyer being enrolled or charged.
- **SC-004**: 100% of course purchases, refunds, and their outcomes are visible in the staff purchase list within moments of occurring.
- **SC-005**: 100% of course purchases leave existing students' credit-wallet balances and session data unchanged (verified by comparing before/after snapshots).
- **SC-006**: A staff member can take a course off sale and have its sales page stop accepting new purchases in under 1 minute, with zero impact to already-enrolled students.

## Assumptions

- A brand-new buyer's Academy account is created with an identifier scheme independent of Core's numeric `customer_id` space (the exact mechanism is a technical decision for planning) — this feature only requires that such an account exists, is durable, and is usable, not that it be reconciled with Core's system in any way.
- Course purchases and refunds are out of scope for any accounting/tax-filing integration beyond what the chosen payment processor provides natively.
- Course pricing is a one-time, single payment per course for this initial version — payment plans, installments, subscriptions, and bundles are out of scope for v1 and may be considered in a future iteration.
- Payment processing is handled by a PCI-compliant third-party payment processor selected during technical planning; the Academy platform itself never stores raw card numbers.
- Taxes (e.g., sales tax/VAT) are out of scope for this initial version and are assumed to be handled by the payment processor's built-in tax tools if/when needed, not built by Academy.
- Refunds are staff-initiated through the platform's admin tooling in this version; there is no student-initiated self-service refund flow.
- Coupon codes, discounts, and promotional pricing are out of scope for this initial version.
- The existing course-creation tooling from 004-course-lesson-management is unchanged by this feature except for the addition of price and for-sale status.
