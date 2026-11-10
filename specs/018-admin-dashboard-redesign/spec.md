# Feature Specification: Admin Dashboard Redesign

**Feature Branch**: `018-admin-dashboard-redesign`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Replace the placeholder Admin Dashboard (apps/academy-platform/src/app/admin/dashboard/page.tsx — currently just two static nav-link cards) with a real, data-driven admin home page, per the attached mockup 'Admin Dashboard V1.1.png'. The sidebar itself is unchanged... This spec is scoped to the main content area only." Full mockup layout and the data-reality constraints discovered during scoping are captured below.

## User Scenarios & Testing *(mandatory)*

<!--
  Today, /admin/dashboard is a bare placeholder (a title, a one-line subtitle, and two static
  link cards to Credit Watch and Customers) — it surfaces no live data at all. Every story below
  replaces or adds to that page; none of them touch the sidebar, which already matches the
  mockup and is out of scope here.
-->

### User Story 1 - Admin sees the academy's current state at a glance (Priority: P1)

An Admin opens the dashboard and immediately sees four key numbers — how many students are active, how many staff are active, how many sessions are happening today, and how many coaching questions are waiting on a reply — without navigating anywhere else first.

**Why this priority**: This is the core promise of a "dashboard" — a single glance that answers "is everything running normally today?" Every other story adds detail on top of this; without it, the page is still just a navigation hub.

**Independent Test**: Can be fully tested by loading the dashboard as a Super Admin and confirming all four numbers match what's independently visible on the Students, Staff, Booking, and Ask a Coach inbox pages for the same moment in time — delivers standalone value even with nothing else on the page built yet.

**Acceptance Scenarios**:

1. **Given** the Admin Dashboard loads, **When** the Active Students card renders, **Then** it shows the current count of active students and how that count has changed since the end of the prior calendar month.
2. **Given** the Admin Dashboard loads, **When** the Active Staff card renders, **Then** it shows the current count of active staff, split into coaches and everyone else.
3. **Given** the Admin Dashboard loads, **When** the Bookings Today card renders, **Then** it shows how many confirmed one-on-one/group sessions and how many confirmed workshop sessions are scheduled for the current calendar day across every coach.
4. **Given** the Admin Dashboard loads, **When** the Awaiting Review card renders, **Then** it shows the count of open Ask a Coach conversations with no coach reply yet, split into how many have been waiting long enough to count as priority and how many haven't (FR-013).

---

### User Story 2 - Admin sees growth trends without leaving the dashboard (Priority: P1)

An Admin looks at two simple charts — one showing the active-student count at the end of each of the last several months, one showing how many new students joined each of those months — to understand whether the academy is growing.

**Why this priority**: Pairs with Story 1 as the other half of "state of the business at a glance" — a point-in-time count answers "where are we," this answers "which direction are we headed." Equally foundational, independently valuable even before any of the operational panels below exist.

**Independent Test**: Can be fully tested by loading the dashboard and confirming the chart values match a manual count of active/new `customer_profiles` rows bucketed by month — delivers standalone value independent of every other story.

**Acceptance Scenarios**:

1. **Given** the Admin Dashboard loads, **When** the Student Growth chart renders, **Then** it shows the active-student count at the end of each of the last 6 calendar months, with a badge showing the percent change from the second-to-last month to the last.
2. **Given** the Admin Dashboard loads, **When** the New Enrollments chart renders, **Then** it shows how many new students joined in each of the last 6 calendar months, with the most recent month visually highlighted and a badge showing the percent change from the prior month.

---

### User Story 3 - Admin triages today's bookings from one place (Priority: P2)

An Admin sees a list of today's upcoming sessions — who, with which coach, at what time, and whether it's confirmed — without opening the full booking calendar, and can jump to the full calendar when they need more.

**Why this priority**: Operationally useful day-to-day, but the academy runs fine without it since the full Admin Master Calendar (specs/017-live-coaching) already provides this same data in more depth — this is a convenience view, not a new capability.

**Independent Test**: Can be fully tested by confirming several bookings for today across different coaches, loading the dashboard, and confirming the list matches what the Admin Master Calendar shows for today — delivers standalone value independent of every other panel.

**Acceptance Scenarios**:

