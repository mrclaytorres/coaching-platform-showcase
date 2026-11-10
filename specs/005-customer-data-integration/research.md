# Phase 0 Research: Dev/Demo Student Account Seeding & Normalized Account Display

All items below were originally raised as candidates for `[NEEDS CLARIFICATION]` in the Technical Context but are resolved here from direct inspection of the existing codebase (`src/lib/auth/customer-profile.ts`, `src/app/login/page.tsx`, `docs/production-deployment.md`) rather than left open, since the answers follow directly from established project conventions.

## 1. Where does seeding + sign-in-bypass logic live?

**Decision**: A single dev-only Next.js page (`src/app/dev/seed-accounts/page.tsx`) with two co-located server actions — `seedDevAccounts` and `signInAsSeededAccount` — following the exact pattern `src/app/login/page.tsx` already uses for its `signIn`/`linkAccount` server actions.

**Rationale**: The "sign-in bypass" (FR-006) has to establish a real browser session either way, which means it has to go through the existing `createSupabaseServerClient()`/cookie machinery. Putting seeding in the same page means both concerns reuse that one code path, and the page can double as a visual list of what's already seeded — free UX. It also means "unreachable in production" (FR-007) is a single, standard Next.js gate at the page level, not two separate mechanisms to keep in sync.

**Alternatives considered**:
- Standalone Node/TS script run via a task runner (`tsx`, `ts-node`) — rejected. The repo has neither dependency today, so this would add new tooling, and a script still can't establish a browser session by itself — the developer would still need a separate page or route to actually "sign in as," so the standalone script wouldn't actually remove complexity.
- A plain API route hit via `curl` — rejected. No benefit over a page for a single developer, and loses the free "list of what's seeded" UI.

## 2. Synthetic placeholder email format

**Decision**: `dev+customer-<id>@example.invalid`, e.g. `dev+customer-10002@example.invalid`.

**Rationale**: `.invalid` is the IANA/RFC 2606-reserved TLD guaranteed to never resolve or accept mail, so it can never collide with a real address. It's deterministic from the numeric identifier alone, which is what makes re-running the seeder idempotent (FR-004) — the same ID always maps to the same email, so `upsertCustomerProfile`'s existing `onConflict: 'supabase_user_id'` upsert naturally updates in place rather than duplicating. It's also human-scannable directly in the Supabase Auth dashboard, which helps FR-008 ("clearly marked as seeded").

**Alternatives considered**:
- Random/UUID-derived placeholder email — rejected, breaks idempotent re-seeding since the same customer ID would get a different email (and therefore a different auth user) every run.
- A real-looking but unregistered domain — rejected, carries a nonzero risk of eventually becoming a real, deliverable domain.

## 3. Sign-in bypass mechanism

**Decision**: Give every seeded account a single fixed, non-secret dev password (module-level constant in `src/lib/dev/seed-accounts.ts`), and have `signInAsSeededAccount` call the existing anon Supabase client's `signInWithPassword({ email: syntheticEmail, password: DEV_SEED_PASSWORD })` through `createSupabaseServerClient()`.

**Rationale**: This reuses Supabase's own session/cookie issuance exactly as the real magic-link flow does after OTP verification — no custom session-minting code, so `src/middleware.ts` and `requireCustomerProfile()` need zero special-casing for seeded accounts. The password only ever works against `@example.invalid` accounts, which cannot exist in a real production dataset (no real student would have one, and FR-012 prevents the seeder from ever creating one in production).

**Alternatives considered**:
- Supabase admin `generateLink()` one-time magic link — rejected as unnecessary extra round-trip for a same-machine dev convenience feature; `signInWithPassword` is simpler and synchronous.
- A custom signed cookie that impersonates a session — rejected, would mean re-implementing Supabase's own session cookie format instead of just using the SDK.

## 4. Production-target guard for the seeder itself (FR-012)

**Decision**: Require an explicit, off-by-default env var — `ALLOW_DEV_SEEDING=true` — checked as the very first step of `seedDevAccounts`, before any Supabase or Core API call. Its absence, or any value other than the literal string `'true'`, causes the seeder to refuse to run and create nothing. It is never added to `docs/production-deployment.md`'s production environment variable list.

**Rationale**: The edge case this guards against (spec: "the seeder is accidentally run with credentials/configuration pointed at the production Supabase project") is specifically a *local process holding production credentials* — `NODE_ENV` doesn't help here, since running the seeding server action locally under `next dev` still reports `NODE_ENV=development` even if `.env` was accidentally populated with production `SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL` values. An explicit, fail-closed opt-in flag is the only signal that reliably distinguishes "a developer deliberately wants this to run right now" from "this just happens to be running outside a `next start` production build."

**Alternatives considered**:
- Comparing `NEXT_PUBLIC_SUPABASE_URL` against a hardcoded production project ref — rejected, requires embedding a production identifier as a quasi-secret in source, and silently breaks (fails open) if the production project is ever recreated under a new ref.
- Relying solely on `NODE_ENV === 'production'` — rejected, doesn't cover the actual named failure mode (dev-mode process, prod credentials).

## 5. Production gate for the page itself (FR-007)

**Decision**: `src/app/dev/seed-accounts/page.tsx` calls Next's `notFound()` immediately if `process.env.NODE_ENV === 'production'`.

**Rationale**: `docs/production-deployment.md` Step 5 confirms production always runs via `npm run build && npm run start`, which sets `NODE_ENV=production` — this is already the existing, correct dev/prod signal for "is this a production deployment," independent of the separate `ALLOW_DEV_SEEDING` guard on the seeding action (item 4). Two independent gates, as the spec's clarification (FR-012) explicitly requires them to be independent.

**Alternatives considered**:
- A dedicated `CORE_ENABLE_DEV_TOOLS` flag for the page — rejected as redundant; `NODE_ENV` already exists, is already correctly set by the project's real build/run commands, and needs no new documentation.

## 6. Schema change to mark seeded accounts (FR-008)

**Decision**: Add `is_seeded boolean NOT NULL DEFAULT false` to `customer_profiles`, set to `true` only by the seeding path (real `linkAccount` calls in `src/app/login/page.tsx` are unaffected and continue to default it to `false`). `listCustomerProfiles()`/`StudentProfile` gain an `isSeeded` field; `StudentListTable` renders a "Dev" badge when true.

**Rationale**: Reuses the exact list/table the admin already has (`src/app/admin/students/page.tsx`) — a one-column addition satisfies "including in any place staff/admins can view account lists" (FR-008) with no new screen. Matches the established incremental-column pattern already used for `is_active`.

**Alternatives considered**:
- A separate `seeded_accounts` join/tracking table — rejected, adds a join for a plain 1:1 boolean flag with no other use case.

---

**Output check**: No `NEEDS CLARIFICATION` markers remain in Technical Context — all six items above are resolved.
