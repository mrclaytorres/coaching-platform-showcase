# Implementation Plan: Staff Credit Watch Dashboard

**Branch**: `008-staff-credit-watch` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-staff-credit-watch/spec.md`

## Summary

A new staff-only `/staff/credit-watch` view aggregates two lists across every student — upcoming sessions in a configurable look-ahead window that would leave a negative balance once debited, and students with a negative balance right now — each annotated with whether an active recurring subscription is expected to cover the shortfall in time. Staff can drill into any row to a single student's full credit picture and record a credit adjustment. The aggregate lists require a **new Core API endpoint** (`POST /pull_credit_watch/`) that does not exist today — this feature is blocked on that endpoint shipping (see `research.md` §1 and `contracts/core-credit-watch-api.md`, the handoff contract). The per-student drill-down reuses the existing `fetchSnapshot()` endpoint unchanged. Credit adjustments are recorded in a new Academy-owned Supabase table (`credit_adjustments`) as placeholder/audit records, since live write access to Core doesn't exist yet; a displayed "effective balance" always overlays a student's placeholder adjustments on top of Core's reported balance.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`)

**Primary Dependencies**: `@supabase/supabase-js` (service-role client, same pattern as every other staff-only write path in this codebase), `@supabase/ssr` (session cookies via existing `createSupabaseServerClient`), existing `src/lib/core-api.ts` (extended with a new `fetchCreditWatch()` alongside `fetchSnapshot()`), existing `src/lib/auth/staff-profile.ts` (`requireStaffRole`)

**Storage**: Supabase Postgres — one new table, `credit_adjustments` (see `data-model.md`, `contracts/supabase-schema.md`). Balances, sessions, coaches, and subscription/renewal data are never stored by Academy — always read live from Core's API per request.

**Testing**: No automated test framework exists in this repo (confirmed: no jest/vitest/tsx in `package.json`). Consistent with prior features, validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app (`next dev` locally, `next start` in production)

**Project Type**: Web application — single existing Next.js app, no new services

**Performance Goals**: N/A beyond "feels instant for staff use" — low request volume (internal staff tool, not customer-facing), no specific throughput target

**Constraints**:
- **Hard external dependency**: this feature cannot go live until Core implements `POST /pull_credit_watch/` per `contracts/core-credit-watch-api.md` — FR-008's renewal-coverage logic (required for v1, not deferred) cannot be satisfied any other way (research.md §1)
- Credit adjustments MUST be applied against placeholder data only, with a persistent "not yet written to Core" indicator, until live write access to Core exists (FR-015) — no code path may claim a real write happened
- Every adjustment MUST be attributable (staff member, timestamp, amount, lesson type, reason) with no way to edit or delete an existing entry — corrections are new entries, not edits (FR-014, SC-007)
- Access restricted to `staff`/`super_admin` roles; `coach` role MUST NOT see this feature at all, including in navigation (FR-010)
- All displayed times are UTC, independent of any student's own display-timezone preference (FR-012)

**Scale/Scope**: Whatever Core's full active-student population is (unknown exact count — the reference mockup shows "195 negative balances" as a plausible order of magnitude); this is an aggregate/list view, not a per-request-heavy interaction, so no pagination strategy is specified in the spec — `tasks.md` should confirm whether the eventual real Core response needs client-side pagination once its actual size is known.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project. There are no gates to evaluate against. Proceeding under the project's established conventions instead, as observed directly in the current (`develop`) codebase: `requireStaffRole()` gating for all staff-only reads/writes (`src/lib/auth/staff-profile.ts`, used throughout `src/app/staff/*` and `src/lib/courses/tier-actions.ts`), service-role Supabase client instantiated inline per-file for privileged writes, RLS-enabled tables with no client-side policy when all access goes through server actions, and cross-system references stored as plain (non-FK) columns when the referenced entity isn't guaranteed to have a local row.

**Note on precedent**: an earlier draft of spec.md's FR-010 cited "the existing purchases/refunds staff view" as precedent for staff/super-admin-only access — that page exists only on an unmerged branch (`006-course-sales-payments`), not on `develop`. This was caught during `/speckit-analyze` and corrected in spec.md; FR-010 and the matching Assumptions bullet now cite the actual `develop` precedent, the `requireStaffRole` pattern itself (e.g., `src/lib/courses/tier-actions.ts` gating Tier management to non-coach roles), which is what this plan applies.

**Post-design re-check**: No new dependencies, services, or cross-cutting patterns were introduced beyond what's documented above and in `research.md` — still no constitution gates apply. The one new external dependency (the not-yet-existing Core endpoint) is a data dependency, not an architectural one, and is called out explicitly rather than hidden.

## Project Structure

### Documentation (this feature)

```text
specs/008-staff-credit-watch/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   ├── core-credit-watch-api.md        # NEW Core endpoint — handoff contract, external dependency
│   ├── supabase-schema.md               # credit_adjustments table
│   └── server-actions.md                # Academy-side functions/pages this feature adds or modifies
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── staff/
│       └── credit-watch/
│           ├── page.tsx                 # NEW — aggregate dashboard (US1 + US2), ?days= look-ahead
│           └── [coreCustomerId]/
│               └── page.tsx             # NEW — per-student drill-down + adjustment form (US3)
├── components/
│   └── StaffSidebar.tsx                 # MODIFIED — adds "Credit Watch" nav item, non-coach only
└── lib/
    ├── core-api.ts                      # MODIFIED — adds fetchCreditWatch() alongside fetchSnapshot()
    ├── auth/
    │   └── staff-profile.ts             # unchanged — requireStaffRole reused as-is
    └── credit-watch/
        ├── adjustments.ts               # NEW — 'use server', staff-role gated CRUD (create + list only)
        └── effective-balance.ts         # NEW — plain module, pure functions (overlay math, renewal-coverage rule)
```

**Structure Decision**: Adds to the existing single Next.js app under `src/app/staff/*` — the same structure and conventions as every other staff-only feature in this codebase (`src/app/staff/tiers`, `src/app/staff/courses`, etc.). No new project, package, or service. The one new external touchpoint is a Core API endpoint that doesn't yet exist (contract documented for handoff); the one new internal touchpoint is a single new Supabase table.

## Complexity Tracking

*No constitution violations — table intentionally omitted.*
