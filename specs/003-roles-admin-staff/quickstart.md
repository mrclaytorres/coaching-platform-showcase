# Quickstart: Roles Validation Guide

**Branch**: `003-roles-admin-staff` | **Date**: 2026-06-16

**Prerequisites**:
- Supabase schema applied (`contracts/supabase-schema.md` SQL run in Supabase SQL Editor)
- `.env` updated with `INITIAL_SUPER_ADMIN_EMAIL=<your-email>`
- `npm run dev` running on `http://localhost:3040`

---

## Scenario 1 — Super Admin Bootstrap

**Goal**: First Super Admin account is created automatically on first login.

1. Ensure `INITIAL_SUPER_ADMIN_EMAIL` is set in `.env` to an email you control
2. Navigate to `http://localhost:3040`
3. You are redirected to `/login`
4. Enter the Super Admin email → "Check your email"
5. Click the magic link
6. **Expected**: Redirected to `/admin/dashboard`
7. **Verify in Supabase**: `staff_profiles` table has one row with `role = 'super_admin'`, `is_active = true`

---

## Scenario 2 — Unauthenticated Access to Admin Routes Blocked

1. Open an incognito window
2. Navigate to `http://localhost:3040/admin/dashboard`
3. **Expected**: Redirected to `/login`

---

## Scenario 3 — Customer Cannot Access Admin Routes

1. Log in as a customer (existing customer email)
2. Navigate to `http://localhost:3040/admin/dashboard`
3. **Expected**: Redirected to the customer dashboard (not `/login`)

---

## Scenario 4 — Super Admin Invites a Coach

1. Log in as Super Admin → `/admin/dashboard`
2. Navigate to `/admin/staff/invite`
3. Fill in: First name, Last name, Email (a second email you control), Role: Coach
4. Submit the form
5. **Expected**: Redirected to `/admin/staff` — new row visible with role "Coach" and status "Active"
6. **Verify in Supabase**: `staff_profiles` has a new row with `role = 'coach'` and `is_active = true`
7. Check the invited email inbox for an invite email from Supabase

---

## Scenario 5 — Coach Logs In and Lands on Staff Dashboard

1. Open the invite email from Scenario 4 → click the invite link
2. **Expected**: Redirected to `/staff/dashboard`
3. **Verify**: Role label "Coach" is visible in the staff sidebar

---

## Scenario 6 — Staff Support Logs In and Sees Same Features as Coach

1. Super Admin invites a second person with Role: Staff Support
2. That person logs in via their invite link
3. **Expected**: Redirected to `/staff/dashboard` with label "Staff Support"
4. **Verify**: The staff dashboard shows the same navigation and content as the Coach view

---

## Scenario 7 — Staff Cannot Access Admin Routes

1. Log in as Coach or Staff Support
2. Navigate to `http://localhost:3040/admin/dashboard`
3. **Expected**: Redirected to `/staff/dashboard` (not `/login` — they are authenticated, just wrong role)

---

## Scenario 8 — Super Admin Changes a Coach's Role to Staff Support

1. Log in as Super Admin → `/admin/staff`
2. Find the Coach from Scenario 4 → change role to "Staff Support"
3. **Expected**: Role badge updates to "Staff Support" on the list page
4. Have the Coach log out and back in
5. **Expected**: They still land on `/staff/dashboard` with label now showing "Staff Support"

---

## Scenario 9 — Super Admin Promotes Staff to Super Admin

1. Log in as Super Admin → `/admin/staff`
2. Find a staff member → change role to "Super Admin"
3. Have that person log out and back in
4. **Expected**: They are redirected to `/admin/dashboard` on next login

---

## Scenario 10 — Super Admin Cannot Deactivate Themselves (Last Admin)

1. Only one active Super Admin exists in the system
2. As that Super Admin, navigate to `/admin/staff`
3. Attempt to deactivate their own account
4. **Expected**: Error message — "At least one Super Admin must remain active"

---

## Scenario 11 — Deactivated Account Cannot Log In

1. Super Admin deactivates a staff member's account
2. The deactivated user tries to log in via magic link
3. After clicking the magic link:
4. **Expected**: Redirected to `/login?error=account_inactive` with message "Your account has been deactivated"

---

## Scenario 12 — Home Page Routes Authenticated Users Correctly

| Who is logged in | Expected redirect from `/` |
|---|---|
| Not logged in | `/login` |
| Super Admin | `/admin/dashboard` |
| Coach or Staff | `/staff/dashboard` |
| Customer | `/customer/[core_id]` |
| Authenticated but no profile | `/login?message=no_profile` |

---

## Scenario 13 — Duplicate Invite Email Rejected

1. Log in as Super Admin → `/admin/staff/invite`
2. Enter the same email as an already-existing staff member
3. **Expected**: Form error — "A staff account with this email already exists"
