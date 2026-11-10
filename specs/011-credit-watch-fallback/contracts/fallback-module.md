# Contract: `src/lib/credit-watch/fallback.ts` (NEW)

Plain module — no `'use server'` directive. It's only ever invoked from within `/staff/credit-watch/page.tsx`, which is already gated by `requireStaffRole(['super_admin', 'staff'])` before this module is reached, so it does not need its own auth check (consistent with `effective-balance.ts`, the codebase's other plain, unguarded credit-watch module).

```ts
import type { CreditWatchAtRiskSession, CreditWatchNegativeBalance, CreditWatchResponse } from '@/lib/types';

export interface FallbackCreditWatchResult extends CreditWatchResponse {
  source: 'fallback';
  uncheckedCount: number;
}

export async function fetchCreditWatchFallback(
  lookAheadDays: 7 | 14 | 30 | 60,
): Promise<FallbackCreditWatchResult>;
```

**Behavior**:
- Calls `listCustomerProfiles()` (`src/lib/auth/customer-profile.ts`) to get the known-student pool.
- For each student, calls `fetchSnapshot(coreCustomerId)` (`src/lib/core-api.ts`, existing/unmodified) independently — a rejected promise for one student is caught per-student and counted in `uncheckedCount`, not propagated (Edge Cases: partial failure).
- From each successful snapshot, builds zero or more `CreditWatchNegativeBalance` rows (data-model.md §"Credit Balance") and zero or more `CreditWatchAtRiskSession` rows (data-model.md §"Upcoming Session (at risk)"), filtered to `lookAheadDays` the same way the primary source's window works today.
- Returns `{ generated_at, excluded_coach_to_coach_count: 0, at_risk_sessions, negative_balances, source: 'fallback', uncheckedCount }`.
- **Never throws** under normal operation (per-student failures are caught internally) — only throws if `listCustomerProfiles()` itself fails (e.g., Supabase unreachable), which `page.tsx` must still catch and fall through to the existing generic error state (FR-005: "interim method itself fails entirely").

## `src/app/staff/credit-watch/page.tsx` (MODIFIED)

```ts
let creditWatch: CreditWatchResponse | FallbackCreditWatchResult;
try {
  creditWatch = await fetchCreditWatch(days);
} catch (primaryError) {
  try {
    creditWatch = await fetchCreditWatchFallback(days);
  } catch (fallbackError) {
    // render the existing generic error state, unchanged (FR-005)
  }
}

const isFallback = 'source' in creditWatch && creditWatch.source === 'fallback';
```

- All existing row-building (`buildAtRiskRow`, `buildNegativeRow`) and effective-balance overlay logic is reused unchanged — it operates on `CreditWatchAtRiskSession`/`CreditWatchNegativeBalance`, which fallback rows also satisfy.
- New conditional rendering, gated on `isFallback`:
  - A banner above both sections (Story 3 / FR-004): "Showing data for already-known students only — the complete list will return once the normal data source is available." Plus, if `uncheckedCount > 0`, an appended note: "{uncheckedCount} known students couldn't be checked."
  - Each at-risk row gets an "Estimate" badge (FR-008).
  - The negative-balance table's renewal cell renders "Renewal info not available" instead of "No active subscription" when `isFallback` (Story 2 Acceptance Scenario 3).
