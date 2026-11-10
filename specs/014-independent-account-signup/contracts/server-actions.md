# Contract: Server Actions / Library Functions

## `src/lib/auth/customer-profile.ts` (MODIFIED)

```ts
// PORTED unmodified from branch 006-course-sales-payments (research.md §0) — that branch
// built this for checkout, this feature reuses it verbatim for signup. Not written new here.
export async function getCustomerProfileByCoreId(coreCustomerId: number): Promise<{
  id: string;
  supabaseUserId: string;
  email: string;
  firstName: string;
  isSeeded: boolean;
  accountOrigin: 'core-linked' | 'native';
} | null>;

// PORTED unmodified from branch 006.
export async function getCustomerProfileByEmail(email: string): Promise<{
  id: string;
  coreCustomerId: number;
} | null>;

// PORTED unmodified from branch 006 — this is the exact primitive this feature's signup path
// needs. Calls next_native_customer_id() (already-live RPC, research.md §0), inserts with
// account_origin: 'native'.
export async function createNativeCustomerProfile(input: {
  supabaseUserId: string;
  email: string;
  firstName: string;
}): Promise<{ id: string; coreCustomerId: number }>;

// requireCustomerProfile() itself: UNCHANGED. Not modified by this feature at all — a native
// account already has a real (negative) coreCustomerId, so every existing call site keeps
// working with zero changes (research.md §0, plan.md Constraints).

// NEW (014's own addition — 006 has no equivalent; native accounts on 006 never link back to
// Core). Called only from consumeCoreLinkToken after a token has been validated. Handles both
// cases from research.md §3:
//   - no pending row for coreCustomerId: updates the caller's own native row's core_customer_id
//     and account_origin in place.
//   - a pending row exists (core_customer_id = N AND supabase_user_id IS NULL): reassigns the
//     caller's own bookings.student_id rows to the pending row's id, deletes the caller's row,
//     sets the pending row's supabase_user_id to the caller's auth uid.
// Runs as a single transaction either way.
export async function linkCoreAccount(
  callerProfileId: string,
  coreCustomerId: number,
): Promise<{ linkedProfileId: string }>;
```

## `src/lib/auth/core-link.ts` (NEW)

```ts
export type RequestLinkResult =
  | { status: 'sent' }
  | { status: 'not_found' }
  | { status: 'already_linked' }
  | { status: 'rate_limited' };

// Called from /account/link/page.tsx's form action. Order: rate-limit check (research.md §5,
// FR-009) → fetchSnapshot(coreCustomerId) (404 → not_found, FR-005) → check no OTHER
// account_origin = 'core-linked' profile already owns this core_customer_id (already_linked,
// FR-008/FR-014 — checked pre-emptively for a fast, clear message; the DB UNIQUE constraint is
// still the actual enforcement at link time) → generate token, insert core_link_requests, email
// the verification link to snapshot.customer.email via Resend (same pattern as
// src/lib/booking/notifications.ts, but NOT best-effort — a failed send must be returned as an
// error, since without it the student has no way to complete linking).
export async function requestCoreLink(
  requesterProfileId: string,
  coreCustomerId: number,
): Promise<RequestLinkResult>;

export type ConsumeTokenResult =
  | { status: 'linked'; linkedProfileId: string; coreCustomerId: number }
  | { status: 'invalid_or_expired' };

// Called from /account/link/verify/route.ts. Hashes the raw token, looks up an unconsumed,
// unexpired core_link_requests row by token_hash, calls linkCoreAccount(), marks the row
// consumed_at. No session/auth check — the token itself is the credential (research.md §4).
export async function consumeCoreLinkToken(rawToken: string): Promise<ConsumeTokenResult>;
```

## `src/app/login/page.tsx` (MODIFIED)

```ts
// NEW server action alongside the existing linkAccount() in the same file. Only reachable from
// the message === 'no_profile' state's new second form.
async function continueWithoutLinking(formData: FormData): Promise<void>;
// - Reads `first_name` from the form.
// - Requires an authenticated user (same auth.getUser() check linkAccount already does).
// - Calls createNativeCustomerProfile({ supabaseUserId: user.id, email: user.email, firstName }).
// - redirect(`/customer/${coreCustomerId}`) — straight to the dashboard, no intermediate area.

// Also renders a new message === 'linked_sign_in' state (US2): "Your account is linked — sign
// in below to continue," reusing the existing sign-in form as-is.
```

## `src/app/customer/[id]/layout.tsx`, `src/app/customer/[id]/page.tsx` (MODIFIED)

```ts
// PORTED from branch 006 (research.md §0), not written new here. Both files gain the same
// shape of change: look up account_origin via getCustomerProfileByCoreId(Number(params.id))
// before calling fetchSnapshot(); if accountOrigin === 'native', skip fetchSnapshot entirely and
// use the profile row's own first_name/email plus existing empty states for
// credits/sessions/activity, instead of a Core snapshot.
```

## `src/app/account/link/page.tsx`, `src/app/account/link/verify/route.ts` (NEW)

```ts
// page.tsx: a Core customer ID entry form → requestCoreLink(); renders the resulting state
// via searchParams (sent / not_found / already_linked / rate_limited / invalid_or_expired retry).

// verify/route.ts:
// GET /account/link/verify?token=...
// Unauthenticated route handler (research.md §4), mirrors src/app/auth/callback/route.ts's
// shape. Calls consumeCoreLinkToken(token).
//   - 'linked': if the current browser has an active session matching linkedProfileId, redirect
//     to `/customer/${coreCustomerId}`; otherwise redirect to `/login?message=linked_sign_in`.
//   - 'invalid_or_expired': redirect to `/account/link?error=invalid_or_expired`.
export async function GET(request: NextRequest): Promise<NextResponse>;
```

## Coaching booking (Story 3) — no contract changes

`src/app/booking/customer/[id]/*`, `src/lib/booking/*` — completely unmodified. `requireCustomerProfile()` resolves the acting student by session regardless of whether `coreCustomerId` is positive or negative; `params.id` in the booking URL tree is only ever used to construct further links within that tree, never re-derived. A native account reaches `/booking/customer/{negative id}/...` the same way a Core-linked account reaches `/booking/customer/{positive id}/...`.
