# Feature Specification: Credit Watch Data Fallback (Interim)

**Feature Branch**: `011-credit-watch-fallback`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "Since we don't have the /pull_credit_watch/ that we need from Core's API endpoint yet, can we instead create a single student pulling system that will feed the pool of the credit watch page? Right now the Credit Watch page only shows a generic 404 error. I want the page to show some initial data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See real negative balances instead of an error (Priority: P1)

A staff member opens Credit Watch today and, instead of the "Not Found" error currently shown, sees a working "Negative balances right now" list built from every student the platform already knows about (anyone who has logged into the student portal, been added through staff tools, or previously looked up by staff), using each student's real, current credit balance.

**Why this priority**: This is the core problem reported — the page is currently unusable (it shows a raw error) rather than simply incomplete. Even a partial, accurate list restores the page to a usable state and directly serves its original purpose of flagging students who need follow-up.

**Independent Test**: Open Credit Watch and confirm the "Negative balances right now" section lists every known student with a negative balance in any lesson type, with the same balance value shown elsewhere in the app for that student (e.g., their individual account snapshot), and that no error message appears.

**Acceptance Scenarios**:

1. **Given** the platform's normal aggregate credit-summary source is unavailable, **When** staff open Credit Watch, **Then** the page loads without displaying an error and instead shows real balance data for known students.
2. **Given** a known student has a negative balance in one lesson type and a positive balance in another, **When** the list is built, **Then** only the negative lesson-type balance appears as its own row, matching how the platform already displays balances elsewhere.
3. **Given** a staff member has already logged a manual credit adjustment for a student, **When** that student's row is shown, **Then** the row reflects the adjustment, consistent with how adjustments already affect the rest of Credit Watch.
4. **Given** no known student currently has a negative balance, **When** staff view the list, **Then** an empty state is shown rather than an error or a missing section.

---

### User Story 2 - See likely at-risk upcoming sessions, clearly marked as an estimate (Priority: P2)

A staff member also sees an "Upcoming sessions at risk" list, built the same way, that flags known students who have a session scheduled soon and a low or already-negative balance in that lesson type — giving staff an early warning, with a clear indication that it's an estimate until the platform's full aggregate source is available.

**Why this priority**: Early warning (catching a problem before the session happens) is more valuable than after-the-fact cleanup, but the underlying per-student data doesn't include everything the eventual full data source will provide, so this is a lower-confidence addition layered on top of Story 1's exact numbers.

**Independent Test**: Open Credit Watch and confirm "Upcoming sessions at risk" shows only known students with a session scheduled within the selected look-ahead window whose balance for that lesson type looks too low to cover it, with each row visibly labeled as an estimate.

**Acceptance Scenarios**:

1. **Given** a known student has a session scheduled within the look-ahead window and a balance too low to cover it, **When** staff view the list, **Then** that session appears, labeled as an estimate.
2. **Given** the look-ahead window changes, **When** the view updates, **Then** only sessions within the new window are shown, same as the balance list behaves today.
3. **Given** renewal/subscription information isn't available from this data source, **When** a row is shown, **Then** it's marked as having no renewal information available, rather than incorrectly stating "no active subscription."

---

### User Story 3 - Know the data is partial, not the full customer base (Priority: P2)

A staff member can tell, directly from the Credit Watch page, that the list they're looking at only covers students already known to the platform — not literally every customer in the coaching business — so they don't mistake a clean list for "confirmed nobody else is at risk."

**Why this priority**: Because this is a financial/account-health tool staff act on, silently showing a partial dataset as if it were complete could cause staff to miss real students who simply haven't interacted with the platform yet. This is a trust and safety requirement, tied in priority with Story 2 since it governs how confidently staff can rely on either list.

**Independent Test**: Open Credit Watch while the normal data source is unavailable and confirm a visible note states the data reflects only students already known to the platform and explains why, without staff needing to ask engineering.

**Acceptance Scenarios**:

1. **Given** the interim data source is active, **When** staff view Credit Watch, **Then** a visible, plain-language note explains the list is limited to already-known students and that the complete, company-wide view will return once the normal data source is available.
2. **Given** the platform's normal aggregate source becomes available again, **When** staff view Credit Watch, **Then** the note disappears and the page reflects the complete list, sourced the usual way.

---

### Edge Cases

