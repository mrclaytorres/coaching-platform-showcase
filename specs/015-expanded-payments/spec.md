# Feature Specification: Multi-Product Payments — Tiers, Lessons & Subscriptions

**Feature Branch**: `015-expanded-payments`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Now that all are in place and students can now create independent accounts. I want you to continue implementing the payment feature. It should accept all major payment methods, banks, paypal, google pay, applepay, etc. So a product would be tied up to a Tier, Course, Lesson or Subscription."

## Clarifications

### Session 2026-09-01

- Q: What should buying a single Lesson grant, given the current access model only knows Tier-sequence rank and whole-Course enrollment, with no per-lesson unlock? → A: A new, independent per-lesson access grant — buying one Lesson unlocks only that Lesson, regardless of whether the buyer owns the surrounding Course or has reached its Tier. Intended for a free-sample/preview-style upsell one step below a full Course purchase.
- Q: What should the recurring Subscription product grant access to, and what happens when it lapses (buyer cancels, or a renewal payment fails)? → A: One all-access plan that, while active, grants access to every Tier and every Course platform-wide, layered on top of (never replacing) whatever the buyer's own Tier rank and individual Course/Lesson purchases already grant. On lapse, access reverts to exactly what those individually-earned/purchased grants provide on their own — a lapsed subscription never revokes anything the buyer separately purchased or reached through progression.
- Q: Which payment methods must checkout actually offer? → A: Card, Apple Pay, and Google Pay (offered together as a single group — Apple Pay/Google Pay appear automatically as wallet options wherever card payment is offered, on supporting devices/browsers), plus PayPal, plus bank account debit. Bank debit is understood to take several business days to settle rather than clearing instantly like the others.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Configure Tiers, Lessons & the Subscription Plan for Sale (Priority: P1)

A staff member sets a price and turns on for-sale availability for a Tier (independent of any specific Course in it) or for an individual Lesson (as a preview/sample upsell), the same way they already do for a Course. Staff also set the single platform-wide Subscription plan's recurring price and turn it on or off for new signups. In every case, staff can change the price or take the item off sale later without affecting anyone who already has access through it.

**Why this priority**: Nothing beyond Course sales (already live) is sellable until Tiers, Lessons, and the Subscription plan can each be priced and published — this unlocks every other story below.

**Independent Test**: As staff, set a price and turn on for-sale for a Tier, a Lesson, and the Subscription plan; confirm each gets a reachable sales page/signup surface. Turn each off and confirm new buyers can no longer reach it while existing owners/subscribers are unaffected.

**Acceptance Scenarios**:

1. **Given** a Tier with no price set, **When** staff set a price and mark it for sale, **Then** that Tier's sales page becomes publicly viewable and purchasable, independent of any single Course's sales page.
2. **Given** a Lesson with no price set, **When** staff set a price and mark it for sale, **Then** that Lesson's sales page becomes publicly viewable and purchasable on its own, independent of its parent Course's price or for-sale status.
3. **Given** the Subscription plan has never been priced, **When** staff set its recurring price and turn it on, **Then** its signup page becomes publicly reachable.
4. **Given** a Tier, Lesson, or the Subscription plan currently for sale, **When** staff take it off sale, **Then** new buyers can no longer purchase/subscribe to it, but everyone who already owns/subscribed keeps their access.
5. **Given** a Tier or Lesson for sale, **When** staff change its price, **Then** new purchases use the new price while past purchases are unaffected.

---

### User Story 2 - Buyer Purchases a Tier Directly (Priority: P1)

A prospective or existing student views a Tier's own sales page — separate from any single Course's sales page — and buys entry into that Tier directly. Payment succeeds and their Tier-sequence rank is immediately enrolled or advanced to that Tier, unlocking it and every Tier below it in the same sequence, exactly as buying a Sequential-Locked Course in that Tier already does today.

