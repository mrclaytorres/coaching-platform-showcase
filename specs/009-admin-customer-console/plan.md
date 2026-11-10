# Implementation Plan: Admin Customer Console

**Branch**: `009-admin-customer-console` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-admin-customer-console/spec.md`

## Summary

A new staff-only `/staff/customers` console lets staff locate any Core customer by CourseHost/Core ID directly (works even if the customer never linked a Academy portal account) or, for customers who have linked a portal account, by searching email/name against the local `customer_profiles` table. Locating a customer lands on a per-customer detail page showing their full snapshot — credit wallets (with the same effective-balance overlay Credit Watch already computes), upcoming/past sessions, and the activity ledger — plus a manual credit-adjustment form. The adjustment form and history reuse the existing `credit_adjustments` audit log unchanged (008-staff-credit-watch); no new adjustment data model, no new Core write path. The wallet/adjustment-form/history UI is extracted from Credit Watch's existing per-customer drill-down into a shared component, which both this console's detail page and Credit Watch's drill-down render — this also brings sessions and the activity ledger to Credit Watch's drill-down for the first time, since both surfaces now render the same component against the same `fetchSnapshot()` data. Access is gated to `super_admin` + `staff` via the existing `requireStaffRole`, matching Credit Watch.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM (`"type": "module"`)

**Primary Dependencies**: existing `src/lib/core-api.ts` (`fetchSnapshot`, unchanged), existing `src/lib/credit-watch/adjustments.ts` (`listAdjustmentsForCustomer`, `createCreditAdjustment`, unchanged), existing `src/lib/credit-watch/effective-balance.ts` (`applyPlaceholderAdjustments`, unchanged), existing `src/lib/auth/staff-profile.ts` (`requireStaffRole`, unchanged), existing `src/lib/auth/customer-profile.ts` (`getCustomerProfileByCoreId` reused as-is; one new function added — see below), `@supabase/supabase-js` (service-role client, same pattern as every other staff-only read path in this codebase)

**Storage**: No new tables. Reuses `credit_adjustments` (008-staff-credit-watch) and the existing `customer_profiles` table (searched read-only, not written to by this feature). Balances, sessions, and activity are never stored by Academy — always read live from Core via `fetchSnapshot()`.

**Testing**: No automated test framework in this repo (confirmed in 008-staff-credit-watch's plan; still true). Validation is manual via `quickstart.md`, consistent with prior features.

**Target Platform**: Node 22 server running the existing Next.js app (`next dev` locally, `next start` in production)

**Project Type**: Web application — single existing Next.js app, no new services

**Performance Goals**: N/A beyond "feels instant for staff use" — internal tool, low request volume, no specific throughput target (same as 008-staff-credit-watch)

**Constraints**:
- Email/name search MUST only query the local `customer_profiles` table (linked accounts) — no new Core endpoint is introduced or assumed for v1 (FR-002, resolved in spec.md's Q1)
- Direct CourseHost/Core ID lookup MUST work for any customer, linked or not, using only the existing `fetchSnapshot()` call (FR-001)
- Credit adjustments MUST use the existing `credit_adjustments` table and MUST NOT write to Core (FR-006–FR-008, unchanged from 008-staff-credit-watch)
- A customer's adjustment history and effective balance MUST be identical whether reached via this console or via Credit Watch's drill-down (FR-009) — enforced structurally by having both routes render the same shared component against the same server functions, not by keeping two implementations in sync manually
- Access restricted to `staff`/`super_admin` roles; `coach` MUST NOT see this feature, including in navigation (FR-010)
- This feature MUST NOT change Credit Watch's at-risk/negative-balance dashboard scope (FR-011) — only its drill-down page gains sessions/activity rendering, via the shared component

**Scale/Scope**: Same customer population as Credit Watch/the existing snapshot endpoint — no new scale dimension. Search is a single ILIKE-style match against `customer_profiles` (currently small — only linked accounts), no pagination needed at current scale.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified principles exist for this project (same finding as 008-staff-credit-watch's plan). No gates to evaluate against. Proceeding under the project's established conventions instead: `requireStaffRole()` gating for all staff-only reads/writes, service-role Supabase client instantiated per-file for privileged reads, existing per-customer Core snapshot as the single source of truth for wallets/sessions/activity, and the "effective balance overlay" pattern established in 008-staff-credit-watch for any balance display.

**Post-design re-check**: No new dependencies, services, tables, or cross-cutting patterns were introduced. The one structural addition — a shared presentational component consumed by two routes — reduces duplication rather than adding it. No constitution gates apply.

## Project Structure

### Documentation (this feature)

```text
specs/009-admin-customer-console/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   └── server-actions.md                # Academy-side functions/pages this feature adds or modifies
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── staff/
│       ├── customers/
│       │   ├── page.tsx                       # NEW — search (by email/name) + direct ID lookup form (US1 + US3)
│       │   ├── CustomerSearchForm.tsx          # NEW — 'use client', ID + search inputs, routes to /staff/customers/[id]
│       │   └── [coreCustomerId]/
│       │       └── page.tsx                    # NEW — resolves snapshot + linked-account status, renders CustomerDetailPanel (US1 + US2)
│       └── credit-watch/
│           └── [coreCustomerId]/
│               └── page.tsx                    # MODIFIED — now renders the shared CustomerDetailPanel instead of its own inline JSX
├── components/
│   └── customers/
│       └── CustomerDetailPanel.tsx             # NEW — shared: wallets, sessions, activity ledger, adjustment form + history
└── lib/
    └── auth/
        └── customer-profile.ts                 # MODIFIED — adds searchCustomerProfiles(query) alongside existing functions
```

**Structure Decision**: Lives under `/staff/*`, not `/admin/*`, because `/admin/layout.tsx` gates on `role === 'super_admin'` only, while this feature's resolved access level (FR-010) is `super_admin` **and** `staff` — the same as Credit Watch. Placing it under `/admin/*` would require loosening that layout's gate, which would also loosen access to Staff account management (invites, role changes) — a different, genuinely admin-only concern that should stay `super_admin`-only. `/staff/customers` follows the exact precedent of `/staff/credit-watch` (same directory level, same role gate, same nav-item pattern in `StaffSidebar.tsx`). No new project, package, or service; no new external dependency (unlike 008-staff-credit-watch, this feature has no blocked/future Core endpoint — everything it needs already exists in production today).

## Complexity Tracking

*No constitution violations — table intentionally omitted.*
