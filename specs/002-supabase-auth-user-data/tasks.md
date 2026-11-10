# Tasks: Supabase Auth, Customer Profile Sync, and Content Management Foundation

**Input**: Design documents from `specs/002-supabase-auth-user-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-flow.md, contracts/supabase-schema.md, contracts/server-actions.md

**Tests**: Not included — no TDD requirement in spec; V1 dashboard test norms per project.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies on in-progress tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All file paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create directory scaffold, provision environment variables, and apply the Supabase database schema. All later phases depend on this.

- [x] T001 Install new npm dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `payload`, `@payloadcms/next`, `@payloadcms/db-postgres`, `@payloadcms/richtext-lexical` — run `npm install` and verify no peer-dependency errors
- [x] T002 [P] Create directories: `src/lib/supabase/`, `src/lib/auth/`, `collections/` per plan.md source layout
- [x] T003 [P] Add all new environment variables to `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — never `NEXT_PUBLIC_`), `DATABASE_URL` (Supabase Postgres direct connection), `PAYLOAD_SECRET` (random 32-char string), `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3040`) — do NOT commit `.env`
- [x] T004 Apply Supabase database schema: run all SQL from `specs/002-supabase-auth-user-data/contracts/supabase-schema.md` in the Supabase SQL editor — creates `customer_profiles`, `recording_progress` tables, indexes, RLS policies, and `updated_at` triggers

**Checkpoint**: Dependencies installed, directories exist, `.env` populated, Supabase tables created with RLS enabled.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Supabase client factories that every user story depends on. No US work can begin until T005–T007 are complete.

**⚠️ CRITICAL**: US1, US2, US3 all import from `src/lib/supabase/` — this phase blocks all user story implementation.

- [x] T005 [P] Create `src/lib/supabase/client.ts` — export `createSupabaseBrowserClient()` using `createBrowserClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; add `'use client'` directive at top of file
- [x] T006 [P] Create `src/lib/supabase/server.ts` — export `createSupabaseServerClient()` using `createServerClient` from `@supabase/ssr` with `cookies()` from `next/headers`; add `import 'server-only'` at top of file (mirrors the `core-api.ts` pattern)
- [x] T007 [P] Create `src/lib/supabase/middleware-client.ts` — export `createSupabaseMiddlewareClient(request: NextRequest, response: NextResponse)` using `createServerClient` from `@supabase/ssr`; reads cookies from request, writes to response; see contracts/server-actions.md for the function signature

**Checkpoint**: All three Supabase client factories are ready — US1, US2, US3 can now be implemented.

---

## Phase 3: User Story 1 — Secure Customer Login (Priority: P1) 🎯 MVP

**Goal**: Every `/customer/[id]` route is protected by a middleware guard. Customers log in via magic link to their Academy-registered email. Unauthenticated visitors are redirected to `/login`. An authenticated customer cannot access another customer's URL.

**Independent Test**: Open an incognito window and navigate to `http://localhost:3040/customer/10001` — confirm redirect to `/login`. Submit the email for customer 10001 — confirm "Check your email" message. Click the magic link — confirm redirect to the correct dashboard. Manually change the URL to `/customer/10002` while logged in as 10001 — confirm access is denied.

- [x] T008 [P] [US1] Create `src/app/login/page.tsx` — render a centered email form with Academy design tokens (`bg-brand-bg`, `brand-card`, `brand-border`, `brand-text`, `brand-accent` submit button); include a Server Action that calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodedNext}\` } })`; show a "Check your email" confirmation on success; accept an optional `?next=` query param and pass it through to the callback URL
- [x] T009 [P] [US1] Create `src/app/auth/callback/route.ts` — GET route handler; extract `code` from URL search params; call `supabase.auth.exchangeCodeForSession(code)`; on success redirect to `next` query param (validate it is a relative path starting with `/` to prevent open redirect); on error redirect to `/login?error=auth_failed`
- [x] T010 [US1] Create `middleware.ts` at the repo root — import `createSupabaseMiddlewareClient` from `src/lib/supabase/middleware-client.ts`; match pattern `'/customer/:path*'`; call `supabase.auth.getUser()` (not `getSession()`); if no user, redirect to `/login?next={encodeURIComponent(request.nextUrl.pathname)}`; write updated session cookie to response; export `config` with matcher that excludes `/_next/static`, `/_next/image`, `/favicon.ico`, `/login`, `/auth/callback`
- [x] T011 [US1] Add logout to `src/components/Sidebar.tsx` — add a logout `<form>` with a Server Action that calls `createSupabaseServerClient().auth.signOut()` then `redirect('/login')`; render a "Log out" button in the sidebar footer below the customer name and email; style consistently with existing muted text links

