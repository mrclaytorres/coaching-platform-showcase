# Feature Specification: Credit Watch Data Fallback (Interim)

> Sanitized example of a real spec from this project. Client names, endpoints and internal
> paths are replaced with generic ones; structure and content follow the original.

**Feature Branch**: `011-credit-watch-fallback`
**Status**: Implemented (final end-to-end quickstart run still open, T017)

**Input**: "We don't have the aggregate credit-watch endpoint from the legacy API yet. Can we
build a per-student pull that feeds the Credit Watch page instead? Right now the page only shows
a generic 404 error. I want it to show some real data."

## User Scenarios & Testing

### User Story 1: See real negative balances instead of an error (Priority: P1)

A staff member opens Credit Watch and, instead of the "Not Found" error, sees a "Negative
balances right now" list built from every student the platform already knows about, using each
student's real, current balance.

**Why this priority**: The page is unusable today. Even a partial, accurate list makes it usable
again and serves its original purpose: flagging students who need follow-up.

**Independent Test**: Open Credit Watch and confirm the list shows every known student with a
negative balance in any lesson type, with the same balance shown on that student's own account
page, and no error message.

**Acceptance Scenarios**:
1. **Given** the aggregate source is unavailable, **when** staff open Credit Watch, **then** the
   page loads with real balance data and no error.
2. **Given** a student has a negative balance in one lesson type and a positive one in another,
   **then** only the negative balance appears as its own row.
3. **Given** staff already logged a manual credit adjustment for a student, **then** that row
   reflects the adjustment.
4. **Given** no known student has a negative balance, **then** an empty state is shown, not an
   error.

### User Story 2: See likely at-risk sessions, marked as an estimate (Priority: P2)

Staff also see an "Upcoming sessions at risk" list of known students with a session coming up
and a balance too low to cover it, clearly labeled as an estimate.

**Why this priority**: Catching a problem before the session is worth more than cleaning up
after, but the per-student data lacks some fields, so this list is lower confidence than Story 1.

**Acceptance Scenarios**:
1. **Given** a known student has a session in the look-ahead window and a balance too low to
   cover it, **then** the session appears, labeled as an estimate.
2. **Given** the look-ahead window changes, **then** only sessions in the new window are shown.
3. **Given** renewal information isn't available from this source, **then** the row says so,
   rather than wrongly claiming "no active subscription."

### User Story 3: Know the data is partial (Priority: P2)

Staff can tell from the page itself that the list covers only students already known to the
platform, not every customer, so a clean list isn't mistaken for "nobody else is at risk."

**Why this priority**: Staff make financial decisions with this tool. Showing a partial list as
if it were complete could make them miss real students.

**Acceptance Scenarios**:
1. **Given** the fallback is active, **then** a plain-language note explains the limit and says
   the full view will return once the normal source is available.
2. **Given** the aggregate source works again, **then** the note disappears and the full list is
   shown.

### Edge Cases

- **No known students:** show the normal empty state, not an error.
- **A session with no lesson type:** the row still appears, with the lesson type shown as
  unknown.
- **One student's lookup fails:** show everyone else, plus a note saying how many couldn't be
  checked.
- **The aggregate source starts working:** switch back to it automatically.
- **The known-student list grows large:** the page shows a loading state rather than hanging.

## Requirements

- **FR-001**: Try the aggregate source first. Use the per-student method only when it fails.
- **FR-002**: Build the negative-balance list from the real balance of every known student.
- **FR-003**: Fallback balances MUST match the balance shown elsewhere in the app for that
  student, including manual adjustments.
- **FR-004**: Whenever the fallback is in use, show a plain-language note that the data is
  limited to known students.
- **FR-005**: If the fallback itself fails entirely, show a clear error, not a blank page.
- **FR-006**: Return to the aggregate source automatically once it's available, with no manual
  switch.
- **FR-007**: Never drop a student's row because one field is missing. Mark the field as
  unknown.
- **FR-008**: Include at-risk sessions, assuming each session costs 1 credit, and label every
  such row as an estimate.

## Success Criteria

- **SC-001**: While the aggregate source is down, staff see a working page with real data 100% of
  the time.
- **SC-002**: Every fallback balance matches that student's balance elsewhere in the app, with
  zero discrepancies.
- **SC-003**: Staff can tell from the page's wording alone that the view is partial.
- **SC-004**: The page loads in about the same time as it normally does.
- **SC-005**: Once the aggregate source is back, no fallback-only wording remains.

## Assumptions

- "Known students" means anyone with an account record on the platform. There's no way to list
  every customer from the legacy system until the aggregate endpoint exists.
- This is a temporary stand-in, to be removed once the aggregate endpoint ships.
- The known-student pool is small enough today that checking each student individually stays
  fast.
- The 1-credit-per-session estimate was confirmed during clarification: early warning is worth
  more than holding the list back.
