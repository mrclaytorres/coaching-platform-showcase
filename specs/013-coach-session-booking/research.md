# Phase 0 Research: Coach Session Booking

**Branch**: `013-coach-session-booking` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

Every decision below was made to resolve a gap the spec deliberately left open (Assumptions section) or a concurrency/architecture question the spec doesn't cover (it's business-facing, not technical). Nothing here overrides a stated FR — each decision is the "how" behind a "what" the spec already fixed.

## 1. Where does "separate stand-alone application" live?

**Decision**: A new top-level route tree, `src/app/booking/`, with its own staff (`/booking/staff/...`) and student (`/booking/customer/[id]/...`) branches — not folded into the existing `/staff/courses/...` or `/customer/[id]/courses/...` trees. Both branches reuse the existing `requireStaffRole()` / `requireCustomerProfile()` auth helpers; no new login flow, no new account system.

**Rationale**: This repo is a single Next.js app with no monorepo tooling (`package.json` has no `workspaces` field, no `apps/` directory) — a literal separate deployable service isn't how anything else in this codebase is structured, and introducing one here would mean a second `next.config`, a second Payload instance or a shared-DB multi-app setup, and duplicated auth wiring for no functional benefit. A new route prefix gets the "feels like its own app" outcome (distinct nav, not interleaved into course pages) the user asked for, while staying inside the deployment, dependency, and auth surface that already exists — matching the "reuse existing collections… e.g. Users" half of the same request.

**Alternatives considered**: A true separate Next.js app in a new `apps/booking` workspace was rejected — it would require introducing a monorepo tool (Turborepo/Nx) that doesn't exist today, duplicating the Supabase/Payload client setup, and solving cross-app auth session sharing, for a feature whose actual requirement (per spec Assumptions) is "its own navigation/URL space," not physical process isolation.

## 2. Storage split: Payload vs. Supabase

