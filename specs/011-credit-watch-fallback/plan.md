# Implementation Plan: Credit Watch Data Fallback (Interim)

**Branch**: `011-credit-watch-fallback` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-credit-watch-fallback/spec.md`

## Summary

When the aggregate Core endpoint `/pull_credit_watch/` fails (it doesn't exist yet — spec 008 is blocked on it), `/staff/credit-watch` currently shows a raw error instead of a page. This feature adds a fallback data path: on failure of `fetchCreditWatch()`, the page builds the same two lists ("Negative balances right now" and "Upcoming sessions at risk") itself, one student at a time, by calling the existing, already-working `fetchSnapshot()` for every student in the local `customer_profiles` table (portal-logged-in and staff-seeded accounts — the only pool Academy can enumerate today). The result is shaped identically to `CreditWatchResponse` so the existing page/table rendering is reused almost unchanged, plus a `source: 'fallback'` marker that drives fallback-only UI: a visible "partial data" banner (Story 3), an "Estimate" label on every at-risk row (Story 2/FR-008, since per-session cost is assumed at 1 credit), and "renewal info not available" wording in place of "no active subscription" (since the snapshot endpoint carries no renewal data at all). No new Core endpoint, no new Supabase table — this composes entirely from data sources that already exist and are already proven working in production (`/staff/credit-watch/[coreCustomerId]` already renders live `fetchSnapshot()` data today).

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`)

**Primary Dependencies**: existing `src/lib/core-api.ts` (`fetchSnapshot`, already `cache()`-wrapped, unmodified), existing `src/lib/auth/customer-profile.ts` (`listCustomerProfiles()` — the enumerable "known students" pool), existing `src/lib/credit-watch/effective-balance.ts` (`applyPlaceholderAdjustments`, reused unchanged), existing `src/lib/credit-watch/adjustments.ts` (`listAdjustmentsForCustomer`)

**Storage**: None new. Reads the existing `customer_profiles` table (Supabase, read-only via `listCustomerProfiles()`) and the existing `credit_adjustments` table (via existing `listAdjustmentsForCustomer`). No new tables, no writes.

**Testing**: No automated test framework exists in this repo (confirmed for spec 008; unchanged). Validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app (`next dev` locally, `next start` in production)

**Project Type**: Web application — single existing Next.js app, no new services

**Performance Goals**: Page load "comparable to today's normal page load" (SC-004) for the current size of `customer_profiles` — small enough today that sequential-per-student fan-out via `Promise.all` is acceptable without a concurrency limiter (see research.md).

**Constraints**:
- MUST NOT change behavior when the normal aggregate source (`fetchCreditWatch`) succeeds — fallback only triggers on its failure (FR-001).
- MUST reuse the same effective-balance overlay (`applyPlaceholderAdjustments`) so fallback figures match the per-student detail page exactly (FR-003, SC-002).
- MUST NOT claim renewal coverage it cannot know — snapshot data has no renewal field, so fallback rows always render "renewal info not available," never "no active subscription" (Story 2 Acceptance Scenario 3).
- MUST NOT drop a student's row for one missing field (FR-007) — missing coach/lesson-type name renders as "Unknown," matching existing UI fallback text already used on the primary path.
- A per-student `fetchSnapshot` failure MUST NOT fail the whole page — partial results render with a count of unchecked students (Edge Cases).

**Scale/Scope**: Bounded by `customer_profiles` row count, which is small today (dev/early-stage user base per Assumptions bullet 4) — no pagination or throttling in this feature; revisit if that stops being true.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project, same as spec 008. No gates to evaluate against. Proceeding under the same established conventions already in use across this codebase: `requireStaffRole()` gating (unchanged — this feature adds no new entry point, it modifies the existing gated `/staff/credit-watch` page), reuse of existing pure-function modules over new abstractions, and no new persistence beyond what already exists.

**Post-design re-check**: No new dependencies, no new services, no new tables. The only new module is a plain aggregation function composing four already-existing, already-tested-in-production functions. No constitution gates apply.

## Project Structure

### Documentation (this feature)

```text
specs/011-credit-watch-fallback/
├── plan.md                       # This file
├── research.md                   # Phase 0 output
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/
│   └── fallback-module.md        # Internal function contract this feature adds
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── staff/
│       └── credit-watch/
│           └── page.tsx                  # MODIFIED — on fetchCreditWatch() failure, calls the
│                                          # new fallback builder instead of rendering the error
│                                          # state; renders the fallback banner (Story 3), and the
│                                          # "renewal info not available" / "Estimate" wording
│                                          # variants driven by `creditWatch.source === 'fallback'`
└── lib/
    └── credit-watch/
        └── fallback.ts                   # NEW — plain module (no 'use server'; only called from
                                           # the already-gated page). Builds a CreditWatchResponse-
                                           # shaped result (plus `source`/`uncheckedCount`) from
                                           # listCustomerProfiles() + fetchSnapshot() per student.
```

**Structure Decision**: Adds one new plain module and modifies the one existing page — no new route, no new project. Mirrors spec 008's own structure convention (`src/lib/credit-watch/*` for credit-watch-specific logic). The per-student detail page (`[coreCustomerId]/page.tsx`) is unmodified — it already works.

## Complexity Tracking

*No constitution violations — table intentionally omitted.*
