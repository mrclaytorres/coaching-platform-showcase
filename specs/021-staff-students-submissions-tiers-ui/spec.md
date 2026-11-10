# Feature Specification: Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign

**Feature Branch**: `021-staff-students-submissions-tiers-ui`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Improve the UI for Staff Dashboard, Staff, Students, Submissions, and Tiers to match the provided mockups: Staff Dashboard.png, Staff.png, Students.png, Submissions.png, Tiers.png. Keep this as its own spec."

## User Scenarios & Testing *(mandatory)*

<!--
  Five pages, continuing the card-based/Anton visual language from specs/018, 019, and 020.
  Staff, Submissions, and Tiers are close to pure restyles (each already has every underlying
  field/action the mockup shows). Students adds real stat cards, two of which have no exact
  real data source (see Assumptions). Staff Dashboard is the biggest story: its mockup
  supersedes the design built in specs/018 Story 8 (which was done without a real mockup to
  follow) with a genuinely different layout — stat cards + a shortcuts grid, not panels — so
  this spec replaces that page's content again, this time against real reference art.
-->

### User Story 1 - Staff sees a redesigned Staff Dashboard matching the real mockup (Priority: P1)

A Staff Support, Coach, or Super Admin opens their dashboard and sees four stat cards and a
"Shortcut" grid of four big navigation cards, replacing the panels-based layout built in
specs/018 (which had no real mockup to follow at the time).

**Why this priority**: The landing page every staff/coach/admin account sees first — now backed
by an actual mockup for the first time.

**Independent Test**: Load `/staff/dashboard` as each of the three roles; confirm the four stat
cards show correct, role-appropriate numbers and the Shortcut grid links all work.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the header renders, **Then** it shows a two-tone "Staff
   Dashboard" title, a "Welcome, [name]. You are logged in as **[Role]**" line, and a search box
   (students/staff, hidden for a Coach — same restriction as the Admin Dashboard's search,
   specs/018).
2. **Given** the four stat cards render, **When** a Coach is viewing, **Then** "My Sessions
   Today" shows only that Coach's own bookings (reusing specs/018's existing coach-scoping);
   **given** Staff Support or Super Admin is viewing, **Then** it shows every coach's bookings —
   unchanged scoping rule from specs/018 Story 8.
3. **Given** the stat cards render, **When** "Awaiting Review", "Credit Alerts", and "Active
   Students" show, **Then** they reuse the exact existing counts already built for the Admin
   Dashboard (specs/018) and Credit Watch (specs/020) — no new aggregation.
4. **Given** a Coach is viewing, **When** the page renders, **Then** the "Credit Alerts" stat
   card and the "Credit Watch" shortcut card are both hidden — same restriction already applied
   to Credit Watch elsewhere (specs/008, /018).
5. **Given** the "Shortcut" section renders, **When** its four cards show, **Then** they link to
   Credit Watch, Customers, Submissions, and Booking, each with its existing icon/description —
   Credit Watch hidden for a Coach per Scenario 4.

---

### User Story 2 - Admin sees a redesigned Staff Accounts page (Priority: P2)

A Super Admin opens Staff Accounts and sees the existing staff list — with instant search and
pagination added — in the new card-based layout.

**Why this priority**: Every field/action (role change, deactivate/reactivate) already exists;
this is mostly a restyle plus two small, low-risk client-side additions.

**Independent Test**: Load `/admin/staff`, search by name/email, page through results if there
are enough to paginate, and confirm role-change/deactivate/reactivate all still work exactly as
today.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the header renders, **Then** it shows a large "Staff
   Accounts" title, a subtitle, and an "Invite Staff Member" button (unchanged destination).
2. **Given** the Admin types into the search box, **When** results filter, **Then** only staff
   matching that name or email remain visible — instantly, with no page reload.
3. **Given** the Admin changes a staff member's role or deactivates/reactivates them, **When**
   the action completes, **Then** it behaves exactly as it does on the current page today.

---

### User Story 3 - Admin sees a redesigned Students page with real stat cards (Priority: P1)

A Super Admin or Staff Support member opens Students and sees four stat cards, a search box, a
CSV export, and the existing student list with instant search and pagination.

**Why this priority**: The highest-traffic of the remaining three pages, and the one with the
most real data-reality resolution needed (two of its four mockup stat cards have no exact
backing data — see Assumptions) — same careful-but-decisive treatment Credit Watch got in
specs/020.

**Independent Test**: Load `/admin/students`, confirm Total Students and New This Month match a
manual count, confirm Export CSV produces a real file, confirm search/pagination/Disable/Enable
all work.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the four stat cards render, **Then** "Total Students" and
   "New This Month" show real counts; "Active This Week" and "Avg Completion" show the closest
   honest substitute this codebase can support today, not a fabricated weekly-recency or
   completion figure (Assumptions).
2. **Given** the Admin types into the search box, **When** results filter, **Then** only
   students matching that name, email, or Academy ID remain visible instantly.
