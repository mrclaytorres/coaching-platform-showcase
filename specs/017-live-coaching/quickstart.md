# Quickstart: Academy Live Coaching (Calendly Replacement)

**Branch**: `017-live-coaching` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Manual validation only — no automated test framework exists in this repo (unchanged since 013).

## Prerequisites

0. External accounts (Zoom, Google, Microsoft, iCloud) needed for Scenarios 4 and 6 are set up per `docs/live-coaching-provisioning.md` — none of Steps 4-9 there are needed for Scenarios 1-3/5/7/8.
1. Apply `contracts/supabase-schema.md` to your dev Supabase project (extensions to 013's tables, then the new tables — order matters, see that file's note).
2. Add the Payload field changes (`contracts/payload-collections.md`) to `collections/BookingEvents.ts`, then:
   ```bash
   npm run payload -- migrate:create extend_booking_events_live_coaching
   npm run payload -- migrate
   ```
3. New env vars:
   ```env
   # Zoom (Server-to-Server OAuth app — Zoom Marketplace, research.md #1)
   ZOOM_ACCOUNT_ID=[per-coach connection uses OAuth; this is only needed if a company-account
                    fallback is ever configured]
   ZOOM_CLIENT_ID=[Server-to-Server OAuth app]
   ZOOM_CLIENT_SECRET=[Server-to-Server OAuth app]

   # Google Calendar (Google Cloud Console → OAuth client, Calendar API enabled)
   GOOGLE_CALENDAR_CLIENT_ID=
   GOOGLE_CALENDAR_CLIENT_SECRET=
   GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3040/api/booking/calendar-oauth/google

   # Microsoft Graph (Azure AD app registration, Calendars.ReadWrite delegated permission)
   MICROSOFT_CALENDAR_CLIENT_ID=
   MICROSOFT_CALENDAR_CLIENT_SECRET=
   MICROSOFT_CALENDAR_TENANT_ID=common
   MICROSOFT_CALENDAR_REDIRECT_URI=http://localhost:3040/api/booking/calendar-oauth/microsoft

   # Encryption key for external_calendar_connections.encrypted_credentials (research.md #3)
   CALENDAR_CREDENTIALS_ENCRYPTION_KEY=[generate with: openssl rand -base64 32]

   # No new credit-system env vars — credits.ts (research.md #5) reuses the existing
   # CORE_SHARED_SECRET/CORE_WAF_BYPASS and base URL src/lib/core-api.ts already has;
   # there is no live Core write endpoint to point at yet (contracts/core-credits-write-api.md)

   # Cron secrets, same pattern as 013's BOOKING_REMINDER_CRON_SECRET
   CALENDAR_SYNC_RENEWAL_CRON_SECRET=[generate with: openssl rand -base64 32]
   ```
4. `npm run dev` (port 3040).
5. One dev Coach account, one dev Admin account, two dev Student accounts, reusing `/dev/seed-accounts` per prior specs' quickstarts.

> Zoom Marketplace app approval and Google OAuth app verification (plan.md's Technical Context
> "Scale/Scope" note) have real external lead time — a dev/unverified app is sufficient for the
> scenarios below, but production go-live needs both started well ahead of launch.

## Scenario 1 — Recurring availability replaces manual slots (User Story 1, P1)

1. As Coach, go to `/booking/staff/availability`, define a weekly schedule: Mon/Wed/Fri 2-6pm, category `one-on-one`. **Expect**: future one-on-one slots appear automatically at `/booking/staff/[eventId]` without adding any manually.
2. Add a second schedule: Tue 10am-12pm, category `group`, overlapping no existing schedule. **Expect**: saves cleanly.
3. Attempt a third schedule that overlaps schedule 1's time in category `workshop`. **Expect**: rejected with a conflict error (FR-004).
4. Add a one-day override blocking next Friday. **Expect**: no slot is generated for that date; the troubleshooting view (`/api/v1/booking/coaches/:id/troubleshoot`) explains why when queried for that date/time.
5. Book one of the generated slots as a Student, then edit the underlying weekly schedule. **Expect**: the existing booking is untouched (FR-005).

## Scenario 2 — Credits checked, debited, refunded (User Story 2, P1)

