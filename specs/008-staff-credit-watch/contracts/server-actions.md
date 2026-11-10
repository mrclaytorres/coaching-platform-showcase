# Contract: Server Actions / Library Functions

## `src/lib/core-api.ts` (MODIFIED — new function alongside existing `fetchSnapshot`)

```ts
export async function fetchCreditWatch(
  lookAheadDays: 7 | 14 | 30 | 60,
): Promise<CreditWatchResponse>;
// Same auth/transport as fetchSnapshot (CORE_API_BASE, CORE_SHARED_SECRET, CORE_WAF_BYPASS),
// wrapped in the same `cache()` (research.md §1). Throws CoreApiError on non-2xx, matching
// fetchSnapshot's existing error contract. See contracts/core-credit-watch-api.md for the
// exact request/response shape and CreditWatchResponse type.
```

## `src/lib/credit-watch/effective-balance.ts` (NEW, plain module — no `'use server'`, pure functions)

```ts
export interface EffectiveBalance {
  coreBalance: number;
  placeholderAdjustmentTotal: number;
  effectiveBalance: number; // coreBalance + placeholderAdjustmentTotal (data-model.md)
}

export function applyPlaceholderAdjustments(
  coreBalance: number,
  adjustments: CreditAdjustment[], // pre-filtered to one (core_customer_id, lesson_type_id) pair, status='placeholder'
): EffectiveBalance;

export function isCoveredByRenewal(
  renewal: { nextRenewalAt: string; renewalAmount: number } | null,
  balanceBeforeRenewal: number,
  now: Date,
  dueBy: Date, // session date for at-risk rows, same as `now` for negative-balance rows
): boolean;
// Implements the "renewal.next_renewal_at is within [now - 14 days, dueBy]" rule
// (contracts/core-credit-watch-api.md) — a renewal scheduled after `dueBy` can't help in time,
// and one more than 14 days overdue relative to `now` no longer counts.
```

## `src/lib/credit-watch/adjustments.ts` (NEW, `'use server'`, staff-role gated)

```ts
export async function listAdjustmentsForCustomer(
  coreCustomerId: number,
): Promise<CreditAdjustment[]>;
// requireStaffRole(['super_admin', 'staff']); used by both the aggregate lists (to compute
// effective balances) and the per-student detail view.

export async function createCreditAdjustment(input: {
  coreCustomerId: number;
  lessonTypeId: number;
  lessonTypeName: string;
  amountCredits: number; // CHECK amount_credits <> 0 enforced at the DB level too
  reason: string; // CHECK non-empty enforced at the DB level too
}): Promise<{ id: string }>;
// requireStaffRole(['super_admin', 'staff']); inserts with status='placeholder',
// created_by = current staff profile id (FR-013, FR-014, FR-015). No update/delete action —
// adjustments are an append-only audit log (SC-007); a correction is a new adjustment, not an edit.
```

## `src/app/staff/credit-watch/page.tsx` (NEW — server component)

Reads `?days=` search param (default `30`), calls `fetchCreditWatch(days)`, calls `listAdjustmentsForCustomer` per distinct customer appearing in the response (or a single batched call — implementation detail for `tasks.md`) to compute effective balances, renders the two tables plus summary counts. `requireStaffRole(['super_admin', 'staff'])` at the top, matching every other page under `src/app/staff/*`.

## `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` (NEW — server component)

Calls `fetchSnapshot(coreCustomerId)` (existing, unmodified — research.md §2) for the full per-lesson-type wallet picture, `listAdjustmentsForCustomer(coreCustomerId)` for this student's placeholder adjustments, renders effective balances per lesson type and the adjustment form (a `'use server'` inline action calling `createCreditAdjustment`, `SubmitButton` per the project's existing loading-state convention).

## `src/components/StaffSidebar.tsx` (MODIFIED)

Adds a "Credit Watch" nav item, visible only when `role !== 'coach'` — same conditional pattern already used for the "Tiers" item (FR-010).
