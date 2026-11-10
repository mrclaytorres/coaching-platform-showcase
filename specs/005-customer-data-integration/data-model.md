# Phase 1 Data Model: Dev/Demo Student Account Seeding & Normalized Account Display

This feature adds one field to an existing entity; it introduces no new tables. All three entities named in `spec.md`'s Key Entities section are mapped below to concrete storage.

## Seeded Dev Account

Not a new table — a `customer_profiles` row (plus its paired `auth.users` row) with `is_seeded = true`.

| Field | Source | Notes |
|---|---|---|
| `id` (uuid) | `customer_profiles.id` | existing |
| `supabase_user_id` (uuid) | `customer_profiles.supabase_user_id` → `auth.users.id` | existing FK; the `auth.users` row is created via `auth.admin.createUser({ email, password: DEV_SEED_PASSWORD, email_confirm: true })` instead of the magic-link OTP flow |
| `core_customer_id` (integer) | `customer_profiles.core_customer_id` | existing; unique — same identifier space as Core's `customer_id` / CourseHost ID (confirmed in Clarifications) |
| `email` (text) | `customer_profiles.email` | existing; for seeded accounts, set to the synthetic placeholder `dev+customer-<id>@example.invalid`, satisfying the existing email-match rule in `upsertCustomerProfile` (FR-003) by construction — the placeholder is compared to itself |
| `first_name` (text) | `customer_profiles.first_name` | existing; still sourced from Core's snapshot (`snapshot.customer.first_name`) — real data, not synthetic |
| `is_active` (boolean) | `customer_profiles.is_active` | existing; unaffected by this feature |
| `is_seeded` (boolean) | `customer_profiles.is_seeded` | **NEW column**, `NOT NULL DEFAULT false`; `true` only for accounts created by the seeding path (FR-008) |
| `created_at` / `updated_at` | existing | unchanged |

**Validation rules** (enforced by the seeding logic in `src/lib/dev/seed-accounts.ts`, reusing existing `upsertCustomerProfile`):
- A `core_customer_id` already linked to a **non-seeded** profile is refused (FR-005) — checked via `getCustomerProfile`-style lookup by `core_customer_id` before creating/upserting.
- Re-seeding an already-seeded `core_customer_id` updates the existing row in place (`onConflict: 'supabase_user_id'`, same as today) rather than creating a duplicate (FR-004).
- Duplicate identifiers within a single run are de-duplicated before processing (edge case in spec.md).

**State transitions**: None beyond existing profile lifecycle (`is_active` toggling via `activateStudent`/`deactivateStudent`, untouched by this feature).

## Seed List

Not persisted — an in-memory, per-request value only:
- The two fixed demo identifiers (`10002`, `10001`), hardcoded as constants in `src/lib/dev/seed-accounts.ts`.
- Any additional identifiers the developer types into the seed-accounts page's input field for that run (parsed from a comma/whitespace-separated string into `number[]`, deduplicated).

No table or persistence layer is needed since the list only exists for the duration of a single seed action invocation.

## Student Record

Unchanged existing entity (`customer_profiles` joined conceptually with Core's live snapshot data via `core_customer_id`) — this feature does not alter how dashboard data is fetched or rendered (`src/lib/core-api.ts`, `src/app/customer/[id]/page.tsx`). The only change is that more `customer_profiles` rows can now exist without having gone through the magic-link flow.

## Schema Diff

See [`contracts/supabase-schema.md`](./contracts/supabase-schema.md) for the exact `ALTER TABLE` statement.