1. **Given** one or more bookings are confirmed for today, **When** the Admin Dashboard loads, **Then** the Upcoming Bookings panel lists each one with the student's name, the coach's name, the start time, and its status, soonest first.
2. **Given** more bookings exist today than the panel shows at once, **When** the Admin views the panel, **Then** it indicates how many more exist and links to the full Admin Master Calendar.
3. **Given** no bookings are confirmed for today, **When** the Admin Dashboard loads, **Then** the panel clearly states there are none rather than appearing broken or empty with no explanation.

---

### User Story 4 - Admin triages the coaching-question backlog from one place (Priority: P2)

An Admin sees the oldest unanswered Ask a Coach questions, which ones have been waiting long enough to be urgent, and can assign a batch of them to a coach in one action — without opening the full Ask a Coach inbox first.

**Why this priority**: Surfaces a real operational risk (a question going unanswered too long) that today has no dashboard-level visibility at all — genuinely new value, not just a convenience view of something that already exists elsewhere, which is why it ranks above Story 3 despite being built after it.

**Independent Test**: Can be fully tested by leaving several Ask a Coach conversations unanswered for varying lengths of time, loading the dashboard, confirming the oldest ones appear with correct wait times and priority flags, assigning a batch to a coach, and confirming that coach's inbox now shows them as assigned — delivers standalone value independent of every other panel.

**Acceptance Scenarios**:

1. **Given** one or more Ask a Coach conversations have no coach reply yet, **When** the Admin Dashboard loads, **Then** the Review Queue panel lists the oldest-waiting ones first, each showing the student's name, the conversation's first message as a preview, and how long it's been waiting.
2. **Given** a conversation has been waiting longer than the priority threshold (FR-013), **When** it appears in the Review Queue, **Then** it is visually flagged as priority; conversations waiting less than that are not.
3. **Given** the Admin selects one or more queued conversations and a coach to assign them to, **When** they confirm the bulk assignment, **Then** each selected conversation's assigned coach is updated and it no longer counts toward the Awaiting Review total for unassigned items.
4. **Given** more unanswered conversations exist than the panel shows at once, **When** the Admin views the panel, **Then** it indicates how many more exist and links to the full Ask a Coach inbox.

---

### User Story 5 - Admin spots credit-risk students without leaving the dashboard (Priority: P3)

An Admin sees which students have credits expiring soon or already have a negative balance, surfaced directly on the dashboard, and can jump to the full Credit Watch page for details.

**Why this priority**: Purely a convenience surface over the existing, fully-functional Credit Watch feature (specs/008-staff-credit-watch, 011-credit-watch-fallback) — no new data or logic, just a summary view, so it ranks below stories that add genuinely new capability.

**Independent Test**: Can be fully tested by confirming the dashboard's Credit Watch panel shows the same top expiring-soon and negative-balance students as the full Credit Watch page for the same moment — delivers standalone value independent of every other panel.

**Acceptance Scenarios**:

1. **Given** one or more students have credits expiring within the Credit Watch feature's existing lookback window, **When** the Admin Dashboard loads, **Then** the Credit Watch panel lists the soonest-expiring ones with their name and expiration detail.
2. **Given** one or more students have a negative credit balance, **When** the Admin Dashboard loads, **Then** the panel lists them alongside the expiring-soon ones, each clearly labeled with its alert type.
3. **Given** more alerts exist than the panel shows at once, **When** the Admin views the panel, **Then** it indicates how many more exist and links to the full Credit Watch page.

---

### User Story 6 - Admin sees what just happened across the academy (Priority: P3)

An Admin sees a running feed of recent notable events — a session that was confirmed, a coaching question that got a reply, a student who reached a new tier — each with a relative timestamp, without checking each feature's own page separately.

**Why this priority**: The most purely informational, least operationally urgent panel — nothing breaks or goes unnoticed without it, since every event it surfaces is also visible on its own feature's page. Ranked alongside Story 5 as a lower-priority convenience addition.