**Decision**:
- **Booking Event** (spec's authored, relatively static entity) → new Payload collection `booking-events`, alongside `Courses`/`Assignments`/`Tiers`.
- **Time Slot** and **Booking** (spec's high-write, concurrency-sensitive entities) → new Supabase tables `booking_time_slots` and `bookings`, alongside `submissions`/`course_enrollments`/`student_tier_progress`.
- Cross-references between the two systems are plain-text/uuid columns, never a real foreign key — `booking_time_slots.booking_event_id` stores a Payload doc id as text, following the same convention `course_enrollments.course_id` already uses.

**Rationale**: This mirrors the split this codebase already has everywhere else: Payload owns staff-authored structured content (Courses → Modules → Lessons, Assignments), Supabase owns transactional student/staff activity (submissions, course_enrollments, student_tier_progress) that needs tight, atomic, constraint-backed writes. A Booking Event (title, description, duration, type, capacity default, Tier restriction) is authored once and read often — a Payload collection, exactly like `Assignments`. A Time Slot's capacity and a Booking's existence are mutated constantly under concurrent access (SC-003 requires zero over-capacity bookings) — that needs real Postgres transactional guarantees on a table the app fully controls, which is what Supabase-managed custom tables already provide for `submissions`/`course_enrollments`. Although Payload's Postgres adapter and the Supabase tables are the *same physical database* (both read `DATABASE_URL`), Payload owns its own tables' migrations/versioning internals — writing raw SQL against a Payload-managed table to get atomic capacity locking would fight that ownership boundary, which is exactly why the existing codebase convention keeps a hard line between "Payload writes only through Payload's API" and "Supabase tables get raw SQL."

**Alternatives considered**: Putting Time Slot in Payload too (nested like Lessons under Modules) was considered, since it would keep all of a Booking Event's schedule authoring in one system. Rejected because Payload's Local API has no primitive for "atomically increment a counter only if under a limit" — every write goes through its full document-update lifecycle, which is the wrong tool for a capacity race (see #3 below).

## 3. Concurrency-safe capacity enforcement (FR-010, SC-003)

**Decision**: `booking_time_slots` carries a `confirmed_count integer NOT NULL DEFAULT 0` column (denormalized, not derived by counting `bookings` rows on every check). Booking a slot is a two-step, single-purpose-statement sequence:

1. `UPDATE booking_time_slots SET confirmed_count = confirmed_count + 1 WHERE id = $1 AND confirmed_count < capacity AND status = 'open' RETURNING id;` — if this returns zero rows, the slot is full or closed; stop, tell the Student.
2. `INSERT INTO bookings (time_slot_id, student_id, status) VALUES ($1, $2, 'confirmed');` — if this fails (e.g. the `UNIQUE (time_slot_id, student_id)` constraint catches an already-booked Student retrying), compensate by decrementing `confirmed_count` back down.

**Implementation note (discovered during `/speckit-implement`)**: `supabase-js`'s query builder has no way to express a same-row column comparison (`confirmed_count < capacity`) as a filter — every `.eq()`/`.lt()` compares a column to a literal, not to another column. `src/lib/booking/bookings.ts`'s `claimSlotCapacity` therefore implements step 1 as a read-then-compare-and-swap: read `confirmed_count`/`capacity`/`status`, reject locally if already full/closed, then `UPDATE ... SET confirmed_count = <read value> + 1 WHERE id = $1 AND confirmed_count = <read value> AND status = 'open'` — a CAS on the exact value just read, retried up to 3 times under contention. This is equivalent-safety to the plain `<` guard: any concurrent claim between the read and the write changes `confirmed_count`, so the CAS predicate fails and the request retries or reports `slot-full`, never overcounting. `releaseSlotCapacity` (cancellation, and compensating step 2's failure) mirrors the same CAS pattern for the decrement.

Canceling a booking is the mirror: mark the `bookings` row `status = 'canceled'`, then `UPDATE booking_time_slots SET confirmed_count = confirmed_count - 1 WHERE id = $1 AND confirmed_count > 0`.

**Rationale**: The project's Postgres best-practices guidance is explicit that the safest, lowest-contention pattern is a single atomic `UPDATE ... WHERE <guard> RETURNING ...` rather than a long-held `BEGIN; SELECT ... FOR UPDATE; ...; COMMIT;` transaction spanning application logic. The guarded UPDATE in step 1 *is* the lock — Postgres serializes concurrent updates to the same row, so two Students racing for the last spot will always see one succeed and one see zero rows affected, satisfying FR-010/SC-003 without a stored procedure or an explicit multi-statement transaction. This also keeps the pattern consistent with how the rest of this codebase already guards against duplicates — application code plus a DB constraint, no PL/pgSQL functions anywhere else in the schema.

**Alternatives considered**: A Postgres function/RPC (`book_slot(...)`) wrapping both statements in one true transaction was considered for stronger atomicity (no possible orphaned counter). Rejected for this MVP — it introduces a new pattern (stored procedures) this codebase has never used, and the compensating decrement on step-2 failure is sufficient given step 2 can only fail on the duplicate-student constraint (a condition that doesn't corrupt `confirmed_count`, it just needs the compensation to run, which the application code guarantees in the same request).

## 4. Tier eligibility semantics (FR-019–021)

**Decision**: A Student is eligible for a Tier-restricted Booking Event if their `student_tier_progress.current_tier_rank` (for the same `course_owner_id` the restricting Tier belongs to) is **greater than or equal to** at least one of the event's `restrictedTiers[].order` values — i.e. "has reached this Tier or beyond," reusing the exact comparison `isCourseUnlocked()` (`src/lib/progress/tier-progress.ts`) already uses for sequential-locked Course access.

**Rationale**: The spec's Tier concept is the platform's existing cumulative belt-progression system, not a discrete membership label — a Student at Tier rank 5 has already unlocked ranks 1–4. Treating event eligibility the same way ("this session is for Students who've reached at least this level") is the only interpretation consistent with how Tier already gates everything else in the product, and lets this feature call the existing `isCourseUnlocked`-style check directly instead of inventing new semantics.

## 5. Overlap prevention (FR-009) is an application-level check, not a DB constraint

**Decision**: Before claiming a slot (research #3 step 1), the booking action fetches the Student's other confirmed Bookings, resolves each one's Booking Event `durationMinutes` from Payload, computes `[start, start + duration)` for each, and rejects the new booking if it overlaps any of them. This runs in the same request as the capacity claim but is not itself a database-enforced constraint.

**Rationale**: A time range lives partly in Supabase (`booking_time_slots.start_time`) and partly in Payload (`booking-events.durationMinutes`) — there is no single-table constraint or index that can express "no two of this Student's slots overlap" across that boundary. A request-time check is the same rigor level this codebase already applies to comparable cross-system rules (e.g. the final-assessment/Tier-advance guards in `course-actions.ts` are application checks, not database ones). It does not need to be airtight against two *different* simultaneous requests for genuinely overlapping-but-different slots — that's a vanishingly rare race for a human manually picking times — whereas same-slot double-booking (research #3) is common (two Students racing for the last spot) and does get a real atomic guard.

## 6. Email provider

**Decision**: Resend, via its official TypeScript SDK. New env vars: `RESEND_API_KEY`, `BOOKING_EMAIL_FROM`.

**Rationale**: No email infrastructure exists anywhere in this repo today (confirmed — no `resend`/`sendgrid`/`nodemailer`/SMTP references) and no AWS SES account is provisioned (the existing `@aws-sdk/client-s3` usage points at a self-hosted MinIO endpoint, not real AWS). Resend is a single-API-key integration purpose-built for transactional email from a Next.js server action, with the smallest footprint of any mainstream option — it doesn't need a verified sending domain to start in dev, and its SDK is a thin fetch wrapper, not a heavyweight client.

**Alternatives considered**: Nodemailer+SMTP was rejected as needing an SMTP relay this project doesn't have. AWS SES was rejected — it would need a *real* AWS account (the current AWS SDK usage is MinIO-compatible-endpoint only) and SES's sandbox/production-access approval process is more operational overhead than this MVP's email volume justifies.

## 7. Reminder scheduling (FR-024)

**Decision**: A new Route Handler, `src/app/api/booking/send-reminders/route.ts`, checks a shared-secret header (`BOOKING_REMINDER_CRON_SECRET`, same pattern as the existing `CORE_SHARED_SECRET` external-call convention) and, when valid, scans for confirmed Bookings whose slot starts within the next `BOOKING_REMINDER_WINDOW_HOURS` (default 24) and whose `reminder_sent_at IS NULL`, sends the reminder, and stamps `reminder_sent_at`. An external scheduler (host crontab, or any free HTTP-cron service) is expected to call this endpoint periodically (e.g. hourly) — documented as a new production deployment step, the same way `docs/production-deployment.md` already documents external Supabase/MinIO setup steps.

**Rationale**: Nothing in this repo runs a background job today — deployment is `next start` with no `vercel.json`, no `pg_cron` usage, no queue. Building a full in-process scheduler would be new infrastructure disproportionate to "send one reminder email per booking." An HTTP endpoint an external cron hits is the minimal-footprint option that works regardless of hosting target (Vercel Cron, a VPS crontab, or a third-party pinger all work identically against a plain Route Handler).

## 8. Notification failures are recorded, not just logged

**Decision**: A new Supabase table `booking_notification_failures` (booking id, notification type, error message, timestamp) captures any Resend send failure (FR-025). The staff-facing slot roster view (`/booking/staff/[eventId]`) surfaces unresolved failures for that event's bookings inline, rather than a separate dedicated failures dashboard.

**Rationale**: FR-025 requires failures be "recorded for staff visibility," not that a new admin surface be built — attaching it to the roster view staff already visit for that event keeps the failure visible exactly where a Coach would notice a Student didn't get their confirmation, without adding a new page whose only content is an error log.

## 9. Access control is role-gated, not per-Coach-owner-scoped

**Decision**: Any `super_admin`, `staff`, or `coach` account can create, edit, publish, add slots to, and cancel slots on *any* Booking Event — the `coachId` field on a Booking Event is descriptive ("led by this Coach," shown to Students) rather than an authorization boundary. This mirrors `requireStaffRole(['super_admin', 'staff', 'coach'])` exactly as already used for Assignments (`createAssignment`/`updateAssignment`), Modules, and Lessons.

**Rationale**: No existing staff-authored content in this codebase is owner-scoped — a Course, Module, Lesson, or Assignment created by one staff member is editable by any other staff/coach account; there's no "only the creator can edit" check anywhere to extend. Introducing owner-scoping here would be a new, unprecedented access pattern for a spec that never asked for it (FR-016 only distinguishes Staff/Coach from Student, not Coach-from-Coach).
