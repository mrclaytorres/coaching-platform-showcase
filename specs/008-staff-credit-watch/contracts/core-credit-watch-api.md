# Contract: Core API — `POST /pull_credit_watch/` (NEW — external dependency)

**Status**: Does not exist yet. This is the handoff contract for whoever implements this endpoint on Core's side — see `research.md` §1 for why it's needed and what was rejected instead. **This feature cannot go live until this endpoint exists and matches this contract** (or `src/lib/core-api.ts`'s client is updated to match whatever shape Core actually ships).

Modeled directly on the existing `POST /pull_portal_snapshot/` (`src/lib/core-api.ts`) — same base URL, same auth, same error conventions.

## Request

```
POST {CORE_API_BASE}/pull_credit_watch/
Content-Type: application/json
x-cf-waf-bypass: {CORE_WAF_BYPASS}

{
  "shared_secret": "{CORE_SHARED_SECRET}",
  "look_ahead_days": 30
}
```

- `look_ahead_days`: one of `7 | 14 | 30 | 60` (FR-002). Bounds the `at_risk_sessions` window; does not affect `negative_balances` (that list is always "right now," per FR-005 / User Story 2).

## Response — `200 OK`

```json
{
  "generated_at": "2026-07-31T00:00:00Z",
  "excluded_coach_to_coach_count": 3,
  "at_risk_sessions": [
    {
      "session_id": 981234,
      "scheduled_at": "2026-07-28T00:00:00Z",
      "student": { "customer_id": 10003, "display_name": "student_c" },
      "coach": { "name": "Coach One" },
      "lesson_type_id": 1,
      "lesson_type_name": "One on One Coaching Lesson",
      "current_balance": 0.0,
      "balance_after_session": -1.0,
      "renewal": {
        "next_renewal_at": "2026-07-13T00:00:00Z",
        "renewal_amount": 1.0
      }
    }
  ],
  "negative_balances": [
    {
      "student": { "customer_id": 10004, "display_name": "Student D" },
      "lesson_type_id": 4,
      "lesson_type_name": "Videoask Question",
      "balance": -24.0,
      "renewal": {
        "next_renewal_at": "2026-07-15T00:00:00Z",
        "renewal_amount": 36.0
      }
    }
  ]
}
```

- `renewal` is `null` when the student has no active recurring subscription for that lesson type (FR-006, Acceptance Scenario 2) — the Academy-side UI renders "No active subscription" in that case.
- All timestamps are UTC (FR-012) — the Academy side does not convert these to any student's display timezone.
- `student.display_name` may be a username/placeholder (e.g., `"student_c"`, `"None None"`) rather than a real name, matching Core's existing data quality elsewhere in this integration — the Academy UI displays whatever string is given, unmodified.
- Coach-to-coach sessions (both parties are coaches, so no credit-purchasing student is involved) are excluded from `at_risk_sessions` by Core itself and rolled into `excluded_coach_to_coach_count` (FR-004) — Academy does not attempt to re-derive this exclusion client-side, since it doesn't have visibility into which accounts are coach accounts on Core's side.

## "Covered by renewal" vs. "unfunded" (computed client-side from this response, FR-008)

Given a row's `renewal` and `balance_after_session` (at-risk) or `balance` (negative-balance):

```
is_covered = renewal !== null
  && renewal.next_renewal_at is within [now - 14 days, session_or_now]
  && renewal.renewal_amount + current_balance_at_that_point >= 0
```

i.e. a renewal still "counts" while it is less than 14 days overdue, per the reference design's stated rule (`spec.md` Assumptions). `renewal === null` is always `unfunded`.

## Errors

Same convention as `fetchSnapshot()`: any non-2xx response is surfaced as `CoreApiError(status, message)`; the credit-watch page shows a loading/error state (spec Edge Cases), never an empty list interpreted as "nothing at risk."
