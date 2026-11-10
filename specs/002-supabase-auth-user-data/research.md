# Research: Supabase Auth, Customer Profile Sync, and Content Management Foundation

**Branch**: `002-supabase-auth-user-data` | **Date**: 2026-06-10

---

## Decision 1: Supabase Auth SDK Version

**Decision**: Use `@supabase/ssr` (v0.5+) with `createServerClient` and `createBrowserClient`.

**Rationale**: The older `@supabase/auth-helpers-nextjs` package is deprecated. `@supabase/ssr` is the official replacement and is designed specifically for Next.js App Router's server/client component boundary. It manages sessions via HTTP cookies, which works correctly across server components, middleware, and client components.

**Alternatives considered**:
- `@supabase/auth-helpers-nextjs` — deprecated, unmaintained
- NextAuth.js — heavier OAuth-focused library; Supabase Auth is simpler for email-only magic link flows

---

## Decision 2: Authentication Method

**Decision**: Magic link (OTP via email). Customers receive a one-time link; clicking it exchanges the OTP for a Supabase session.

**Rationale**: Academy customers already have email addresses registered in the Academy system. Magic link requires zero new credentials to remember, matches the user's expectation that "my Academy email is my login," and eliminates password management complexity.

**Alternatives considered**:
- Email + password — adds friction; customers would need to set a password they didn't previously have
- Google/social OAuth — not all Academy customers have Google accounts; requires OAuth app setup
- Session tokens passed via URL — insecure, not auditable

---

## Decision 3: Route Protection Strategy

**Decision**: Next.js `middleware.ts` at the repo root intercepts all `/customer/[id]/*` routes. It uses `createServerClient` with the cookie store to check for a valid Supabase session. Unauthenticated requests are redirected to `/login`.

**Rationale**: Middleware runs on the Edge before any server component renders, preventing any customer data from being fetched or rendered for unauthenticated visitors. This is the approach recommended by Supabase's official Next.js App Router documentation.

**Alternatives considered**:
- Checking auth in each page/layout — repetitive, easy to miss a new route
- Checking auth only in layout.tsx — middleware is faster and runs closer to the network edge

---

## Decision 4: Customer ID Ownership Validation

**Decision**: In `src/app/customer/[id]/layout.tsx`, after session confirmation, the layout fetches the authenticated user's `CustomerProfile` and verifies that `profile.core_customer_id === params.id`. If they don't match, the user is redirected to their own `/customer/[correct_id]` dashboard.

**Rationale**: The URL contains a Academy customer ID. A logged-in customer must only be able to view their own data. Middleware can validate session existence, but the customer-ID-to-user mapping check requires a database lookup that belongs in the layout (runs once per navigation, cached per request via React `cache()`).

**Alternatives considered**:
- Performing the ownership check in middleware — requires a database call in Edge runtime; Supabase JS v2 works in Edge but adds latency to every request
- Storing customer_id in the JWT claim — requires custom JWT configuration in Supabase; ownership check in middleware becomes feasible, but adds setup complexity

---

## Decision 5: Academy API → Supabase Profile Sync Pattern

**Decision**: Upsert on every authenticated layout render. In `layout.tsx`, after `fetchSnapshot` succeeds, call `upsertCustomerProfile(supabaseUserId, snapshot.customer)`. This uses `INSERT ... ON CONFLICT (core_customer_id) DO UPDATE SET ...`.

**Rationale**: No separate job, no webhook, no cron. The snapshot is already being fetched on every page load (cached by React `cache()` — zero extra network requests). Piggy-backing the upsert onto the snapshot fetch is idempotent, always keeps the profile fresh, and requires no additional infrastructure. The upsert is a single SQL statement and completes in < 10ms on Supabase.

**Alternatives considered**:
- Background sync job — adds infrastructure complexity; profile could be stale between runs
- Supabase Edge Function webhook — requires a webhook endpoint on the Academy API side; Core's API is read-only and doesn't emit webhooks
- Sync only on first login — profile would diverge from Academy data over time

---

## Decision 6: Recording Progress Sync Architecture

**Decision**: Supabase as the authority, `localStorage` as the optimistic/offline cache. On component mount, fetch the latest position and reviewed state from Supabase and write to localStorage. On user interaction, write to both localStorage (synchronously for instant UI feedback) and Supabase (async, fire-and-forget with error logging). The existing `use-library-storage.ts` hook is updated — its external API does not change.

**Rationale**: This maintains backward compatibility with spec 001 (no changes needed to `RecordingPlayer` or `RecordingCard` component props). The hook abstraction hides the sync logic. localStorage continues to serve as an offline fallback — if Supabase is unreachable, the app still works.

**Alternatives considered**:
- Replace localStorage entirely with Supabase — loses offline capability; adds loading states to every card
- Use Supabase Realtime for live sync across browser tabs — overkill for V1; reading from Supabase on mount is sufficient for cross-device sync

---

## Decision 7: PayloadCMS Integration with Next.js 14

**Decision**: Use PayloadCMS 3.x with the `@payloadcms/next` plugin. PayloadCMS 3.x runs inside the same Next.js application, adding an `/admin` route. The config lives at `payload.config.ts` in the repo root. Collections are defined in `/collections/`. The `next.config.mjs` is wrapped with `withPayload()`.

**Rationale**: PayloadCMS 3.x was purpose-built for Next.js App Router and is the only version compatible with Next.js 14+. It requires no separate server — the admin panel is just another set of Next.js routes. This minimizes operational overhead.

**Alternatives considered**:
- PayloadCMS 2.x (Express-based) — incompatible with Next.js App Router; requires a separate Express server
- Contentful/Sanity/Strapi — hosted or separate service; adds vendor lock-in and monthly cost; PayloadCMS is self-hosted and code-first

---

## Decision 8: Database Architecture (Supabase + PayloadCMS)

**Decision**: Use the same Supabase-managed PostgreSQL instance for both Supabase tables and PayloadCMS collections. Supabase tables live in the `public` schema; PayloadCMS uses its own tables (prefixed `payload_`) in the same schema. The `DATABASE_URL` from Supabase is used for both.

**Rationale**: One database to manage, one connection string in `.env`, no additional cost. PayloadCMS and Supabase don't interact with each other's tables — they coexist cleanly. Supabase's RLS policies only apply to Supabase client calls (via `anon`/`service_role` keys), not to PayloadCMS's direct PostgreSQL connection.

**Alternatives considered**:
- Separate PostgreSQL for PayloadCMS — adds operational overhead (two databases, two connection strings, two backup strategies)
- Separate Supabase project for PayloadCMS — unnecessary; Payload doesn't use Supabase Auth

---

## Decision 9: New npm Packages Required

The following packages must be added to `package.json`:

| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | `^2.x` | Supabase client (auth + database) |
| `@supabase/ssr` | `^0.5.x` | App Router-compatible session management |
| `payload` | `^3.x` | CMS core |
| `@payloadcms/next` | `^3.x` | Next.js plugin (admin panel, routing) |
| `@payloadcms/db-postgres` | `^3.x` | PostgreSQL adapter for PayloadCMS |
| `@payloadcms/richtext-lexical` | `^3.x` | Rich text editor for content types |

**Note**: Confirm exact v3 package names before install — Payload 3.x is in stable release but package names should be verified against the official docs at install time.
