# Phase 0 Research: Staff-Driven Student Enrollment

## 1. Reusing spec 004's dormant enrollment functions instead of writing new ones

`src/lib/progress/enrollment.ts` already has `enrollStudentInTierSequence(studentId, courseOwnerId)` and `enrollStudentInCourse(studentId, courseId)`, both `requireStaffRole`-gated, both described in their own comments as "the in-app stand-in for 'the purchase happened.'" Neither is called anywhere in the app (confirmed via `grep`) — spec 004 built the backend but never built a UI for it.

**Decision**: Extend these two functions rather than adding new ones. They already do the right thing structurally (staff-gated, idempotent-by-design via DB constraints); this feature widens their inputs (accept a Core customer id instead of an already-known Supabase student id) and adds the two guard behaviors the spec calls for (FR-004, FR-005), surfaced as typed results instead of thrown DB errors.

**Alternatives considered**: Writing a parallel `enrollStudentV2`-style module — rejected; there's no reason to maintain two enrollment code paths, and spec 004's functions are new enough (unused) that widening their signature has no other call sites to break.

## 2. Resolving FR-009: enroll by Core customer ID, resolve-or-create the local record

`src/lib/dev/seed-accounts.ts`'s `seedOneAccount(id)` already does exactly the "resolve or create" half of what FR-009 needs: `fetchSnapshot(id)` to confirm the customer is real and get their name, then `upsertCustomerProfile(...)` to create (or reuse) their `customer_profiles` row. The only parts of that function this feature does *not* want are the dev-only parts: the synthetic `@example.invalid` email, the `DEV_SEED_PASSWORD` Supabase auth user, and `isSeeded: true`.

**Decision**: The enroll actions call `getCustomerProfileByCoreId(coreCustomerId)` first; if it returns `null`, call `fetchSnapshot(coreCustomerId)` (propagating a clear "customer not found" result on 404, per spec.md's edge case) and `upsertCustomerProfile` with `isSeeded: false` and no synthetic email/auth-user creation — this is a *real* student who simply hasn't logged into the portal yet, not a dev/test account, so they shouldn't get a synthetic sign-in identity. Their real portal sign-in continues to work exactly as it does today (whatever creates `customer_profiles` rows on first login already handles the real email).

**Open question, resolved with the user**: `customer_profiles.supabase_user_id` is `NOT NULL UNIQUE REFERENCES auth.users(id)` today (spec 002's schema, `specs/002-supabase-auth-user-data/contracts/supabase-schema.md`) — every row requires a real Supabase Auth user, and the only two places that create rows (`login/page.tsx`'s `linkAccount`, and the dev seeder) both create/require that auth user *first*. A student who's never logged in has no auth user, so `upsertCustomerProfile` can't be reused as-is for them.

Considered three ways to close this gap (presented to the user):
1. Migrate `supabase_user_id` to nullable and fix the real login flow to *adopt* a pre-existing row instead of inserting a new one.
2. Send a real Supabase Auth invite email at enroll time, so the auth user (and thus `supabase_user_id`) is populated immediately, no schema change.
3. Narrow FR-009: only allow enrolling students who've already logged in at least once.

**Decision (user-confirmed)**: Option 1. `supabase_user_id` becomes nullable; a pre-enrolled row (`supabase_user_id IS NULL`) is invisible to any authenticated user under RLS (the existing policies key off `supabase_user_id = auth.uid()`, and `NULL = auth.uid()` is never true) until it's linked. `upsertCustomerProfile`'s conflict target changes from `supabase_user_id` to `core_customer_id` (already `UNIQUE`), so the real login flow's call *updates* the pre-existing row in place — filling in `supabase_user_id`, refreshing `email`/`first_name` — instead of attempting a second insert that would collide on `core_customer_id`. No invite email is sent at enroll time; the student's real first login is unchanged from today's flow and simply completes the row that's already there.

**Rejected**: Option 2 (invite email at enroll time) — sending an account-claim email as a side effect of an internal staff action is a product/comms decision (timing, copy, whether it should go through CourseHost's own onboarding emails instead) that's out of scope for a backend enrollment feature. Option 3 (require login first) — defeats the purpose the user specifically asked for (enroll right after a sale or grant, before the student has ever logged in).

## 3. Letting staff choose the starting Tier (not always the lowest)

`enrollStudentInTierSequence` today always inserts `student_tier_progress.current_tier_rank` at the sequence's lowest `order`. `advanceTier(studentId, courseOwnerId, newRank)` already exists and sets `current_tier_rank` to an arbitrary value — today it's only called from the submission-review pass flow (FR-021).

**Decision**: `enrollStudentInTierSequence` gains a `startingTierOrder` parameter (defaults to the sequence's lowest, preserving today's behavior for any other future caller). On first enrollment it inserts at that rank directly (no need to insert-then-`advanceTier`, since there's no row yet). On an already-enrolled student choosing a *lower* rank than they already have, this is the FR-005 downgrade case — blocked pending confirmation (see below).

**Alternatives considered**: Reusing `advanceTier` as a *second* call after `enrollStudentInTierSequence` inserts at the lowest rank — rejected as an unnecessary two-step (extra round trip, and a window where the row briefly exists at the wrong rank).

## 4. Surfacing "already enrolled" and "would downgrade" without relying on thrown errors

Both `student_tier_progress` (composite PK) and `course_enrollments` (unique constraint) already prevent duplicate rows at the DB level (data-model.md, spec 004) — but today's `enrollStudentInCourse` uses `.upsert(..., { ignoreDuplicates: true })`, which silently no-ops on conflict rather than telling the caller anything happened. FR-004 requires staff be *told*, not silently ignored.

**Decision**: Both functions return a typed result (`{ status: 'enrolled' | 'already_enrolled' | 'would_downgrade' | 'not_found' }`) instead of `Promise<void>` or throwing for these expected-and-common cases; the calling page turns that into the on-page message FR-004/FR-005/edge-cases call for. A downgrade attempt (FR-005) returns `would_downgrade` and takes no write — this version doesn't build a confirm-to-proceed step (the spec only requires staff be warned before it happens, and the safest way to guarantee that with a single form submission is to require them to explicitly pick a rank at or above the current one, resubmitting after seeing the message, rather than adding a second confirmation click).

**Alternatives considered**: A two-step "are you sure?" confirm dialog for downgrades — rejected as unnecessary complexity for an internal staff tool; re-submitting with a different Tier choice after seeing the warning message satisfies FR-005 just as well.

## 5. Preventing standalone-enrollment on a Tier-sequence Course (FR-003)

`enrollStudentInCourse` already partially does this: `if (course.courseCategory !== 'standalone') throw new Error(...)`. This becomes one of the typed result variants (`not_standalone`) instead of a thrown error, same treatment as the other guard cases above, so the page can render it the same way.

**Decision**: Fold this existing check into the same typed-result pattern from §4, rather than leaving it as the one guard that still throws.
