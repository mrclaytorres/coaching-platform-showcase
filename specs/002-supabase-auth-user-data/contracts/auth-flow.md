# Contract: Authentication Flow

**Branch**: `002-supabase-auth-user-data` | **Date**: 2026-06-10

---

## Magic Link Login Flow

```
Browser                    Next.js                     Supabase Auth
  │                           │                              │
  │  GET /customer/[id]       │                              │
  │──────────────────────────►│                              │
  │                           │  middleware: no session      │
  │                           │  → redirect /login?next=...  │
  │◄──────────────────────────│                              │
  │                           │                              │
  │  GET /login               │                              │
  │──────────────────────────►│                              │
  │◄── login page rendered ───│                              │
  │                           │                              │
  │  POST email → Server Action│                             │
  │──────────────────────────►│  signInWithOtp(email)       │
  │                           │────────────────────────────►│
  │                           │◄── { error: null } ─────────│
  │◄── "Check your email" ────│                              │
  │                                                          │
  │     [customer clicks magic link in email]                │
  │                                                          │
  │  GET /auth/callback?code=...                             │
  │──────────────────────────►│                              │
  │                           │  exchangeCodeForSession(code)│
  │                           │────────────────────────────►│
  │                           │◄── session + user ──────────│
  │                           │  set-cookie: sb-*-auth-token │
  │◄── redirect /customer/[id]│                              │
  │                           │                              │
  │  GET /customer/[id]       │                              │
  │──────────────────────────►│                              │
  │                           │  middleware: session valid   │
  │                           │  layout: fetchSnapshot +     │
  │                           │    upsertCustomerProfile()   │
  │                           │    ownership check           │
  │◄── dashboard rendered ────│                              │
```

---

## Route Protection Rules

| Route Pattern | Auth Required | Ownership Check |
|---|---|---|
| `/login` | No | No |
| `/auth/callback` | No (handles auth) | No |
| `/customer/[id]/*` | Yes | Yes — `profile.core_customer_id === params.id` |
| `/admin/*` | PayloadCMS auth | Separate (Payload users only) |
| `/` (home) | No | No |

---

## Middleware Behavior (`middleware.ts`)

**Matcher**: `['/customer/:path*']`

1. Create Supabase server client from request cookies
2. Call `supabase.auth.getUser()` — refreshes session if expired
3. If no user → `NextResponse.redirect('/login?next={encoded current url}')`
4. If user exists → pass request through with updated session cookie

**Important**: Middleware calls `getUser()` (not `getSession()`) — `getUser()` validates the JWT with the Supabase server, making it unforgeable.

---

## Auth Callback Route (`/auth/callback/route.ts`)

**Method**: GET

**Query params**:
- `code`: One-time code from Supabase (present when coming from magic link)
- `next`: Optional redirect target (defaults to `/`)

**Flow**:
1. Extract `code` from URL
2. Call `supabase.auth.exchangeCodeForSession(code)`
3. On success → redirect to `next` (or `/`)
4. On error → redirect to `/login?error=auth_failed`

---

## Login Page (`/login/page.tsx`)

**Inputs**:
- Email address (text input)

**Server Action behavior**:
1. Validate email format (basic)
2. Call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/auth/callback' } })`
3. Return "Check your email" confirmation (do not reveal whether the email exists)

**Query param**:
- `?next=`: If present, passed through to the auth callback as the post-login redirect

---

## Session Duration

- Magic link OTP: expires in **1 hour** (Supabase default)
- Session (after magic link used): **7 days** with refresh token rotation (Supabase default)
- Session is stored in an HTTP-only cookie managed by `@supabase/ssr`
