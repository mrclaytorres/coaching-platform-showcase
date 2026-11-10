# Quickstart: Credit Watch Data Fallback (Interim)

## Prerequisites

- `next dev` running locally (`npm run dev`, port 3040 per `package.json`).
- Logged in as a `staff` or `super_admin` account.
- At least one linked `customer_profiles` row with a real/valid `core_customer_id` that Core recognizes (e.g., the same one used to verify `/staff/credit-watch/10001` during spec 011's clarification — confirm any seeded account works via `/staff/credit-watch/<id>` first).
- `CORE_API_BASE`, `CORE_SHARED_SECRET`, `CORE_WAF_BYPASS` env vars set (same as today — no new env vars added by this feature).

## Scenario 1 — Fallback activates when the primary source fails (current real-world state)

Since `/pull_credit_watch/` doesn't exist on Core's side yet, this is the *current* behavior with no extra setup:

1. Visit `/staff/credit-watch`.
2. **Before this feature**: page shows "Couldn't load Credit Watch data: Credit watch fetch failed (404)...".
3. **After this feature**: page loads normally, showing "Negative balances right now" and "Upcoming sessions at risk" sections built from known students, plus a visible banner stating the data is limited to already-known students (Story 3).
4. Confirm no error message appears anywhere on the page (SC-001).

## Scenario 2 — Negative balances match the per-student detail page (Story 1)

1. Pick a known student with a negative balance in at least one lesson type (or create one via a staff credit adjustment on `/staff/credit-watch/<id>`).
2. On `/staff/credit-watch`, confirm that student's row appears in "Negative balances right now" with the exact same balance shown on `/staff/credit-watch/<id>`'s own balance panel, including any placeholder adjustment already applied (FR-003, SC-002).

## Scenario 3 — At-risk sessions are labeled as estimates (Story 2)

1. Pick a known student with a session scheduled within the next 30 days (default look-ahead) whose lesson-type balance is 0 or negative once 1 credit is assumed spent.
2. Confirm that session appears in "Upcoming sessions at risk" with a visible "Estimate" badge.
3. Confirm the row's renewal cell reads "Renewal info not available" — not "No active subscription" and not a fabricated renewal date.
4. Change the look-ahead window (`?days=`) and confirm the list updates to match, same as the primary path's existing behavior.

## Scenario 4 — Partial failure doesn't break the page (Edge Cases)

1. Temporarily point one known student's Core lookup at an invalid ID (or simulate by revoking access for one test account, if feasible) so their `fetchSnapshot()` call fails.
2. Reload `/staff/credit-watch`.
3. Confirm the page still renders results for every other known student, plus a note indicating how many students couldn't be checked.

## Scenario 5 — Automatic reversion (FR-006)

1. Temporarily point `CORE_API_BASE` (or mock the fetch) so `fetchCreditWatch()` succeeds instead of 404ing.
2. Reload `/staff/credit-watch`.
3. Confirm the page shows the primary, complete dataset with no fallback banner, no "Estimate" badges, and no "renewal info not available" wording.
4. Revert the env change.

## Verification commands

```bash
npm run typecheck
npm run lint
```

No automated test suite exists in this repo (see plan.md Technical Context) — the scenarios above are the acceptance check.
