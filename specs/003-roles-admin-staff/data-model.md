# Data Model: Role-Based Access Control

**Branch**: `003-roles-admin-staff` | **Date**: 2026-06-16

---

## New Table: `staff_profiles`

Stores all staff accounts — Super Admins, Coaches, and Staff Support members. Analogous to `customer_profiles` but for internal Academy users.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` | Internal primary key |
| `supabase_user_id` | `uuid` | UNIQUE, FK → `auth.users(id)` ON DELETE CASCADE, **nullable** | Null until the invited user clicks their invite link and their auth account is created |
| `email` | `text` | NOT NULL | Must match Supabase auth email; used for invite lookup before `supabase_user_id` is set |
| `first_name` | `text` | NOT NULL | Display name |
| `last_name` | `text` | NOT NULL | Display name |
| `role` | `staff_role` | NOT NULL | Enum: `super_admin`, `coach`, `staff` |
| `is_active` | `boolean` | NOT NULL DEFAULT `true` | Deactivated accounts cannot access any staff/admin routes |
| `invited_by` | `uuid` | FK → `staff_profiles(id)`, nullable | Which Super Admin created this account. Null for the bootstrapped first Super Admin |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()` | Auto-updated via trigger |

### Key Constraints

- `UNIQUE (supabase_user_id)` — one Supabase auth user maps to at most one staff profile
- `UNIQUE (email)` — prevents duplicate invites to the same address
- `CHECK (role IN ('super_admin', 'coach', 'staff'))` — enforced at DB level via enum type
- At least one `super_admin` with `is_active = true` must always exist — enforced at the application layer (layout + server action) rather than a DB constraint (see Decision 9 in research.md)

### State Transitions

```
[Invited]                    [Active]                   [Deactivated]
supabase_user_id = NULL  →  supabase_user_id = set  →  is_active = false
(Super Admin creates)        (Invitee clicks link)       (Super Admin deactivates)
```

---

## Role Enum

```sql
CREATE TYPE staff_role AS ENUM ('super_admin', 'coach', 'staff');
```

| Role | Workspace Route | Description |
|---|---|---|
| `super_admin` | `/admin/*` | Full platform management — user management, role assignment |
| `coach` | `/staff/*` | Same functional access as `staff`; label shown as "Coach" |
| `staff` | `/staff/*` | Same functional access as `coach`; label shown as "Staff Support" |

---

## Existing Tables (unchanged)

`customer_profiles` and `recording_progress` are unchanged. The routing logic in `src/app/auth/callback/route.ts` is extended to check `staff_profiles` before `customer_profiles`.

---

## Row Level Security

`staff_profiles` uses RLS to allow staff members to read their own row. All writes go through the service role key (server-side only — same pattern as `customer_profiles`).

| Policy | Operation | Who | Predicate |
|---|---|---|---|
| `staff_select_own` | SELECT | authenticated | `supabase_user_id = auth.uid()` |
| `super_admin_select_all` | SELECT | authenticated | Role join check (requires service role for admin list view) |

All INSERT/UPDATE/DELETE operations on `staff_profiles` are performed server-side via the service role key and bypass RLS. No client-side mutations to this table.
