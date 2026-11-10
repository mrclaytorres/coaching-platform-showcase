# Implementation Plan: Dev/Demo Student Account Seeding & Normalized Account Display

**Branch**: `005-customer-data-integration` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-customer-data-integration/spec.md`

## Summary

Add a development-only Next.js route that (1) seeds `customer_profiles` + Supabase auth accounts for the two known demo students and any developer-supplied CourseHost/customer IDs, each linked to real Core API data via a deterministic synthetic placeholder email, and (2) lets the developer sign into any seeded account via `signInWithPassword` instead of the magic-link flow. The route is unreachable once `NODE_ENV=production`, and the seeding action independently refuses to run unless an explicit opt-in env var is set, so an accidental production-credentialed run creates nothing. The existing customer dashboard (`/customer/[id]`) requires no changes — seeded accounts flow through it exactly as real accounts do.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`)

**Primary Dependencies**: `@supabase/supabase-js` (service-role admin client for `auth.admin.createUser`), `@supabase/ssr` (session cookies via existing `createSupabaseServerClient`), existing `src/lib/core-api.ts` (`fetchSnapshot`), existing `src/lib/auth/customer-profile.ts` (`upsertCustomerProfile`, `listCustomerProfiles`)

**Storage**: Supabase Postgres — `customer_profiles` table (adds one column, `is_seeded`), Supabase Auth (`auth.users`)

**Testing**: No automated test framework exists in this repo (confirmed: no jest/vitest/tsx in `package.json`). Consistent with the existing precedent (`scripts/test-snapshot.sh`), validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app (`next dev` locally, `next start` in production per `docs/production-deployment.md`)

**Project Type**: Web application — single existing Next.js app, no new services

**Performance Goals**: N/A — single-developer, low-volume dev tooling (2 fixed IDs + a handful of developer-supplied IDs per run)

**Constraints**:
- The dev route MUST be unreachable when `NODE_ENV=production` (FR-007)
- The seeding action MUST independently refuse to run unless an explicit dev-only opt-in env var is present, regardless of `NODE_ENV` (FR-012) — protects against the real failure mode named in the spec's edge cases: a locally-run process holding production Supabase credentials
- No real student email may ever be required, stored, or displayed for seeded accounts (FR-011)

**Scale/Scope**: 2 fixed demo identifiers (`10002`, `10001`) + a small developer-supplied list, single developer, local/dev environment only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project. There are no gates to evaluate against. Proceeding under the project's established conventions instead (dev-only surfaces gated by `NODE_ENV`, service-role Supabase access server-side only, schema changes documented under `contracts/supabase-schema.md`), as observed directly in the existing codebase (`src/lib/auth/customer-profile.ts`, `docs/production-deployment.md`).

**Post-design re-check**: No new dependencies, services, or cross-cutting patterns were introduced beyond what's documented below — still no constitution gates apply.

## Project Structure

### Documentation (this feature)

```text
specs/005-customer-data-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   ├── supabase-schema.md   # is_seeded column addition
│   └── dev-routes.md        # dev-only page + server actions contract
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── dev/
│   │   └── seed-accounts/
│   │       └── page.tsx        # NEW — dev-only seed + sign-in-bypass UI, NODE_ENV-gated
│   ├── admin/students/page.tsx  # unchanged (reads listCustomerProfiles)
│   ├── customer/[id]/           # unchanged — existing dashboard, no new work
│   └── login/page.tsx           # unchanged — real magic-link flow, untouched
├── components/
│   └── StudentListTable.tsx     # MODIFIED — add "Dev" badge when profile.isSeeded
└── lib/
    ├── auth/
    │   └── customer-profile.ts  # MODIFIED — isSeeded field on StudentProfile/UpsertInput
    ├── dev/
    │   └── seed-accounts.ts     # NEW — seeding logic + production-target guard
    ├── core-api.ts               # unchanged — reused as-is
    └── supabase/                 # unchanged — server/client/middleware clients reused as-is
```

**Structure Decision**: This feature adds to the existing single Next.js app — no new project, package, or service. All new code lives under the existing `src/app`, `src/lib`, `src/components` trees, following the same server-action-on-a-page pattern already used by `src/app/login/page.tsx`.

## Complexity Tracking

*No constitution violations — table intentionally omitted.*
