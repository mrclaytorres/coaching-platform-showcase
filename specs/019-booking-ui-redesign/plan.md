# Implementation Plan: Booking UI Redesign

**Branch**: `019-booking-ui-redesign` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-booking-ui-redesign/spec.md`

## Summary

Redesigns four already-fully-functional Booking pages (`/booking/staff` events list,
`/booking/staff/sessions`, `/booking/staff/schedule`, `/booking/staff/availability`) to match
four provided mockups — card-based sections, Anton headings, a tab-based sub-nav, colored status
pills — continuing the visual language established by specs/018-admin-dashboard-redesign. The
one real functional change: the Sessions page (and, by extension, My Schedule) must show
not-yet-occurred confirmed bookings alongside historical session outcomes, which today's page
can't do at all (research.md #1) — resolved by a read-time merge, no schema change.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22 — unchanged.

**Primary Dependencies**:
- Existing, reused as-is: `listOwnedBookingEvents`, `hasBookingRole` (`src/lib/booking/roles.ts`),
  `listSessionRecords`/`exportSessionsCsv`/`exportSessionsXlsx` (`src/lib/booking/sessions.ts`),
  `listCoachSchedule` (`src/lib/booking/time-slots.ts`), `listSchedulesForCoach`/
  `listOverridesForCoach`/`explainAvailability` (`src/lib/booking/availability.ts`),
  `listStaffProfiles`, `getBookingEvent`.
- New, same conventions as specs/018: a small merge function joining live `bookings` with
  historical `session_records` (research.md #1); `Anton` via `next/font/google`, scoped to
  `src/app/booking/staff/layout.tsx` (research.md #3) — no new npm package.

**Storage**: No new tables or columns — every shape in data-model.md is computed or already
modeled by specs/013.

**Testing**: No automated test framework exists in this repo. Validation is manual via
`quickstart.md`.

**Target Platform**: Existing Next.js app, no new routes beyond what's already live — this is a
restyle of four existing pages, not new pages.

**Performance Goals**: No new targets beyond "feels as fast as the current pages" — data volumes
(a handful of booking events, a coach's sessions over a filtered date range) are the same ones
these pages already handle today.

**Constraints**: FR-020 — every page's existing `requireStaffRole`/`requireBookingRole` gate
stays exactly as-is; this redesign never changes who can see or do what, only how it looks.

**Scale/Scope**: Four pages restyled, one new merge function, two small new presentational
components (`BookingTabs`, a shared breadcrumb pattern), one new font loader addition to one
layout file. No change to `/booking/admin/*` (Calendar/Roles destinations, spec.md Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist
for this project (unchanged since every prior feature). No formal gates to evaluate against.
Proceeding under the same established conventions as specs/013 and specs/018: `requireStaffRole`/
`requireBookingRole` gating preserved verbatim, service-role Supabase client per file, status
pills reusing the existing color-token pattern rather than inventing a new one.

**Post-design re-check**: No new pattern beyond what specs/018 already established (a read-time
merge of two data sources, mirroring that spec's own Recent Activity merge, research.md #5 of
018). Nothing to flag in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/019-booking-ui-redesign/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output — one computed merge shape
├── quickstart.md                        # Phase 1 output
└── checklists/
    └── requirements.md
```

No `contracts/` — no new public API surface; every data access is server-side Next.js data
fetching consumed only by these four pages.

### Source Code (repository root)

```text
apps/academy-platform/src/
├── app/
│   └── booking/
│       └── staff/
│           ├── layout.tsx                # MODIFIED — adds the Anton font loader
│           │                               # (research.md #3), mirroring admin/staff layouts
│           ├── page.tsx                  # MODIFIED — Story 1 redesign
│           ├── sessions/
│           │   └── page.tsx              # MODIFIED — Story 2 redesign + live/historical merge
│           ├── schedule/
│           │   └── page.tsx              # MODIFIED — Story 3 redesign
│           └── availability/
│               └── page.tsx              # MODIFIED — Story 4 redesign (visual only)
├── components/
│   └── booking/
│       ├── BookingTabs.tsx               # NEW — the landing page's tab row (research.md #5)
│       ├── BookingBreadcrumb.tsx         # NEW — the sub-pages' "← BOOKING" link (research.md #4)
│       └── SessionStatusPill.tsx         # NEW — shared status→color pill (research.md #2),
│                                           # used by both Sessions and My Schedule rows
└── lib/
    └── booking/
        └── session-list.ts               # NEW — the live+historical merge (research.md #1,
                                            # data-model.md's Session List Row), consumed by
                                            # both sessions/page.tsx and schedule/page.tsx
```

**Structure Decision**: One new small `src/lib/booking/session-list.ts` module (the one real
data-shape change) plus three new small, shared presentational components under a new
`src/components/booking/` folder — mirroring specs/018's "new cross-cutting pieces get their own
folder, existing pages stay thin wrappers" structure. Every other existing `src/lib/booking/*.ts`
file is read, never modified — this feature adds one new read path, it doesn't touch any
existing write/mutation logic (booking, cancellation, schedule/override CRUD all untouched).

## Complexity Tracking

*No constitution violations — table intentionally omitted (no ratified gates exist to violate).
No new cross-cutting pattern beyond what specs/018 already established and is being reused here.*