3. **Given** the Admin clicks "Export CSV", **When** the file downloads, **Then** it contains
   the full student list (not just the current page), matching what's shown in the table.
4. **Given** a student's status shows, **When** it renders, **Then** it shows Active or
   Inactive — the mockup's third state, "Suspended," has no real backing status in this
   codebase and isn't fabricated (Assumptions).
5. **Given** the Admin disables or enables a student, **When** the action completes, **Then** it
   behaves exactly as it does on the current page today.

---

### User Story 4 - Coach sees a redesigned Submissions queue (Priority: P2)

A Coach, Staff Support, or Super Admin opens Submissions and sees the pending/reviewed queue —
with a pending count badge, a priority flag for long-waiting submissions, and a search box — in
the new card-based layout.

**Why this priority**: A frequently-used coach workflow, but every underlying field/action
already exists; the one new element (a priority flag) is a small, well-precedented addition
(mirrors specs/018's Ask a Coach Review Queue priority flag).

**Independent Test**: Load `/staff/submissions`, confirm the Pending tab shows a correct count
badge, confirm a submission waiting longer than the priority threshold is flagged, confirm
Reviewed tab and search both work, confirm Review still opens the right submission.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the Pending tab renders, **Then** it shows a count badge
   (e.g., "Pending (5)") reflecting the real pending count.
2. **Given** a pending submission has been waiting longer than the priority threshold, **When**
   its row renders, **Then** it's flagged "Priority"; a more recently-submitted one is not
   (Assumptions — mirrors the Ask a Coach Review Queue's own time-based priority rule,
   specs/018).
3. **Given** the Admin types into the search box, **When** results filter, **Then** only
   submissions from matching students remain visible.
4. **Given** the Admin clicks "Review" on a row, **When** the page navigates, **Then** it opens
   that submission's existing review page — unchanged destination/behavior.

---

### User Story 5 - Admin sees a redesigned Tiers page (Priority: P3)

A Super Admin or Staff Support member opens Tiers and manages belt ranking order, pricing, and
sale status, all in the new card-based layout.

**Why this priority**: Every field and action here already exists and already works — pure
visual redesign, the lowest-risk story in this spec.

**Independent Test**: Load `/staff/tiers`, reorder a tier, update its pricing, create a new
tier, and confirm all three succeed exactly as they do today, just restyled.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the table renders, **Then** it shows each tier's order,
   name (with a "Sales Page" link when for-sale), pricing controls, and a delete action, all
   functionally unchanged from today, inside the mockup's card layout.
2. **Given** the "Add a Tier" section renders, **When** the Admin creates a new tier, **Then**
   it's created exactly as it is today.

---

### Edge Cases

- What happens when the Students or Staff search matches zero rows? A clear "no matches" state,
  not an empty, unexplained table.
- What happens when a submission has been reviewed — does it still show a Priority flag? No —
  the priority flag only applies to the Pending tab; a reviewed submission's wait time is no
  longer relevant.
- What happens when exporting Students CSV with an active search filter applied? The export
  includes the full unfiltered student list, matching this codebase's existing "export is
  independent of on-screen filtering" convention (specs/019's Sessions export works the same
  way).
- What happens on Staff Dashboard when a stat card's underlying data source fails (e.g., the
  Ask a Coach cross-app read for Awaiting Review)? Unchanged from specs/018 — that one card
  shows a localized error, the rest of the page still renders (FR-023, specs/018).

## Requirements *(mandatory)*

### Functional Requirements

**Staff Dashboard (Story 1)**

- **FR-001**: System MUST show a two-tone "Staff Dashboard" title, a "Welcome, [name]. You are
  logged in as [Role]" line, and a search box (hidden for a Coach).