1. Find a real (or dev-Core-stubbed) student whose `fetchSnapshot()` balance shows exactly one `one-on-one` credit.
2. Book a one-on-one slot as that Student. **Expect**: succeeds, `credit_transactions` gets one `debit`/`placeholder` row, `checkCredit`'s effective-balance calculation (Core's snapshot balance + this row) is now zero — even though Core's own reported balance hasn't changed (research.md #5).
3. Attempt a second booking. **Expect**: blocked with a "credit required" message before any slot is claimed (FR-023).
4. Cancel the first booking before its `cancellationCutoffMinutes`. **Expect**: `credit_transactions` gets a matching `refund`/`placeholder` row, effective balance returns to one.
5. Book again, then cancel *after* the cutoff (or simulate a no-show). **Expect**: no refund row is created, `bookings.late_cancellation = true`, and a `session_records` row is still created for coach-pay purposes (FR-025).
6. Fire the debit call twice for the same booking id (simulate a retry). **Expect**: `credit_transactions`' unique constraint prevents a second debit (SC-003).
7. Confirm no request is ever made to a Core *write* endpoint (there isn't one) — every row this scenario produces stays `status='placeholder'`, which is expected, not a bug (contracts/core-credits-write-api.md).

## Scenario 3 — Public workshop discovery and booking (User Story 3, P2)

1. As Admin, create a workshop event type: `pricingModel = credit`, capacity 3, two co-hosting Coaches.
2. Visit `/booking/workshops` with no login. **Expect**: the workshop appears, filterable by coach/topic/date.
3. Book 3 seats as 3 different Students. **Expect**: all succeed; a 4th Student is offered a waitlist position instead of a hard failure (FR-014).
4. Cancel one of the 3 confirmed bookings. **Expect**: the waitlisted Student is offered the freed seat with a visible hold window (research.md #6); claim it before expiry and confirm the booking succeeds.
5. Mark the workshop `isHidden`. **Expect**: it disappears from `/booking/workshops` but remains bookable at its direct `/booking/workshops/:id` link (FR-020).

## Scenario 4 — Zoom auto-creation (User Story 4, P2)

1. Connect a test Zoom account as the Coach (`/booking/staff/calendar` → Zoom connection).
2. Confirm a one-on-one booking. **Expect**: a unique Zoom join link appears in the booking detail and confirmation email within about a minute.
3. Reschedule that booking to a different slot. **Expect**: the same Zoom meeting id updates its time rather than a new meeting being created (FR-029).
4. Cancel it. **Expect**: the Zoom meeting is deleted.
5. Book a group session with 3 attendees. **Expect**: all 3 see the identical join link (FR-030).
6. Temporarily use an invalid Zoom credential and confirm a booking. **Expect**: the booking still succeeds, `zoom_meetings.status = 'failed'` with a `failure_reason`, and this is visible to staff (FR-032).

## Scenario 5 — Session tracking and export (User Story 5, P2)

1. Complete several sessions across categories for one Coach (mark `session_records.status = 'completed'` for past bookings, simulating what a Zoom webhook or manual mark would do).
2. As that Coach, view `/booking/staff/sessions` filtered to a date range. **Expect**: counts match exactly what was completed.
3. As Admin, export the same range to CSV and to XLSX. **Expect**: both files' row counts and totals match the on-screen filtered view exactly (FR-037).
4. Delete or rename the underlying event type/coach record. **Expect**: previously exported/viewed historical rows are unchanged (FR-038, denormalized snapshot fields).
5. As a non-Admin Coach, attempt to change an event type's `sessionCategory` directly via the API. **Expect**: rejected (FR-039).

## Scenario 6 — External calendar sync (User Story 6, P3)

1. Connect a Google test account as Coach, choosing one calendar to check and one to receive bookings.
2. Place a busy event on the checked calendar during otherwise-open hours. **Expect**: that time no longer appears in `/api/v1/booking/slots`.
3. Confirm a Academy booking. **Expect**: it appears as an event on the chosen Google calendar.
4. Manually expire the stored push-channel state (or wait past a short test threshold) and run the renewal cron. **Expect**: the channel renews; if renewal itself fails (revoke the token first), the connection flips to `needs_reconnect` and the Coach sees an alert.
5. Repeat steps 1-3 with a CalDAV/iCloud test account. **Expect**: conflict-checking works via the poll cron instead of a push channel (research.md #2).

## Scenario 7 — Roles and audit log (User Story 7, P3)

1. As Owner/Admin, invite a new staff member with the `scheduler` role only.
2. As that user, confirm they can create an event type but `/booking/admin/api-keys` and `/booking/admin/roles` are inaccessible (FR-043).
3. Toggle "coaches may create their own event types" off; confirm a plain Coach can no longer create one (FR-044).
4. Make an availability change and check `/booking/admin/audit-log`. **Expect**: an entry attributed to the acting user with what changed (FR-045) — same `audit_log` table Ask a Coach's own audit page reads from.

## Scenario 8 — Per-event-type notification workflows (User Story 8, P4)

1. Configure a workshop's reminder to fire 24h before start, and a one-on-one's to fire 1h before.
2. Book one of each with a start time that will cross both windows during testing (or fast-forward the cron's due-window check). **Expect**: each Student receives their reminder at their own event type's offset, not a shared global one (FR-040).
3. Confirm the owning Coach and relevant Admins receive a separate new-booking alert distinct from the Student's confirmation email.
