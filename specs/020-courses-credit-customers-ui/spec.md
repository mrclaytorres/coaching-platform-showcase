# Feature Specification: Courses, Credit Watch & Customers UI Redesign

**Feature Branch**: `020-courses-credit-customers-ui`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Create a spec and implement these UI changes for the Courses, Credit, Customers pages." Mockups: Courses.png (landing page), "Courses - Sub Page - New Course.png", "Credit Watch.png", Customers.png.

## User Scenarios & Testing *(mandatory)*

<!--
  Four pages, three different starting points:
  - Courses landing page and New Course sub-page: already fully functional, this is close to a
    pure visual redesign (two real additions: a Price column and row-level Edit/Publish actions
    — both backed by data/actions that already exist, just not surfaced on this page yet).
  - Customers page: already fully functional search; the mockup adds a "Recent Lookups" table
    with no existing backing data (see Assumptions).
  - Credit Watch: the mockup is the biggest gap of the four — it adds two entirely new alert
    categories (expiring cards, failed payments) on top of the two that already exist (negative
    balance, low balance), and one of the two new categories has no real data source anywhere in
    this codebase today. See Assumptions for exactly what's built vs. explicitly descoped.
-->

### User Story 1 - Admin sees a redesigned Courses page with pricing and quick actions (Priority: P1)

A Super Admin or Staff Support member opens the Courses page and sees every course's price and
can edit or publish/unpublish it directly from the list, in the new card-based layout.

**Why this priority**: The most-visited of the four pages in this spec, and the one with the
clearest, lowest-risk functional addition (surfacing data that already exists on every course).

