# Phase 0 Research: Credit Watch Data Fallback (Interim)

## 1. Reviving the previously-rejected "iterate `fetchSnapshot()`" approach — why it's the right call now

`specs/008-staff-credit-watch/research.md` §1 rejected building Credit Watch entirely on a loop over `fetchSnapshot()`, for three reasons: it only covers portal-logged-in students (not Core's full customer base), it doesn't scale to "iterate every customer," and it can't supply renewal data — which spec 008 required for v1.

This feature revives the same mechanism deliberately, as an **interim, lower-fidelity fallback**, not spec 008's primary source:

- **Coverage gap** is now an explicit, surfaced limitation (Story 3 / FR-004), not a silent one — the page says outright that it only covers already-known students.
- **Scale** concern doesn't apply yet: the actual student pool is small (early-stage product), so a `Promise.all` fan-out over `customer_profiles` is fine today (see §3).
- **Renewal data gap** is handled by removing the false claim rather than working around it: FR-008's Assumptions bullet confirms fallback rows say "renewal info not available" instead of asserting "no active subscription" or a specific renewal date.

Decision: build the fallback exactly as scoped in spec.md — no new external dependency, no schema change.

## 2. Where the "known students" pool comes from

**Decision**: `listCustomerProfiles()` (`src/lib/auth/customer-profile.ts`), which reads every row of the `customer_profiles` Supabase table (portal sign-ups plus dev-seeded accounts, per its existing doc comment).

**Alternatives considered**:
- *Include staff ad-hoc lookups (`/staff/customers/[coreCustomerId]`) in the pool* — rejected. That page calls `fetchSnapshot()` directly for a single ID and does not write anything to `customer_profiles` (confirmed: `getCustomerProfileByCoreId` returns `null` for any ID staff have only looked up, not linked to a portal account — see its own doc comment, "Unlinked customers aren't in this table at all"). Including these would require a new tracking mechanism, which is out of scope for an interim fallback.
- *A hardcoded/staff-curated watchlist* — rejected as extra product surface for a feature meant to be temporary and removed once spec 008's real endpoint ships.

**Consequence for spec wording**: the spec's Assumptions bullet ("portal users who've logged in, staff-seeded/test accounts, and any customer staff have already looked up") is slightly broader than what `listCustomerProfiles()` actually returns today (it returns the first two, not the third). This doesn't change any functional requirement — FR-004's banner already just says "already-known students" without promising staff-lookup inclusion — so no spec change is needed; noted here so the implementer doesn't try to also capture ad-hoc staff lookups.

## 3. Per-student fetch strategy — concurrency

**Decision**: `Promise.all(knownStudents.map(fetchSnapshotSafely))`, no concurrency limiter, each call wrapped individually in try/catch so one failure doesn't reject the whole batch (Edge Cases: partial failure).

**Rationale**: `fetchSnapshot` is already `cache()`-wrapped per request and used today in a single-student context; nothing in the codebase currently does a Core fan-out, but the known-student count is small enough (Assumptions bullet 4, Technical Context Scale/Scope) that no batching/throttling is needed for a first interim version. `CORE_API_BASE` upstream isn't documented as rate-limited.

**Alternatives considered**: a `p-limit`-style concurrency cap — rejected for now as unnecessary complexity given current scale; flagged in spec.md's Assumptions as "out of scope for this feature" if the student count grows.

## 4. Response shape — reuse `CreditWatchResponse` vs. a new type

**Decision**: Build a fallback result shaped exactly like `CreditWatchResponse` (`at_risk_sessions`, `negative_balances`, `excluded_coach_to_coach_count`, `generated_at`), plus two additive fields: `source: 'primary' | 'fallback'` and `uncheckedCount: number`. This lets `page.tsx` reuse its existing table-rendering JSX almost unchanged — only the two spots that currently assume renewal/estimate context (the "no active subscription" cell and the at-risk section, per FR-008) branch on `source`.

**Alternatives considered**: a fully separate fallback-only component/page — rejected; the visual difference required by the spec is small (a banner + a few label changes), and duplicating the whole table would drift from the primary path over time (this feature is explicitly temporary, so minimizing surface area matters more than usual).

## 5. At-risk session cost assumption

**Decision** (confirmed with user, spec.md FR-008 / Assumptions): every upcoming session in the look-ahead window costs 1 credit in its lesson type. A row is "at risk" when `currentBalanceForLessonType - 1 < 0`. `balance_after_session` in the fallback result is simply `currentBalance - 1`.

**Rationale**: `SnapshotWallet`/`SnapshotSession` (the only data this fallback can read) has no per-session or per-lesson-type cost field anywhere. 1 credit is the simplest, most conservative default and is always rendered with an explicit "Estimate" label (FR-008) so staff aren't misled into treating it as exact — unlike the negative-balance list (Story 1), which uses exact, real balances and carries no such label.

## 6. Reversion to the primary source

**Decision**: No explicit state to manage — `page.tsx` already calls `fetchCreditWatch(days)` first on every request; the fallback only runs inside the existing `catch` block. The moment Core's `/pull_credit_watch/` endpoint starts responding successfully, the `catch` block stops being reached and the page reverts automatically, satisfying FR-006 with zero additional code.
