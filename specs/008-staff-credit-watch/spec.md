# Feature Specification: Staff Credit Watch Dashboard

**Feature Branch**: `008-staff-credit-watch`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "I want to create a Staff feature where I can manage student credits. So the Student's credit are pulled from Core's API endpoint. Based on this image, please create me a feature." (reference: `credit watch.png` — a staff-facing "Credit watch" dashboard showing upcoming sessions that would put a student below zero, and students currently at a negative balance)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spot upcoming sessions that will overdraft a student (Priority: P1)

A staff member opens Credit Watch and sees every scheduled session, across all students, coming up within a chosen look-ahead window that would leave the student with a negative credit balance once the session is debited — so staff can step in (top up credits, contact the student, adjust the booking) before it happens.

**Why this priority**: This is prevention rather than cleanup. Catching a shortfall before the session happens avoids a disrupted lesson and an awkward billing conversation after the fact — it's the highest-leverage, most time-sensitive use of this feature.

**Independent Test**: Can be fully tested by opening Credit Watch and confirming the "Upcoming sessions at risk" list contains only sessions inside the selected look-ahead window whose balance after debit is negative, each showing the student, lesson type, coach, current balance, and projected balance.

**Acceptance Scenarios**:

1. **Given** a student has fewer session credits than needed for a lesson type and has a session of that type scheduled within the look-ahead window, **When** staff open Credit Watch, **Then** that session appears in "Upcoming sessions at risk" with a negative projected balance.
2. **Given** staff change the look-ahead window (e.g., from 30 days to 7 days), **When** the view updates, **Then** only at-risk sessions occurring within the newly selected window are shown.
3. **Given** a scheduled session is between two coaches (no paying student involved), **When** the at-risk list is computed, **Then** that session is excluded from the list and the exclusion is noted (e.g., "N coach-to-coach sessions excluded").
4. **Given** no sessions in the current window are at risk, **When** staff view the list, **Then** an empty state is shown instead of an error or a stale/previous list.

---

### User Story 2 - Review students who are already in a negative balance (Priority: P2)

A staff member reviews a list of every student currently holding a negative credit balance for any lesson type, so they can follow up on accounts that are already overdrawn.

**Why this priority**: These shortfalls have already occurred — it's a real, current financial/account issue, but it's reactive rather than preventive, so it ranks just below the proactive at-risk view.

**Independent Test**: Can be fully tested by opening Credit Watch and confirming "Negative balances right now" lists every student with a negative balance for at least one lesson type, with the balance amount and renewal outlook shown per row.

**Acceptance Scenarios**:

1. **Given** a student has a negative balance in one lesson type, **When** staff view Credit Watch, **Then** that student's row appears in "Negative balances right now" showing the lesson type and the exact negative amount.
2. **Given** a student with a negative balance has no active recurring subscription, **When** staff view their row, **Then** the row indicates they have no active subscription rather than showing a renewal date.
3. **Given** a student with a negative balance has an active recurring subscription, **When** staff view their row, **Then** the row shows the next expected renewal date and the credit amount it would add.
4. **Given** a student has a negative balance in one lesson type but a positive balance in another, **When** the list is built, **Then** only the negative lesson-type balance appears as its own row (balances are never merged across lesson types).

---

### User Story 3 - Drill into one student's credit details (Priority: P3)

From either list, a staff member opens a focused view scoped to a single student to investigate their credit and session situation further before deciding what to do next.

**Why this priority**: This supports and extends the first two stories. The two aggregate lists already deliver value on their own (staff can see who needs attention); this story makes acting on that information faster.

**Independent Test**: Can be fully tested by clicking "Analyze" on any row in either list, confirming a view opens that is scoped to that one student's credits, sessions, and subscription status, and submitting a credit adjustment from that view.

**Acceptance Scenarios**:

