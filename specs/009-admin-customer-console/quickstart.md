# Quickstart Validation: Admin Customer Console

Manual validation, consistent with 008-staff-credit-watch (no automated test framework in this repo). Run against a dev server with real `CORE_API_BASE`/`CORE_SHARED_SECRET`/`CORE_WAF_BYPASS` env vars — no Core stub needed, since this feature introduces no new external endpoint.

## Prerequisites

- Logged in as a `staff` or `super_admin` staff account.
- One known CourseHost/Core customer ID for a customer who has **never** logged into the Academy portal (no `customer_profiles` row).
- One known customer who **has** linked a portal account (visible on `/admin/students` today).

## Scenario 1 — Direct ID lookup for an unlinked customer (US1)

1. Navigate to `/staff/customers`.
2. Enter the unlinked customer's CourseHost/Core ID directly, submit.
3. **Expect**: lands on `/staff/customers/{id}`, showing wallets, sessions, and activity ledger, with a visible "no linked portal account" indicator.

## Scenario 2 — Unknown ID (US1 edge case)

1. On `/staff/customers`, enter an ID that doesn't exist in Core.
2. **Expect**: a clear "no customer found" state, not a crash or blank page.

## Scenario 3 — Record an adjustment from the new console (US2)

1. From Scenario 1's customer detail page, submit a credit adjustment (lesson type, non-zero amount, reason).
2. **Expect**: adjustment appears immediately in the effective balance and in the adjustment history on this page.
3. Navigate to `/staff/credit-watch/{same id}` (if the customer also happens to be at-risk/negative — otherwise skip to step 4 using any customer both pages can reach).
4. **Expect**: the same adjustment appears in Credit Watch's drill-down history for that customer (FR-009).

## Scenario 4 — Zero-amount / empty-reason rejection (US2 edge case)

1. Submit an adjustment with amount `0`, or with an empty reason.
2. **Expect**: submission rejected, no new row created (verify via a direct Supabase query against `credit_adjustments` if needed).

## Scenario 5 — Search a linked customer by email/name (US3)

1. On `/staff/customers`, enter the linked customer's email (or partial name) in the search field, submit.
2. **Expect**: the matching customer appears as a selectable result; selecting it lands on `/staff/customers/{their id}` with no "no linked portal account" indicator shown.
3. Repeat with a query matching no one.
4. **Expect**: a clear "no results" state that also surfaces the direct-ID-lookup option.

## Scenario 6 — Access control (FR-010)

1. Log in as a `coach`-role account.
2. **Expect**: no "Customers" item in `StaffSidebar`; direct navigation to `/staff/customers` redirects to `/staff/dashboard`.

## Scenario 7 — Credit Watch drill-down still works (regression check on the modified route)

1. From `/staff/credit-watch`, drill into any listed student.
2. **Expect**: page still renders wallets and the adjustment form/history as before, **plus** sessions and the activity ledger now visible too (net-new from the shared component).
3. Navigate to `/staff/credit-watch` itself (the aggregate list, not a drill-down).
4. **Expect**: still shows only the "Upcoming sessions at risk" and "Negative balances right now" tables, scoped to flagged students exactly as before this feature shipped (FR-011) — no new columns, sections, or customers appear that weren't already surfaced by Credit Watch's own look-ahead logic.
