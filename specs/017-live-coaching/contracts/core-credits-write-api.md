# Contract: Core API — `POST /adjust_credit/` (NEW — external dependency)

**Status**: Does not exist yet. Checking prior spec history (specs/008-staff-credit-watch, specs/011-credit-watch-fallback) confirmed Core's API is read-only today — no write endpoint of any kind exists for credit balances. This is the handoff contract for whoever implements a write endpoint on Core's side — see `research.md` §5 for why a placeholder-ledger approach is used instead of blocking on this. **This feature does not need this endpoint to launch** (Story 2's credit enforcement is real and live against a Academy-owned placeholder ledger from day one, per `data-model.md`'s Credit Transaction entity) — this endpoint is only needed for `credit_transactions` rows to eventually sync from `status='placeholder'` to `status='synced'`, making Core the system of record again instead of Academy's overlay.

Modeled on the same base URL/auth/error conventions as the existing `POST /pull_portal_snapshot/` and 008's proposed `POST /pull_credit_watch/` (`src/lib/core-api.ts`, `specs/008-staff-credit-watch/contracts/core-credit-watch-api.md`).

## Request

```
POST {CORE_API_BASE}/adjust_credit/
Content-Type: application/json
x-cf-waf-bypass: {CORE_WAF_BYPASS}

{
  "shared_secret": "{CORE_SHARED_SECRET}",
  "core_customer_id": 10003,
  "lesson_type_id": 1,
  "amount_credits": -1.0,
  "idempotency_key": "017-live-coaching:booking:9f2c...:debit",
  "reason": "Live Coaching booking 9f2c... confirmed"
}
```

- `amount_credits`: negative for a debit, positive for a refund — same sign convention as an `amount_credits <> 0` adjustment (matches `credit_adjustments.amount_credits`, `specs/008-staff-credit-watch/contracts/supabase-schema.md`).
- `idempotency_key`: a stable, unique string (this feature sends `<feature>:booking:<booking_id>:<transaction_type>`) — **Core MUST treat a repeated call with the same `idempotency_key` as a no-op returning the original result**, not a second adjustment. This is the write-side equivalent of `credit_transactions`' own `UNIQUE (booking_id, transaction_type)` guard (FR-024/025, SC-003) and is the single most important behavior this endpoint must guarantee — without it, a retried call after a network timeout could double-debit a Student.
- `reason`: free text, stored on Core's side for its own audit trail, mirroring `credit_adjustments.reason`.

## Response — `200 OK`

```json
{
  "adjustment_id": "core-generated-id-or-int",
  "core_customer_id": 10003,
  "lesson_type_id": 1,
  "new_balance": 2.0,
  "applied_at": "2026-09-22T00:00:00Z"
}
```

- `adjustment_id`: Core's own transaction id — once returned, the corresponding `credit_transactions` row is updated with `status='synced'` (no other schema change).
- A repeated call with an already-seen `idempotency_key` MUST return the **same** `adjustment_id` and `new_balance` as the original call, `200 OK`, not an error.

## Errors

Same convention as `fetchSnapshot()`/008's proposed endpoint: any non-2xx response is surfaced as `CoreApiError(status, message)`. A failure here never blocks or reverses the underlying Academy booking — the `credit_transactions` row simply stays `status='placeholder'` and a background retry (mirroring this feature's other retry-cron patterns, `plan.md`) attempts the sync again later.

## Why this is intentionally separate from `POST /pull_credit_watch/` (008)

008's proposed endpoint is a **bulk read** across every student, for a staff dashboard. This is a **single-customer write**, triggered by an individual booking event. They solve different problems and can ship independently of each other — this feature does not need 008's endpoint to exist, and 008 does not need this one.
