# Implementation Plan: Admin Dashboard Redesign

**Branch**: `018-admin-dashboard-redesign` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-admin-dashboard-redesign/spec.md`

## Summary

Replaces the placeholder `/admin/dashboard` page (currently two static link cards) with a real, data-driven admin home page: four live stat cards, two small hand-rolled SVG charts, four operational panels (Upcoming Bookings, Review Queue, Credit Watch, Recent Activity), a combined student/staff search, and three quick-action links. No new tables, no new npm dependencies, no new external integrations — every data source either already exists (Credit Watch, booking slots, customer/staff profiles) or is a small, self-contained read-only aggregation over existing columns (month-bucketing, the Recent Activity merge, the cross-app Ask a Coach read). The one new cross-cutting pattern is a dedicated `src/lib/admin-dashboard/` module, since this is the first feature in the codebase whose job is specifically to summarize across five otherwise-unrelated domains (students, staff, booking, Ask a Coach, credit watch, tiers) onto one page — every other feature's lib code lives under its own domain folder because it only ever serves that one domain.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM — unchanged from every prior feature in this app.

**Primary Dependencies**:
- Existing, reused as-is: `@supabase/supabase-js` service-role client, `requireStaffRole()`, `listCustomerProfiles`/`searchCustomerProfiles` (`src/lib/auth/customer-profile.ts`), `listStaffProfiles` (`src/lib/auth/staff-profile.ts`), `listAllUpcomingSlots` (`src/lib/booking/time-slots.ts`), `fetchCreditWatch`/`fetchCreditWatchFallback` (`src/lib/core-api.ts`, `src/lib/credit-watch/fallback.ts`), `advanceTier`'s underlying `student_tier_progress` table.
- New, same project conventions: a small `searchStaffProfiles()` addition to the existing `staff-profile.ts` (research.md #2); a new `src/lib/admin-dashboard/` module (six small files, one per panel/card group, research.md #1–#6); two hand-rolled inline-SVG chart components — no new npm package (research.md #1).
- Cross-app: `apps/ask-a-coach`'s `conversations` table, read and written directly via `apps/academy-platform`'s own service-role client — the same established pattern as `getCrossAppLinks` (research.md #3), not a new HTTP integration.

**Storage**: No new tables or columns. Every shape in data-model.md is computed at request time from existing tables.

**Testing**: No automated test framework exists in this repo (unchanged since every prior feature). Validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app. No new cron jobs, no new externally-triggered endpoints — this is a single page with server-side data fetching on each load.

**Project Type**: Web application — single existing Next.js app (`apps/academy-platform`), no new service, no new route beyond the one existing `/admin/dashboard` page being filled in.

**Performance Goals**: SC-001/SC-004 — the full snapshot perceivable in under 10 seconds, search results in under 10 seconds for a known name. No bulk-operation targets otherwise; data volumes here (dozens of staff, low thousands of students, single-digit-to-low-double-digit daily bookings/open conversations) are small enough that straightforward queries meet this without special optimization.

**Constraints**:
- FR-023 (one failing data source must not blank the page) is met structurally, not just by convention: each panel/card/chart is its own React Suspense boundary with its own server-side data fetch, so a slow or failing Ask a Coach read (the one cross-app dependency) can show a localized error state while every other panel — all backed by `apps/academy-platform`'s own database — renders normally. This mirrors the "a notification failure never blocks the booking" independent-failure philosophy already established in 013/017, applied here to independent *reads* instead of independent side effects.
- FR-013's 12-hour priority threshold and the fixed display caps/lookback window (spec.md Assumptions) are plain constants in `src/lib/admin-dashboard/`, not configuration — no admin-facing settings UI for these in this pass, consistent with spec.md's explicit no-manual-override Assumption.
- The Review Queue bulk assignment (FR-011) writes to a table `apps/academy-platform` doesn't own the migrations for (`conversations` lives in `apps/ask-a-coach`'s Payload/Postgres setup) — the write only ever touches the existing `assigned_coach_id` column via the shared service-role client, never DDL, so no cross-app migration coordination is needed.

**Scale/Scope**: One page, six new small lib files grouped under one new folder, two new small chart components, a handful of new panel/card UI components, one new search function alongside an existing one. No new user-facing route beyond the one page already existing as a placeholder.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project (unchanged since every prior feature). No formal gates to evaluate against. Proceeding under the same established conventions used throughout this codebase: `requireStaffRole()` gating for every page (Super Admin only, matching every other `/admin/*` page — FR-022), a service-role Supabase client instantiated per-file, cross-system/cross-app references stored and queried as plain columns (never a foreign key across the app boundary), and each panel's own data-fetching function owning its own error handling rather than one page-level try/catch.

**Post-design re-check**: One genuinely new pattern, flagged here for visibility even with no formal gates to check against: a dedicated `src/lib/admin-dashboard/` module whose only job is summarizing across five other domains' tables onto one page. This is the first "rollup/summary" module in the codebase — every prior feature's lib code lives under its own domain folder (`src/lib/booking/`, `src/lib/credit-watch/`, etc.) because it only ever serves that one domain. Justified inline above (Summary) and in research.md; not blocking, documented in Complexity Tracking below for visibility only.

## Project Structure

### Documentation (this feature)

```text
specs/018-admin-dashboard-redesign/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output — no new tables, computed shapes only
├── quickstart.md                        # Phase 1 output
└── checklists/
    └── requirements.md
```

No `contracts/` directory — this feature adds no new public/external API surface (no new `/api/v1/*` routes); every data access is server-side Next.js data fetching consumed only by this one page, consistent with the plan template's own guidance to skip contracts for purely internal features.

### Source Code (repository root)

```text
apps/academy-platform/src/
├── app/
│   └── admin/
│       └── dashboard/
│           └── page.tsx                  # MODIFIED — replaces the two-link placeholder
│                                           # with the full dashboard (Stories 1–7)
├── components/
│   └── admin-dashboard/
│       ├── StatCard.tsx                  # NEW — the four Story 1 cards, one shared component
│       ├── StudentGrowthChart.tsx        # NEW — inline SVG line/area chart (Story 2)
│       ├── NewEnrollmentsChart.tsx       # NEW — inline SVG bar chart (Story 2)
│       ├── UpcomingBookingsPanel.tsx     # NEW — Story 3
│       ├── ReviewQueuePanel.tsx          # NEW — Story 4, includes the bulk-assign form
│       ├── CreditWatchPanel.tsx          # NEW — Story 5
│       ├── RecentActivityPanel.tsx       # NEW — Story 6
│       ├── DashboardSearch.tsx           # NEW — Story 7 search box (client component,
│       │                                   # debounced input calling a server action)
│       └── QuickActions.tsx              # NEW — Story 7 bottom button row
└── lib/
    ├── auth/
    │   └── staff-profile.ts              # MODIFIED — adds searchStaffProfiles() (research.md #2)
    └── admin-dashboard/
        ├── snapshot.ts                   # NEW — the four stat-card aggregations (FR-001–004)
        ├── growth.ts                     # NEW — month-bucketing shared by both charts +
        │                                   # Active Students MoM (FR-005/006, research.md #6)
        ├── bookings.ts                   # NEW — listTodaysBookings(), thin filter over
        │                                   # listAllUpcomingSlots (FR-007/008)
        ├── review-queue.ts               # NEW — cross-app conversations read + bulk-assign
        │                                   # action (FR-009–012, research.md #3)
        ├── credit-watch.ts               # NEW — thin wrapper over fetchCreditWatch, top-N
        │                                   # only (FR-014/015, research.md #4)
        ├── activity.ts                   # NEW — the three-source merge (FR-016/017,
        │                                   # research.md #5)
        └── search.ts                     # NEW — combines searchCustomerProfiles +
                                            # searchStaffProfiles into one tagged result list
                                            # (FR-018–020)
```

**Structure Decision**: Everything new lives under one new `src/lib/admin-dashboard/` folder and one new `src/components/admin-dashboard/` folder, kept additive — the only existing files touched are the placeholder page itself (replaced) and `staff-profile.ts` (one new exported function appended, no existing function changed). No existing route, collection, or table outside those two files is touched. Each `src/lib/admin-dashboard/*.ts` file is deliberately thin where a reusable function already exists elsewhere (`bookings.ts`, `credit-watch.ts`) and only genuinely new where no reuse is possible (`growth.ts`, `activity.ts`, `review-queue.ts`'s cross-app read) — matching this codebase's established "thin wrapper over existing data, new code only where nothing exists yet" convention from 017's `audit.ts`/`api-keys.ts`.

## Complexity Tracking

*No constitution violations — table intentionally omitted, per the Constitution Check note above (no ratified gates exist to violate). The one new pattern (a cross-domain summary module) is justified inline in Technical Context and Constitution Check above, not tracked here since there's no gate it would be an exception to.*

## Addendum: Story 8 — Staff/Coach Dashboard (added 2026-10-08)

No new files beyond `src/app/staff/dashboard/page.tsx` (modified in place, same as the Admin
Dashboard's own placeholder replacement) — every lib function and panel/card component built for
Stories 1-7 is imported and reused directly. The only `src/lib/admin-dashboard/` changes are two
backward-compatible optional parameters (`coachId` on `getBookingsTodayStat` and
`listTodaysBookings` — omitted, behavior is byte-for-byte unchanged) and three new optional props
on `UpcomingBookingsPanel` (each defaulting to its existing Admin Dashboard value). This keeps
the "one new cross-domain module" footprint from the Constitution Check above exactly as it was
— Story 8 adds role-aware composition, not new data-access patterns.
