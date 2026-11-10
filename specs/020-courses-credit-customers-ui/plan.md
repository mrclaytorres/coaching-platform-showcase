# Implementation Plan: Courses, Credit Watch & Customers UI Redesign

**Branch**: `020-courses-credit-customers-ui` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-courses-credit-customers-ui/spec.md`

## Summary

Redesigns four pages — Courses, New Course, Credit Watch, Customers — to match four provided
mockups, continuing the card-based/Anton visual language from specs/018 and specs/019. Courses
and New Course are near-pure restyles (two small data additions already backed by existing
fields/actions). Customers adds one small new "Recent Lookups" read. Credit Watch is the real
work: a new `getCreditWatchAlerts()` unifies the existing negative-balance sweep, a new
low-balance bucket over that same sweep, and existing declined-purchase data into one filterable
alert list — while explicitly declining to fabricate the one mockup category (Cards Expiring)
with no real backing data anywhere in this codebase (research.md #5).

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22 — unchanged.

**Primary Dependencies**:
- Existing, reused as-is: `listCourses`, `updateCourse` (`src/lib/courses/*`),
  `fetchCreditWatchFallback` (`src/lib/credit-watch/fallback.ts`), `listAllPurchases`
  (`src/lib/payments/purchases.ts`), `listCustomerProfiles` (`src/lib/auth/customer-profile.ts`),
  `CustomerSearchForm`.
- New: `getCreditWatchAlerts()` (research.md #3/#4/#5) and `listRecentCustomerLookups()`
  (research.md #7) — both thin, read-only, no new table.

**Storage**: No new tables or columns.

**Testing**: No automated test framework exists in this repo. Validation is manual via
`quickstart.md`.

**Target Platform**: Existing Next.js app, no new routes — four existing pages restyled.

**Performance Goals**: No new targets — Credit Watch's extended sweep iterates the same known-
student set `fetchCreditWatchFallback` already iterates today, just with one more bucket and one
extra field captured per student; no additional external calls.

**Constraints**: FR-018 — every page's existing `requireStaffRole` gate (and the Coach-hides-
New-Course rule) stays exactly as-is.

**Scale/Scope**: Four pages restyled, two new small read-only lib functions, no new components
beyond what's needed for the shared status/issue pill styling (reusing the
`SessionStatusPill`-style pattern from specs/019, not that component itself).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist.
No formal gates to evaluate against. Proceeding under the same established conventions as
specs/018/019: existing role gates preserved verbatim, service-role Supabase client per file,
new aggregation functions kept read-only and additive over data this codebase already owns.

**Post-design re-check**: The one judgment call worth flagging for visibility (not a gate
violation, since none exist): extending `fetchCreditWatchFallback`'s sweep with a second bucket
means Low Balance's real-world accuracy is tied to the fallback path specifically. If/when the
real `/pull_credit_watch/` Core endpoint ships, its own contract would need the equivalent
extension for Low Balance to stay accurate — flagged in research.md #3, not blocking here since
that endpoint doesn't exist yet and isn't this codebase's to change.

## Project Structure

### Documentation (this feature)

```text
specs/020-courses-credit-customers-ui/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
└── checklists/
    └── requirements.md
```

No `contracts/` — no new public API surface.

### Source Code (repository root)

```text
apps/academy-platform/src/
├── app/
│   └── staff/
│       ├── courses/
│       │   ├── page.tsx                  # MODIFIED — Story 1 redesign
│       │   └── new/
│       │       └── page.tsx              # MODIFIED — Story 2 redesign (visual only)
│       ├── credit-watch/
│       │   └── page.tsx                  # MODIFIED — Story 3 redesign + alerts wiring
│       └── customers/
│           └── page.tsx                  # MODIFIED — Story 4 redesign + Recent Lookups
├── components/
│   └── credit-watch/
│       └── AlertPill.tsx                 # NEW — category→color pill (mirrors
│                                           # SessionStatusPill's pattern from specs/019)
└── lib/
    ├── credit-watch/
    │   └── alerts.ts                     # NEW — getCreditWatchAlerts() (research.md #3/#4/#5)
    └── auth/
        └── customer-profile.ts           # MODIFIED — adds listRecentCustomerLookups()
```

**Structure Decision**: Every page stays a thin wrapper over existing or newly-added read
functions, matching specs/018/019's own structure. `alerts.ts` is the one real new aggregation
in this feature; everything else is either unchanged data or a one-function addition to an
existing file.

## Complexity Tracking

*No constitution violations — table intentionally omitted (no ratified gates exist to violate).*
