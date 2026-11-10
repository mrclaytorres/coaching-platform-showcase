# Quickstart: Staff Credit Watch Dashboard

Manual validation guide — this repo has no automated test framework (see `plan.md` Technical Context).

**Important**: Scenarios 1 and 2 depend on `POST /pull_credit_watch/` existing on Core's side (`contracts/core-credit-watch-api.md`) — a new endpoint that does not exist as of this feature's implementation. Until it ships, validate against a local stub that returns a fixed `CreditWatchResponse` (e.g., hardcode the JSON shown in the contract behind an env flag, or point `CORE_API_BASE` at a local mock server) so the UI, effective-balance overlay, and drill-down can still be built and demoed end-to-end. Scenario 3 (adjustments) has no such dependency and can be validated fully today against `fetchSnapshot()`, which already exists in production.

## Prerequisites

- `.env` has valid `CORE_API_BASE`, `CORE_SHARED_SECRET`, `CORE_WAF_BYPASS`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Applied the schema change from `contracts/supabase-schema.md` (`credit_adjustments` table) to the Supabase project.
- A staff account with role `staff` or `super_admin` (see `003-roles-admin-staff` quickstart for how to create one), and a second account with role `coach` for the access-control check.
- At least one seeded student customer id you can reference by number (e.g., `10002` per `005-customer-data-integration`'s demo accounts).

## Scenario 1 — Upcoming sessions at risk (User Story 1, SC-001, SC-003)

1. `npm run dev`, log in as staff, visit `/staff/credit-watch`.
2. **Expect**: "Upcoming sessions at risk" table renders, look-ahead defaults to 30 days, summary count at the top matches the number of rows shown.
3. Change the look-ahead selector to 7 days.
4. **Expect**: the list updates to only sessions within 7 days, without a full page reload; the summary count updates to match.
5. Confirm at least one row shows a "covered by renewal" badge and at least one shows "unfunded" (using stubbed data with both cases per `contracts/core-credit-watch-api.md`'s covered/unfunded formula).
6. Confirm the page shows the coach-to-coach exclusion count (e.g., "3 coach-to-coach sessions excluded") rather than silently omitting those sessions with no explanation.

## Scenario 2 — Negative balances right now (User Story 2, SC-002)

1. On `/staff/credit-watch`, scroll to "Negative balances right now."
2. **Expect**: every student/lesson-type pair with a negative effective balance in the stubbed response appears as its own row (not merged across lesson types), each showing the balance and either a next-renewal date/amount or "No active subscription."
3. Confirm the same student appearing with a negative balance for two different lesson types produces two separate rows.

## Scenario 3 — Drill in and record a credit adjustment (User Story 3, FR-013–FR-015, SC-006, SC-007)

1. From either list on `/staff/credit-watch`, click "Analyze" on any row.
2. **Expect**: lands on `/staff/credit-watch/{coreCustomerId}`, showing that student's balances across **all** lesson types (via `fetchSnapshot`), not just the one from the row clicked.
3. Submit the adjustment form with an amount and a reason.
4. **Expect**: the student's displayed balance for that lesson type updates immediately to reflect the adjustment; a "not yet written to Core" indicator is shown next to the adjusted balance (FR-015).
5. Attempt to submit again with a blank reason, then with a `0` amount.
6. **Expect**: both submissions are rejected with a validation message; no `credit_adjustments` row is created for either attempt.
7. **Verify in Supabase**: `credit_adjustments` has one new row — `status = 'placeholder'`, `created_by` matches the logged-in staff member's `staff_profiles.id`, `amount_credits`/`reason` match what was submitted.
8. Go back to `/staff/credit-watch`. If the adjustment was large enough to bring the student's effective balance to zero or above, **expect** their row to no longer appear in "Negative balances right now" (data-model.md's effective-balance rule).

## Scenario 4 — Access control (FR-010)

1. Log in as the `coach`-role account, navigate directly to `/staff/credit-watch`.
2. **Expect**: redirected away (to `/staff/dashboard`), same as attempting to open `/staff/tiers` as a coach.
3. Confirm the "Credit Watch" item does not appear in the coach's sidebar at all.
4. Log in as `staff` or `super_admin` and confirm the sidebar item is present and the page loads.

## Scenario 5 — Core API failure handling (Edge Cases)

1. Temporarily point `CORE_API_BASE` at an unreachable host (or stop the stub server).
2. Visit `/staff/credit-watch`.
3. **Expect**: a clear loading/error state is shown — not an empty "0 at risk / 0 negative balances" view that could be mistaken for a genuinely healthy state.
