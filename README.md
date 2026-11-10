# Coaching Platform: Backend Case Study

A sanitized showcase of the backend work I did on a production platform for an online coaching
academy (client name withheld). The production code is private. This repo explains the
architecture and decisions, and includes **rewritten, standalone versions of the core backend
patterns** with tests you can run.

> Nothing here is copied from the client codebase. Names, endpoints, schemas and business
> details have been changed or generalized. The patterns and trade-offs are real.

## The project

The academy needed a modern student and staff platform built around a legacy system of record
that it couldn't change quickly:

- **Two Next.js services in one monorepo:** the main academy platform (courses, payments, staff
  consoles, booking) and a standalone, API-first video Q&A service where students record a
  question and a coach replies.
- **Shared identity:** both services authenticate against one Supabase project, so a student
  has one account everywhere. Shared tables (audit log, API keys, webhook deliveries) are reused
  rather than duplicated.
- **Integrations:** Stripe (cards, wallets, PayPal, bank debit; one-off and subscription
  products), Payload CMS for authored content, a legacy Django REST API for customer, credit and
  session data, Zoom, external calendar sync (Google, Microsoft 365, CalDAV), Resend for email,
  and Mux for video.
- **Scope:** 20+ features shipped (all specs in [specs/](specs/)) through a spec-driven, AI-assisted workflow (see
  [docs/agentic-workflow.md](docs/agentic-workflow.md)).

My role: backend and full-stack engineer. I owned the specs, architecture, implementation and
deployment for most of the features.

See [docs/architecture.md](docs/architecture.md) for the system diagram and decisions, and
[specs/](specs/) for every feature's spec, research, plan and tasks (sanitized), numbered as they
were built. Pattern 1 below is
[specs/011-credit-watch-fallback](specs/011-credit-watch-fallback/).

## Patterns in this repo

| Pattern | Problem | Code |
|---|---|---|
| **Resilient aggregation** | A staff dashboard needed an aggregate endpoint the upstream team hadn't built. | [`src/resilient-aggregation/credit-watch.ts`](src/resilient-aggregation/credit-watch.ts) |
| **Atomic capacity claim** | Two students must never get the last seat in a group session. | [`src/booking/capacity.ts`](src/booking/capacity.ts) |
| **Compensating booking pipeline** | Booking touches seats, bookings and credits; any step can fail. | [`src/booking/book-slot.ts`](src/booking/book-slot.ts) |
| **Swappable, idempotent credit ledger** | The system of record had no write endpoint, but credits still had to be enforced. | [`src/credits/credits-adapter.ts`](src/credits/credits-adapter.ts) |
| **Hashed API keys** | A versioned public API for a future mobile app and integrations. | [`src/api-keys/api-keys.ts`](src/api-keys/api-keys.ts) |

### 1. Resilient aggregation

The staff credit-watch page lists students with negative balances and upcoming sessions that
would overdraw them. It was designed around one aggregate endpoint from the upstream API, and
that endpoint didn't exist yet. Instead of shipping a broken page or waiting:

- The service tries the aggregate call first.
- If that fails, it rebuilds the same lists from a per-student endpoint that already worked in
  production, using `Promise.allSettled` so one bad record can't take down the page.
- The fallback returns **the exact same response shape** plus `source: 'fallback'` and an
  `uncheckedCount`, so the UI keeps one rendering path and can say the data is partial.
- A written handoff contract tells the upstream team what the real endpoint needs to return, so
  it can be dropped in later with no UI changes.

### 2. Atomic capacity claim

The booking store's query builder can't express `WHERE confirmed_count < capacity` as a single
filter. So the claim reads the slot, then writes with a **compare-and-swap** on the count it just
read, and retries a few times if it loses a race. The test fires 10 concurrent claims at a slot
with 3 seats and checks that exactly 3 succeed.

### 3. Compensating booking pipeline

Read-only checks (eligibility, credit) run first, so nothing is written for a request that will
be rejected anyway. Every write after the seat claim has a matching undo step: a failed booking
insert releases the seat, and a failed credit debit cancels the booking *and* releases the seat.
The confirmation email runs last and never fails the booking.

### 4. Swappable, idempotent credit ledger

Credits live in the legacy system, which had no write API. Bookings still had to spend credits,
so the adapter enforces them against a local ledger laid on top of the upstream's last-known
balance. A unique `(booking_id, type)` constraint makes debits and refunds idempotent: a retried
call is a no-op, not a double charge. When the upstream write endpoint ships, a new class
implements the same `CreditsAdapter` interface.

### 5. Hashed API keys

Only a SHA-256 hash is stored, and the raw key is shown once. Revoked keys return 401 and
read-only keys get 403 on writes. Each service prefixes its keys, since both share one table.

## Running the tests

Requires Node 22.18 or newer, which runs TypeScript directly. No dependencies to install.

```bash
npm test
```

## Operations notes

- **Deploys:** PM2 on a Linux staging and production host, one process per service.
- **A bug worth mentioning:** on staging, starting the app through an npm workspace command
  didn't reliably change the working directory, so Next.js loaded `.env` from the wrong folder
  and Stripe keys showed up as missing. The fix was to set `cwd` explicitly in the PM2 config, so
  the OS-level process starts in the right directory no matter how npm behaves.
- **Third-party provisioning:** every feature that needed a new external account (Mux,
  Turnstile, Zoom, calendar OAuth apps, Resend) shipped with a step-by-step provisioning runbook.

## License

[MIT](LICENSE)
