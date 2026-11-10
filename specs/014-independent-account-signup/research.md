# Phase 0 Research: Independent Account Signup

## 0. Discovery mid-implementation: branch 006 already solved "an account with no Core identity"

While preparing to apply this plan's original migration (`customer_profiles.core_customer_id` → nullable), a schema check turned up an unexpected column already live on the shared dev database: `account_origin text NOT NULL DEFAULT 'core-linked'`, with a `CHECK (account_origin IN ('core-linked', 'native'))` constraint, a `native_customer_id_seq` sequence, and a `next_native_customer_id()` RPC — none of which this plan's Phase 0/1 had accounted for.

Traced it to branch `006-course-sales-payments` (per prior project memory: fully implemented, 26/27 tasks complete, never merged into `develop`/`main`). Its spec 006 needed the same underlying capability this feature needs — "a person with no prior CourseHost/Core relationship gets a working `customer_profiles` row" — for a checkout flow, not a signup flow, but the identity problem is identical. Its solution (spec 006 research.md §3):

- `core_customer_id` stays `NOT NULL`. A native account gets a **negative** synthetic id (`-nextval('native_customer_id_seq')`), guaranteed disjoint from Core's positive-integer space.
- `account_origin` (`'core-linked' | 'native'`) is the actual signal for "does this account have a real Core record," not nullability.
- `src/app/customer/[id]/layout.tsx` and `page.tsx` (on branch 006, not yet in `develop`) check `account_origin` and skip the one `fetchSnapshot()` call for a native account, rendering existing empty states instead. Every other page in that tree needs zero changes.
- `src/lib/auth/customer-profile.ts` (branch 006) already has `createNativeCustomerProfile(input: { supabaseUserId, email, firstName }): Promise<{ id, coreCustomerId }>` — the exact primitive this feature's signup path needs, and `getCustomerProfileByEmail()`.

Confirmed against the live database: the schema (`account_origin`, the sequence, the RPC, and even the `purchases` table) is fully applied, with 6 existing rows, all `'core-linked'`. Someone applied 006's full migration ahead of merging its application code.

**Decision (user-confirmed)**: Rework this feature onto 006's `account_origin`/native-id convention instead of the nullable-column design. Concretely:
- Withdraw the `core_customer_id` nullable migration entirely — not needed, and would create a second, competing "not really Core" convention alongside 006's if added.
- Port `createNativeCustomerProfile()` and `getCustomerProfileByEmail()` from branch 006 into this branch unmodified (they're small, self-contained, and don't depend on any of 006's checkout-specific code).
- Port the `account_origin` guards in `layout.tsx`/`page.tsx` from branch 006 into this branch.
- Do **not** merge branch 006 wholesale, and do **not** touch `purchases`, Stripe, or the `enrollment.ts` internal/public split — those remain 006's own scope, out of bounds here.
- This feature's actual new contribution becomes narrower and sharper than the original draft: (a) trigger native-account creation from `/login`'s signup path, not only from checkout, and (b) build the verified linking flow that converts a native account into a core-linked one — which branch 006 never built at all (its native accounts are a one-way "bought without Core" outcome with no path back to a real Core identity).

**Consequence for the rest of this research.md**: §3 (route resolution for an unlinked user) and §6 (reaching Coaching before linking) from the original draft are now moot — a native account is already a normal account at `/customer/[id]`, reachable by every existing route including booking, with no new resolution logic needed. They're removed below rather than kept as dead sections. §1, §2, §4, §5, §7 are retained, with §4 adapted for the native-account trigger instead of the withdrawn null-column trigger.

## 1. Why link verification can't reuse Supabase's own OTP/magic-link mechanism

`/login`'s existing `signIn` action calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`. This authenticates a *browser* as an email — it either signs an existing `auth.users` row in, or (Supabase's default behavior) creates a brand-new one. That's exactly why independent signup needs no new auth mechanism (see §2) — but it's also exactly why it's the wrong tool for proving "the already-signed-in user also controls this *other* email address." Routing link verification through a second `signInWithOtp` call against the Core record's on-file email would either mint a second, disconnected `auth.users`/`customer_profiles` identity, or silently hijack whatever account already owns that email — neither is "link my existing account."

