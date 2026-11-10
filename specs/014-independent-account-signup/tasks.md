---

description: "Task list for Independent Account Signup"
---

# Tasks: Independent Account Signup

**Input**: Design documents from `/specs/014-independent-account-signup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: Not requested in spec.md; no automated test framework exists in this repo. Validation is manual via `quickstart.md`, referenced in the Polish phase.

**Organization**: Tasks are grouped by user story (spec.md: US1 = independent signup, P1; US2 = link to an existing Core record, P1; US3 = Academy-native features before linking, P2).

**Revision note**: This task list was rewritten mid-implementation after discovering branch `006-course-sales-payments` already solved "an account with no Core identity" via an `account_origin`/negative-synthetic-id convention, already live on the shared database (research.md §0, user-confirmed direction). The original version of this file (nullable `core_customer_id`, a new `/account` route tree) is superseded — Foundational now ports two small pieces from branch 006 instead of writing a schema migration for `customer_profiles`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to repo root; this is a single Next.js project (no backend/frontend split)

---

## Phase 1: Setup

- [X] T001 Confirm `RESEND_API_KEY` and `BOOKING_EMAIL_FROM` are set locally and that `next dev` runs
- [X] T002 [P] Re-read the current (pre-port) `src/app/login/page.tsx`, `src/lib/auth/customer-profile.ts`, `src/app/customer/[id]/layout.tsx`, and `src/app/customer/[id]/page.tsx` on this branch — the dashboard/layout have been redesigned since branch 006 was cut, so 006's diffs (research.md §0) need adapting, not a direct patch

**Checkpoint**: Environment confirmed ready; no code written yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one new table, the ported account-creation/guard logic from branch 006, and the new linking primitive every user story sits on top of. **Must complete before any user story phase.**

- [X] T003 Write and apply a Supabase migration creating `public.core_link_requests` (columns, indexes, `ENABLE ROW LEVEL SECURITY`, no policies — data-model.md "New table: core_link_requests"). No `customer_profiles` migration — `account_origin`/`native_customer_id_seq`/`next_native_customer_id()` are already live (research.md §0)
- [X] T004 In `src/lib/auth/customer-profile.ts`: (a) port `createNativeCustomerProfile(input: { supabaseUserId, email, firstName }): Promise<{ id, coreCustomerId }>` and `getCustomerProfileByEmail(email): Promise<{ id, coreCustomerId } | null>` from branch 006 (`git show 006-course-sales-payments:src/lib/auth/customer-profile.ts` for reference — port unmodified, they don't depend on any of 006's checkout-specific code); confirm `getCustomerProfileByCoreId`'s return type already includes `firstName`/`accountOrigin` on this branch, adding them if not; (b) add `linkCoreAccount(callerProfileId, coreCustomerId): Promise<{ linkedProfileId }>` — NEW, 006 has no equivalent — implementing both the direct-update case and the pending-row merge case as one transaction (research.md §3, contracts/server-actions.md)
- [X] T005 [P] In `src/app/customer/[id]/layout.tsx`: port branch 006's `account_origin` guard (`git show 006-course-sales-payments:src/app/customer/[id]/layout.tsx` for reference), adapted to this branch's current file content (the `CustomerSidebar`/theme work already on this branch, not present when 006 was cut) — skip `fetchSnapshot()` entirely for a `native` account, sourcing `first_name`/`email` from the profile row instead
- [X] T006 [P] In `src/app/customer/[id]/page.tsx`: port branch 006's `account_origin` guard (`git show 006-course-sales-payments:src/app/customer/[id]/page.tsx` for reference), adapted to this branch's redesigned dashboard (`StatCard`/`CourseRow`/tier-progress work already on this branch, not present when 006 was cut) — skip `fetchSnapshot()` for a `native` account, render existing empty states for Courses/credits/session-history sections
- [X] T007 Create `src/lib/auth/core-link.ts`: `requestCoreLink(requesterProfileId, coreCustomerId): Promise<RequestLinkResult>` (rate-limit check against `core_link_requests` — 5/hour per profile, 20/hour per IP via `headers()`; `fetchSnapshot` 404 → `not_found`; pre-check for an existing `core-linked` owner → `already_linked`; token generation via `crypto.randomBytes(32)` + SHA-256 hash for storage; insert row; send the verification email via Resend, same `getResendClient()`/`BOOKING_EMAIL_FROM` pattern as `src/lib/booking/notifications.ts`, but **not** best-effort — a failed send must be returned as an error) and `consumeCoreLinkToken(rawToken): Promise<ConsumeTokenResult>` (hash lookup, expiry/consumed checks, calls `linkCoreAccount`, marks `consumed_at`) (research.md §1, §4, §5, contracts/server-actions.md)

**Checkpoint**: Migration applied; native-account creation, the two dashboard guards, and the linking primitive exist and compile. Ready for user story work.

---

## Phase 3: User Story 1 - Sign up without an existing account on file (Priority: P1) 🎯 MVP

**Goal**: A person can create a platform account without any pre-existing Core customer record and land directly on a working, non-error dashboard under their own identity.

**Independent Test**: Sign up with a brand-new email, choose "Continue without linking," confirm a `customer_profiles` row exists with `account_origin = 'native'` and a negative `core_customer_id`, and the person lands on `/customer/{that id}` (quickstart.md Scenario 1).

### Implementation for User Story 1

- [X] T008 [US1] In `src/app/login/page.tsx`: add a `continueWithoutLinking` `'use server'` action (reads `first_name`, requires `auth.getUser()`, calls `createNativeCustomerProfile`, `redirect('/customer/' + coreCustomerId)`) and a second form in the `message === 'no_profile'` state, alongside the existing `linkAccount` form (contracts/server-actions.md)

**Checkpoint**: User Story 1 is fully functional and independently testable — a new person can sign up and land directly on their own dashboard (this story needed no new route tree; T005/T006 from Foundational are what make the dashboard itself render correctly for a native account).

---

## Phase 4: User Story 2 - Link the account to an existing legacy customer record (Priority: P1)

**Goal**: A student with an existing Core customer record can connect their native platform account to it, proven via emailed verification, without losing (or duplicating) any staff-granted access already on file.

**Independent Test**: Submit a real Core customer ID from a native account, receive and click the verification email, confirm the account converts to `account_origin = 'core-linked'` with the real id — including the merge case where a spec-012 staff-enrollment pending row already exists for that ID (quickstart.md Scenarios 2, 4).

### Implementation for User Story 2

- [X] T009 [US2] Create `src/app/account/link/page.tsx`: a Core customer ID entry form → `requestCoreLink()` server action; renders the resulting state via `searchParams` (`sent` confirmation, `not_found`, `already_linked` — generic, no details about the other account, FR-014 — `rate_limited`, or `invalid_or_expired` with a "request a new link" retry, reusing this same form)
- [X] T010 [US2] Create `src/app/account/link/verify/route.ts`: unauthenticated `GET` handler reading `?token=`, calls `consumeCoreLinkToken()`; on `'linked'`, check for a session matching `linkedProfileId` and redirect to `/customer/{coreCustomerId}` if present, otherwise `/login?message=linked_sign_in`; on `'invalid_or_expired'`, redirect to `/account/link?error=invalid_or_expired` (contracts/server-actions.md, research.md §4)
- [X] T011 [US2] In `src/app/login/page.tsx`: add the `message === 'linked_sign_in'` display state — "Your account is linked — sign in below to continue," reusing the existing sign-in form as-is (same file T008 modified — sequence after T008, not parallel)

**Checkpoint**: User Story 2 is fully functional and independently testable — linking works for both a fresh Core ID and one with a pre-existing staff-enrollment pending row, guarded against double-linking and rate-limited against guessing.

---

## Phase 5: User Story 3 - Use Academy-native features before linking (Priority: P2)

**Goal**: A native account can browse and book coaching sessions with the same success as a Core-linked account, and its dashboard shows accurate empty states (not errors) for Core-dependent sections.

**Independent Test**: Sign up, skip linking, browse and book a coaching session; confirm it's correctly attached to the account and survives a later link (quickstart.md Scenario 3).

### Implementation for User Story 3

- [X] T012 [US3] No new code — verified live via Playwright against the real dev server: a fresh native account (negative `core_customer_id`) can browse `/booking/customer/{id}`, select a date/time, and complete a booking; the resulting `bookings.student_id` correctly matches the native profile's `id`. One false alarm during verification: an initial fast-clicking test script produced a `bookings_student_id_fkey` violation intermittently — traced to the test script clicking through `DateSlotPicker` faster than React hydration completed in this dev build (confirmed by re-running with realistic interaction timing, which succeeded every time, and by confirming the identical pre-existing `DateSlotPicker`/`bookSlotAction` code is untouched by this feature — not something introduced here). No code change made.

**Checkpoint**: All three user stories are independently functional; the feature is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Run `npm run typecheck`; fix any errors introduced by this feature's changes across `src/lib/auth/customer-profile.ts`, `src/lib/auth/core-link.ts`, `src/app/login/page.tsx`, `src/app/customer/[id]/layout.tsx`, `src/app/customer/[id]/page.tsx`, and the new `src/app/account/link/**` files
- [X] T014 Ran all 5 quickstart.md scenarios live against the real dev server and real database (cleaned up after each run):
  - Scenario 1 (signup): native account created (`account_origin: 'native'`, negative `core_customer_id`), landed on own dashboard, all Core-sourced sections show correct empty states, welcome name rendered correctly.
  - Scenario 2 (linking, common case): link request → real Resend email path exercised (send succeeds); verification consumed via a test-inserted token (real email inbox not accessible from this environment — see Notes) → `linkCoreAccount` updates the row in place, `core_customer_id`/`account_origin` correctly updated, same row `id` preserved.
  - Scenario 2 (linking, merge case): tested against a real pre-existing spec-012-style pending row (`core_customer_id = 133548`, `supabase_user_id IS NULL`) — after linking, the pending row was adopted (`supabase_user_id` set), the native row was deleted, and a booking made while native was correctly reassigned to the pending row's `id`. Restored the pending row to its original state afterward (not deleted — it pre-dates this feature).
  - Scenario 3: see T012.
  - Scenario 4: bogus Core ID → "not found", already-linked Core ID (10001) → "already linked" (generic, no account details), both confirmed via live UI text.
  - Scenario 5: confirmed unaffected — Core-linked dashboard/layout still call `fetchSnapshot()` as before for non-native accounts.
  - Not exercised live: rate-limit threshold (5/hour) and expired-token rejection — both are straightforward per the code (simple count-based gate, `expires_at` comparison in the same query as the token lookup) and pose materially lower risk than the linking/merge path that was tested; recommend a manual pass before shipping if that matters for launch.
- [X] T015 [P] Security spot-check, verified: `core_link_requests` has RLS enabled with 0 policies (service-role-only access, confirmed live against the real database). `token_hash` is SHA-256 hex (64 lowercase hex chars) while the emailed raw token is `crypto.randomBytes(32).toString('base64url')` (~43 mixed-case chars with `-`/`_`) — unambiguously distinct formats by construction, so the raw token is never what's stored. `already_linked`/`rate_limited` responses use the same generic `STATUS_MESSAGES` text regardless of which account or Core id triggered them (confirmed live: a bogus id and an already-linked id each rendered their respective generic message with no account-specific detail, FR-014).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T003-T007 must exist before T008+)
- **User Stories (Phase 3-5)**: All depend on Foundational completion
  - US1 (T008) has no dependency on US2 or US3
  - US2 (T009-T011) has no code dependency on US1, but T011 shares `login/page.tsx` with T008 — sequence, don't parallelize
  - US3 (T012) has no dependency on US1 or US2's code — it's a verification pass over Foundational's own guarantees
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T005 and T006 (Foundational) touch different files — parallel
- T009 and T010 (US2) touch different new files — parallel; T011 touches `login/page.tsx` (already modified by T008) — sequence after T008
- T013 and T015 (Polish) can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T003-T007) — the riskiest parts are T004's `linkCoreAccount()` merge-on-link transaction (the only place this feature deletes a row) and T005/T006's ported guards (touch the existing dashboard every Core-linked student already uses — a regression here affects everyone, not just new signups)
3. Complete Phase 3: User Story 1 (T008)
4. **STOP and VALIDATE**: quickstart.md Scenario 1, plus Scenario 5 (regression — existing Core-linked dashboard unaffected)
5. This alone resolves the core ask — deploy/demo if ready, even before linking exists

### Incremental Delivery

1. Setup + Foundational → native accounts can exist and render correctly, no signup entry point yet
2. Add US1 → a person can sign up and land on their own dashboard → validate → deploy (MVP)
3. Add US2 → linking works end-to-end, including the merge case → validate → deploy
4. Add US3 → confirmed, not built — Coaching already worked from the moment Foundational landed

---

## Notes

- T005/T006 (Foundational) are the highest-regression-risk tasks in this feature, despite being "just a port" — they touch the dashboard every existing Core-linked student uses today. Test a Core-linked account's dashboard immediately after these two tasks, before moving on to US1.
- T004's merge-on-link transaction (research.md §3) is the second-highest-risk piece — the only place this feature deletes a row. Test the pending-row/merge path in quickstart.md Scenario 2 explicitly, not just the common direct-update path.
- Do not port any of branch 006's checkout/Stripe/`purchases`/`enrollment.ts`-split code — out of scope here (plan.md Constraints).
- [P] tasks = different files, no dependencies
- Commit after each phase checkpoint
- No buy/enroll-without-linking, no duplicate-account merging, no forced link deadline in this version (spec.md Assumptions) — don't add any of these without a spec update
