# Data Model: Supabase Auth, Customer Profile Sync, and Content Management Foundation

**Branch**: `002-supabase-auth-user-data` | **Date**: 2026-06-10

---

## Supabase Database (PostgreSQL — `public` schema)

### `customer_profiles`

The platform's representation of a Academy customer. Created automatically on first login; updated on every subsequent session from Academy API data.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Internal platform ID |
| `supabase_user_id` | `uuid` | NOT NULL, UNIQUE, FK → `auth.users(id)` | Links to Supabase Auth identity |
| `core_customer_id` | `integer` | NOT NULL, UNIQUE | Academy system identifier (stable, never changes) |
| `email` | `text` | NOT NULL | Customer's email address (from Academy API) |
| `first_name` | `text` | NOT NULL | Customer's first name (from Academy API) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | First login timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last sync from Academy API |

**Row Level Security**:
- `SELECT`: `supabase_user_id = auth.uid()`
- `UPDATE`: `supabase_user_id = auth.uid()`
- `INSERT`: Via service role key only (server-side upsert in layout — customers cannot create arbitrary profiles)
- `DELETE`: Disabled (accounts deactivated in Academy system, not deleted here)

**Indexes**:
- Unique index on `supabase_user_id`
- Unique index on `core_customer_id`

---

### `recording_progress`

Stores playback position and reviewed status per customer per Academy session. Server-side replacement for the `localStorage` entries from spec 001.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Internal row ID |
| `customer_profile_id` | `uuid` | NOT NULL, FK → `customer_profiles(id)` | Owning customer |
| `core_session_id` | `integer` | NOT NULL | Academy session ID (matches `SnapshotSession.id`) |
| `position_seconds` | `real` | NOT NULL, default `0`, check `>= 0` | Playback position in seconds |
| `is_reviewed` | `boolean` | NOT NULL, default `false` | Whether the customer marked this recording reviewed |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last write timestamp |

**Constraints**:
- UNIQUE (`customer_profile_id`, `core_session_id`) — one row per customer per session

**Row Level Security**:
- `SELECT`: `customer_profile_id IN (SELECT id FROM customer_profiles WHERE supabase_user_id = auth.uid())`
- `INSERT`: Same ownership check via policy
- `UPDATE`: Same ownership check via policy
- `DELETE`: Same ownership check via policy (allow customers to clear their own progress)

**Indexes**:
- Composite index on (`customer_profile_id`, `core_session_id`) — primary lookup pattern

---

## PayloadCMS Collections (PostgreSQL — same instance, `payload_` table prefix)

### `Course`

Managed by Academy staff via the admin panel. Customer-facing rendering is out of scope for this feature.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | auto | — | PayloadCMS internal ID |
| `title` | `text` | Yes | Course display name |
| `slug` | `text` | Yes, unique | URL-friendly identifier |
| `description` | `richtext` | No | Course description (Lexical editor) |
| `thumbnail` | `upload` | No | Course thumbnail image |
| `status` | `select` | Yes | `draft` \| `published` |
| `publishedAt` | `date` | No | Publication date (set when status → published) |
| `createdAt` | auto | — | PayloadCMS managed |
| `updatedAt` | auto | — | PayloadCMS managed |

---

### `CommunityPost`

Managed by Academy staff via the admin panel. Customer-facing rendering is out of scope for this feature.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | auto | — | PayloadCMS internal ID |
| `title` | `text` | Yes | Post display name |
| `slug` | `text` | Yes, unique | URL-friendly identifier |
| `content` | `richtext` | No | Post body (Lexical editor) |
| `author` | `text` | No | Author display name |
| `status` | `select` | Yes | `draft` \| `published` |
| `publishedAt` | `date` | No | Publication date |
| `createdAt` | auto | — | PayloadCMS managed |
| `updatedAt` | auto | — | PayloadCMS managed |

---

## Validation Rules

### CustomerProfile
- `core_customer_id` must match the authenticated user's email: `snapshot.customer.email === supabaseUser.email` — if they diverge, the upsert is rejected with an error log (not a crash)
- `email` is taken from the Academy snapshot, not from `auth.users` — the snapshot is the source of truth
- Upsert uses `ON CONFLICT (supabase_user_id) DO UPDATE SET email=..., first_name=..., core_customer_id=..., updated_at=now()`

### RecordingProgress
- `position_seconds >= 0` enforced by check constraint
- `position_seconds` values > `video.duration` are clamped on write to `video.duration`
- If `position_seconds >= duration - 10`, the recording is treated as completed: position is reset to `0` on next open
- Only the owning customer can read or write their progress rows (RLS enforced)

### Course / CommunityPost
- `slug` must be lowercase, hyphen-separated, unique within the collection
- Status transitions: `draft → published` requires `title` to be non-empty
- PayloadCMS admin accounts are separate from Supabase Auth — no customer Supabase account can authenticate with PayloadCMS

---

## State Transitions

### Authentication Session

```
Unauthenticated → [Submit email on /login] → MagicLinkSent
MagicLinkSent   → [Click valid link]        → Authenticated
MagicLinkSent   → [Link expires (1 hour)]   → Expired → back to Unauthenticated
Authenticated   → [Click logout]            → Unauthenticated
Authenticated   → [Session expires (7 days)] → Unauthenticated
```

### CustomerProfile Sync

```
No Profile  → [First authenticated layout render] → ProfileCreated
ProfileCreated → [Any subsequent authenticated layout render] → ProfileUpdated
ProfileUpdated → [Any subsequent authenticated layout render] → ProfileUpdated (idempotent)
```

### RecordingProgress

```
No row     → [Customer opens recording for first time]     → row created (position=0, reviewed=false)
Watching   → [timeupdate fires, throttled 5s]              → position updated
Watching   → [beforeunload / component unmount]            → position updated
Completed  → [position >= duration - 10]                   → position reset to 0 on next open
Reviewed   → [Customer clicks reviewed toggle]             → is_reviewed toggled
```