**Decision**: A purpose-built, single-use verification token, independent of Supabase Auth. Generated with `crypto.randomBytes(32)`, stored as a SHA-256 hash (never the raw token) in a new `core_link_requests` row alongside the requesting `customer_profile_id`, expiry, and consumed state. The emailed link carries the raw token; the verify endpoint hashes what it receives and looks up the match. Sent via Resend, same pattern as `src/lib/booking/notifications.ts` (`getResendClient()`, `BOOKING_EMAIL_FROM`).

**Alternatives considered**: Supabase's `admin.generateLink({ type: 'magiclink' })` — rejected for the identity-fork reason above. Comparing the Core snapshot's on-file email to the caller's *signup* email as a string match (today's `linkAccount` behavior) — rejected as the thing this feature is explicitly meant to improve on.

## 2. Why no new signup UI/mechanism is needed at the auth layer

`signInWithOtp` already creates a new `auth.users` row for any email with no existing account. Following a first-time magic-link click through `exchangeCodeForSession`, `/auth/callback` checks `staff_profiles`, then `getCustomerProfile(user.id)` — if neither matches, it redirects to `/login?message=no_profile`. Today, that state's only action is `linkAccount`, which hard-requires a valid Core customer id.

**Decision**: No separate `/signup` route, no password infrastructure. Add a second action to the `message === 'no_profile'` branch: "Continue without linking," which collects a first name and calls `createNativeCustomerProfile()` (ported from branch 006, §0), then redirects straight to `/customer/{negative coreCustomerId}` — no intermediate area.

**Alternatives considered**: A dedicated `/signup` page — rejected as an unnecessary parallel entry point.

## 3. The merge case: linking into a Core id that already has a staff-created pending row

Spec 012 lets staff enroll a student into a Tier/Course by Core id before that student has ever logged in, creating a `customer_profiles` row with `supabase_user_id: NULL`, `core_customer_id: <real Core id>`, `account_origin: 'core-linked'` (staff enrollment always targets a real Core id, never a native one). If that same student instead signs up independently first (their own row: `account_origin: 'native'`, a negative `core_customer_id`) and later links to that same real Core id, two rows now both partially represent the same person — `core_customer_id` is `UNIQUE`, so the native row's `core_customer_id` can't simply be updated to the real id while the pending row still holds it.

**Decision**: `linkCoreAccount()` checks for an existing pending row (`core_customer_id = N AND supabase_user_id IS NULL`) before writing:
- **No pending row** (the common case): update the caller's own native row in place — `core_customer_id = N`, `account_origin = 'core-linked'`. The row's `id` never changes, so anything already written against it (e.g. a Coaching booking made while native) stays correctly attached.
- **Pending row exists**: in one transaction — reassign `bookings.student_id` from the caller's native row's `id` to the pending row's `id`; delete the caller's native row; set the pending row's `supabase_user_id` to the caller's auth uid (the same "adopt in place" update `upsertCustomerProfile` already performs for a real first login against a pending row, spec 012). The student ends up on the pending row's `id`, with its pre-existing Tier/Course enrollments intact (FR-011) plus any bookings made while native.

**Alternatives considered**: Blocking linking entirely when a pending row already exists — rejected; this is exactly the scenario spec 012 was built to support, so it should be the best-supported case, not a dead end.

## 4. Verification link doesn't require the clicking browser to be signed in

The token, not the session, identifies which account is being linked (`core_link_requests.customer_profile_id`) — the verify endpoint looks up the row by the hashed token, validates expiry/consumed state, and performs the link regardless of which device or browser the link is opened on.

**Decision**: `/account/link/verify/route.ts` is an unauthenticated `GET` route handler (same shape as `/auth/callback/route.ts`). After a successful link, if the *clicking* browser happens to already hold a session for the now-linked account, redirect straight to `/customer/{id}`; otherwise redirect to `/login` with a "linked — sign in to continue" message.

**Alternatives considered**: Requiring the click to happen in the same, already-authenticated browser that requested the link — rejected as a worse experience for no real security gain, since the token itself is what's being verified.

## 5. Rate limiting without a new external dependency

No rate-limiting utility or external store exists anywhere in this codebase; every existing "prevent abuse" mechanism here is a plain Postgres check.

**Decision**: Reuse `core_link_requests`' own rows as the attempt log — no separate counter table. Before creating a new row, `requestCoreLink()` counts rows for the same `customer_profile_id` created in the last hour (cap: 5) and, separately, rows for the same `requested_ip` created in the last hour (cap: 20); either cap being hit returns `rate_limited` without querying Core or sending an email.

**Alternatives considered**: An in-memory counter — rejected; doesn't survive a server restart or work correctly across multiple instances.
