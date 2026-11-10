# Research: Role-Based Access Control — Super Admin, Coach, and Staff

**Branch**: `003-roles-admin-staff` | **Date**: 2026-06-16

---

## Decision 1: Where to store the staff role

**Decision**: A dedicated `staff_profiles` table in Supabase Postgres.

**Rationale**: Mirrors the existing `customer_profiles` pattern exactly. Gives a clear, single source of truth for name, email, role enum, active status, and invite state. Avoids coupling role data to Supabase's `auth.users.user_metadata` (which is user-editable) or `app_metadata` (which requires service role to write and has no type safety).

**Alternatives considered**:
- `auth.users.app_metadata.role` — not user-editable, but lives inside the JWT blob. Harder to query with SQL, no foreign-key guarantees, harder to join for admin list views.
- Supabase custom claims — require a Postgres function hook (`custom_access_token_hook`), add setup complexity, and the claims only refresh on token rotation.

---

## Decision 2: Role enum values

**Decision**: Postgres `ENUM` type with three values: `super_admin`, `coach`, `staff`.

**Rationale**: Enforced at the DB level — no invalid role strings can enter the table. Coach and Staff share identical permissions in code; the distinction is display-only and purely for identity (who is a coaching professional vs. a support member). A single permissions check `role IN ('coach', 'staff')` is sufficient for all staff workspace access.

**Alternatives considered**:
- Separate `permissions` table — over-engineered for three fixed roles with no dynamic permission grid.
- Boolean columns (`is_admin`, `is_coach`) — harder to extend, allows impossible states.

---

## Decision 3: Authorization boundary — middleware vs. layout

**Decision**: Middleware handles authentication (is there a session at all?). Role authorization is enforced in the **route group layouts** (`/admin/layout.tsx`, `/staff/layout.tsx`), which call `getStaffProfile()` and redirect if the role does not match.

**Rationale**: Exactly the same pattern used for the customer portal — middleware redirects unauthenticated users, the layout checks ownership/role and redirects on mismatch. Avoids a DB call on every edge request in middleware (which has no stable DB connection). At Academy's scale (hundreds of users), the layout-level check has negligible performance impact.

**Alternatives considered**:
- Role in middleware via a DB call — adds latency to every request; edge runtime has no Postgres driver.
- Role stored in an httpOnly cookie set at login — faster reads but cookie tamper risk; requires invalidation on role change.
- Supabase JWT custom claims — possible but requires a `custom_access_token_hook` Postgres function; more moving parts than needed.

---

## Decision 4: Staff account invite flow

**Decision**: Super Admin fills an invite form (name, email, role). A server action calls Supabase Admin API `inviteUserByEmail({ email, options: { redirectTo } })` via the service role key. This creates the Supabase auth user and sends the invite email in one step. The `staff_profiles` row is created immediately using the user ID returned by the invite call.

**Rationale**: `inviteUserByEmail` is the purpose-built Supabase mechanism for admin-initiated user creation. It sends a one-time invite link, creates `auth.users` atomically, and returns the new user ID — so `staff_profiles.supabase_user_id` is populated at invite time, not on first login. No two-step lookup needed.

**Alternatives considered**:
- Super Admin triggers `signInWithOtp` for the invitee — sends a magic link but the Super Admin's own session would be at risk; not a correct use of the OTP API.
- Manual "create account" form (no email sent) — violates FR-004.
- Send a plain notification email outside Supabase — no auth link, requires a separate email service.

---

## Decision 5: Super Admin bootstrapping (first account)

**Decision**: `INITIAL_SUPER_ADMIN_EMAIL` environment variable. On the first login of that email address, if no `staff_profiles` row exists, the auth callback auto-creates a `super_admin` staff profile. No seed script, no SQL run by hand.

**Rationale**: Minimal operational friction. The env var is set once in `.env` before first boot. The auto-create logic is a single `if` block in the callback route. After the first login the profile exists and the env var is no longer consulted.

**Alternatives considered**:
- Seed SQL run manually in Supabase SQL editor — requires coordination and is error-prone without a Supabase user ID to put in the row.
- A one-time admin CLI command — adds tooling for a one-off task.
- First staff created through the public UI — chicken-and-egg; no admin UI without a Super Admin.

---

## Decision 6: Callback routing (staff vs. customer resolution order)

**Decision**: After `exchangeCodeForSession`, the callback checks in this order:
1. Redirect cookie (`brand-login-redirect`) — used by the existing customer new-user flow
2. `staff_profiles` lookup by `supabase_user_id` (and INITIAL_SUPER_ADMIN_EMAIL bootstrap)
3. `customer_profiles` lookup by `supabase_user_id`
4. `no_profile` fallback

Staff takes precedence over customers in the lookup because an email in `staff_profiles` indicates the account was explicitly provisioned by an admin. An email in `customer_profiles` only means the customer visited their portal URL once.

**Rationale**: Clean separation of concerns. Staff accounts are provisioned top-down (admin creates them); customer accounts are provisioned bottom-up (customer visits their URL). The redirect cookie case is preserved for the existing first-time customer flow.

---

## Decision 7: `no_profile` state for staff

**Decision**: Staff accounts are always pre-created by a Super Admin before first login, so the `no_profile` state is not expected for staff. If a staff invite email logs in but no `staff_profiles` row is found (e.g., invite was created but DB write failed), the callback falls through to the existing customer `no_profile` page. A separate "staff not found" error message is shown (`error=staff_not_found`).

---

## Decision 8: Deactivation enforcement

**Decision**: `is_active = false` prevents access via the layout: `getStaffProfile()` returns null if `is_active = false`, causing the layout to redirect to `/login?error=account_inactive`. Session cookies already in the browser become ineffective on the next page load.

**Rationale**: Supabase `auth.users` can be disabled via `admin.updateUserById` but that requires the service role and is an extra call. Layout-level deactivation check is instant and consistent with the existing ownership pattern. Real-time deactivation (kicks active session immediately) is a future enhancement.

---

## Decision 9: Same email conflict (customer + staff)

**Decision**: Staff lookup is checked before customer lookup in the callback. If the same email exists in both tables, the user is treated as staff and routed to the staff workspace. The `customer_profiles` row is not deleted. This is documented in the spec as a known edge case.

---

## New Environment Variables Required

```env
INITIAL_SUPER_ADMIN_EMAIL=you@example.com
```

No new public-facing env vars. The service role key (`SUPABASE_SERVICE_ROLE_KEY`) already exists and is reused for the admin invite API call.
