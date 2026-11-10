# Feature Specification: Admin Customer Console

**Feature Branch**: `009-admin-customer-console`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Build an Admin Customer Console: a staff-facing page where an admin can search and look up any Academy customer by email, name, or CourseHost/Core customer ID (not just customers who have linked their Academy portal account), and view that customer's full snapshot — credit wallets, upcoming/past sessions, and the activity ledger. From this console, staff can also record a manual credit adjustment for the customer, reusing the existing credit-adjustment stub-and-audit-log pattern from the Credit Watch feature (008-staff-credit-watch): the adjustment is logged with status 'placeholder' and does not write to Core, since live write access to Core doesn't exist yet. This is a new page, separate from Credit Watch's at-risk/negative-balance dashboard — Credit Watch stays scoped to flagged students; this console is for looking up any customer on demand."

**Note**: "Admin Customer Console" is this feature's planning name. Per Q2's resolution (staff, not just admins, get access) and research.md §2 (route placement), it ships as a `/staff/*` page — in-app it's labeled "Customers" in the staff sidebar, not "Admin Customer Console."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Look up a customer by ID and view their full snapshot (Priority: P1)

A staff member has a customer's CourseHost/Core ID (from a support ticket, an email, or another system) and needs to see everything about that customer's account in one place — their credit balances, upcoming and past sessions, and their full activity history — regardless of whether that customer has ever logged into the Academy portal.

**Why this priority**: This is the minimum viable console. It requires no new lookup capability beyond what already exists (fetching a snapshot by customer ID), and it already solves the core problem: staff currently cannot view an unlinked customer's account at all.

**Independent Test**: Enter a known CourseHost/Core customer ID for a customer who has never logged into the portal. Confirm their wallets, sessions, and activity ledger render, and that no "student" or "linked account" record is required for this to work.

**Acceptance Scenarios**:

1. **Given** a staff member on the Admin Customer Console, **When** they enter a valid CourseHost/Core customer ID and submit, **Then** the console displays that customer's credit wallets (with effective balances), upcoming and past sessions, and activity ledger.
2. **Given** a staff member enters a customer ID that does not exist in Core, **When** they submit, **Then** the console shows a clear "no customer found" state rather than an error page or a blank screen.
3. **Given** a located customer has never linked a Academy portal account, **When** their snapshot is displayed, **Then** the console shows their data normally and indicates they have no linked portal account, without treating this as an error.

---

### User Story 2 - Record a manual credit adjustment for a located customer (Priority: P2)

Having located a customer, a staff member needs to correct their credit balance (e.g., a manual grant, a refund-driven deduction) before Core write access exists, with the adjustment recorded as an auditable action rather than a silent edit.

**Why this priority**: This is the other half of the console's value — without it, staff can see a problem but not act on it from the same place. It depends on User Story 1 (a customer must already be located) and reuses the adjustment pattern already shipped in Credit Watch.

**Independent Test**: From a located customer's snapshot, submit a credit adjustment with a lesson type, signed amount, and reason. Confirm it appears immediately in that customer's effective balance and in their adjustment history, and confirm no write to Core is attempted.

**Acceptance Scenarios**:

1. **Given** a staff member is viewing a located customer's snapshot, **When** they submit a valid credit adjustment (lesson type, non-zero amount, non-empty reason), **Then** the adjustment is recorded, the customer's effective balance updates immediately to reflect it, and the adjustment appears in that customer's history.
2. **Given** a staff member submits an adjustment with a zero amount or an empty reason, **When** they submit, **Then** the console rejects the submission and no record is created.
3. **Given** a credit adjustment was already recorded for a customer via Credit Watch's existing per-customer view, **When** that same customer is located through this console, **Then** the existing adjustment appears in their history here too (one shared history, not two separate logs).

---

### User Story 3 - Find a linked customer without knowing their ID (Priority: P3)

A staff member only has a customer's name or email (e.g., from a support email or a phone call) and needs to find their account without already knowing their CourseHost/Core ID. This works for customers who have linked a Academy portal account; a customer who has never linked one is only reachable by direct ID (User Story 1) until a broader search capability exists.

**Why this priority**: High value but depends on a search capability beyond a direct ID lookup, and is not required to deliver the console's core value (Stories 1 and 2 already work for any customer once the ID is known).

**Independent Test**: Enter a linked customer's name or email into the search field. Confirm the matching customer (or a disambiguated list, if more than one match) leads to the same full-snapshot view as a direct ID lookup.

**Acceptance Scenarios**:

1. **Given** a staff member enters the full or partial email of a customer who has linked a portal account, **When** they submit, **Then** the console returns the matching customer(s) for selection.
2. **Given** a search by name matches more than one linked customer, **When** results are shown, **Then** each result is distinguishable (e.g., by email and ID alongside name) so staff can pick the right one.
3. **Given** a search matches no linked customer, **When** results are shown, **Then** the console shows a clear "no results" state that also reminds staff they can look up any customer directly by CourseHost/Core ID.

---

### Edge Cases

