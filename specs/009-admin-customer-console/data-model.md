# Phase 1 Data Model: Admin Customer Console

No new tables or columns. This feature reads two existing data sources and writes to one existing table, all unchanged from their current shape.

## Entities (all pre-existing, reused as-is)

- **Customer Snapshot** (`Snapshot`, `src/lib/types.ts`, fetched via `fetchSnapshot(customerId)`): a Core customer's `credits` (wallets), `sessions`, and `activity` ledger. Source of truth for everything this console displays about a customer's account, keyed by CourseHost/Core numeric customer ID. Unmodified by this feature.

- **Customer Profile** (`customer_profiles` table / `StudentProfile`, `src/lib/auth/customer-profile.ts`): the local record of a customer who has linked a Academy portal account (`id`, `coreCustomerId`, `email`, `firstName`, `isActive`, `isSeeded`, `createdAt`). This feature adds one new **read** access path (`searchCustomerProfiles`, see `contracts/server-actions.md`) against this existing table — no schema change. A customer with no row here is still fully viewable via direct ID lookup (FR-001); the absence of a row is what drives the "no linked portal account" indicator (FR-004).

- **Credit Adjustment** (`credit_adjustments` table, introduced in 008-staff-credit-watch, `contracts/supabase-schema.md` there): unchanged. This feature's adjustment form (`CustomerDetailPanel`) calls the same `createCreditAdjustment` / `listAdjustmentsForCustomer` functions Credit Watch's drill-down already calls, against the same rows — this is what guarantees FR-009 (identical history regardless of which console is used).

## Effective balance (reused, not reimplemented)

Unchanged from 008-staff-credit-watch: `applyPlaceholderAdjustments(coreBalance, adjustments)` in `src/lib/credit-watch/effective-balance.ts` — Core-reported wallet balance plus the sum of that customer's still-`'placeholder'` adjustments for that lesson type. Both this console's detail page and Credit Watch's drill-down call the same function against the same inputs.

## No state transitions

Nothing introduced by this feature has a lifecycle beyond what 008-staff-credit-watch already defined for `credit_adjustments` (`placeholder` → `synced`, driven by a future Core-sync process, out of scope for both features).