**Why this priority**: Buying "the Tier" rather than having to pick one specific Course inside it is a core new purchase path this feature exists to add.

**Independent Test**: Open a Tier's sales page, complete a test purchase, and confirm the buyer's Tier rank reaches that Tier immediately, unlocking every Course in it and below.

**Acceptance Scenarios**:

1. **Given** a published, for-sale Tier, **When** a buyer views its sales page, **Then** they see the Tier's name, description, and price.
2. **Given** a buyer on a Tier's sales page, **When** payment succeeds, **Then** their Tier-sequence rank is enrolled/advanced to at least that Tier, immediately unlocking it and every Tier below it.
3. **Given** a buyer whose current Tier rank already meets or exceeds a Tier for sale, **When** they view that Tier's sales page, **Then** they see they already have access rather than being offered to buy it.
4. **Given** an active all-access Subscriber, **When** they view any Tier's sales page, **Then** they see they already have access rather than being offered to buy it.

---

### User Story 3 - Buyer Purchases a Single Lesson (Priority: P1)

A prospective or existing student views one Lesson's own sales/preview page and buys access to just that Lesson — without needing to own its Course or have reached its Tier. Payment succeeds and the buyer can immediately view that one Lesson's content, while the rest of its Course/Tier remains exactly as locked or unlocked as it was before.

**Why this priority**: This is a new, independent access dimension the platform has never had — a deliberately low-friction upsell entry point below a full Course purchase.

**Independent Test**: As a buyer with no access to a Lesson's Course or Tier, buy that Lesson directly and confirm only that Lesson becomes viewable, with the rest of its Course/Tier still locked.

**Acceptance Scenarios**:

1. **Given** a published, for-sale Lesson, **When** a buyer views its sales/preview page, **Then** they see the Lesson's title, its parent Course's name for context, and its price.
2. **Given** a buyer on a Lesson's sales page, **When** payment succeeds, **Then** they can immediately view that Lesson's content, regardless of whether they own its Course or have reached its Tier.
3. **Given** a buyer who purchased a Lesson but not its Course or Tier, **When** they try to view a different, unpurchased Lesson in the same Course, **Then** they remain blocked exactly as before the Lesson purchase.
4. **Given** a buyer who already owns a Lesson (bought individually, or through Course/Tier ownership, or through an active Subscription), **When** they view that Lesson's sales page, **Then** they see they already have access instead of being offered to buy it again.

---

### User Story 4 - Buyer Subscribes to the All-Access Plan (Priority: P1)

A prospective or existing student signs up for the platform's one recurring Subscription plan and, while it stays active, can access every Tier and every Course — on top of, not instead of, whatever they already own individually. If they cancel, or a renewal payment fails, their access reverts to exactly what their own Tier rank and individual purchases provide, and nothing they separately earned or bought is taken away.

**Why this priority**: The Subscription is the feature's other major new product type and its own primary purchase path (recurring revenue), independent of any one-time purchase.

**Independent Test**: As a buyer with no existing access anywhere, subscribe and confirm every Tier/Course becomes viewable immediately. Cancel (or simulate a failed renewal) and confirm access reverts to nothing (since none was separately owned).

**Acceptance Scenarios**:

1. **Given** the Subscription plan is for sale, **When** a buyer views its signup page, **Then** they see what it grants and its recurring price and billing interval.
2. **Given** a buyer completes Subscription signup and payment succeeds, **When** they browse the platform, **Then** every Tier and Course is accessible to them immediately, regardless of their own Tier rank or individual purchases.
3. **Given** an active Subscriber who also separately owns a specific Course or has reached a specific Tier on their own, **When** their Subscription later lapses (cancellation or failed renewal), **Then** they keep access to exactly what they separately own/reached, and lose access to everything else that only the Subscription was granting.
4. **Given** an active Subscriber, **When** they cancel, **Then** they are told clearly when their access will actually end (immediately, or at the end of an already-paid period) and are not silently re-charged afterward.
5. **Given** a Subscriber's renewal payment fails, **When** the failure occurs, **Then** the Subscription moves to a clearly-communicated past-due state and eventually lapses per the payment processor's standard retry schedule, without ever charging the buyer without a matching state they can see.