- A customer ID is well-formed but doesn't exist in Core at all (typo, or an ID from a different system) → "no customer found" state, not a crash or an unhandled error page.
- A located customer has zero wallets, zero sessions, and zero activity (e.g., a brand-new signup) → sections render as empty, not as errors.
- The underlying customer-data lookup fails or times out (Core unavailable) → a distinct error state is shown, never stale or blank data presented as current.
- A staff member submits an adjustment for a customer who turns out to have no matching lesson-type wallet on record → the adjustment is still recorded (matching Credit Watch's existing behavior) with the lesson type as entered.
- The same customer is reachable via this console and via Credit Watch's per-customer drill-down (e.g., a flagged student who's also searched directly) → both surfaces show the same balances and the same adjustment history, since they draw from the same underlying data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Staff MUST be able to locate a customer by entering their CourseHost/Core customer ID directly, without that customer needing a linked Academy portal account.
- **FR-002**: Staff MUST be able to search for a customer by email or name among customers who have linked a Academy portal account. Customers who have never linked a portal account are reachable only via direct CourseHost/Core ID lookup (FR-001) until a broader Core-wide search capability exists.
- **FR-003**: When a customer is located, the console MUST display their credit wallets (including effective balance — Core balance plus any recorded placeholder adjustments), their upcoming and past sessions, and their full activity ledger.
- **FR-004**: The console MUST clearly indicate when a located customer has no linked Academy portal account, without blocking access to their data.
- **FR-005**: The console MUST show a clear "no customer found" state when a search or ID lookup returns nothing, and a distinct error state when the underlying data lookup fails.
- **FR-006**: Staff MUST be able to record a manual credit adjustment for a located customer, specifying a lesson type, a signed credit amount, and a reason.
- **FR-007**: The console MUST reject an adjustment submission with a zero amount or an empty reason, and MUST NOT create a record for a rejected submission.
- **FR-008**: Every recorded adjustment MUST be persisted with its creator, timestamp, amount, reason, and a status indicating it has not been written to Core, and the system MUST NOT attempt any write to Core when an adjustment is recorded.
- **FR-009**: A customer's adjustment history and effective balance MUST be consistent regardless of whether the customer is viewed through this console or through Credit Watch's existing per-customer view — both MUST reflect the same underlying adjustment records.
- **FR-010**: Access to the Admin Customer Console MUST be restricted to staff with the `super_admin` or `staff` role, the same access level as Credit Watch. The `coach` role MUST NOT have access.
- **FR-011**: The Admin Customer Console MUST NOT change the scope of Credit Watch's existing at-risk/negative-balance dashboard — that dashboard continues to list only flagged students.

### Key Entities

- **Credit Adjustment** (existing entity, reused from 008-staff-credit-watch): an auditable record of a staff-initiated credit change for a customer — lesson type, signed amount, reason, creator, timestamp, and sync status. This console creates and displays the same records Credit Watch's per-customer view already creates and displays; no new adjustment data model is introduced.
- **Customer Snapshot** (existing external data, not stored by Academy): a customer's credit wallets, sessions, and activity ledger as reported by Core. This console displays the same snapshot data Credit Watch's per-customer view already displays, for any customer ID rather than only customers surfaced by Credit Watch's at-risk/negative-balance lists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff member who has a customer's CourseHost/Core ID can view that customer's full snapshot in under 15 seconds from opening the console.
- **SC-002**: Staff can successfully view the full snapshot of a customer who has never logged into the Academy portal — a case that is impossible anywhere else in the app today.
- **SC-003**: A recorded credit adjustment is reflected in the customer's displayed balance immediately, with no separate refresh or sync step required by staff.
- **SC-004**: 100% of credit adjustments recorded through this console include a creator, timestamp, and reason, and zero are written directly to Core during v1.
- **SC-005**: A customer's adjustment history is identical whether viewed through this console or through Credit Watch's per-customer view, in 100% of cases.

## Assumptions

- The existing per-customer Core snapshot capability (wallets, sessions, activity ledger, keyed by CourseHost/Core customer ID) is reused as-is; this feature adds a lookup and presentation layer in front of it, not a new data source.
- The existing credit-adjustment audit log (introduced in 008-staff-credit-watch) is reused as the single source of truth for adjustment history; this feature does not introduce a second adjustment log.
- Direct ID lookup (User Story 1) has no external dependency beyond what already exists in production today and can ship independently of the email/name search capability (User Story 3).
- "Full activity ledger" means the complete activity history already returned by the existing snapshot capability — no new activity types or a longer retention window are introduced.
- Email/name search (FR-002, User Story 3) is scoped to customers with a linked Academy portal account and is served from data already available locally — no new Core endpoint is required for v1. A Core-wide search endpoint (covering unlinked customers by name/email) is out of scope for this feature and would be a future extension, following the same "assume a handoff contract" pattern used for Credit Watch's bulk endpoint.
- Access is gated by the existing `staff_profiles.role` mechanism (`super_admin` and `staff` allowed, `coach` excluded) — the same `requireStaffRole` pattern Credit Watch already uses — rather than a new `is_admin` flag.
