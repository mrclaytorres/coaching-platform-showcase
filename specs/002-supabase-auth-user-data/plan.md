# Implementation Plan: Supabase Auth, Customer Profile Sync, and Content Management Foundation

**Branch**: `002-supabase-auth-user-data` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-supabase-auth-user-data/spec.md`

## Summary

Secure the Academy platform behind Supabase magic-link authentication, automatically sync Academy customer data into Supabase profiles on each authenticated page load (upsert triggered by the existing `fetchSnapshot` call — no extra network requests), migrate recording progress from device-local `localStorage` to server-side Supabase storage for cross-device sync, and scaffold PayloadCMS 3.x as the content management foundation for future courses and community features. Two new routes (`/login`, `/auth/callback`), a Next.js middleware guard, and a profile-sync step in the customer layout cover the auth surface. The existing `use-library-storage.ts` hook API is unchanged; Supabase sync is added internally.

## Technical Context

**Language/Version**: TypeScript 5.5 / Node 20 (matches existing project)

**Primary Dependencies**: Next.js 14.2 App Router, React 18.3, Tailwind 3.4, `@supabase/supabase-js` v2, `@supabase/ssr` v0.5+, PayloadCMS 3.x (`payload`, `@payloadcms/next`, `@payloadcms/db-postgres`, `@payloadcms/richtext-lexical`)

**Storage**:
- Supabase (Postgres) — `customer_profiles` + `recording_progress` tables, auth session via HTTP-only cookies
- PayloadCMS — Courses and CommunityPosts collections, using the same Supabase Postgres instance via `DATABASE_URL`

**Testing**: Manual validation against demo customers 10002 and 10001 across 13 quickstart scenarios. No automated tests per project norms for V1.

**Target Platform**: Web — desktop and mobile, same as existing dashboard.

**Project Type**: Next.js web application (App Router, server + client components).

**Performance Goals**: Auth callback exchange < 500ms; profile upsert < 100ms per session; recording progress fetch on library mount < 200ms; cross-device sync visible within 5 seconds of write.

**Constraints**:
- `server-only` guard on `core-api.ts` and new `src/lib/supabase/server.ts` — never import from client components
- `SUPABASE_SERVICE_ROLE_KEY` must never be `NEXT_PUBLIC_` prefixed — server-only
- Middleware must call `getUser()` (not `getSession()`) for unforgeable session validation
- PayloadCMS `DATABASE_URL` uses Supabase Postgres direct connection (not pooled Supavisor)
- `use-library-storage.ts` public API must not change — `RecordingPlayer` and `RecordingCard` need no prop updates

**Scale/Scope**: Hundreds of Academy customers in V1. Supabase free tier (500MB database, 50,000 MAU) is sufficient.

## Constitution Check

*No project constitution is in effect (template placeholder only). No gates to evaluate.*

## Project Structure

### Documentation (this feature)

```text
specs/002-supabase-auth-user-data/
├── plan.md                    # This file
├── research.md                # Phase 0 — 9 resolved decisions
├── data-model.md              # Phase 1 — Supabase tables + PayloadCMS collections
├── contracts/
│   ├── auth-flow.md           # Authentication sequence + route protection rules
│   ├── supabase-schema.md     # SQL DDL + RLS policies
│   └── server-actions.md      # Server function signatures + component interfaces
├── quickstart.md              # 13 validation scenarios
└── tasks.md                   # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# New files
src/
├── app/
│   ├── login/
│   │   └── page.tsx                       # Magic link request page
│   └── auth/
│       └── callback/
│           └── route.ts                   # Supabase auth callback (code → session)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                      # createBrowserClient() — 'use client' only
│   │   ├── server.ts                      # createServerClient() — server-only
│   │   └── middleware-client.ts           # createServerClient() for middleware
│   └── auth/
│       └── customer-profile.ts            # upsertCustomerProfile(), getCustomerProfile()
middleware.ts                               # Route guard (repo root)

collections/
├── Courses.ts                             # PayloadCMS Course collection
└── CommunityPosts.ts                      # PayloadCMS CommunityPost collection
payload.config.ts                          # PayloadCMS configuration (repo root)

# Modified files
src/app/customer/[id]/layout.tsx           # Add: profile upsert + ownership check
src/lib/library/use-library-storage.ts    # Add: Supabase sync layer (public API unchanged)
next.config.mjs                            # Add: withPayload() wrapper
```

**Structure Decision**: New Supabase utilities live under `src/lib/supabase/` (parallel to `src/lib/core-api.ts`). Auth server functions live under `src/lib/auth/` (server-only, distinct from the SDK wrapper). PayloadCMS config and collections sit at the repo root per PayloadCMS 3.x convention. Middleware at repo root per Next.js convention.

## Complexity Tracking

No constitution violations to justify.