1. **Given** staff are viewing either list, **When** they select "Analyze" on a row, **Then** a view scoped to that single student's credit situation opens.
2. **Given** staff are on a single student's detail view, **When** they look for context, **Then** they can see that student's balances across all lesson types, not just the one that triggered the row they came from.
3. **Given** staff are on a single student's detail view, **When** they submit a credit adjustment (amount, lesson type, and a reason), **Then** the student's displayed balance updates to reflect the adjustment and the adjustment is recorded with who made it, when, and why.
4. **Given** live write access to Core's API is not yet available, **When** staff submit a credit adjustment, **Then** the system clearly indicates the adjustment was applied to placeholder data only and has not been written back to Core's real records, so staff don't mistake it for a completed real-world change.

---

### Edge Cases

- What happens when Core's API is slow or unreachable while loading either list? Staff should see a clear loading/error state, not an empty list mistaken for "nothing at risk."
- What happens when the look-ahead window is changed to a value with zero at-risk sessions? The list shows an explicit empty state, and the summary count updates to 0.
- What happens when a session's assigned coach can't be determined? The row still appears with the coach shown as unknown, rather than being dropped from the list.
- What happens when a student has a renewal expected exactly at the boundary of "less than 14 days overdue"? It counts as covering (per the reference design's stated rule), consistent with how it applies elsewhere.
- What happens when the same student appears in both the at-risk list and the negative-balances list at the same time? Both entries are shown; they represent different situations (a future session vs. an already-negative balance) and aren't deduplicated.
- What happens when staff try to submit a credit adjustment without providing a reason, or with a zero-amount adjustment? The system rejects the submission and asks for the missing information rather than recording an empty or no-op adjustment.
- What happens when two staff members adjust the same student's balance around the same time? Each adjustment is recorded independently with its own audit entry; the displayed balance reflects all adjustments applied, in order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display, for authorized staff, a list of upcoming scheduled sessions — across all students — within a configurable look-ahead window whose projected credit balance after the session is debited would be negative ("at-risk sessions").
- **FR-002**: Staff MUST be able to change the look-ahead window between 7, 14, 30, and 60 days, defaulting to 30 days.
- **FR-003**: Each at-risk session row MUST show the student, lesson type, coach, session date/time, current balance, and projected balance after the session.
- **FR-004**: System MUST exclude sessions where neither participant is a credit-purchasing student (e.g., coach-to-coach sessions) from the at-risk list, and MUST show staff how many sessions were excluded.
- **FR-005**: System MUST display a list of every student currently holding a negative credit balance for any lesson type ("negative balances"), each row showing the student, lesson type, and current balance.
- **FR-006**: Each negative-balance row MUST show the student's next expected credit renewal (date and amount) if they have an active recurring credit subscription, or indicate they have no active subscription.
- **FR-007**: System MUST show summary counts at the top of the view — the number of at-risk sessions and the number of negative balances currently displayed.
- **FR-008**: System MUST distinguish, for each at-risk session, whether it is expected to be "covered by renewal" (an active subscription is expected to add sufficient credit before the session date, counting a renewal that is less than 14 days overdue) versus "unfunded" (no such coverage expected). This distinction is required for the first release, not deferred to a later one.
- **FR-009**: Staff MUST be able to open a focused detail view for a single student from either list, showing that student's balances across all lesson types.
- **FR-010**: System MUST restrict access to this feature to staff and super-admin roles; coach-role staff MUST NOT see this view (same `requireStaffRole` access-control pattern already used to restrict Tier management to non-coach roles).
- **FR-011**: System MUST source student credit balances, session schedules, and subscription/renewal data from Core's API rather than maintaining an independent copy of coaching-credit records.
- **FR-012**: All dates and times in this view MUST be displayed in UTC, independent of any individual student's own display-timezone preference used elsewhere in the portal.
- **FR-013**: Staff MUST be able to directly adjust (grant or deduct) a student's credit balance for a specific lesson type from within the student detail view, providing a reason for the adjustment.
- **FR-014**: System MUST record, for every credit adjustment, who made it, when, the amount and lesson type, and the reason provided, so adjustments are fully auditable.
- **FR-015**: Because live write access to Core's API for credit adjustments is not yet available, the system MUST apply adjustments to placeholder/mock data and MUST clearly and persistently indicate (wherever an adjusted balance is shown) that the adjustment has not been written back to Core's real records — staff must never be able to mistake a placeholder adjustment for a completed real-world change. This indicator MUST be removed once live write access is enabled.

### Key Entities *(include if feature involves data)*

- **Credit Balance**: A student's remaining usable credits for one specific lesson type, sourced from Core; can be positive, zero, or negative. Balances are tracked per lesson type and are never combined into one total.
- **At-Risk Session**: An upcoming scheduled session whose lesson-type credit balance is projected to go negative once that session is debited.
- **Recurring Coaching Subscription (Renewal)**: An active recurring payment arrangement expected to add credits to a student's balance on a periodic schedule. A renewal still counts toward covering a shortfall while it is less than 14 days overdue.
- **Coach**: The person assigned to deliver a session. Used to identify and exclude coach-to-coach sessions (which don't involve a credit-purchasing student) from the at-risk list.
- **Credit Adjustment**: A staff-recorded change to a student's balance for one lesson type — an amount, a required reason, who made it, and when. Applied on top of Core's reported balance until live write access to Core exists (see Assumptions), at which point it's expected to be written back to Core directly instead of held locally.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can identify every student at risk of a negative balance within a chosen look-ahead window from a single view, without manually cross-referencing each student's schedule and balance individually.
- **SC-002**: Staff can see the complete current list of negative-balance students in one view, with no negative balance omitted from the aggregate list.
- **SC-003**: Changing the look-ahead window updates the at-risk list without requiring staff to leave or reload the page.
- **SC-004**: Staff can move from either aggregate list to a single student's detail view in one action.
- **SC-005**: Staff report that reviewing credit risk across all students takes noticeably less time than the prior process of checking students one at a time.
- **SC-006**: Staff can resolve a flagged at-risk or negative-balance student (review their situation and record a credit adjustment) without leaving the Credit Watch feature.
- **SC-007**: Every credit adjustment made through this feature can be traced back to the staff member who made it, when, and why, with no unattributed adjustments.

## Assumptions

- Core's API will expose (directly, or via a new endpoint added for this purpose) the aggregate read data this feature needs — balances, upcoming sessions, and subscription/renewal status across all students at once. No such bulk endpoint is used anywhere in the Academy platform today (the existing integration fetches one student's snapshot at a time); this is a hard dependency for the first release, since renewal-coverage computation (FR-008) is required for v1, not deferred.
- Live write access to Core's API for credit adjustments does not exist yet and is a planned future capability, not something this feature builds itself. Until it's enabled, credit adjustments made through this feature are applied to placeholder/mock data only, clearly labeled as such (FR-015), so the adjustment workflow, UI, and audit trail can be built and validated ahead of real write access. Cutting the adjustment flow over to real Core writes is a tracked follow-up once that access exists.
- Access is limited to staff and super-admin roles, consistent with the existing `requireStaffRole` access-control pattern already used elsewhere in the portal (e.g., Tier management), excluding coaches.
- The "less than 14 days overdue still counts as covering" renewal rule shown in the reference design is the intended business rule and is carried forward unchanged.
- All times in this feature are shown in UTC, matching the reference design, regardless of each student's own display-timezone preference used elsewhere in the portal.
- The "Find customer" search bar and the "Schedule" / "Django admin" links visible in the reference screenshot belong to a different internal tool's shared navigation and are out of scope — only the Credit Watch page's own content (summary counts, at-risk sessions, negative balances, drill-down, adjustment) is covered by this specification.
- Historical/trend reporting on negative balances over time is out of scope for this feature; it reflects current, real-time state only.