**Checkpoint**: US1 fully functional — auth guard blocks unauthenticated access, magic link flow works, logout clears session, cross-customer URL shows access denied (after US2 ownership check is wired in Phase 4).

---

## Phase 4: User Story 2 — Automatic Customer Profile Sync (Priority: P1)

**Goal**: On every authenticated page load, the Academy API snapshot data is upserted into the `customer_profiles` table. The customer's `core_customer_id` in the profile is used to validate they own the URL they're accessing.

**Independent Test**: Log in as a brand-new customer → check Supabase `customer_profiles` table — row created with correct Academy data. Manually corrupt `first_name` in the table → log in again → row is corrected. Log in as customer 10001 → try URL `/customer/10002` → confirm redirect to `/customer/10001`.

- [x] T012 [US2] Create `src/lib/auth/customer-profile.ts` — add `import 'server-only'`; implement `upsertCustomerProfile(input: UpsertInput): Promise<UpsertResult>` using `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS); SQL: `INSERT INTO customer_profiles ... ON CONFLICT (supabase_user_id) DO UPDATE SET email=..., first_name=..., core_customer_id=..., updated_at=now()`; throw `CustomerProfileMismatchError` (custom error class) if `input.email !== supabaseUser.email`; also implement `getCustomerProfile(supabaseUserId: string)` returning `{ id, coreCustomerId }` or `null`; see contracts/server-actions.md for full signatures
- [x] T013 [US2] Update `src/app/customer/[id]/layout.tsx` — after the existing `fetchSnapshot` call: (1) call `createSupabaseServerClient().auth.getUser()` to get the authenticated user, (2) call `upsertCustomerProfile({ supabaseUserId: user.id, coreCustomerId: snapshot.customer.id, email: snapshot.customer.email, firstName: snapshot.customer.first_name })`, (3) call `getCustomerProfile(user.id)` to validate `profile.coreCustomerId === Number(params.id)` — if mismatch, `redirect(\`/customer/${profile.coreCustomerId}\`)`

**Checkpoint**: US2 fully functional — profile created/updated on every login, ownership check prevents cross-customer access, combined with US1 the full auth boundary is enforced.

---

## Phase 5: User Story 3 — Cross-device Recording Progress Sync (Priority: P2)

**Goal**: Recording playback positions and "reviewed" markers sync to Supabase and are visible from any device. `localStorage` continues to serve as the offline/optimistic cache. The hook's public API (`getPosition`, `setPosition`, `isReviewed`, `setReviewed`) does not change — no updates needed to `RecordingPlayer` or `RecordingCard`.

**Independent Test**: Mark a recording as reviewed on Browser A (logged in as customer 10001) → open Browser B logged in as the same customer → confirm reviewed indicator appears. Play an mp4 recording past 10s on Browser A → close player → open same recording on Browser B → confirm playback resumes near saved position. Check Supabase `recording_progress` table — confirm rows exist with correct data.

- [x] T014 [US3] Update `src/lib/library/use-library-storage.ts` — add Supabase browser client initialization; add a `useEffect` that on mount calls `createSupabaseBrowserClient().from('recording_progress').select(...)` filtered by `customer_profile_id` (fetched via the authenticated session); merge fetched rows into an in-memory `Map<sessionId, { position: number, reviewed: boolean }>`; hydrate `localStorage` with fetched values; maintain all existing SSR guards (`typeof window === 'undefined'`) and `SecurityError` catch blocks; do not change the function signatures of `getPosition`, `setPosition`, `isReviewed`, `setReviewed`
- [x] T015 [US3] Update `src/lib/library/use-library-storage.ts` — in `setPosition(sessionId, position)` and `setReviewed(sessionId, reviewed)`, after the existing `localStorage` write, fire an async Supabase upsert: `createSupabaseBrowserClient().from('recording_progress').upsert({ customer_profile_id: ..., core_session_id: sessionId, position_seconds: position, is_reviewed: reviewed })` with `onConflict: 'customer_profile_id,core_session_id'`; wrap in `try/catch` — Supabase errors must never surface to the UI or break the localStorage write; `customer_profile_id` is fetched from the customer's profile row on mount and stored in a `useRef`

**Checkpoint**: US3 fully functional — reviewed and position state persist across devices; offline fallback (localStorage) continues working; no changes required to RecordingPlayer or RecordingCard props.

---

## Phase 6: User Story 4 — Content Management Foundation for Academy Staff (Priority: P3)

**Goal**: PayloadCMS 3.x is scaffolded inside the Next.js app. An `/admin` panel is accessible to Academy staff accounts only. Courses and Community Posts content types are defined and editable. Customer Supabase accounts have no access to `/admin`.

**Independent Test**: Navigate to `http://localhost:3040/admin` — confirm PayloadCMS admin login screen loads. Log in with a Payload admin account → confirm "Courses" and "Community Posts" appear in the sidebar. Create a Course entry → confirm it saves. Log in as a regular customer via Supabase magic link → navigate to `/admin` → confirm PayloadCMS login page appears (not the customer dashboard).

- [x] T016 [P] [US4] Create `collections/Courses.ts` — export `Courses: CollectionConfig` with slug `'courses'`; fields: `title` (text, required), `slug` (text, required, unique), `description` (richText using `lexicalEditor()`), `thumbnail` (upload, `relationTo: 'media'`), `status` (select, options: `['draft', 'published']`, defaultValue: `'draft'`, required), `publishedAt` (date); access: `read: () => true`, create/update/delete require `req.user`; admin: `useAsTitle: 'title'`
- [x] T017 [P] [US4] Create `collections/CommunityPosts.ts` — export `CommunityPosts: CollectionConfig` with slug `'community-posts'`; fields: `title` (text, required), `slug` (text, required, unique), `content` (richText using `lexicalEditor()`), `author` (text), `status` (select, options: `['draft', 'published']`, defaultValue: `'draft'`, required), `publishedAt` (date); same access rules as Courses
- [x] T018 [P] [US4] Create `payload.config.ts` at repo root — import `buildConfig` from `payload`, `postgresAdapter` from `@payloadcms/db-postgres`, `lexicalEditor` from `@payloadcms/richtext-lexical`, `payloadCloudPlugin` if applicable; configure: `db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } })`, `editor: lexicalEditor({})`, `collections: [Courses, CommunityPosts]`, `secret: process.env.PAYLOAD_SECRET!`, `serverURL: process.env.NEXT_PUBLIC_APP_URL!`; also add a minimal `Media` collection (upload type) for course thumbnails
- [x] T019 [US4] Update `next.config.mjs` — import `withPayload` from `@payloadcms/next`; wrap the existing `nextConfig` export: `export default withPayload(nextConfig, { configPath: path.resolve(dirname, 'payload.config.ts') })`; preserve existing `reactStrictMode` and `serverActions` settings; add required `import path from 'path'` and `import { fileURLToPath } from 'url'` for ESM dirname resolution

**Checkpoint**: US4 fully functional — `/admin` panel accessible to Payload staff accounts; Courses and CommunityPosts editable; customer Supabase accounts have no Payload access.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, mobile layout, and end-to-end validation.

- [x] T020 [P] Security audit of `middleware.ts` — verify the matcher excludes `/_next/static`, `/_next/image`, `/favicon.ico`, `/login`, `/auth/callback` to prevent redirect loops; verify `src/app/auth/callback/route.ts` validates the `next=` param starts with `/` and does not start with `//` (prevent open redirect to external domains); verify `SUPABASE_SERVICE_ROLE_KEY` is not referenced in any `'use client'` file or `NEXT_PUBLIC_` env var
- [x] T021 [P] Login page mobile audit — open `/login` in browser devtools at 375px viewport width; confirm form is centered, inputs are full-width, submit button is tappable (min 44px height), no horizontal overflow; adjust Tailwind classes in `src/app/login/page.tsx` as needed
- [x] T022 Run all 13 validation scenarios from `specs/002-supabase-auth-user-data/quickstart.md` against the running dev server (`npm run dev`); confirm each passes; document any discrepancies

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002, T003 can run in parallel after T001
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 install must complete) — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — T008 and T009 can run in parallel; T010 and T011 require T005–T007
- **US2 (Phase 4)**: Depends on Phase 3 (US1 must be complete — needs authenticated user in layout)
- **US3 (Phase 5)**: Depends on Phase 4 (US2 must be complete — needs `customer_profile_id` from the profile)
- **US4 (Phase 6)**: Depends only on Phase 1 (needs npm install) — **can run in parallel with US1–US3** after Phase 2
- **Polish (Phase 7)**: Depends on all desired user stories complete

