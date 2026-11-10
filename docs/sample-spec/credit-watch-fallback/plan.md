# Implementation Plan: Credit Watch Data Fallback (Interim)

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Tasks**: [tasks.md](./tasks.md)

## Summary

When the legacy API's aggregate credit-watch endpoint fails (it doesn't exist yet), the staff
Credit Watch page shows a raw error. This feature adds a fallback: on that failure, the page
builds the same two lists itself, one student at a time, using the per-student snapshot endpoint
that already works in production.

The result has the same shape as the aggregate response plus a `source: 'fallback'` marker. That
marker drives the fallback-only UI: a "partial data" banner, an "Estimate" badge on at-risk rows,
and "renewal info not available" wording. No new endpoint and no new table.

A standalone version of the module is in
[`src/resilient-aggregation/credit-watch.ts`](../../../src/resilient-aggregation/credit-watch.ts).

## Technical Context

- **Stack:** TypeScript 5.5, Next.js 14 (App Router), Node 22.
- **Reused as-is:** the per-student snapshot client, the known-student list, and the existing
  effective-balance overlay (so fallback numbers match the student detail page exactly).
- **Storage:** none new. Read-only use of the existing profiles and credit-adjustment tables.
- **Constraints:**
  - No behavior change when the aggregate source succeeds (FR-001).
  - Never claim renewal coverage the data can't support.
  - Never drop a row for one missing field (FR-007).
  - One student's failed lookup must not fail the page.
- **Scale:** bounded by the known-student count, which is small today. No throttling for now.

## Constitution Check

No ratified project principles yet. The plan follows established conventions: the existing
staff role gate is unchanged, existing functions are reused rather than replaced, and there is
no new persistence.

## Structure

```text
src/
├── app/staff/credit-watch/page.tsx   # MODIFIED: on aggregate failure, call the fallback;
│                                      # render the banner, badges and wording when
│                                      # source === 'fallback'
└── lib/credit-watch/fallback.ts      # NEW: builds the aggregate-shaped result from
                                       # per-student snapshots
```

## Contract

```ts
export interface FallbackCreditWatchResult extends CreditWatchResponse {
  source: 'fallback';
  uncheckedCount: number;
}

export async function fetchCreditWatchFallback(
  lookAheadDays: 7 | 14 | 30 | 60,
): Promise<FallbackCreditWatchResult>;
```

- Catches per-student failures and counts them in `uncheckedCount`.
- Throws only if the known-student list itself can't be loaded. The page catches that and shows
  the existing error state (FR-005).

## Validation

The project has no automated test framework, so each feature ships a `quickstart.md` of manual
scenarios: fallback activates, balances match, estimates are labeled, partial failure is
tolerated, and the page switches back automatically. (This showcase repo adds unit tests for the
same behavior.)
