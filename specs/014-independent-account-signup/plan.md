# Implementation Plan: Independent Account Signup

**Branch**: `014-independent-account-signup` | **Date**: 2026-08-25 (revised same day, mid-implementation) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-independent-account-signup/spec.md`

## Summary

Today, every `customer_profiles` row requires a Core (`core.example.com`) customer record to exist first — both places that create a row (`login/page.tsx`'s `linkAccount`, and the dev seeder) call `fetchSnapshot()` before they'll insert anything. This feature removes that requirement.

**Revised mid-plan**: the first draft of this plan designed a nullable `customer_profiles.core_customer_id` and a new `/account` route tree for unlinked users. Before writing any migration, discovery work turned up branch `006-course-sales-payments` — unmerged, but 26/27 tasks complete, and its schema change **already applied to the shared dev database**. That branch solved the near-identical problem ("a buyer with no Core `customer_id`") with a different, smaller mechanism: `customer_profiles.account_origin` (`'core-linked' | 'native'`) plus a disjoint **negative** synthetic `core_customer_id` for native accounts (`next_native_customer_id()`), keeping the column `NOT NULL` throughout and requiring no new route tree — `/customer/[id]/layout.tsx` and `page.tsx` just skip `fetchSnapshot()` for a native account and render existing empty states. This plan now builds on that foundation instead of duplicating it (user-confirmed direction). See research.md §0 for the full account.

What this feature actually adds on top of 006's foundation: (1) creating a native account from `/login`'s signup path instead of only from checkout, (2) the verified linking flow that converts a native account into a core-linked one — something 006 never built at all, since its native accounts are a one-way "bought without Core" outcome.

## Technical Context

**Language/Version**: TypeScript 5.5, Next.js 14.2 (App Router), Node 22, ESM

**Primary Dependencies**: `@supabase/supabase-js` (service-role client, same inline-per-file pattern as every other write path in this repo), `@supabase/ssr` (existing session handling, unchanged), `resend` (existing dependency, reused via the same pattern as `src/lib/booking/notifications.ts`), Node's built-in `crypto` (token generation/hashing — no new dependency).

**Storage**: Supabase Postgres.
- **Already live, reused as-is, no migration needed**: `customer_profiles.account_origin` (`'core-linked' | 'native'`, `CHECK` constraint), `native_customer_id_seq`, `next_native_customer_id()` RPC — all from branch 006, applied directly to the database ahead of that branch merging. This feature's Foundational phase ports the small set of 006 application-code pieces it depends on (`createNativeCustomerProfile()`, the `layout.tsx`/`page.tsx` `account_origin` guards) from that branch into this one, without pulling in 006's unrelated Stripe/`purchases`/checkout scope.
- **New table**: `core_link_requests` — one row per link attempt, holding a hashed one-time verification token, its expiry/consumed state, and enough context (requesting account, target Core id, requesting IP) to drive both the verification flow and the rate limit. Service-role access only, same as `booking_notification_failures`.
- No change to `bookings`/`booking_time_slots`/`student_tier_progress`/`course_enrollments` — a native account's `customer_profiles.id` never changes across linking (only `core_customer_id` and `account_origin` do), so rows already written against it stay correctly attached.

**Testing**: No automated test framework exists in this repo (confirmed unchanged since specs 008/011/012). Validation is manual via `quickstart.md`.

**Target Platform**: Node 22 server running the existing Next.js app (`next dev` locally, `next start` in production) — no new services.

**Project Type**: Web application — single existing Next.js app.

**Performance Goals**: N/A beyond "feels instant" — single-account, single-action flows, no bulk operations.

**Constraints**:
- MUST NOT create a second, disconnected `auth.users` identity as a side effect of link verification (spec FR-006) — the verification token flow is deliberately independent of Supabase's own OTP/session machinery (research.md §1).
- MUST NOT allow a Core customer id to end up linked to two platform accounts (FR-008) — enforced by the pre-existing `customer_profiles.core_customer_id UNIQUE` constraint itself.
- MUST NOT disclose anything about an already-linked account when a second account attempts to claim the same Core id (FR-014).
- MUST rate-limit link lookup/request attempts per account and per originating request source (FR-009).
- MUST preserve staff-granted enrollments (spec 012) when a native account links to a Core id that already had a staff-created pending `customer_profiles` row on file (FR-011) — a merge case, not just a column update (research.md §4, adapted for the native-account trigger).
- MUST NOT change behavior for any existing caller of `requireCustomerProfile()` — its signature, return type, and behavior are **completely unchanged** by this feature (unlike the withdrawn nullable-column draft, a native account already has a real, if negative, `core_customer_id`, so no redirect branch is needed here at all).
- Verification tokens are single-use and expire after 24 hours (spec Assumptions).
- Scope boundary: this feature reuses 006's `account_origin` schema and ports the two guard files it needs; it does **not** take on 006's checkout/Stripe/`purchases` functionality, which remains separately scoped to branch 006 for whenever that ships independently.

**Scale/Scope**: Single-account, single-action operations — signup, one link request, one verification click. No bulk/admin tooling in this version.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template — no ratified project principles exist. No gates to evaluate against. Proceeding under the same conventions already established throughout this codebase, and deliberately reusing branch 006's already-validated `account_origin` design rather than introducing a second, competing convention for "not really Core" accounts.

**Post-design re-check**: One new table (`core_link_requests`), no schema changes to `customer_profiles` (006 already covers what's needed), two small ported files, no new external services, no new runtime dependency.

## Project Structure

### Documentation (this feature)

```text
specs/014-independent-account-signup/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   └── server-actions.md                # Phase 1 output — new/modified function contracts
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── login/
│   │   └── page.tsx                     # MODIFIED — the message === 'no_profile' branch gains a
│   │                                     # second action alongside the existing linkAccount form:
│   │                                     # "Continue without linking" (collects a first name,
│   │                                     # calls createNativeCustomerProfile, redirects straight
│   │                                     # to /customer/{negative id}); also adds the
│   │                                     # message === 'linked_sign_in' display state (US2)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                 # UNCHANGED — its existing Step 6 fallback
│   │                                     # (`/login?message=no_profile`) is the entry point
│   ├── customer/
│   │   └── [id]/
│   │       ├── layout.tsx               # MODIFIED — ports 006's account_origin guard (skip
│   │       │                            # fetchSnapshot for a native account)
│   │       └── page.tsx                 # MODIFIED — ports 006's account_origin guard on the
│   │                                     # dashboard (existing empty states for Core-sourced
│   │                                     # sections, per research.md §0)
│   └── account/
│       └── link/                        # NEW — the only new route tree this feature adds; not
│           │                            # a general "unlinked area" (006 already made that
│           │                            # unnecessary), just the linking flow's own two pages
│           ├── page.tsx                 # Core customer ID entry form → requestCoreLink()
│           └── verify/
│               └── route.ts             # GET ?token=... → consumeCoreLinkToken(); no session
│                                         # required to click (research.md §5)
├── lib/
│   └── auth/
│       ├── customer-profile.ts          # MODIFIED — ports createNativeCustomerProfile() and
│       │                                # getCustomerProfileByEmail() from branch 006 (unmodified
│       │                                # from that branch's version); adds linkCoreAccount()
│       │                                # (NEW — 006 has no equivalent, this is 014's own addition)
│       └── core-link.ts                # NEW — requestCoreLink(), consumeCoreLinkToken(),
│                                         # rate-limit check, verification email send (Resend,
│                                         # same pattern as src/lib/booking/notifications.ts)
```

**Structure Decision**: Single existing Next.js app, no new services, no new route tree for "unlinked users" in general — 006 already established that a native account is just a normal account at `/customer/[id]`. The only new route surface this feature adds is the linking flow itself (`/account/link` + its verify endpoint), which doesn't need a numeric id in its URL since it operates on the caller's session. Coaching booking (Story 3) needs **no new code at all** — `src/app/booking/customer/[id]/*` already resolves the acting student via `requireCustomerProfile()` (session-based), which is completely unaffected by whether `coreCustomerId` is positive or negative.

## Complexity Tracking

*No constitution violations to justify — table is intentionally empty.*