- What happens when no students are known to the platform yet (empty pool)? The same empty state used when nothing is at risk is shown, not an error.
- What happens when a known student's session doesn't have a determinable lesson type? The row still appears, consistent with the existing rule of never dropping a row for missing detail, with the lesson type shown as unknown rather than guessed at.
- What happens if pulling data for one known student fails while others succeed? The page still shows results for every student that succeeded, with a small note about how many couldn't be checked, rather than the whole page failing.
- What happens once the platform's normal aggregate source starts working again? The page automatically returns to using it as the primary source; the interim, per-student method is used only when the normal source is unavailable.
- What happens when the number of known students grows large? The page should still load in a reasonable time; if it can't, staff see a loading state rather than the page hanging indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST attempt to load Credit Watch data from its normal aggregate source first, and only use the interim per-student method when that source is unavailable.
- **FR-002**: When using the interim method, system MUST build the "Negative balances right now" list from the real, current balance of every student already known to the platform (i.e., has an existing account record), per Story 1.
- **FR-003**: The interim method's negative-balance figures MUST match the balance already shown for that same student elsewhere in the app, including any manual credit adjustments staff have already logged.
- **FR-004**: System MUST visibly indicate, whenever the interim method is in use, that the data shown is limited to already-known students rather than every customer, in plain language staff can understand without asking engineering.
- **FR-005**: System MUST continue to show a clear loading/error message, not a blank or broken page, in the case the interim method itself fails entirely (e.g., no students could be checked).
- **FR-006**: System MUST return to showing the complete, normal dataset automatically once the platform's normal aggregate source becomes available again — no manual switch required.
- **FR-007**: System MUST NOT silently drop a known student from the list because one piece of their data (e.g., lesson type name, coach name) is missing or undetermined; the row still appears with the missing piece marked as unknown.
- **FR-008**: System MUST include an "upcoming sessions at risk" estimate in the interim method (Story 2), assuming each scheduled session costs 1 credit in its lesson type unless a more reliable per-session cost is available, and MUST visibly label every row built this way as an estimate.

### Key Entities *(include if feature involves data)*

- **Known Student**: A person the platform already has an account record for (via portal login, staff lookup, or test/demo setup) — the boundary of who this interim view can check.
- **Credit Balance**: A known student's current credit total for one specific lesson/session type, including any manual adjustments already on record.
- **Upcoming Session (at risk)**: A scheduled session for a known student whose lesson-type balance may not cover its estimated cost (assumed at 1 credit per session unless a more reliable cost is available), always shown labeled as an estimate.
- **Data Source Status**: Whether Credit Watch is currently showing the normal, complete dataset or the interim, partial one — drives the visibility note required by FR-004.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff who open Credit Watch while the normal data source is unavailable see a working page with real data, not an error message, 100% of the time.
- **SC-002**: Every negative balance shown in the interim view matches the same student's balance shown elsewhere in the app, with zero discrepancies.
- **SC-003**: Staff can correctly state, without asking engineering, that the interim view only covers already-known students — verified by a quick review of the page's own wording.
- **SC-004**: Credit Watch loads within a reasonable time (comparable to today's normal page load) for the current size of the known-student list.
- **SC-005**: Once the normal aggregate source is available, Credit Watch shows the complete dataset with no leftover interim-only wording or partial-data notes.

## Assumptions

- "Known students" means anyone the platform already has an account record for — portal users who've logged in, staff-seeded/test accounts, and any customer staff have already looked up through existing staff tools. There is currently no way to pull a list of every customer in the coaching business directly, so a fully complete list isn't possible until the normal aggregate source exists.
- This interim method is a temporary stand-in, not a permanent replacement — it's expected to be phased out once the platform's normal aggregate credit-watch source is delivered.
- Renewal/subscription information (used to tell staff a shortfall will "self-resolve" on its own) is not available from this interim method's data; any row that would normally show that will instead show that renewal information isn't available yet, rather than a possibly-wrong "no subscription" claim.
- The number of known students is currently small enough that checking each one individually stays fast; if that stops being true, the interim method's performance would need to be revisited (out of scope for this feature).
- Per-session cost for the at-risk estimate (Story 2, FR-008) is assumed to be 1 credit unless a more reliable per-session cost becomes available. This was confirmed as an accepted, clearly-labeled estimate rather than a blocker — early-warning value is preferred over withholding the list until the normal aggregate source exists.
