# Phase 1 Data Model: Courses, Credit Watch & Customers UI Redesign

**Branch**: `020-courses-credit-customers-ui` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

**No new tables or columns.** Courses and New Course read/write shapes that already exist
unchanged (research.md #1/#2). The two computed shapes below are the only new data modeling in
this feature.

## Credit Watch Alert *(computed, not stored)*

One unified row shape across all four categories (Story 3), built by a new
`getCreditWatchAlerts()`.

| Field | Type | Source |
|---|---|---|
| `category` | `'negative-balance' \| 'low-balance' \| 'cards-expiring' \| 'failed-payment'` | Which bucket produced this row |
| `studentName` | text | `CreditWatchStudent.display_name` (balance rows) or the purchase's buyer name (failed-payment rows) |
| `coreCustomerId` | number | `CreditWatchStudent.customer_id` or the purchase's `buyerAcademyCustomerId` — backs the row's action link |
| `credits` | number | The student's current wallet balance for the relevant lesson type (balance rows: the bucketed balance itself; failed-payment rows: that same student's current balance, reused from the same sweep — research.md #4) |
| `membership` | text | `lesson_type_name` (balance rows) or the failed purchase's `productTitle` (failed-payment rows) — see spec.md Assumptions on this column's name |
| `lastActivity` | ISO date | Balance rows: that student's most recent `snapshot.activity[0].occurred_at` from the fallback sweep (research.md #3). Failed-payment rows: `purchases.created_at` |
| `actionLabel` | `'Add Credit' \| 'Send Reminder' \| 'Retry Charge'` | Fixed per category — `cards-expiring` never renders (always empty, research.md #5) |
| `actionHref` | text | `/staff/credit-watch/{coreCustomerId}` (balance rows) or `/staff/purchases` (failed-payment rows) |

## Recent Lookup Row *(computed, not stored)*

Story 4 — reuses `StudentProfile` (`src/lib/auth/customer-profile.ts`) as-is; no new shape. The
table shows `firstName`, `email`, `coreCustomerId`, `isActive`, each linking to
`/staff/customers/{coreCustomerId}`.

## Everything else — unchanged shapes, new presentation only

- **Course** (Story 1/2): `CourseSummary` (`src/lib/courses/course-queries.ts`) — no shape change.
