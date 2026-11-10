# Implementation Plan: Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign

**Branch**: `021-staff-students-submissions-tiers-ui` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-staff-students-submissions-tiers-ui/spec.md`

## Summary

Redesigns five pages — Staff Dashboard, Staff Accounts, Students, Submissions, Tiers — to match
five provided mockups, continuing the card-based/Anton language from specs/018-020. Staff,
Submissions, and Tiers are near-pure restyles. Students adds real stat cards (two real, two
honestly substituted — research.md #4) plus client-side search/pagination/CSV export. Staff
Dashboard is a full content replacement of specs/018 Story 8's earlier, mockup-less design,
reusing every number from existing specs/018/020 functions — zero new aggregation anywhere in
this feature except a small time-based Submissions priority flag mirroring an established
pattern (research.md #5).

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22 — unchanged.

**Primary Dependencies**:
- Existing, reused as-is: `getBookingsTodayStat`, `getAwaitingReviewStat`,
  `getActiveStudentsStat`, `DashboardSearch` (`src/lib/admin-dashboard/*`, specs/018);
  `getCreditWatchAlerts` (specs/020); `listStaffProfiles`, `listCustomerProfiles`
  (`src/lib/auth/*`); `listSubmissions` (`src/lib/progress/submissions.ts`); `listTiers`/
  `createTier`/`updateTier`/`deleteTier`/`setTierPricing` (`src/lib/courses/tier-actions.ts`).
- New: a small client-side search/pagination wrapper for `StaffListTable`/`StudentListTable`
  (research.md #2); a client-side CSV builder for Students (research.md #3); a request-time
  `isPriority` computation for Submissions (research.md #5) — no new npm dependency anywhere.

**Storage**: No new tables or columns.

**Testing**: No automated test framework exists in this repo. Validation is manual via
`quickstart.md`.

**Target Platform**: Existing Next.js app, no new routes — five existing pages restyled.

**Performance Goals**: No new targets — every reused stat function already runs on its own
existing page; Staff Dashboard composing four of them in parallel is the only place this
feature adds concurrent calls, matching specs/018's own Suspense-per-card pattern.

**Constraints**: FR-018 — every page's existing role gate stays exactly as-is.

**Scale/Scope**: Five pages restyled, one small client-side list-filter component (reused across
Staff and Students), one client-side CSV export, one small priority computation. No new routes,
no new tables.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist.
No formal gates to evaluate against. Proceeding under the same established conventions as
specs/018-020: existing role gates preserved verbatim, new aggregation avoided in favor of
reusing already-built functions wherever possible.

**Post-design re-check**: The one judgment call worth flagging for visibility (not a gate
violation): Staff Dashboard's content is being replaced a second time (first specs/018 Story 8,
now this spec) because the earlier round had no real mockup to work from. Documented explicitly
in spec.md's Assumptions (FR-004) rather than left as a silent overwrite.

## Project Structure

### Documentation (this feature)

```text
specs/021-staff-students-submissions-tiers-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

No `contracts/` — no new public API surface.

### Source Code (repository root)

```text
apps/academy-platform/src/
├── app/
│   ├── staff/
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # MODIFIED — Story 1, replaces specs/018 Story 8 content
│   │   ├── submissions/
│   │   │   └── page.tsx                  # MODIFIED — Story 4 redesign + priority flag
│   │   └── tiers/
│   │       └── page.tsx                  # MODIFIED — Story 5 redesign (visual only)
│   └── admin/
│       ├── staff/
│       │   └── page.tsx                  # MODIFIED — Story 2 redesign
│       └── students/
│           └── page.tsx                  # MODIFIED — Story 3 redesign + stat cards + export
└── components/
    ├── StaffListTable.tsx                # MODIFIED — wrapped with search/pagination (research.md #2)
    ├── StudentListTable.tsx              # MODIFIED — wrapped with search/pagination + CSV export
    └── admin-dashboard/
        └── ShortcutCard.tsx              # NEW — Staff Dashboard's big nav-card tile (Story 1)
```

**Structure Decision**: No new lib files — every number this feature needs already exists from
specs/018/020. The only new component is `ShortcutCard` (a simple, reusable tile); search/
pagination is added directly inside the two existing list table components rather than as
separate new components, since each is only ever used by its own one page.

## Complexity Tracking

*No constitution violations — table intentionally omitted (no ratified gates exist to violate).*
