# Contract: Auth Flow and Route Protection — Roles

**Branch**: `003-roles-admin-staff` | **Date**: 2026-06-16

---

## Route Protection Table

| Route prefix | Who can access | Enforced by |
|---|---|---|
| `/customer/:path*` | Authenticated customers with a `customer_profiles` row | Middleware (auth) + customer layout (ownership) |
| `/admin/:path*` | Authenticated staff with `role = super_admin` AND `is_active = true` | Middleware (auth) + admin layout (role check) |
| `/staff/:path*` | Authenticated staff with `role IN ('coach', 'staff')` AND `is_active = true` | Middleware (auth) + staff layout (role check) |
| `/login` | Public | — |
| `/auth/callback` | Public (Supabase callback) | — |

---

## Middleware Changes

`src/middleware.ts` — extend the matcher to include `/admin/*` and `/staff/*`:

```typescript
export const config = {
  matcher: ['/customer/:path*', '/admin/:path*', '/staff/:path*'],
};
```

The middleware body is **unchanged** — it only checks that a valid Supabase session exists. Role authorization happens in the route group layouts, consistent with the customer portal pattern.

---

## Callback Route Resolution Order

`src/app/auth/callback/route.ts` — after `exchangeCodeForSession` succeeds:

```
1. Check brand-login-redirect cookie (existing customer new-user flow) → redirect to cookie value
2. Get authenticated user from supabase.auth.getUser()
3. INITIAL_SUPER_ADMIN_EMAIL bootstrap:
   - If user.email === process.env.INITIAL_SUPER_ADMIN_EMAIL
   - AND no staff_profiles row exists for this user
   → auto-create super_admin staff_profile, redirect to /admin/dashboard
4. Look up staff_profiles by supabase_user_id:
   - If found and is_active = true and role = super_admin → redirect /admin/dashboard
   - If found and is_active = true and role IN (coach, staff) → redirect /staff/dashboard
   - If found and is_active = false → redirect /login?error=account_inactive
5. Look up customer_profiles by supabase_user_id (existing logic):
   - If found → redirect /customer/[core_customer_id]
6. Fallback → redirect /login?message=no_profile
```

---

## Home Page (`/`) Resolution Order

`src/app/page.tsx` — same extension:

```
1. getUser() → if no user, redirect /login
2. getStaffProfile(user.id) → if found and active:
   - super_admin → /admin/dashboard
   - coach or staff → /staff/dashboard
3. getCustomerProfile(user.id) → if found → /customer/[id]
4. → /login?message=no_profile
```

---

## Admin Layout Guard

`src/app/admin/layout.tsx`:

```
1. getUser() → if no user, redirect /login
2. getStaffProfile(user.id) → if not found or is_active = false → redirect /login?error=account_inactive
3. if profile.role !== 'super_admin' → redirect /staff/dashboard (they're staff, not admin)
4. Render admin layout with profile context
```

---

## Staff Layout Guard

`src/app/staff/layout.tsx`:

```
1. getUser() → if no user, redirect /login
2. getStaffProfile(user.id) → if not found or is_active = false → redirect /login?error=account_inactive
3. if profile.role === 'super_admin' → redirect /admin/dashboard (they should be in admin)
4. Render staff layout — role label displayed: coach → "Coach", staff → "Staff Support"
```

---

## Login Page — Additional States

`src/app/login/page.tsx` — add handling for new error codes:

| `?error=` value | Message shown |
|---|---|
| `account_inactive` | "Your account has been deactivated. Please contact Academy support." |

The existing `no_profile` message and link-account form remain unchanged for customers. Staff members are pre-provisioned by the Super Admin and should not see `no_profile` in normal operation.
