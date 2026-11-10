# Contract: Stable v1 Scheduling API

**Branch**: `017-live-coaching` | **Date**: 2026-09-22

Every action the booking UI performs is one of these endpoints (FR-048) — no page calls `src/lib/booking/*` directly for anything listed here (research.md #12). Any future embed or in-app "Live Coaching" tab uses this same surface, never a different one. All endpoints are versioned under `/api/v1/booking`.

**Auth**: `Authorization: Bearer <api_key>` for external/API-key callers (reuses Ask a Coach's `api_keys` table, research.md #8) or the staff/student's own browser session for the built-in UI. A signed identity JWT (`X-Host-Identity`, FR-050) lets a host app pre-fill and skip the contact step on public/booking endpoints, reusing Ask a Coach's `verifyHostIdentityToken` shape.

**Rate limiting**: per API key and per source IP on public (unauthenticated) endpoints, same convention as Ask a Coach's `/api/v1/submissions` — exact limits are a `/speckit-tasks` implementation detail, not fixed here.

## Public — no auth required

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/booking/workshops` | Public master workshop calendar listing, filterable by `coachId`, `topic`, `dateFrom`/`dateTo` (FR-007). Excludes `isHidden` event types. |
| `GET` | `/api/v1/booking/workshops/:id` | One workshop's detail, including remaining-seat count and waitlist state. |
| `GET` | `/api/v1/booking/ics/workshops` | ICS feed of the public workshop calendar (FR-013). |
| `GET` | `/api/v1/booking/ics/student/:token` | A Student's own-bookings ICS feed, token-scoped (research.md #10). |

## Coaches, event types & slots (session or API key)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/booking/coaches` | Id → display name list, optionally filtered by category. |
| `GET` | `/api/v1/booking/event-types` | List event types, filterable by `coachId`, `category`. Excludes `isHidden` unless the caller has a direct id (below). |
| `GET` | `/api/v1/booking/event-types/:id` | One event type's full config (booking questions, buffers, cutoff, pricing model) — works for a hidden/secret event type when accessed by direct id (FR-021). |
| `GET` | `/api/v1/booking/slots` | Open slots for an event type in a date range — the availability engine's read surface (FR-001–006); reflects generated slots, overrides, cross-category conflicts, and connected-calendar busy blocks all pre-applied, so the caller never has to reason about any of that itself. |
| `GET` | `/api/v1/booking/coaches/:id/troubleshoot` | Admin-only: for a given time, explains why it is/isn't available (FR-006). |

## Bookings (session, API key, or public with contact info)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/booking/bookings` | Create a booking. Body: `eventTypeId`, `slotId` (or `workshopId` for a workshop seat/waitlist join), `answers` (booking-question responses), contact info or host-identity JWT. Runs the credit check/debit (FR-023/024), then Zoom meeting creation (FR-029) — a Zoom failure does not fail this call (Edge Cases); response includes `zoomStatus: 'created' \| 'pending' \| 'failed'`. |
| `GET` | `/api/v1/booking/bookings/:id` | One booking's detail, including Zoom link and credit-transaction status. |
| `PATCH` | `/api/v1/booking/bookings/:id` | `{ action: 'reschedule', newSlotId }` or `{ action: 'cancel', reason }` — enforces the event type's `cancellationCutoffMinutes` (FR-020/025). |
| `GET` | `/api/v1/booking/students/:identifier/bookings` | A Student's bookings by email or `external_user_id` (FR-051) — never email alone as the only lookup path. |

## Session tracking (coach or admin session, or read-scoped API key)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/booking/sessions` | Filterable by `coachId`, `category`, `status`, `dateFrom`/`dateTo`; `Accept: text/csv` or the XLSX content type triggers export instead of JSON (FR-036/037), same content-negotiation pattern Ask a Coach's `/api/v1/reports/durations` already uses. |
| `GET` | `/api/v1/booking/sessions/counts` | Aggregated counts by category/date-range for a Coach's own dashboard (FR-034). |

## Availability & calendar management (coach session, own data only)

| Method | Path | Purpose |
|---|---|---|
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/v1/booking/availability/schedules` | A Coach's own weekly schedules (FR-001), rejecting cross-category overlaps (FR-004). |
| `GET` / `POST` / `DELETE` | `/api/v1/booking/availability/overrides` | Date-specific overrides (FR-002). |
| `POST` | `/api/v1/booking/calendar-connections` | Start an OAuth connection (Google/Microsoft) or submit an app-specific password (iCloud) (FR-010). |
| `PATCH` / `DELETE` | `/api/v1/booking/calendar-connections/:id` | Update which calendars are checked/written to, or disconnect. |
| `POST` | `/api/v1/booking/zoom-connection` | Connect this Coach's own Zoom account (research.md #1). |

## Admin

| Method | Path | Purpose |
|---|---|---|
| `GET` / `PATCH` | `/api/v1/booking/settings` | Global settings incl. "coaches may create their own event types" toggle (FR-046). |
| `GET` / `PATCH` | `/api/v1/booking/staff/:id/roles` | Grant/revoke Owner/Admin/Scheduler roles (FR-043, `booking_staff_roles`). |
| `POST` / `DELETE` | `/api/v1/booking/api-keys` | Create (name, read-only flag) / revoke — reuses Ask a Coach's `api_keys` table (FR-046). |
| `GET` | `/api/v1/booking/audit-log` | FR-045, reuses Ask a Coach's `audit_log` table. |
| `GET` / `POST` / `PATCH` | `/api/v1/booking/notification-workflows` | Per-event-type workflow config (FR-039). |
| `GET` | `/api/v1/booking/master-calendar` | Admin combined view across every Coach (FR-009). |

Every write above appends an `audit_log` row for availability, event-type, or global-setting changes (FR-045); the exact enumerated set of audited actions is a `/speckit-tasks` implementation detail. Every booking lifecycle write also delivers the matching outbound webhook (`booking.created`/`.rescheduled`/`.cancelled`/`.completed`/`.no_show`, FR-050) via the reused `webhook_subscriptions`/`webhook_deliveries` tables.
