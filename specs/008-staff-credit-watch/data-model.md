# Phase 1 Data Model: Staff Credit Watch Dashboard

## New Supabase table: `credit_adjustments`

The only new persisted entity this feature owns. Everything else (balances, sessions, coaches, subscriptions) is read live from Core's API and never duplicated into Academy's database — see `research.md` §1 and §3.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `default gen_random_uuid()` | |
| `core_customer_id` | `integer` NOT NULL | Plain cross-system reference to Core's customer id — **no FK**, since not every Core customer has a `customer_profiles` row (many have never logged into the Academy portal). Same convention as other cross-system references in this codebase. |
| `lesson_type_id` | `integer` NOT NULL | Matches Core's `lesson_type_id` (same id space as `SnapshotWallet.lesson_type_id` / `SnapshotActivity.lesson_type_id`). |
| `lesson_type_name` | `text` NOT NULL | Denormalized label captured at adjustment time, so historical adjustments still display correctly even if a lesson type is later renamed on Core's side. |
| `amount_credits` | `numeric` NOT NULL | Positive = grant, negative = deduct. `CHECK (amount_credits <> 0)` — FR: no zero-amount adjustments (see spec Edge Cases). |
| `reason` | `text` NOT NULL | `CHECK (char_length(reason) > 0)` — required, non-empty (FR-013, Edge Cases). |
| `status` | `text` NOT NULL DEFAULT `'placeholder'` | `CHECK (status IN ('placeholder', 'synced'))`. `'placeholder'` = applied only in Academy's overlay, not yet written to Core (current v1 reality — see FR-015). `'synced'` = written back to Core (reserved for once live write access exists; no code path sets this in v1, but the column exists now so the future cutover doesn't require a schema change). |
| `created_by` | `uuid` NOT NULL, `REFERENCES staff_profiles(id)` | The staff member who made the adjustment (FR-014). Real FK — `staff_profiles` is Academy-owned. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Indexes**: `credit_adjustments_customer_lesson_idx` on `(core_customer_id, lesson_type_id)` — this is the lookup used every time an "effective balance" is computed (research.md §3), for every row of every list render.

**RLS**: Enabled. No client-side `SELECT`/`INSERT` policy — all reads and writes go through server actions using the service-role client, gated by `requireStaffRole(['super_admin', 'staff'])`, matching the existing convention for staff-only writes elsewhere in this codebase (no student or coach session should ever be able to read or write this table directly).

## Derived / read-through concepts (not persisted by Academy)

These come from Core's API on every request and are described here only to fix vocabulary for `contracts/` and `tasks.md` — they are not Academy database tables.

- **At-Risk Session**: one row of the new bulk endpoint's `at_risk_sessions[]` — a scheduled session, the student it belongs to, its lesson type, assigned coach, current balance, and whether the projected balance after debit (adjusted for Academy's own placeholder overlay) is negative.
- **Negative Balance**: one row of `negative_balances[]` — a student + lesson type currently below zero (after the placeholder-adjustment overlay is applied), plus their next expected renewal if any.
- **Renewal / Recurring Subscription**: a `{ next_renewal_at, renewal_amount }` (or null) attached to a negative balance or at-risk session row by Core, used to compute "covered by renewal" vs. "unfunded" (FR-008) with the "less than 14 days overdue still counts" rule applied client-side against `next_renewal_at`.

## Effective balance computation (used everywhere a balance is displayed)

```
effective_balance(core_customer_id, lesson_type_id) =
  core_reported_balance(core_customer_id, lesson_type_id)
  + sum(amount_credits FROM credit_adjustments
        WHERE core_customer_id = :core_customer_id
          AND lesson_type_id = :lesson_type_id
          AND status = 'placeholder')
```

Applied to: the "Now"/current balance and "Projected" column in at-risk rows, the "Balance" column in negative-balance rows, and every wallet shown in the per-student detail view. A student whose effective balance crosses back to zero or above (e.g., after a staff adjustment) no longer appears in the negative-balances list on the next render — the list is always computed from effective, not raw Core, balances.