---

### User Story 5 - Buyer Pays With Their Preferred Method (Priority: P2)

A buyer completing any purchase or Subscription signup can pay with a card, Apple Pay, Google Pay, PayPal, or by debiting their bank account directly, choosing whichever is most convenient. A buyer who pays by bank debit is clearly told their payment will take a few business days to clear and that access begins once it does, rather than immediately.

**Why this priority**: Expands who can complete a purchase and how, but every purchase flow already works end-to-end with at least one payment method (Story 1's co-requisites) without this — it's a breadth improvement, not a blocker for the core flows.

**Independent Test**: Complete one purchase using a card, one using PayPal, and one using bank debit; confirm the first two grant access immediately on success and the third shows a "processing" state until the payment clears, then grants access.

**Acceptance Scenarios**:

1. **Given** any purchase or Subscription signup screen, **When** a buyer reaches payment, **Then** card, Apple Pay/Google Pay (where supported by their device/browser), PayPal, and bank debit are all offered as options.
2. **Given** a buyer pays by card, Apple Pay, Google Pay, or PayPal, **When** the payment succeeds, **Then** access is granted immediately, same as today's card-only flow.
3. **Given** a buyer pays by bank debit, **When** they complete the payment step, **Then** they see a clear "payment processing, access begins once cleared" state rather than an immediate success message.
4. **Given** a bank debit payment that later clears successfully, **When** it clears, **Then** access is granted automatically with no further buyer action.
5. **Given** a bank debit payment that later fails to clear, **When** it fails, **Then** no access is granted (or, if already granted in error, is revoked) and the buyer is clearly informed.

---

### User Story 6 - Student Reviews All Purchases & Subscription Status in One Place (Priority: P2)

A student can see everything they've bought — Tiers, Courses, and Lessons — alongside their current Subscription status (active, past-due, canceled, or none), each with date, amount, and status, in the same purchase history view that already exists for Courses.

**Why this priority**: Expected baseline commerce visibility once more product types exist, but not required for any individual purchase flow above to work.

**Independent Test**: As a student who has bought a Tier, a Lesson, and is subscribed, open purchase history and confirm all three appear correctly labeled by product type, with the Subscription's current status shown.

**Acceptance Scenarios**:

1. **Given** a student with purchases across multiple product types, **When** they open their purchase history, **Then** each entry clearly shows which product type it is (Tier, Course, or Lesson), its name, date, amount paid, and status.
2. **Given** a student with an active, past-due, or canceled Subscription, **When** they open their purchase history, **Then** they see its current status and, if active or past-due, when it next renews or will lapse.
3. **Given** a student with no purchases and no Subscription, **When** they open their purchase history, **Then** they see an empty state rather than an error.

---

### User Story 7 - Staff Review All Sales & Handle Refunds/Cancellations (Priority: P3)

Staff can see every purchase and Subscription across all product types (who bought/subscribed to what, when, for how much) and, when warranted, refund a one-time purchase (revoking that specific access) or cancel a Subscription on a buyer's behalf (revoking the all-access grant going forward, without refunding past payments).

**Why this priority**: Necessary for day-to-day operations and support, but every purchase path already delivers its core value without this — same lower-frequency operational priority as the existing Course refund capability.

**Independent Test**: As staff, open the sales list, locate a Tier purchase and a Subscription, refund the former and cancel the latter, and confirm each buyer's corresponding access is revoked appropriately.

**Acceptance Scenarios**:

1. **Given** staff with appropriate permissions, **When** they open the sales list, **Then** they see every purchase and Subscription across all product types, with buyer, product, date, amount, and status.
2. **Given** a completed Tier, Course, or Lesson purchase, **When** staff mark it refunded, **Then** its status updates to "refunded" and the buyer's access granted by that specific purchase is revoked, without affecting any other access they have.
3. **Given** an active Subscription, **When** staff cancel it, **Then** the buyer's all-access grant is revoked (immediately or at period end, matching the same buyer-facing timing as a self-service cancellation) without automatically refunding any already-collected payment.

---

### Edge Cases

- What happens if a buyer already has all-access through an active Subscription and views a Tier, Course, or Lesson sales page? Treated the same as already owning it outright — they are shown existing access, not offered to buy it again, and are not charged.
- What happens if the same buyer tries to purchase the same Tier, Lesson, or Subscription twice in quick succession (double-click)? Only one charge and one grant of access results, consistent with the existing Course purchase behavior.
- What happens if staff take a Tier or Lesson off sale while a buyer is mid-checkout? Access is never granted for that purchase; if the charge already succeeded before the system caught the change, it is automatically reversed and the buyer is informed — same guarantee as the existing Course purchase flow.
- What happens if a buyer attempts to reach a sales page for a Tier or Lesson that was never marked for sale, or for the Subscription plan before staff have priced it? The page is not reachable.
- What happens to a Lesson purchase if that Lesson is later unpublished or removed by staff? The purchase record and history are preserved, but viewable access is revoked along with the content itself, consistent with how removed Course content already behaves.
- What happens if a bank debit payment is reported as failed some time after the buyer was told it was "processing"? Access is not (or is no longer) granted, and the buyer is informed — treated the same as a chargeback for access purposes.
- What happens to a Subscriber's own separately-earned Tier rank or individually-purchased Courses/Lessons while their Subscription is active? Nothing changes about them — the Subscription only adds access on top; it never consumes, alters, or is required to preserve them.
- What happens if a Subscriber's renewal is retried after a failed payment and eventually succeeds? Their Subscription returns to active and all-access resumes with no separate action needed from staff or the buyer.
- What happens to the existing Core-sourced coaching-session credit wallet when any Tier, Lesson, or Subscription purchase occurs? It is completely unaffected, exactly as already guaranteed for Course purchases.
- What happens to a brand-new buyer's Academy account created during a Tier, Lesson, or Subscription checkout, if they later try to sign up again with the same email? Same existing-account protection as the Course purchase flow — they are directed to sign in rather than allowed to create a second account.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Staff (or coaches with appropriate permission) MUST be able to set a price on any Tier and mark it available for sale, independent of any single Course within it, making that Tier's own sales page publicly reachable.
- **FR-002**: Staff MUST be able to set a price on any Lesson and mark it available for sale as a standalone purchase, independent of its parent Course's own price or for-sale status.
- **FR-003**: Staff MUST be able to set a recurring price for the platform's single Subscription plan and turn it on or off for new signups.
- **FR-004**: Staff MUST be able to take any for-sale Tier or Lesson off sale, or turn off new Subscription signups, without revoking access already granted to existing owners/subscribers.
- **FR-005**: Each for-sale Tier MUST have a sales page displaying its name, description, and current price; each for-sale Lesson MUST have a sales page displaying its title, parent Course name, and current price; the Subscription plan MUST have a signup page displaying what it grants, its price, and its billing interval.
- **FR-006**: A Tier's, Lesson's, or the Subscription's sales/signup page MUST NOT be reachable while it is not marked for sale (or, for a Lesson, while its content is unpublished).
- **FR-007**: Upon a successful Tier purchase, the system MUST enroll the buyer into that Tier's sequence at that Tier (or advance their existing rank to it if lower) with no manual staff action, using the same Tier-rank grant already used for Sequential-Locked Course purchases (006-course-sales-payments FR-020).
- **FR-008**: Upon a successful Lesson purchase, the system MUST immediately grant the buyer access to that specific Lesson's content only, independent of their Tier rank or Course enrollment status, with no manual staff action.
- **FR-009**: Upon successful Subscription signup (and for as long as it remains active), the system MUST grant the buyer access to every Tier and every Course platform-wide, in addition to — never replacing or requiring the removal of — any access they separately hold through Tier rank, Course enrollment, or Lesson purchase.
- **FR-010**: When a Subscription lapses (buyer cancellation takes effect, or renewal payment ultimately fails after the payment processor's standard retry schedule), the system MUST revoke exactly the access the Subscription was granting, leaving every separately-earned or separately-purchased access grant (Tier rank, Course enrollment, Lesson purchase) completely intact.
- **FR-011**: The system MUST NOT charge a buyer, or grant/duplicate a Tier, Lesson, or Subscription grant, for something they already have access to — including access already covered by an active Subscription.
- **FR-012**: Checkout for every product type MUST offer, at minimum, card payment, Apple Pay/Google Pay (wherever the buyer's device/browser supports them), PayPal, and bank account debit.
- **FR-013**: A bank-debit payment MUST be clearly presented as "processing" rather than immediately successful, and access MUST only be granted once that payment actually clears — never optimistically before it does.
- **FR-014**: If a bank-debit payment fails to clear after initially being accepted for processing, the system MUST ensure no access is left granted from that payment, and MUST clearly inform the buyer.
- **FR-015**: When a declined, failed, or reversed payment occurs for any product type, the system MUST NOT grant or leave granted any access tied to that payment, and MUST show the buyer a clear, actionable message.
- **FR-016**: The system MUST record every purchase attempt and every Subscription state change (succeeded, declined, refunded, subscribed, past-due, canceled), including buyer, product type and identity, amount, and timestamps, for staff review and buyer receipts.
- **FR-017**: Students MUST be able to view their own purchase history covering all product types (Tier, Course, Lesson) and their current Subscription status in one place, each with clear product-type labeling, date, amount, and status.
- **FR-018**: Staff MUST be able to view a complete list of all purchases and Subscriptions across all buyers and all product types.
- **FR-019**: Staff MUST be able to mark a completed Tier, Course, or Lesson purchase as refunded, which immediately revokes exactly the access that purchase granted, without affecting any other access the buyer holds.
- **FR-020**: Staff MUST be able to cancel a buyer's Subscription, which revokes the buyer's all-access grant (on the same timing as a self-service cancellation) without automatically refunding any already-collected Subscription payment.
- **FR-021**: If a Tier or Lesson is taken off sale, or the Subscription plan is turned off, after a buyer begins checkout but before payment is confirmed, the system MUST NOT grant access for that attempt; if payment already succeeded before the system detected the change, it MUST be automatically reversed and the buyer clearly informed.
- **FR-022**: If access-granting fails after a successful one-time payment or Subscription-payment event, the system MUST either automatically complete the grant on retry/reconciliation or reverse the charge — a buyer must never be left charged without access and without a clear resolution path (same guarantee as 006-course-sales-payments FR-014, extended to every product type introduced here).
- **FR-023**: The existing coaching-session credit wallet system (sourced from Core's API) MUST NOT be read, written, or otherwise affected by any Tier, Lesson, or Subscription purchase, grant, refund, or cancellation.
- **FR-024**: All Tier, Lesson, and Subscription prices MUST be displayed and charged in US Dollars (USD), consistent with existing Course pricing.
- **FR-025**: A brand-new buyer with no prior CourseHost/Core relationship MUST be able to complete a Tier, Lesson, or Subscription purchase by creating a Academy account as part of checkout, on the same terms already established for Course purchases (006-course-sales-payments FR-017–FR-019), including being redirected to sign in instead of creating a duplicate account if their checkout email already belongs to an existing account.

### Key Entities

- **Tier Listing**: The for-sale state of an existing Tier — adds a price and a published/for-sale flag to the Tier entity, independent of any Course within it. Controls whether that Tier's own sales page is publicly reachable.
- **Lesson Listing**: The for-sale state of an existing Lesson — adds a price and a published/for-sale flag to the Lesson entity, independent of its parent Course's own listing. Controls whether that Lesson's sales page is publicly reachable.
- **Subscription Plan**: The platform's single recurring-billing product — a price, billing interval, and on/off-for-new-signups flag. Not tied to any specific Tier or Course; grants all-access while a buyer's Subscription against it is active.
- **Lesson Purchase**: A record of one buyer's grant of access to one specific Lesson, independent of any Tier rank or Course enrollment they do or don't have.
- **Subscription**: A record of one buyer's relationship to the Subscription Plan — captures its current status (active, past-due, canceled), renewal timing, and payment history. While active, it is an additional access grant layered on top of the buyer's own Tier rank and individual purchases; it never replaces or is required to preserve them.
- **Purchase** *(extended from 006-course-sales-payments)*: A record of one buyer's attempt to buy a Tier, Course, or Lesson — now additionally identifies which product type and which specific item was purchased, alongside the amount, payment outcome, and timestamps already captured for Course purchases.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A buyer can go from viewing a Tier, Lesson, or Subscription sales/signup page to having the access it grants in under 5 minutes for any instantly-clearing payment method, with zero manual staff intervention.
- **SC-002**: 100% of successful Tier, Lesson, and Subscription payments (via any instantly-clearing method) result in the buyer having the correct access within moments, without staff action.
- **SC-003**: 0% of declined, failed, or reversed payments across any product type or payment method result in the buyer being granted or keeping access, or being charged without a corresponding state visible to them.
- **SC-004**: 100% of Tier, Lesson, and Subscription sales, cancellations, and refunds are visible in the staff sales list within moments of occurring.
- **SC-005**: 100% of Tier, Lesson, and Subscription purchases leave existing students' credit-wallet balances, session data, and any separately-earned/purchased access completely unchanged (verified by before/after comparison).
- **SC-006**: A Subscriber whose Subscription lapses retains exactly the access their own Tier rank and individual purchases provide — verified by comparing their accessible content immediately before signup and immediately after lapse (with no intervening separate purchase or progression) being identical.
- **SC-007**: A staff member can take a Tier or Lesson off sale, or turn off new Subscription signups, and have the corresponding page stop accepting new buyers in under 1 minute, with zero impact to existing owners/subscribers.

## Assumptions

- Buyers may self-service cancel their own Subscription (taking effect at the end of the period already paid for, so they are never charged again without continuing access through that point), in addition to staff being able to cancel on a buyer's behalf — standard subscription-commerce practice, and not addressed by 006-course-sales-payments (which has no recurring product).
- The Subscription is a single, platform-wide plan at one price/interval for this version — per-Tier subscriptions, multiple subscription tiers, and free trials are out of scope and may be considered in a future iteration.
- A Lesson's sales page shows its parent Course's name for context only; buying a Lesson does not require or imply anything about that Course's own for-sale status or price.
- Coupon codes, discounts, promotional pricing, and proration for mid-cycle Subscription changes remain out of scope, consistent with 006-course-sales-payments.
- Taxes and accounting/tax-filing integration remain out of scope beyond what the payment processor provides natively, consistent with 006-course-sales-payments.
- Bank-debit payments are accepted for one-time Tier/Lesson purchases and for Subscription signup/renewal alike; the same "processing until cleared" handling applies in both cases.
- Refunding a one-time Tier, Course, or Lesson purchase and canceling a Subscription remain staff-initiated actions for revocation purposes (no self-service refund of money), even though self-service Subscription *cancellation* (stopping future renewal, per the assumption above) is supported.
- This feature builds directly on 006-course-sales-payments (Course purchase, native buyer accounts, purchase records, refund handling) and 014-independent-account-signup (native account creation) — those existing behaviors are unchanged except where explicitly extended above.
