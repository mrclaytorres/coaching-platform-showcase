# Phase 0 Research: Admin Dashboard Redesign

**Branch**: `018-admin-dashboard-redesign` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

No `[NEEDS CLARIFICATION]` markers were left in spec.md (all resolved via documented Assumptions during specification). This research resolves the remaining *technical* unknowns needed before design: what already exists to reuse, and the few genuinely new pieces.

## #1 — Charting: no new dependency

**Decision**: Both charts (Student Growth line/area, New Enrollments bar) are hand-built with inline SVG, not a charting library.

**Rationale**: `apps/academy-platform/package.json` has zero charting dependencies today (grepped for recharts/visx/d3/victory/nivo — no hits). Each chart only ever renders 6 data points (last 6 months) — well within what a ~40-60 line hand-rolled SVG component can do cleanly, matching this codebase's established minimalism (native CSV generation instead of a library, `ical-generator` added only because ICS's binary-ish format genuinely isn't hand-rollable, etc.). Pulling in a full charting library for two simple, small, static-per-load charts would be the heavier choice, not the lighter one.

**Alternatives considered**: `recharts` (most common React charting choice) — rejected, adds a real dependency (plus its own re-render/SSR quirks in Next.js) for something two small inline SVGs fully cover. A canvas-based approach — rejected, SVG is simpler for static bar/line charts and keeps markup inspectable/testable.

## #2 — Student/staff search: one function exists, one is new

**Decision**: Reuse `searchCustomerProfiles(query)` (`src/lib/auth/customer-profile.ts:335`) as-is for the student half. Add a new, symmetric `searchStaffProfiles(query)` to `src/lib/auth/staff-profile.ts` for the staff half — `listStaffProfiles()` exists but has no filter; staff counts are small (≈18 per the mockup) so this is a simple `.ilike` query mirroring the customer one, not a new pattern.

**Rationale**: `searchCustomerProfiles` already does exactly what FR-018 needs for students (case-insensitive substring match on email or first name, `source_app IS NULL` to exclude Ask-a-Coach-only leads) — reusing it verbatim keeps "a student in search results" consistent with every other place this app already defines "a real Academy student." No equivalent exists for staff; adding one is the smallest unit of new code that keeps both halves of FR-018 symmetric.

## #3 — Review Queue: cross-app read, existing assignment column

**Decision**: A new function in `apps/academy-platform` queries Ask a Coach's `conversations` table directly via a service-role Supabase client (same project, different app's tables) — not an HTTP call to `apps/ask-a-coach`. Bulk assignment (FR-011) writes to the existing `conversations.assigned_coach_id` column directly, the same column `apps/ask-a-coach`'s own `updateConversation()` already writes.

**Rationale**: This exact pattern is already established and live — `getCrossAppLinks` (`src/lib/auth/staff-profile.ts:161`) already queries Ask a Coach's `coach_staff_roles`/`coach_staff_status` tables directly from `apps/academy-platform` for the cross-app sidebar link, because both apps share one Supabase project (confirmed: both apps' `NEXT_PUBLIC_SUPABASE_URL` point at `[project-ref].supabase.co`). `conversations.assigned_coach_id` already exists and is already read/written by Ask a Coach's own code (`src/lib/conversations/get-thread.ts:42`, `update.ts:13`, `list.ts:20,37,50`) — reusing it means FR-011's bulk assignment needs zero new schema and is immediately visible in the Ask a Coach coach's own inbox with no sync step.

**Alternatives considered**: A new internal API endpoint on `apps/ask-a-coach` that `apps/academy-platform` calls over HTTP — rejected, adds a new API surface and a network hop for a same-database read/write that the existing `getCrossAppLinks` precedent already proves is unnecessary.

## #4 — Credit Watch panel: reuse, don't rebuild

**Decision**: The dashboard's Credit Watch panel calls the exact same functions the full Credit Watch page already calls — `fetchCreditWatch(days)` (`src/lib/core-api.ts:52`) with its existing `fetchCreditWatchFallback(days)` fallback (`src/lib/credit-watch/fallback.ts:21`) — just rendering the top N of each list instead of all of them.

**Rationale**: This data is already fully assembled (at-risk sessions, negative balances, effective-balance adjustments) by spec 008/011's existing work. Nothing about FR-014/015 needs new aggregation — it's a smaller view over the same calls.

## #5 — Recent Activity: read-and-merge, not a new audit table

**Decision**: A new function reads each covered feature's own existing recent rows directly — confirmed bookings (`bookings.created_at`/`status='confirmed'`), Ask a Coach replies (`replies.created_at` where `author_type='coach'`), and tier advancements (`student_tier_progress.updated_at`) — and merges them by timestamp in application code, descending, capped at a fixed count within a fixed lookback window.

**Rationale**: Confirmed during specification that `audit_log` doesn't cover these domains at all (only role grants, booking-settings toggles, staff invites, branding — see spec.md Assumptions) and that `reviewSubmission()`/`updateConversation()` don't record an actor. Reading existing timestamp columns directly needs no schema change and no new write path threaded through three unrelated features — the read-only merge is strictly additive.

**Alternatives considered**: Adding `audit_log` writes to booking confirmation, reply-sending, and tier advancement — rejected as out of scope per spec.md's own Assumptions; a much larger change (touches three already-working, unrelated code paths) for a feed that reading existing columns already fully satisfies.

## #6 — Month-bucketing (Active Students MoM, both charts)

**Decision**: One new small aggregation function reads `customer_profiles.created_at`/`is_active` (already selected by `listCustomerProfiles`, `src/lib/auth/customer-profile.ts:137`) and buckets by calendar month in application code (not a SQL `GROUP BY`, given Payload/Supabase access here is via `supabase-js`, not raw SQL, matching this codebase's established query style everywhere else).

**Rationale**: Confirmed no existing month-bucketing logic exists anywhere in the repo (grepped "growth", "month-over-month", "startOfMonth" — zero hits). The source columns already exist; this is new, self-contained logic with no reuse available, consistent with spec.md's own Assumption on this point.

## #7 — "Bookings Today" and "Book Coaching": already resolved in spec.md

No further research needed — spec.md's Assumptions already redefine both away from their literal mockup form (confirmed-today split by category instead of a nonexistent "pending" status; "Book Coaching" links to the existing Admin Master Calendar instead of a new proxy-booking flow). Implementation reuses `getSessionCounts`-style category filtering (`src/lib/booking/sessions.ts`) and `listAllUpcomingSlots` (`src/lib/booking/time-slots.ts:201`) respectively — both already exist.