**Independent Test**: Can be fully tested by performing one action in each covered category (confirm a booking, reply to an Ask a Coach conversation, advance a student's tier), loading the dashboard, and confirming all three appear in the feed in the correct order — delivers standalone value independent of every other panel.

**Acceptance Scenarios**:

1. **Given** a booking was confirmed, an Ask a Coach reply was sent, or a student advanced to a new tier within the feed's lookback window, **When** the Admin Dashboard loads, **Then** the Recent Activity panel lists each one as a single line with a relative timestamp ("8 minutes ago"), most recent first.
2. **Given** more events exist than the panel shows at once, **When** the Admin views the panel, **Then** it indicates there's more and links to a fuller activity view.
3. **Given** no qualifying events occurred within the lookback window, **When** the Admin Dashboard loads, **Then** the panel clearly states there's no recent activity rather than appearing broken or empty with no explanation.

---

### User Story 7 - Admin jumps straight into common actions and records (Priority: P4)

An Admin uses a search box to jump directly to a specific student's or staff member's record, or uses one of a few shortcut buttons to start a booking, invite a staff member, or create a new booking event — without first navigating through the sidebar.

**Why this priority**: Pure navigation convenience layered on top of pages that already exist and already work on their own — the lowest-risk, lowest-value-add piece, appropriate to build last.

**Independent Test**: Can be fully tested by searching for a known student and a known staff member and confirming each result link lands on that person's correct existing record page, then confirming each of the three action buttons lands on its correct existing page — delivers standalone value independent of every other story.

**Acceptance Scenarios**:

1. **Given** the Admin types part of a student's or staff member's name or email into the search box, **When** matching results appear, **Then** each result is labeled as a student or staff member and clicking it opens that person's existing record page.
2. **Given** no student or staff member matches the search text, **When** the Admin views the results, **Then** the box clearly states nothing matched rather than showing an empty, unexplained list.
3. **Given** the Admin clicks "Invite Staff" or "Create Booking", **When** the page navigates, **Then** it lands on the existing Invite Staff Member page or the existing New Booking Event page, respectively (FR-021).

---

### User Story 8 - Staff and Coaches get the same live dashboard, scoped to their role (Priority: P3)

*(Added 2026-10-08, after the initial Admin Dashboard build — the user asked for the same
redesign to extend to `/staff/dashboard`, the shared landing page every Staff Support, Coach,
and Super Admin account already lands on.)*

A Staff Support member, Coach, or Super Admin opens `/staff/dashboard` and sees the same kind of
live snapshot the Admin Dashboard gives a Super Admin — but scoped to what's actually relevant
and permitted for their role, not the full academy-wide view.

**Why this priority**: Reuses almost everything already built for Stories 1-7 — the value is in
scoping and reuse, not new data work, so it's appropriately mid-priority: meaningfully useful,
but not as foundational as the original Admin Dashboard cards/charts.

**Independent Test**: Log in as each of the three roles, confirm each sees exactly the
sections/data their role permits (per the Acceptance Scenarios below), and confirm every link on
the page lands on a page that role can actually open (no owner/admin-only or super_admin-only
dead ends).

**Acceptance Scenarios**:

1. **Given** a Coach opens `/staff/dashboard`, **When** the Bookings card and Upcoming Bookings
   panel render, **Then** both show only that Coach's own sessions today (as owner or co-host),
   labeled "My Bookings Today" — not every coach's.
2. **Given** a Staff Support member or Super Admin opens `/staff/dashboard`, **When** the same
   card/panel render, **Then** both show every coach's bookings today, same as the Admin
   Dashboard's equivalent.
3. **Given** any of the three roles opens `/staff/dashboard`, **When** the Awaiting Review card,
   Review Queue panel, and Recent Activity panel render, **Then** all three show the same
   org-wide data as the Admin Dashboard — no role-based restriction, since nothing already
   treats booking or coaching-question visibility as private between coaches.
4. **Given** a Coach opens `/staff/dashboard`, **When** the page renders, **Then** no Credit
   Watch panel appears — matching the existing restriction already applied to the Credit Watch
   and Customers links in the Staff sidebar (FR-010, spec 008-staff-credit-watch).
5. **Given** a Staff Support member or Super Admin opens `/staff/dashboard`, **When** the page
   renders, **Then** the Credit Watch panel appears, identical to the Admin Dashboard's.
6. **Given** any role opens `/staff/dashboard`, **When** they click "View my schedule" (or the
   equivalent "view all" link on the Upcoming Bookings panel) or "Create Booking", **Then** they
   land on `/booking/staff/schedule` or `/booking/staff/new` respectively — pages every one of
   the three roles here can already open, never the owner/admin-only Master Calendar or the
   super_admin-only Invite Staff page the Admin Dashboard's own buttons use.

---

### Edge Cases

- What happens when a student or staff account used in a dashboard count is deactivated mid-day? Deactivated accounts are excluded from "active" counts from the moment of deactivation; already-rendered page views are not expected to update live.
- What happens when two Admins both try to bulk-assign the same Review Queue conversations to different coaches at nearly the same time? The second assignment to complete wins (last write); neither Admin sees an error, consistent with how `assigned_coach_id` already behaves everywhere else it's edited today.
- What happens when a student appears in both the search results and is also the subject of a Review Queue or Credit Watch entry? Each panel/result is independent — the same person can legitimately appear in multiple places at once.
- What happens when the Ask a Coach side of the shared database is unreachable while the rest of the dashboard loads fine? The Awaiting Review card and Review Queue panel show a clear "couldn't load" state local to just those two elements; every other card/panel/chart on the page still renders normally (no single data source failing should blank the whole page).
- What happens when there is no booking, review-queue, credit-watch, or activity data at all (a brand-new academy)? Each panel shows its own empty state (Story 3 Scenario 3, Story 6 Scenario 3) rather than an error or a misleading zero with no context.

## Requirements *(mandatory)*

### Functional Requirements

**Snapshot & Trends (Story 1, 2)**

- **FR-001**: System MUST show, on the Admin Dashboard, the current count of active students and the change in that count since the end of the prior calendar month, expressed as both a raw number and a percentage.
- **FR-002**: System MUST show the current count of active staff, broken down into coaches and all other active staff roles.
- **FR-003**: System MUST show, for the current calendar day, the count of confirmed one-on-one/group bookings and the count of confirmed workshop bookings, across every coach.
- **FR-004**: System MUST show the count of open Ask a Coach conversations with no coach reply yet, split into priority and standard per FR-013.
- **FR-005**: System MUST show, as a chart, the active-student count at the end of each of the last 6 calendar months, with the percent change from the second-to-last to the last month.
- **FR-006**: System MUST show, as a chart, the count of new students who joined in each of the last 6 calendar months, with the most recent month visually distinguished and the percent change from the prior month.

**Upcoming Bookings (Story 3)**

- **FR-007**: System MUST list today's confirmed bookings across every coach, each showing the student's name, the coach's name, the start time, and the booking's status, ordered soonest-first.
- **FR-008**: System MUST cap the Upcoming Bookings panel's visible list at a fixed number, show how many additional bookings exist beyond that cap, and link to the existing Admin Master Calendar for the full list.

**Review Queue (Story 4)**

- **FR-009**: System MUST list the oldest-waiting open Ask a Coach conversations with no coach reply yet, each showing the student's name, a preview of the conversation's first message, and how long it has been waiting, ordered oldest-first.
- **FR-010**: System MUST visually flag a queued conversation as priority once it has been waiting longer than the threshold in FR-013, and must not flag conversations waiting less than that.
- **FR-011**: System MUST allow an Admin to select one or more queued conversations, choose a single coach, and assign all selected conversations to that coach in one action, using the conversation's existing assigned-coach field.
- **FR-012**: System MUST cap the Review Queue panel's visible list at a fixed number, show how many additional unanswered conversations exist beyond that cap, and link to the existing Ask a Coach inbox for the full list.
- **FR-013**: System MUST treat an open, unassigned Ask a Coach conversation as priority once it has been waiting more than 12 hours since its first message with no coach reply.

**Credit Watch (Story 5)**

- **FR-014**: System MUST show, on the Admin Dashboard, the soonest-expiring and negative-balance students from the existing Credit Watch feature's own data, each labeled with its alert type.
- **FR-015**: System MUST cap the Credit Watch panel's visible list at a fixed number, show how many additional alerts exist beyond that cap, and link to the existing full Credit Watch page.

**Recent Activity (Story 6)**

- **FR-016**: System MUST show a reverse-chronological feed of recent notable events limited to: a booking being confirmed, an Ask a Coach reply being sent to a student, and a student advancing to a new tier — each as one line with a relative timestamp.
- **FR-017**: System MUST limit the Recent Activity feed to events from within a fixed, recent lookback window and cap the number of visible entries, linking out when more exist within that window than are shown.

**Search & Quick Actions (Story 7)**

- **FR-018**: System MUST let an Admin search by partial name or email across both students and staff from the Admin Dashboard, and label each result as a student or a staff member.
- **FR-019**: System MUST navigate to that person's existing record page when a search result is selected (the existing Customer record page for a student, the existing Staff Accounts page for a staff member).
- **FR-020**: System MUST clearly indicate when a search returns no matches, rather than showing an empty, unexplained result list.
- **FR-021**: System MUST provide one-click navigation from the dashboard to the existing Invite Staff Member page and the existing New Booking Event page.

**Access & Reliability (cross-cutting)**

- **FR-022**: System MUST restrict the Admin Dashboard to the Super Admin role, matching every other page under the existing `/admin/*` route tree.
- **FR-023**: System MUST let each panel/card/chart on the dashboard fail independently — a data-source failure behind one element MUST show a localized error state for that element only, without preventing the rest of the page from rendering.

**Staff/Coach Dashboard (Story 8)**

- **FR-024**: System MUST show the same bookings-today card and panel on `/staff/dashboard` as the Admin Dashboard, scoped to only the logged-in Coach's own sessions (owner or co-host) when the viewer's role is Coach, and to every coach's sessions otherwise.
- **FR-025**: System MUST show the same Awaiting Review card, Review Queue panel, and Recent Activity panel on `/staff/dashboard` as the Admin Dashboard, unrestricted by role — Staff Support, Coach, and Super Admin all see the same org-wide data.
- **FR-026**: System MUST hide the Credit Watch panel on `/staff/dashboard` when the viewer's role is Coach, and show it (identical to the Admin Dashboard's) for every other role — matching the existing Credit Watch/Customers restriction already applied in the Staff sidebar.
- **FR-027**: System MUST route every link and quick action on `/staff/dashboard` to a page the viewer's role can actually open — never the owner/admin-only Master Calendar or the super_admin-only Invite Staff page the Admin Dashboard's own equivalents use.