**Independent Test**: Load `/staff/courses`, confirm every course shows its real price (or "Not
for sale"), and confirm clicking Edit and Publish/Unpublish both work correctly from the list.

**Acceptance Scenarios**:

1. **Given** the Courses page loads, **When** the header renders, **Then** it shows a large
   "Courses" title, a one-line subtitle, and a "New Course" button (hidden for a Coach, matching
   today's existing restriction).
2. **Given** the table renders, **When** a course's price shows, **Then** a for-sale course shows
   its real price and a not-for-sale course shows "Not for sale" — never an invented price.
3. **Given** a published course's row renders, **When** the Actions column shows, **Then** it
   offers "Edit" (linking to that course's existing edit page) and "Unpublish"; **given** a draft
   course, **Then** it offers "Edit" and "Publish" instead — both using the course's real,
   current status, never both options shown regardless of state.
4. **Given** the Admin clicks "Unpublish" or "Publish", **When** the action completes, **Then**
   the course's status updates and the row reflects it immediately, using the existing
   `updateCourse` status toggle.

---

### User Story 2 - Admin sees a redesigned New Course page (Priority: P2)

A Super Admin or Staff Support member opens New Course and sees the existing Title/Slug/
Category/Tier form in the new card-based layout with a breadcrumb back to Courses.

**Why this priority**: Every field and the create action are already fully built — this is pure
visual redesign, the lowest-risk story in this spec.

**Independent Test**: Load `/staff/courses/new`, submit a new course, confirm it's created
exactly as it is today, just restyled.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the header renders, **Then** it shows a "Courses > New
   Course" breadcrumb and a large "New Course" title.
2. **Given** the Admin fills in Title/Slug/Category/Tier and clicks "Create Course", **When** the
   form submits, **Then** the course is created exactly as the current form already does —
   unchanged fields, unchanged validation, unchanged redirect.

---

### User Story 3 - Admin sees a redesigned Credit Watch page with alert categories (Priority: P1)

A Super Admin or Staff Support member opens Credit Watch and sees four alert-category counts at
a glance, can filter the list by category, and can act on each alert directly from the row.

**Why this priority**: The highest-value page of the four — it's where staff catch at-risk
students before they churn — but also the one with the most real data-reality gaps to resolve
correctly (see Assumptions), so it's appropriately scoped carefully rather than rushed.

**Independent Test**: Load `/staff/credit-watch` with at least one negative-balance and one
low-balance student; confirm both appear with correct counts, filter correctly by category, and
that "Add Credit" opens the right student's existing adjustment form.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the four stat cards render, **Then** they show counts for
   Negative Balance, Low Balance (0-1), Cards Expiring, and Failed Payments — each from real
   data where real data exists (Negative Balance, Low Balance, Failed Payments), and Cards
   Expiring always showing zero until a real data source exists (Assumptions).
2. **Given** the filter tabs render, **When** the Admin clicks a category tab, **Then** the table
   below shows only that category's alerts; "All Alerts" shows every category together.
3. **Given** a Negative Balance or Low Balance row renders, **When** the Admin clicks "Add
   Credit", **Then** they land on that student's existing Credit Watch detail page, where the
   real credit-adjustment form already lives.
4. **Given** a Failed Payment row renders (a declined purchase), **When** the Admin clicks "Retry
   Charge", **Then** they land on the existing Purchases page, where that purchase's record is —
   this spec does not add an automatic Stripe charge-retry capability (Assumptions).
5. **Given** no alerts exist in a selected category, **When** the Admin views that tab, **Then**
   the table clearly states there are none, rather than appearing broken or empty with no
   explanation.
6. **Given** the page loads, **When** the four alert categories finish rendering, **Then** the
   existing "upcoming sessions at risk" table (with its lookahead selector) still renders below
   them, unchanged from today (FR-015a).

---

### User Story 4 - Admin sees a redesigned Customers page (Priority: P2)

A Super Admin or Staff Support member opens Customers and sees the existing two lookup methods
(CourseHost/Core ID, email/name search) as two side-by-side cards, plus a list of recently-active
linked accounts.

**Why this priority**: Both lookup methods are already fully built; the one new element (a
lookups table) is a lower-stakes convenience addition, not core functionality.

**Independent Test**: Load `/staff/customers`, confirm both lookup forms work exactly as today,
and confirm the "Recent Lookups" table shows real, correctly-linked customer accounts.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the header renders, **Then** it shows a "Customers" title
   and the existing subtitle, with the two lookup forms as side-by-side cards.
2. **Given** the Admin enters a CourseHost/Core ID and clicks "Open", **When** the page navigates,
   **Then** it opens that customer's existing record page — unchanged from today.
3. **Given** the Admin searches by email/name and clicks "Search", **When** results render,
   **Then** they match exactly what the current search already returns — unchanged behavior.
4. **Given** the "Recent Lookups" table renders, **When** its rows show, **Then** they list real
   linked customer accounts (most-recently-active first) with a working "Open" link per row —
   not a true lookup-history log, which doesn't exist anywhere in this codebase (Assumptions).

---

### Edge Cases

- What happens when a course has never been priced (`priceCents` is null)? Treated the same as
  not-for-sale — shows "Not for sale," never a blank or "$NaN" price.
- What happens when the Admin clicks Publish on a sequential-locked course missing a required
  Tier? Unchanged from today — the existing `updateCourse` validation already governs this; this
  spec doesn't add or remove any validation.
- What happens when a student appears in both the Negative Balance and Low Balance categories at
  once (e.g., negative balance on one lesson type, low balance on another)? They appear once per
  qualifying row, not deduplicated across categories — each row is its own (student, lesson
  type, issue) combination, matching how the underlying data is already shaped today.
- What happens when zero linked customer accounts exist yet? "Recent Lookups" shows an empty
  state, not an error.

## Requirements *(mandatory)*

### Functional Requirements

**Courses page (Story 1)**

- **FR-001**: System MUST show a large "Courses" title, a one-line subtitle, and a "New Course"
  button (hidden for a Coach), matching the existing visibility rule.
- **FR-002**: System MUST show each course's title, category, tier, price, status, and
  Edit/Publish-or-Unpublish actions in a card-wrapped table.
- **FR-003**: System MUST show a for-sale course's real price and a not-for-sale (or unpriced)
  course as "Not for sale."
- **FR-004**: System MUST let the Admin toggle a course between Published and Draft directly
  from the list, using the existing status-update action, with the row's action label always
  matching its current real status.

**New Course page (Story 2)**

- **FR-005**: System MUST show a "Courses > New Course" breadcrumb and a large "New Course"
  title.
- **FR-006**: System MUST keep the existing Title/Slug/Category/Tier form and its create action
  functionally unchanged, inside the mockup's card layout.

**Credit Watch page (Story 3)**

- **FR-007**: System MUST show four stat cards — Negative Balance, Low Balance (0-1), Cards
  Expiring, Failed Payments.
- **FR-008**: System MUST compute Negative Balance and Low Balance from real per-student wallet
  data (the existing Credit Watch sweep); a wallet balance below zero counts as Negative Balance,
  a balance from zero to one inclusive counts as Low Balance.
- **FR-009**: System MUST compute Failed Payments from real declined purchases (the existing
  Purchases data).
- **FR-010**: System MUST show Cards Expiring as zero/empty until a real card-expiry data source
  exists — no fabricated card data (Assumptions).
- **FR-011**: System MUST show a filter tab row (All Alerts, Negative Balance, Low Balance,
  Expiring Cards, Failed Payments) that narrows the table below to the selected category.
- **FR-012**: System MUST show, per row, who's affected, the issue (as a colored pill), the
  relevant credit/amount figure, the relevant lesson type or product, when it was last active,
  and an action appropriate to that row's category.
- **FR-013**: System MUST link a Negative Balance or Low Balance row's "Add Credit" action to
  that student's existing Credit Watch detail page, where the real adjustment form lives — not a
  new inline action.
- **FR-014**: System MUST link a Failed Payment row's "Retry Charge" action to the existing
  Purchases page — this spec does not add a real charge-retry capability (Assumptions).
- **FR-015**: System MUST show a clear empty state for any category (or "All Alerts") with zero
  matching rows.
- **FR-015a**: System MUST keep the existing "upcoming sessions at risk" table (with its
  renewal-coverage calculation and 7/14/30/60-day lookahead selector) below the four mockup
  alert categories, unchanged in data/behavior — confirmed with the user rather than silently
  dropped (spec.md Assumptions).

**Customers page (Story 4)**

- **FR-016**: System MUST show a "Customers" title and the existing subtitle, with the
  CourseHost/Core ID lookup and the email/name search as two side-by-side cards, both functionally
  unchanged from today.
- **FR-017**: System MUST show a "Recent Lookups" table of real linked customer accounts
  (most-recently-active first), each row linking to that customer's existing record page — not a
  true per-staff-member lookup-history log, which doesn't exist anywhere in this codebase
  (Assumptions).

**Cross-cutting**

- **FR-018**: System MUST preserve every page's existing role gating exactly as it is today —
  this spec changes layout and data presentation only, never access control.
- **FR-019**: System MUST render every page's headings in the Anton display font already
  established for the Admin/Staff Dashboards and Booking area (specs/018, specs/019) — these
  four pages already sit under a layout that loads it (`src/app/staff/layout.tsx`), so no new
  font wiring is needed here.

### Key Entities

- **Credit Watch Alert Row** *(computed, not stored)*: Unifies the existing Negative Balance and
  Low Balance wallet data and the existing declined-Purchase data into one row shape per
  category, plus an always-empty Cards Expiring category (FR-010). Nothing in this feature adds
  a new table.
- **Recent Lookup Row** *(computed, not stored)*: The existing `customer_profiles` data
  (linked/native accounts only), ordered by recent activity — not a new lookup-history entity
  (FR-017).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Courses page, New Course page, Credit Watch page, and Customers page each
  visually match their mockup's layout, typography, and card structure, verified by side-by-side
  comparison.
- **SC-002**: Every price shown on the Courses page is either a course's real price or "Not for
  sale" — zero invented or placeholder prices, verified by spot-check against each course's
  actual `priceCents`/`isForSale` values.
- **SC-003**: Every Negative Balance, Low Balance, and Failed Payment alert shown on Credit Watch
  corresponds to a real student/purchase in the underlying data, with zero fabricated rows,
  verified by spot-check.
- **SC-004**: No existing functionality on any of the four pages (course creation, course status
  toggling, customer lookup by ID or search, credit adjustments, purchase refunds) regresses —
  every action available today still produces the same result after this redesign.

## Assumptions

- **"Included w/ Academy Live"-style pricing copy isn't reproduced literally.** `CourseSummary` has
  only `priceCents`/`isForSale` — nothing records which subscription/membership a non-for-sale
  course is bundled with. Resolved by showing "Not for sale" for any course that isn't
  independently purchasable (FR-003), rather than inventing a specific bundling claim this
  codebase has no way to verify.
- **Cards Expiring has no real data source anywhere in this codebase and is explicitly
  descoped from this feature.** Checking a customer's saved card for upcoming expiry means
  calling Stripe's Payment Methods API per customer and persisting/surfacing the result — a new
  integration, not something a UI redesign should silently add. The stat card and filter tab stay
  in the layout (matching the mockup's structure) but always show zero/empty (FR-010) until a
  future feature builds that integration — same treatment as specs/018's "Book Coaching" (no
  underlying capability existed, so the UI pointed at the closest real surface instead of
  fabricating one).
- **Retry Charge is a link, not a real retry action.** Stripe doesn't support silently re-running
  a declined `PaymentIntent` — a real retry needs the customer to resubmit payment, not something
  staff can trigger unilaterally. "Retry Charge" links to the existing Purchases page (FR-014)
  instead of performing a fabricated server-side retry.
- **Failed Payments maps to the existing `declined` purchase status** (`src/lib/payments/
  purchases.ts`) — the closest, and only, real "payment failed" concept in this codebase. No new
  status or tracking is added.
- **Low Balance (0-1) is computed from the same per-student wallet sweep the existing Credit
  Watch fallback already performs** (`fetchCreditWatchFallback`, `src/lib/credit-watch/
  fallback.ts`) — today the primary Core endpoint this feature would otherwise use
  (`/pull_credit_watch/`) doesn't exist yet (`src/lib/types.ts`'s own comment confirms this), so
  every Credit Watch page load already runs on this fallback sweep in practice. Extending it with
  a second bucket (0 ≤ balance ≤ 1, not just < 0) is additive to code this app already owns and
  runs; the not-yet-built real Core contract would need the same extension whenever that
  endpoint ships, which is outside this codebase's control.
- **"Recent Lookups" shows recently-active linked accounts, not a true lookup-history log.** No
  per-staff-member "who looked up whom" tracking exists anywhere in this codebase, and adding one
  would mean a new audit table and a new write path on every lookup — real new scope, not a
  restyle. Resolved by substituting the closest honest equivalent: the existing, already-ordered
  `customer_profiles` list (FR-017) — same "substitute the closest real data instead of inventing
  a new table" resolution used for specs/018's Recent Activity panel.
- **"Membership" (the mockup's Credit Watch column showing names like "Academy Starter"/"Academy
  Live")** maps to the existing `lesson_type_name` field already shown on the current Credit
  Watch page — not a new per-customer subscription/membership concept, which doesn't exist in
  this codebase (the one real subscription plan, `src/lib/payments/subscription-plan.ts`, is a
  single platform-wide plan, not a per-customer named membership tier).
- **The mockup's four-category alert view supplements, rather than replaces, the current page's
  "upcoming sessions at risk" table.** Today's Credit Watch page has two sections: negative
  balances, and upcoming sessions that would go negative if attended (with its own renewal-
  coverage calculation and a 7/14/30/60-day lookahead selector, specs 008/011). The mockup shows
  neither that second section nor the lookahead control. **Confirmed with the user**: the
  redesigned page keeps the existing at-risk-sessions table, unchanged, as a fifth section below
  the four mockup alert categories — nothing currently visible to staff is lost. See FR-015a.
