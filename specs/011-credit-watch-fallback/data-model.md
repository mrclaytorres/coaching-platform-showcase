# Phase 1 Data Model: Credit Watch Data Fallback (Interim)

No new database tables or columns. This feature only adds in-memory shapes built from existing data sources (`customer_profiles` via `listCustomerProfiles()`, and Core's `pull_portal_snapshot` via `fetchSnapshot()`), consumed by the existing `/staff/credit-watch` page.

## FallbackCreditWatchResult

The fallback module's return type — a superset of the existing `CreditWatchResponse` (`src/lib/types.ts`) so `page.tsx` can render either with the same JSX.

```ts
interface FallbackCreditWatchResult extends CreditWatchResponse {
  source: 'fallback';
  uncheckedCount: number; // known students whose fetchSnapshot() call failed (Edge Cases)
}
```

- `at_risk_sessions: CreditWatchAtRiskSession[]` — built per §"Upcoming Session (at risk)" below. `renewal` is always `null` in fallback rows (no renewal data available from `fetchSnapshot`); `page.tsx` must render fallback's null-renewal cells as "renewal info not available," distinct from the primary path's null-renewal cells (which mean "genuinely no active subscription" once the real endpoint supplies that fact).
- `negative_balances: CreditWatchNegativeBalance[]` — built per §"Known Student" + "Credit Balance" below. `renewal` is always `null`, same rule as above.
- `excluded_coach_to_coach_count`: always `0` — `fetchSnapshot` has no concept of coach-to-coach sessions to exclude; this field exists only for shape-compatibility with `CreditWatchResponse` so the existing `{count} coach-to-coach sessions excluded` note simply never renders in fallback mode (count is 0).
- `generated_at`: timestamp of when the fallback aggregation ran (`new Date().toISOString()`), same meaning as the primary source's field.

The primary path continues to return a plain `CreditWatchResponse` (no `source` field). `page.tsx` distinguishes the two with `'source' in creditWatch && creditWatch.source === 'fallback'`.

## Known Student

One row from `listCustomerProfiles()` (`StudentProfile`, already defined in `src/lib/auth/customer-profile.ts`): `coreCustomerId`, `email`, `firstName`, `isActive`, `isSeeded`, `createdAt`. This feature reads it as-is — no new fields. Both active and inactive profiles are included (a deactivated student's stale negative balance is still worth flagging to staff; FR-002 does not say to exclude inactive rows).

## Credit Balance (per known student)

Derived per-student from `Snapshot.credits: SnapshotWallet[]` (`{ lesson_type_id, lesson_type_name, balance, total_purchased }`), one `CreditWatchNegativeBalance` row per wallet entry where `balance < 0`:

```ts
{
  student: { customer_id: snapshot.customer.id, display_name: snapshot.customer.first_name || 'Unknown' },
  lesson_type_id: wallet.lesson_type_id,
  lesson_type_name: wallet.lesson_type_name,
  balance: wallet.balance,
  renewal: null, // see FallbackCreditWatchResult note
}
```

`page.tsx`'s existing `buildNegativeRow()` (effective-balance overlay via `applyPlaceholderAdjustments` + `listAdjustmentsForCustomer`) is reused completely unchanged — it already operates on this same `CreditWatchNegativeBalance` shape regardless of which source produced it (FR-003, SC-002).

## Upcoming Session (at risk)

Derived per-student from `Snapshot.sessions: SnapshotSession[]`, filtered to `!is_past` and `event_start_time` within the selected look-ahead window (same `days` query param the primary path already uses), matched against that session's `lesson_type_id`'s wallet balance:

```ts
{
  session_id: session.id,
  scheduled_at: session.event_start_time,
  student: { customer_id: snapshot.customer.id, display_name: snapshot.customer.first_name || 'Unknown' },
  coach: null, // SnapshotSession carries no coach field — existing UI already renders "Unknown" for null coach (FR-007)
  lesson_type_id: session.lesson_type_id ?? -1, // FR-007: sessions with an undeterminable lesson type still appear
  lesson_type_name: session.lesson_type_name ?? 'Unknown',
  current_balance: walletBalanceFor(session.lesson_type_id),
  balance_after_session: walletBalanceFor(session.lesson_type_id) - 1, // assumed 1-credit cost (research.md §5)
  renewal: null,
}
```

Only included when `balance_after_session < 0` (mirrors the primary source's own "at risk" definition — a session that wouldn't go negative isn't a risk). Every row from this source is inherently an estimate (research.md §5); `page.tsx` renders an "Estimate" badge on each row whenever `creditWatch.source === 'fallback'`, satisfying FR-008's "visibly label every row" requirement without a new per-row field (the whole section is fallback-sourced, so the source flag is sufficient — no ambiguity about which rows are estimates).

## Data Source Status

Not a stored entity — it's the `source` field on `FallbackCreditWatchResult` (absent = primary, `'fallback'` = interim), read directly by `page.tsx` to decide: whether to show the Story 3 banner, whether to render "Estimate" badges, and whether to render "renewal info not available" instead of "no active subscription." No persistence needed — recomputed on every page load per FR-006 (automatic reversion).