### Key Entities

- **Dashboard Snapshot**: Not a stored entity — a computed, read-only view assembled at request time from existing data (`customer_profiles`, `staff_profiles`, `bookings`/`booking_time_slots`, Ask a Coach's `conversations`, the existing Credit Watch data, `student_tier_progress`). Nothing in this feature introduces new tables.
- **Review Queue Item**: An existing Ask a Coach `conversation` with no reply yet, viewed through a new lens (oldest-first, with a computed priority flag per FR-013) — not a new entity, and its existing `assigned_coach_id` field is reused as-is for FR-011's bulk assignment.
- **Recent Activity Entry**: Not a stored entity — synthesized at request time by reading each covered feature's own existing recent rows (bookings, Ask a Coach replies, tier-progress changes) and merging them by timestamp; no new activity-log table or write path is introduced by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Admin can assess the academy's current day-to-day state (active students/staff, today's bookings, the coaching-question backlog) without navigating away from the dashboard, in under 10 seconds of looking at the page.
- **SC-002**: Every number and chart value on the dashboard exactly matches what the corresponding full feature page (Students, Staff, Booking Master Calendar, Ask a Coach inbox, Credit Watch) shows for the same moment, with zero discrepancies under spot-check testing.
- **SC-003**: An Admin can assign a batch of waiting coaching questions to a coach in under 15 seconds, without leaving the dashboard.
- **SC-004**: An Admin can locate a specific student's or staff member's record via the dashboard search in under 10 seconds for a known name or email.
- **SC-005**: A failure in any single data source (e.g., Ask a Coach's database being briefly unreachable) degrades only the one or two dependent elements, never the rest of the page, verified under fault-injection testing.
- **SC-006**: A Coach, Staff Support member, and Super Admin each see the exact same page (`/staff/dashboard`) adapt correctly to their own role with zero cross-role data leakage (a Coach never sees another coach's booking details or the Credit Watch panel) and zero dead-end links, verified by logging in as each role.

## Assumptions

- **"Bookings Today" has no real "pending" state to show**: the existing booking system only ever has `confirmed` or `canceled` status — there is no pending/unconfirmed state, so the mockup's literal "6 confirmed · 2 pending" split isn't achievable as pictured. Resolved by splitting the count a different, real way instead: one-on-one/group sessions vs. workshop sessions (FR-003).
- **"Awaiting Review" means Ask a Coach, not Academy's own course-assignment submissions queue**: the mockup's example subjects ("Chest voice & power," "Breath support check") read as coaching questions, and Academy's own `/staff/submissions` queue already has its own dedicated page — this feature does not duplicate or merge the two.
- **Priority is a computed, time-based flag, not a manually-set one for v1**: waiting more than 12 hours with no reply (FR-013) is a reasonable starting threshold inferred from the mockup's own example wait times (its "priority" examples wait 18–26h; its non-priority example waits 4h) — no new UI or permission model for manually marking priority is in scope for this feature; a human can revisit the exact threshold or add manual override later without changing anything else here.
- **"Book Coaching" is not a new staff-initiated proxy-booking capability**: no such capability (a staff member booking a session on a student's behalf, running that student's own Tier/credit checks) exists anywhere in the codebase today, and building one is substantial, unrelated scope beyond a dashboard redesign. The "Book Coaching" quick action instead links to the existing Admin Master Calendar / Booking Events list — the closest existing staff-facing booking surface — not a new flow.
- **Recent Activity reads existing tables directly rather than writing to the shared `audit_log`**: `audit_log` only covers admin/settings-type actions today (role grants, booking-settings toggles, staff invites, branding) and several of the events this feature needs to show don't currently record who performed them — retrofitting audit writes into booking confirmation, Ask a Coach replies, and tier advancement is out of scope; the feed is assembled read-only from each feature's own existing timestamped rows instead.
- **The Review Queue cross-app read is a direct database query, not a new API call between the two apps**: `apps/academy-platform` and `apps/ask-a-coach` already share one Supabase project; this feature's admin dashboard reads Ask a Coach's `conversations` table directly via a service-role client, the same established pattern already used for the existing cross-app sidebar link (`getCrossAppLinks`).
- **"Active staff" counts every non-deactivated row in `staff_profiles`**, regardless of which app(s) that person actually uses — consistent with how the existing Staff Accounts page already counts staff.
- **Dashboard values are as-of-page-load, not live-updating** — an Admin refreshes the page to see newer data; no real-time/websocket updates are in scope for this feature.
- **Fixed display caps and lookback windows** (Upcoming Bookings, Review Queue, Credit Watch panel row limits; Recent Activity's lookback window) use the same kind of small, fixed defaults already established elsewhere in this codebase (e.g., existing list pages' pagination limits) — exact numbers are a planning-stage detail, not a spec-level one.
- **Story 8's role-scoping decisions are grounded in existing precedent, not new policy**: "Coach sees only their own bookings" mirrors the existing `listCoachSchedule`/`/booking/staff/schedule` convention (013-coach-session-booking) that a Coach's own schedule is personal while nothing restricts cross-coach visibility of schedules generally (`listAllUpcomingSlots` is already open to `['super_admin','staff','coach']`). "Credit Watch hidden from Coach" reuses the exact `role !== 'coach'` guard StaffSidebar already applies to the Credit Watch and Customers links. "Review Queue/Recent Activity are org-wide for everyone" follows from there being no existing restriction anywhere that treats booking or coaching-question visibility as private between coaches — Ask a Coach's own default (non-"assigned_only") visibility mode already shows a plain Coach every conversation, not just their own.
- **No search box on `/staff/dashboard`**: the Admin Dashboard's combined student/staff search exists because an Admin has nowhere else convenient to jump from; Staff Support already has a dedicated `/staff/customers` search page, and a Coach is restricted from customer lookup entirely (same guard as Credit Watch) — a half-feature search box wasn't worth adding here.
- **No growth charts or Active Students/Active Staff cards on `/staff/dashboard`**: those are academy-wide business metrics relevant to a Super Admin managing the whole operation, not to an individual Coach or Staff Support member's day-to-day — kept off this page to stay focused on what's actionable for those roles, consistent with the existing page's own (much lighter) prior scope.
