# Phase 0 Research: Admin Customer Console

## 1. Where does the search query run?

**Decision**: A new `searchCustomerProfiles(query: string)` function in `src/lib/auth/customer-profile.ts`, doing a case-insensitive `ILIKE` match against `customer_profiles.email` and `customer_profiles.first_name` (Supabase `.or()` with two `ilike` filters), using the existing service-role client pattern already used by every other function in that file.

**Rationale**: The spec's Q1 resolution scopes email/name search to linked accounts only (no new Core endpoint). `customer_profiles` is already the local table of linked accounts (`listCustomerProfiles()` proves the read pattern works); a targeted `ILIKE` query is simpler and cheaper than fetching all profiles and filtering in memory, and matches how the rest of the codebase queries Supabase directly rather than post-filtering.

**Alternatives considered**:
- Filter `listCustomerProfiles()`'s full result client-side — rejected: works today at current scale but pushes filtering logic into the page component and does an unnecessary full-table fetch on every keystroke/submit; a dedicated query is the same amount of code and scales better.
- Full-text search / `pg_trgm` — rejected as over-engineering for the current linked-account population size (same order of magnitude as the roster already rendered unpaginated on `/admin/students`).

## 2. Route placement: `/staff/customers` vs `/admin/customers`

**Decision**: `/staff/customers`, mirroring `/staff/credit-watch`.

**Rationale**: `/admin/layout.tsx` gates on `role === 'super_admin'` only (checked directly in the current codebase). The spec's Q2 resolution sets this feature's access to `super_admin` **and** `staff` — identical to Credit Watch's existing gate. Placing it under `/admin/*` would force a choice between loosening the admin layout's gate (which would also expose Staff account management to the `staff` role — a separate, more sensitive concern that should stay `super_admin`-only) or duplicating a layout. `/staff/customers` avoids both: it reuses `StaffSidebar.tsx`'s existing non-coach nav pattern (same conditional already used for "Credit Watch") and needs no layout changes.

**Alternatives considered**:
- New `/admin/customers` page with its own role check overriding the layout's — rejected: Next.js layouts apply to all nested routes uniformly in this codebase's existing convention (no per-page override precedent exists), and introducing one here for a single route adds an inconsistency future maintainers would need to rediscover.
- Loosen `/admin/layout.tsx` to `super_admin` + `staff` — rejected: would silently widen access to `/admin/staff` (staff invites/role management) and `/admin/dashboard`, neither of which this feature asks to expose more broadly.

## 3. Avoiding duplication with Credit Watch's existing drill-down

**Decision**: Extract the wallet grid, adjustment form, and adjustment-history list from `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` into a new shared component, `src/components/customers/CustomerDetailPanel.tsx`, that also renders sessions and the activity ledger (net-new — the current drill-down doesn't show either today). Both `/staff/customers/[coreCustomerId]/page.tsx` and the existing `/staff/credit-watch/[coreCustomerId]/page.tsx` become thin pages: each resolves its own data (snapshot, adjustments, linked-account status) and its own `'use server'` submit action (so redirect targets and `revalidatePath` calls stay correct per-route), then renders `CustomerDetailPanel` with that data and action passed as props.

**Rationale**: The spec explicitly requires this (input description) and FR-009 requires the two surfaces to be behavior-identical for shared data (history, effective balance) — the cheapest way to guarantee that structurally, rather than by convention, is one component with two call sites. Next.js Server Actions are serializable and can be passed as props from a Server Component page into another Server/Client Component, so no client-side data-fetching duplication is introduced.

**Alternatives considered**:
- Leave Credit Watch's drill-down untouched and build a fully separate detail page for this console — rejected: duplicates ~150 lines of JSX and risks exactly the FR-009 drift the spec calls out as a requirement to avoid.
- Extract only the adjustment form (leave wallets/history duplicated) — rejected: partial extraction still leaves two balance-rendering implementations that could silently diverge.

## 4. Indicating "no linked portal account"

**Decision**: Reuse `getCustomerProfileByCoreId(coreCustomerId)` (already exists in `src/lib/auth/customer-profile.ts`, currently used by the dev-seeding path) to check for a linked profile when rendering a customer's detail page. `null` → render the existing "no linked portal account" indicator; a row → nothing extra needed (existing student data already visible via Core snapshot).

**Rationale**: This function already does exactly this lookup (by Academy/Core numeric ID) and already has exactly the right null-vs-row semantics needed here — no new query required.

**Alternatives considered**: None — this is a direct match for an existing function, not a genuine design choice.

## 5. "Search by name" scope given no `last_name` column

**Decision**: Name search matches `customer_profiles.first_name` only (via the `ILIKE` above); no last-name field exists locally or in Core's snapshot data (`SnapshotCustomer` has only `first_name`).

**Rationale**: Consistent with the rest of the app's data model — nothing in this codebase stores a customer's last name today (student portal, admin students list, and Core's own snapshot response all use `first_name` only). Not a gap introduced by this feature.

**Alternatives considered**: None — there's no last-name data anywhere in the system to search against.
