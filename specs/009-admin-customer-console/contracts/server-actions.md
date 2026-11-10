# Server Actions & Function Contracts: Admin Customer Console

All items below are internal (Academy-side) contracts — no external API is introduced by this feature. Items marked **(existing, unchanged)** are called by the new pages but not modified.

## `src/lib/auth/customer-profile.ts`

### `searchCustomerProfiles(query: string): Promise<StudentProfile[]>` — NEW

```ts
export async function searchCustomerProfiles(query: string): Promise<StudentProfile[]>
```

- Trims `query`; returns `[]` immediately if empty after trimming (no "browse all" behavior from an empty search — direct ID lookup or `/admin/students` already serve that).
- Queries `customer_profiles` with `.or(\`email.ilike.%${query}%,first_name.ilike.%${query}%\`)`, ordered by `created_at` ascending (matches `listCustomerProfiles()`'s existing ordering).
- Returns the same `StudentProfile` shape `listCustomerProfiles()` already returns — no new type.
- No role check inside this function — callers (`/staff/customers` page) already run `requireStaffRole` before calling it, matching the pattern of every other function in this file (none of which self-check roles; they're all called from already-gated pages/actions).

### `getCustomerProfileByCoreId(coreCustomerId: number)` — existing, unchanged

Reused to determine whether a located customer has a linked portal account, for the "no linked portal account" indicator (FR-004).

## `src/lib/core-api.ts`

### `fetchSnapshot(customerId: number | string)` — existing, unchanged

Reused directly for both direct-ID lookups (US1) and search-result selections (US3, which resolve to a `coreCustomerId` and then call this same function).

## `src/lib/credit-watch/adjustments.ts`

### `listAdjustmentsForCustomer(coreCustomerId: number)` / `createCreditAdjustment(input)` — existing, unchanged

Reused as-is by `CustomerDetailPanel`. Both this console and Credit Watch's drill-down call these same functions against the same `coreCustomerId`, which is what makes FR-009 (identical adjustment history on both surfaces) true by construction rather than by convention.

## `src/lib/credit-watch/effective-balance.ts`

### `applyPlaceholderAdjustments(coreBalance, adjustments)` — existing, unchanged

Reused as-is for wallet display in `CustomerDetailPanel`.

## `src/components/customers/CustomerDetailPanel.tsx` — NEW (presentational component, not a server action)

```ts
interface CustomerDetailPanelProps {
  snapshot: Snapshot;                 // from fetchSnapshot()
  adjustments: CreditAdjustment[];    // from listAdjustmentsForCustomer()
  hasLinkedPortalAccount: boolean;    // from getCustomerProfileByCoreId() !== null
  submitAdjustmentAction: (formData: FormData) => Promise<void>; // 'use server' action, supplied by the calling page
}
```

- Renders: wallet grid with effective balances (existing JSX from Credit Watch's drill-down, moved here unchanged), a new sessions section (upcoming/past, from `snapshot.sessions`), a new activity ledger section (from `snapshot.activity`), the adjustment form (existing JSX, moved here unchanged), and the adjustment history list (existing JSX, moved here unchanged).
- `submitAdjustmentAction` is supplied by the calling page (not defined inside the component) so each route keeps its own redirect target and `revalidatePath` calls (`/staff/customers/[coreCustomerId]` vs. `/staff/credit-watch/[coreCustomerId]` + `/staff/credit-watch`) — the component itself has no route-specific knowledge.
- No role check inside the component — both call sites already run `requireStaffRole` before rendering it.

## `src/app/staff/customers/page.tsx` — NEW

- `requireStaffRole(['super_admin', 'staff'])`.
- Reads `?q=` search param; if present, calls `searchCustomerProfiles(q)` and renders results as links to `/staff/customers/{coreCustomerId}`.
- Renders `CustomerSearchForm` (client component: one text input for direct ID → navigates straight to `/staff/customers/{id}`; one text input for `?q=` → navigates to `/staff/customers?q=...`).

## `src/app/staff/customers/[coreCustomerId]/page.tsx` — NEW

- `requireStaffRole(['super_admin', 'staff'])`.
- `fetchSnapshot(coreCustomerId)`, wrapped for `404` → `notFound()` (same pattern as Credit Watch's drill-down).
- `listAdjustmentsForCustomer(coreCustomerId)`, `getCustomerProfileByCoreId(coreCustomerId)`.
- Defines its own inline `'use server'` `submitAdjustmentAction`, redirecting to `/staff/customers/{coreCustomerId}?success=…` / `?error=…` and revalidating that same path (does **not** revalidate `/staff/credit-watch`, since this route isn't reachable from there — mirrors how Credit Watch's own action only revalidates paths relevant to it).
- Renders `CustomerDetailPanel` with the resolved data.

## `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` — MODIFIED

- Unchanged data-fetching and `submitAdjustmentAction` (still revalidates both `/staff/credit-watch/{id}` and `/staff/credit-watch`).
- JSX body replaced with a call to `CustomerDetailPanel`, passing the same data it already resolves today plus the new `hasLinkedPortalAccount` (via `getCustomerProfileByCoreId`, newly called here) — this is the one behavior addition to this existing route: sessions and the activity ledger now render here too, where previously only wallets did.

## `src/components/StaffSidebar.tsx` — MODIFIED

- Adds a "Customers" nav item alongside "Credit Watch", same `role !== 'coach'` condition, pointing to `/staff/customers`.
