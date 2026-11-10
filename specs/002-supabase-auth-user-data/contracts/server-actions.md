# Contract: Server Functions and Component Interfaces

**Branch**: `002-supabase-auth-user-data` | **Date**: 2026-06-10

---

## Server-Only Functions (`src/lib/auth/customer-profile.ts`)

### `upsertCustomerProfile`

Called in `layout.tsx` after every successful `fetchSnapshot`. Creates or updates the customer's platform profile.

```typescript
import 'server-only';

interface UpsertInput {
  supabaseUserId: string;
  coreCustomerId: number;
  email: string;
  firstName: string;
}

interface UpsertResult {
  profileId: string;       // uuid of the customer_profiles row
  coreCustomerId: number;
}

async function upsertCustomerProfile(input: UpsertInput): Promise<UpsertResult>
// Throws: CustomerProfileMismatchError if input.email !== auth.users.email
// Uses: SUPABASE_SERVICE_ROLE_KEY (bypasses RLS for insert; customer cannot self-insert)
```

**Error cases**:
- Email mismatch → log error, throw `CustomerProfileMismatchError` (HTTP 403 equivalent)
- Supabase unavailable → let error propagate; layout's existing `try/catch` handles it

---

### `getCustomerProfile`

Used in `layout.tsx` to fetch the profile for ownership validation.

```typescript
import 'server-only';

async function getCustomerProfile(supabaseUserId: string): Promise<{
  id: string;
  coreCustomerId: number;
} | null>
// Returns null if no profile exists yet (first visit before upsert completes)
// Uses: SUPABASE_SERVICE_ROLE_KEY
```

---

## Supabase Client Factory (`src/lib/supabase/`)

### `server.ts` — Server Component / Route Handler client

```typescript
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() // → SupabaseClient
// Used in: server components, route handlers, server actions
// Reads and writes cookies from Next.js cookie store
```

### `client.ts` — Browser Component client

```typescript
'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() // → SupabaseClient
// Used in: 'use client' components (recording progress sync)
// Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### `middleware-client.ts` — Middleware client

```typescript
import { createServerClient } from '@supabase/ssr';

export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
) // → SupabaseClient
// Used in: middleware.ts only
// Reads cookies from request, writes to response
```

---

## Updated Hook Interface (`src/lib/library/use-library-storage.ts`)

The external API of `useLibraryStorage` does not change. Internal implementation adds Supabase sync.

```typescript
// Unchanged public interface — RecordingPlayer and RecordingCard need no updates
export function useLibraryStorage(customerId: string): {
  getPosition: (sessionId: number) => number;
  setPosition: (sessionId: number, positionSeconds: number) => void;
  isReviewed: (sessionId: number) => boolean;
  setReviewed: (sessionId: number, reviewed: boolean) => void;
}
```

**New internal behavior**:
- On first call, fetches all progress rows for `customerId` from Supabase and hydrates a local in-memory cache
- `setPosition` / `setReviewed`: writes to localStorage immediately + fires async Supabase upsert
- If Supabase is unreachable, the localStorage write still succeeds (no error surfaced to UI)
- Supabase RLS enforces ownership — the anon key with the customer's session only returns their own rows

---

## PayloadCMS Collection Interfaces (`collections/`)

### `Courses.ts`

```typescript
import type { CollectionConfig } from 'payload';

export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: { useAsTitle: 'title' },
  access: {
    read: () => true,        // readable by anyone (for future public pages)
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'richText' },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
    { name: 'status', type: 'select', options: ['draft', 'published'], defaultValue: 'draft', required: true },
    { name: 'publishedAt', type: 'date' },
  ],
};
```

### `CommunityPosts.ts`

```typescript
import type { CollectionConfig } from 'payload';

export const CommunityPosts: CollectionConfig = {
  slug: 'community-posts',
  admin: { useAsTitle: 'title' },
  access: { /* same pattern as Courses */ },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'content', type: 'richText' },
    { name: 'author', type: 'text' },
    { name: 'status', type: 'select', options: ['draft', 'published'], defaultValue: 'draft', required: true },
    { name: 'publishedAt', type: 'date' },
  ],
};
```

---

## Middleware Signature (`middleware.ts`)

```typescript
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest): Promise<NextResponse>

export const config = {
  matcher: [
    '/customer/:path*',
    // Exclude Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Behavior**:
1. Create middleware Supabase client
2. Call `supabase.auth.getUser()` — refreshes token if needed, writes updated cookie to response
3. If `user` is null → redirect to `/login?next={encodedPath}`
4. Pass through with updated response headers (session cookie refresh)