### User Story Dependencies

| Story | Depends On | Can Start After |
|---|---|---|
| US1 (P1) — Auth | Phase 2 complete | T007 done |
| US2 (P1) — Profile Sync | US1 complete | T011 done |
| US3 (P2) — Cross-device Progress | US2 complete | T013 done |
| US4 (P3) — CMS Foundation | Phase 1 complete | T001 done — parallel with US1–US3 |

### Within Each Phase

- Tasks marked `[P]` reference different files and can be dispatched simultaneously
- Sequential tasks (no `[P]`) must complete in listed order
- Phase 3: run T008, T009 in parallel → then T010 → then T011
- Phase 4: T012 → T013 (T013 calls functions from T012)
- Phase 5: T014 → T015 (both edit the same file, in order)
- Phase 6: run T016, T017, T018 in parallel → then T019 (T019 imports from T018)

### Parallel Opportunities

```bash
# Phase 1 — after T001 completes, launch together:
T002  mkdir src/lib/supabase/ src/lib/auth/ collections/
T003  .env.example additions

# Phase 2 — launch together:
T005  src/lib/supabase/client.ts
T006  src/lib/supabase/server.ts
T007  src/lib/supabase/middleware-client.ts

# Phase 3 — launch together first:
T008  src/app/login/page.tsx
T009  src/app/auth/callback/route.ts

# Phase 6 — launch together (parallel with US1–US3):
T016  collections/Courses.ts
T017  collections/CommunityPosts.ts
T018  payload.config.ts

# Phase 7 — launch together:
T020  Security audit (middleware + callback)
T021  Login page mobile audit
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (install, schema)
2. Complete Phase 2: Foundational (Supabase client factories)
3. Complete Phase 3: US1 (auth guard + magic link + logout)
4. Complete Phase 4: US2 (profile sync + ownership check)
5. **STOP and VALIDATE**: Confirm unauthenticated access is blocked, login works, profile is created, cross-customer URLs redirect
6. Ship — the platform now has a real security boundary

### Incremental Delivery

1. Setup + Foundational → Supabase clients ready
2. US1 → Auth guard + login → **security boundary established (critical milestone)**
3. US2 → Profile sync → Academy customer identity in Supabase
4. US3 → Cross-device progress → recording library upgrades from localStorage to server-side sync
5. US4 → CMS foundation → Academy staff can author content
6. Polish → Security hardening + mobile + full validation

### Parallel Team Strategy (if two developers)

After Phase 2:
- Developer A: US1 → US2 → US3 (sequential — auth chain)
- Developer B: US4 (independent — CMS has no dependency on auth chain after Phase 1)

---

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` is used only in `src/lib/auth/customer-profile.ts` (server-only) — never expose to client
- `src/lib/supabase/server.ts` and `src/lib/auth/customer-profile.ts` must have `import 'server-only'` at top
- Middleware calls `getUser()` (validates JWT with Supabase server) — not `getSession()` (reads local cookie only, forgeable)
- `use-library-storage.ts` public API must not change — `RecordingPlayer` and `RecordingCard` props require no updates
- PayloadCMS `/admin` route uses its own authentication (Payload users, not Supabase) — the two systems are isolated
- `DATABASE_URL` for PayloadCMS must use Supabase's **direct** connection string (port 5432), not the pooled Supavisor connection (port 6543) — Payload needs direct Postgres access for migrations
- All `localStorage` accesses must remain guarded with `typeof window !== 'undefined'` — SSR safety from spec 001 must be preserved
