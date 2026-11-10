# Phase 0 Research: Staff Credit Watch Dashboard

## 1. Sourcing the aggregate "at risk" / "negative balance" data

**Decision**: Add a new Core API endpoint, `POST /pull_credit_watch/`, following the exact auth/transport convention of the existing `POST /pull_portal_snapshot/` (`src/lib/core-api.ts`): same `CORE_API_BASE`, `CORE_SHARED_SECRET` body field, `x-cf-waf-bypass` header. Request body carries `{ shared_secret, look_ahead_days }`; response returns `at_risk_sessions[]` and `negative_balances[]` arrays shaped per `contracts/core-credit-watch-api.md`. The Academy side implements a thin client (`fetchCreditWatch(lookAheadDays)`) alongside the existing `fetchSnapshot()` in `src/lib/core-api.ts`, same `react cache()` wrapper, same `CoreApiError` on non-2xx.

**Rationale**: The user confirmed (scoping question during planning) that a new bulk Core endpoint should be assumed and specified as a handoff contract, rather than working around its absence. This is also the only approach that satisfies FR-008 (renewal-coverage logic required for v1) — Core's existing per-student snapshot endpoint has no subscription/renewal data at all, so no amount of client-side iteration over `fetchSnapshot()` could produce a "covered by renewal" vs. "unfunded" distinction. This feature is therefore blocked on that endpoint existing before it can go live; that dependency is called out explicitly in `plan.md` and `spec.md`'s Assumptions.

**Alternatives considered**:
- *Iterate `fetchSnapshot()` over every `customer_profiles` row*: Rejected — only covers students who've already logged into the Academy portal (many Core customers may never have created a Academy account), doesn't scale (N sequential API calls per page load), and cannot supply renewal/subscription data at all (blocks FR-008 outright).
- *Iterate `fetchSnapshot()` and skip renewal logic entirely for v1*: Rejected by the user during `/speckit-specify` clarification (Q2 answer: renewal logic is required for v1, not deferred).

## 2. Drill-down detail view (per-student "Analyze")

**Decision**: Reuse the existing `fetchSnapshot(customerId)` per-student endpoint unchanged for the "Analyze" detail view (User Story 3, acceptance scenario 2 — "balances across all lesson types"). No new Core endpoint is needed for this piece; `fetchSnapshot` already returns the full `credits: SnapshotWallet[]` array for one customer.

**Rationale**: This data already exists and is already proven in production use by the customer-facing portal (`/customer/[id]`). Reusing it avoids asking Core for more than necessary and keeps the drill-down view resilient even before the new bulk endpoint ships (staff can already open a single student's full credit picture today).

**Alternatives considered**: Extending the new bulk endpoint to also return full per-student, per-lesson-type detail on demand — rejected as unnecessary duplication of data the existing endpoint already provides.

## 3. Recording credit adjustments before Core write access exists

**Decision**: New Supabase table `credit_adjustments`, owned entirely by Academy (no Core dependency), storing each adjustment as an audit-first record: who, when, amount, lesson type, reason, and a `status` of `'placeholder'` (not yet written to Core) or `'synced'` (future — once live write access exists and the value has been pushed to Core). References the Core customer by `core_customer_id` (plain integer), **not** a foreign key to `customer_profiles.id` — mirroring the existing cross-system-reference convention used elsewhere in this codebase (e.g., `purchases.course_id` in prior specs) — because Credit Watch surfaces *every* Core customer, including ones who have never logged into the Academy portal and therefore have no `customer_profiles` row at all.

**Rationale**: FR-013–FR-015 require an in-app adjustment capability today, with an explicit "not yet written to Core" indicator, and full audit trail (FR-014, SC-007). A local table is the only way to satisfy this without live Core write access. Keeping the reference as a plain Core customer ID (not an FK) avoids forcing a `customer_profiles` row to exist for every adjustment, which would be incorrect for students who aren't Academy-portal users.

**Displayed ("effective") balance rule**: Wherever a balance is shown (at-risk projection, negative-balance list, detail view), it is computed as `Core-reported balance from the bulk/snapshot endpoint + sum of that student's own 'placeholder' adjustments for that lesson type`. This is what allows a staff-recorded adjustment to actually move a student off the "negative balances" list in the UI, even though Core itself hasn't been updated yet.

**Alternatives considered**: Writing the adjustment directly against a mocked/stubbed version of `fetchSnapshot` — rejected as it would require faking Core API responses rather than genuinely composing real Core data with a local overlay, and would break the moment live write access is enabled (the overlay approach requires no rework: `status` flips from `placeholder` to `synced` and the merge math stays the same, or is removed once Core itself reflects the adjustment).

## 4. Role gating

**Decision**: `requireStaffRole(['super_admin', 'staff'])`, same helper already used throughout `src/app/staff/*` (`src/lib/auth/staff-profile.ts`). Coach-role staff are redirected away, consistent with FR-010.

**Rationale**: This is the existing, already-proven access-control primitive in the codebase (see `src/app/staff/layout.tsx`, `src/lib/courses/tier-actions.ts`); no new pattern is introduced. (Note: the spec's reference to an existing "purchases/refunds" staff view as precedent was aspirational — that page exists only on an unmerged branch, not on `develop`. The actual precedent used here is the `requireStaffRole` pattern itself, which *is* present on `develop`, e.g. in `src/lib/courses/tier-actions.ts` gating Tier management to non-coach roles.)

## 5. Look-ahead window control

**Decision**: A client-side `<select>` bound to a `?days=` search param on `/staff/credit-watch`, defaulting to 30 when absent, with options 7/14/30/60 — matching FR-002 and the reference mockup's "30 days" default. Changing it triggers a normal Next.js navigation (`router.push`) that re-runs the server component with the new `days` value, so the at-risk list re-fetches from Core with the new look-ahead window server-side (satisfies SC-003 — no full page reload from the user's perspective; App Router soft-navigates).

**Rationale**: Matches the existing pattern used by `?error=`/`?success=` query-param-driven UI elsewhere in this codebase (`src/app/login/page.tsx`, `src/app/staff/courses/[courseId]/page.tsx`), keeps the look-ahead selection linkable/shareable, and requires no new client-state library.
