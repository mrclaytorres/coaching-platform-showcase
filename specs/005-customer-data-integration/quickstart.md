# Quickstart: Dev/Demo Student Account Seeding & Normalized Account Display

Manual validation guide — this repo has no automated test framework (see `plan.md` Technical Context), so these are the scenarios to run by hand after implementation.

## Prerequisites

- `.env` has valid `CORE_API_BASE`, `CORE_SHARED_SECRET`, `CORE_WAF_BYPASS`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` pointed at a **non-production** Supabase project.
- Applied the schema change from `contracts/supabase-schema.md` to that project.
- Add `ALLOW_DEV_SEEDING=true` to `.env`.

## Scenario 1 — Seed the two demo accounts (User Story 1, SC-001)

1. `npm run dev`, visit `http://localhost:3040/dev/seed-accounts`.
2. Click "Seed demo accounts" without adding any extra IDs.
3. **Expect**: two accounts reported as created/linked, for `10002` and `10001`. No email was sent or required.
4. Click "Sign in as" next to `10002`.
5. **Expect**: lands directly on `/customer/10002`, no magic-link step, credits/sessions/activity match what `/customer/10002`'s existing demo route already shows.
6. Time the walkthrough from opening `/dev/seed-accounts` (step 1) to landing on `/customer/10002` (step 5). **Expect**: under 2 minutes (SC-001).
7. Repeat for `10001`, confirm it shows the "heavy" data set.

## Scenario 2 — Idempotent re-run (User Story 1 Acceptance #2, SC-003)

1. Run the seeder again with no changes.
2. **Expect**: no new rows in `customer_profiles` (still exactly one row each for `10002`/`10001`), no error, page reports both as already-seeded/updated in place.

## Scenario 3 — Seed an additional known identifier (User Story 2, SC-002)

1. On `/dev/seed-accounts`, enter one additional real customer/CourseHost ID in the input field, submit.
2. **Expect**: a third seeded account appears in the list within the run.
3. Sign in as it.
4. **Expect**: dashboard shows that student's real data, timezone-correct.
5. Confirm the whole flow (entering the ID → viewing its dashboard) took under 2 minutes (SC-002).

## Scenario 4 — Unknown identifier doesn't abort the batch (Edge Case, FR-009)

1. Enter one real ID plus one clearly-invalid ID (e.g. `999999999`) together, submit.
2. **Expect**: the real ID is seeded successfully; the invalid one is reported with a specific failure message; the run completes (does not abort/rollback the valid one).

## Scenario 5 — Refuses to seed over a real account (Edge Case, FR-005)

1. Manually link a real account through the normal `/login` magic-link flow for some test customer ID (or reuse an existing real linked account from prior features' data).
2. Attempt to seed that same customer ID via `/dev/seed-accounts`.
3. **Expect**: seeding is refused for that ID with a clear message; the real account's row is untouched (`is_seeded` still `false`, `email` still the real student's email).

## Scenario 6 — Dashboard empty/large states still work (User Story 3)

1. Sign in as the "light" demo (`10002`) — confirm empty states render for whichever sections have no data, no errors.
2. Sign in as the "heavy" demo (`10001`) — confirm the dashboard loads and long session/activity lists remain usable.

## Scenario 7 — Bypass page is inert in production (FR-007, SC-004)

1. `npm run build && npm run start` (this sets `NODE_ENV=production`).
2. Visit `/dev/seed-accounts`.
3. **Expect**: 404 — page does not render, no seeding form, no account list.

## Scenario 8 — Seeder refuses to run without explicit opt-in (FR-012, SC-006)

1. With the app still running under `next dev` (`NODE_ENV=development`), remove or unset `ALLOW_DEV_SEEDING` from `.env` (or set it to anything other than `true`) and restart.
2. Attempt to trigger seeding.
3. **Expect**: seeding refuses to run and reports the missing opt-in; zero accounts are created; confirm via Supabase dashboard that no new `auth.users`/`customer_profiles` rows appeared.

## Scenario 9 — Admin-visible dev marking (FR-008)

1. As an admin/staff user, visit `/admin/students`.
2. **Expect**: every seeded account (`10002`, `10001`, and any additional ones from Scenario 3) is visibly marked (e.g. a "Dev" badge) and distinguishable from real student rows.
