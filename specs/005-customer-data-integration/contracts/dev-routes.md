# Contract: Dev-Only Seeding & Sign-In Bypass Route

**Branch**: `005-customer-data-integration` | **Date**: 2026-07-15

Mirrors the server-action contract pattern established by `specs/002-supabase-auth-user-data/contracts/server-actions.md` for `src/app/login/page.tsx`.

## Route

`GET /dev/seed-accounts` — `src/app/dev/seed-accounts/page.tsx`

**Gate**: First statement in the Server Component:

```ts
if (process.env.NODE_ENV === 'production') notFound();
```

Satisfies FR-007 — the route 404s in any production deployment (`next start`), independent of the seeding action's own guard below.

**Renders**:
- A form to enter additional numeric identifiers (comma/whitespace-separated) beyond the two fixed demos, submitting to the `seedDevAccounts` server action.
- A list of all `is_seeded = true` profiles (via `listCustomerProfiles()`, filtered client-side or via a new `listSeededProfiles()` — implementation detail for tasks), each with a "Sign in as this account" button bound to `signInAsSeededAccount`.
- Per-identifier failure messages from the last seeding run (FR-009), e.g. "customer_id 99999: not found in Core's system."

## Server Action: `seedDevAccounts`

```ts
async function seedDevAccounts(formData: FormData): Promise<void>
```

**Behavior**:
1. Guard first: if `process.env.ALLOW_DEV_SEEDING !== 'true'`, throw/redirect with an error — refuses to run, creates nothing (FR-012). This check happens before any Supabase or Core API call.
2. Build the identifier list: the two fixed demo IDs (`10002`, `10001`) plus any IDs parsed from the form input, deduplicated.
3. For each identifier, sequentially, produce a `SeedResult = { id: number; status: 'seeded' | 'skipped' | 'error'; message?: string }`:
   - Call `fetchSnapshot(id)` (existing, from `src/lib/core-api.ts`).
     - On 404 or other failure: `{ id, status: 'error', message }` and continue to the next identifier (FR-009) — do not abort the batch.
   - Check for an existing `customer_profiles` row for this `core_customer_id`:
     - If it exists and `is_seeded = false` (a real, already-claimed account): `{ id, status: 'skipped', message: 'already linked to a real account' }` (FR-005) — do not touch it.
     - If it exists and `is_seeded = true`: reuse the existing `auth.users` row, just re-upsert the profile fields, `{ id, status: 'seeded' }` (idempotent re-run, FR-004).
     - If it does not exist: call `auth.admin.createUser({ email: syntheticEmail(id), password: DEV_SEED_PASSWORD, email_confirm: true })`, then `upsertCustomerProfile({ ..., email: syntheticEmail(id), authUserEmail: syntheticEmail(id), isSeeded: true })`, `{ id, status: 'seeded' }`.
4. Redirect back to `/dev/seed-accounts` with a summary (e.g. via query params or a transient message) built from the `SeedResult[]`, showing per-identifier outcomes.

**Synthetic email**: `syntheticEmail(id) = \`dev+customer-${id}@example.invalid\`` (see `research.md` §2).

## Server Action: `signInAsSeededAccount`

```ts
async function signInAsSeededAccount(customerId: number): Promise<void>
```

**Behavior**:
1. Call `assertNotProduction()` first — an independent, action-level guard (throws unless `process.env.NODE_ENV !== 'production'`). This exists because Next.js Server Actions can be invoked directly via POST without necessarily re-running the page component's `notFound()` gate, so FR-007's "inoperative under any circumstance" requirement needs its own check inside the action itself, not just at the page level.
2. Look up the seeded profile's synthetic email for `customerId` (must have `is_seeded = true` — refuse otherwise, since this action must never be usable to impersonate a real account).
3. Call `createSupabaseServerClient().auth.signInWithPassword({ email, password: DEV_SEED_PASSWORD })` — this sets the standard Supabase session cookies via the existing SSR client, identical to how a real user's session is established post-magic-link.
4. `redirect(\`/customer/${customerId}\`)`.

No changes to `src/middleware.ts`, `requireCustomerProfile()`, or the dashboard itself — a seeded account's session is indistinguishable, at the auth layer, from a real one.

## Explicitly Out of Scope

- No changes to `src/app/login/page.tsx`'s real `signIn`/`linkAccount` flow.
- No new API routes (`/api/...`) — everything is Server Component + Server Actions on one page, consistent with the rest of the app.