- **FR-002**: System MUST show four stat cards — My Sessions Today (role-scoped per specs/018
  Story 8's existing rule), Awaiting Review, Credit Alerts (hidden for a Coach), Active
  Students — each reusing an existing function, no new aggregation.
- **FR-003**: System MUST show a "Shortcut" section with four large cards — Credit Watch (hidden
  for a Coach), Customers, Submissions, Booking — each linking to its existing page.
- **FR-004**: System MUST replace, not add to, the panels-based layout specs/018 Story 8 built
  for this page — this spec's mockup is the authoritative design going forward.

**Staff Accounts (Story 2)**

- **FR-005**: System MUST show a large "Staff Accounts" title, a subtitle, and an "Invite Staff
  Member" button, unchanged destination.
- **FR-006**: System MUST let the Admin instantly filter the staff list by name or email, with
  no page reload.
- **FR-007**: System MUST keep every existing action (role change, deactivate, reactivate)
  functionally unchanged.

**Students (Story 3)**

- **FR-008**: System MUST show four stat cards — Total Students and New This Month from real
  data; Active This Week and Avg Completion from the closest honest substitute available, never
  a fabricated figure (Assumptions).
- **FR-009**: System MUST let the Admin instantly filter the student list by name, email, or
  Academy ID, with no page reload.
- **FR-010**: System MUST provide an "Export CSV" button producing the full student list.
- **FR-011**: System MUST show a student's status as Active or Inactive only — "Suspended" isn't
  a real status in this codebase and isn't added as one (Assumptions).
- **FR-012**: System MUST keep the existing Disable/Enable action functionally unchanged.

**Submissions (Story 4)**

- **FR-013**: System MUST show a pending-count badge on the Pending tab.
- **FR-014**: System MUST flag a pending submission as "Priority" once it's been waiting longer
  than a fixed threshold (Assumptions) since submission, and must not flag a more recent one.
- **FR-015**: System MUST let the Admin instantly filter the visible queue by student name.
- **FR-016**: System MUST keep the existing Pending/Reviewed tabs and "Review" action
  functionally unchanged.

**Tiers (Story 5)**

- **FR-017**: System MUST keep every existing field and action (reorder, rename/sales-page link,
  pricing/for-sale toggle, delete, create) functionally unchanged, inside the mockup's card
  layout.

**Cross-cutting**

- **FR-018**: System MUST preserve every page's existing role gating exactly as it is today.
- **FR-019**: System MUST render every page's headings in the Anton display font already
  established (specs/018/019/020) — these pages already sit under layouts that load it, so no
  new font wiring is needed.

### Key Entities

- **Staff Dashboard Stat**: Not a new entity — reuses `getBookingsTodayStat`,
  `getAwaitingReviewStat`, `getActiveStudentsStat` (specs/018) and `getCreditWatchAlerts`'s total
  count (specs/020) as-is.
- **Submission Priority**: Not a stored field — computed at request time from
  `submittedAt` vs. now, mirroring specs/018's Ask a Coach priority flag (FR-014).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five pages visually match their mockup's layout, typography, and card
  structure, verified by side-by-side comparison.
- **SC-002**: Every stat card on Staff Dashboard and Students shows either a real, verifiable
  number or a clearly-substituted one per the documented Assumptions — zero fabricated figures.
- **SC-003**: Every existing action across all five pages (role change, deactivate/reactivate/
  disable/enable, submission review, tier CRUD/pricing) produces the same result after this
  redesign as it did before.
- **SC-004**: An Admin can find a specific staff member or student via the new search box in
  under 5 seconds for a known name.

## Assumptions

- **Staff Dashboard's new mockup supersedes specs/018 Story 8's design.** That earlier version
  was built without a real mockup (the request only covered the Admin Dashboard at the time) and
  used a panels-based layout (Upcoming Bookings, Review Queue, Recent Activity). This spec's
  mockup shows a different, more deliberate design (4 stat cards + a Shortcut grid) — treated as
  the authoritative replacement, not an addition alongside the old layout.
- **"3 confirmed · 2 pending" (My Sessions Today) has no real "pending" booking state**, same
  finding as specs/018/019 — resolved the same way: split by session category (1-on-1/group vs.
  workshop) using the existing `getBookingsTodayStat`, not a fabricated pending count.
- **"Active This Week" (Students) has no real weekly-recency data anywhere in this codebase** —
  `customer_profiles` has no last-login/last-session timestamp. Resolved by showing the real,
  already-tracked total active-student count under that label instead of a fabricated weekly
  figure — the same "closest honest substitute" resolution used for specs/018's Recent Activity
  and specs/020's Recent Lookups.
- **"Avg Completion" (Students) has no real aggregate anywhere in this codebase.**
  `lesson-completions.ts` only tracks one student's one lesson at a time — there's no existing
  academy-wide average-completion calculation, and building one means a new, non-trivial
  cross-student aggregate query, not a UI restyle. Shown as "—" rather than fabricated, same
  treatment as specs/020's Cards Expiring.
- **Students' "Suspended" status has no backing data** — `customer_profiles` only has a boolean
  `is_active`, no three-state status. The redesigned page shows Active/Inactive only (FR-011).
- **Submissions' priority threshold is a new, independent judgment call** (not reusing Ask a
  Coach's 12-hour threshold verbatim, since these are full course assignments reviewed on a
  different cadence than live chat) — a pending submission is flagged Priority once it's waited
  more than 24 hours, a reasonable starting default a human can revisit later without changing
  anything else here.
- **Students' "Export CSV" is new** — unlike specs/019's Sessions export, no students CSV
  export exists anywhere in this codebase today. Given the full student list is already loaded
  client-side for search/pagination (below), this is built as a client-side download (no new API
  route) rather than a server endpoint — the smallest, lowest-risk way to add it.
- **Staff/Students search and pagination are client-side**, not new server queries — both lists
  are already fetched in full on page load (small-to-medium academy-staff/student counts), so
  instant, no-reload filtering over already-loaded data is the simplest, lowest-risk way to match
  the mockup's live-search feel without adding a new paginated query shape.
