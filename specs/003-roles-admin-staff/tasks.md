# Tasks: Role-Based Access Control — Super Admin, Coach, and Staff

**Input**: Design documents from `specs/003-roles-admin-staff/`

**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/ ✅, research.md ✅, quickstart.md ✅

**Tests**: Not requested — manual validation via quickstart.md (13 scenarios).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies within the phase)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are exact — adjust nothing unless the project structure changes

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment variables and database schema — must be in place before any code runs.

- [x] T001 Add `INITIAL_SUPER_ADMIN_EMAIL` to `.env.example` with the comment `# First Super Admin — auto-provisioned on first login (server-only, never NEXT_PUBLIC_)`
- [ ] T002 ⚠️ MANUAL — Apply SQL in Supabase SQL Editor in order: (1) `CREATE TYPE public.staff_role` enum, (2) `CREATE TABLE public.staff_profiles`, (3) all four indexes, (4) RLS `ALTER TABLE` + `CREATE POLICY`, (5) trigger — full DDL in `specs/003-roles-admin-staff/contracts/supabase-schema.md`

**Checkpoint**: `.env` has `INITIAL_SUPER_ADMIN_EMAIL` set and `staff_profiles` table exists in Supabase before proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core server-side library and middleware changes that every user story depends on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [x] T003 Create `src/lib/auth/staff-profile.ts` — add `import 'server-only'`, define `StaffRole = 'super_admin' | 'coach' | 'staff'`, define `StaffProfile` interface (id, supabaseUserId, email, firstName, lastName, role, isActive), add `createServiceRoleClient()` helper (mirror pattern from `src/lib/auth/customer-profile.ts`), implement `getStaffProfile(supabaseUserId: string): Promise<StaffProfile | null>` — queries `staff_profiles` by `supabase_user_id`; returns `null` if not found OR if `is_active = false`
- [x] T004 [P] Add `bootstrapSuperAdmin(input: { supabaseUserId: string; email: string }): Promise<StaffProfile>` to `src/lib/auth/staff-profile.ts` — inserts a new `staff_profiles` row with `role = 'super_admin'`, `is_active = true`, `first_name = 'Admin'`, `last_name = ''`, `invited_by = null`; uses service role client
- [x] T005 [P] Add `createStaffProfile(input: { supabaseUserId: string; email: string; firstName: string; lastName: string; role: StaffRole; invitedBy: string }): Promise<StaffProfile>` to `src/lib/auth/staff-profile.ts` — inserts new staff_profiles row using service role client
- [x] T006 [P] Add `updateStaffProfile(staffProfileId: string, updates: { role?: StaffRole; isActive?: boolean }): Promise<StaffProfile>` to `src/lib/auth/staff-profile.ts` — updates role and/or is_active by `id` using service role client
- [x] T007 [P] Add `listStaffProfiles(): Promise<StaffProfile[]>` to `src/lib/auth/staff-profile.ts` — fetches all rows from `staff_profiles` ordered by `created_at` ascending using service role client (bypasses RLS to return all rows)
- [x] T008 Extend matcher in `src/middleware.ts` — add `'/admin/:path*'` and `'/staff/:path*'` to the matcher array (body logic unchanged — middleware only validates session existence)
- [x] T009 Update `src/app/auth/callback/route.ts` — after `exchangeCodeForSession` succeeds, replace/extend the post-auth routing logic to follow the 6-step resolution order from `specs/003-roles-admin-staff/contracts/auth-flow.md`: (1) check `brand-login-redirect` cookie, (2) `getUser()`, (3) if `user.email === INITIAL_SUPER_ADMIN_EMAIL` AND no staff_profiles row for this user → call `bootstrapSuperAdmin()` → `redirect('/admin/dashboard')`, (4) look up `staff_profiles` by supabase_user_id: `super_admin + active → /admin/dashboard`, `coach/staff + active → /staff/dashboard`, `is_active=false → /login?error=account_inactive`, (5) look up `customer_profiles` → `redirect('/customer/[id]')`, (6) fallback `redirect('/login?message=no_profile')`

**Checkpoint**: `getStaffProfile` can be imported in layouts; middleware protects `/admin/*` and `/staff/*`; callback routes staff users correctly.

---

## Phase 3: User Story 1 — Super Admin Login and Admin Dashboard (Priority: P1) 🎯 MVP Start

**Goal**: A Super Admin email logs in via magic link and lands on `/admin/dashboard`. Customers and unauthenticated users are blocked from `/admin/*` routes.

**Independent Test**: Set `INITIAL_SUPER_ADMIN_EMAIL` to your email. Log in via magic link. Confirm you land on `/admin/dashboard` and see a welcome heading with your name. Open an incognito window, visit `/admin/dashboard`, confirm redirect to `/login`.

- [x] T010 [P] [US1] Create `src/components/AdminSidebar.tsx` — accepts props `{ firstName: string; lastName: string; email: string }`. Renders: Academy logo/branding (match existing `Sidebar.tsx` style), nav links to `/admin/dashboard` (label: "Dashboard") and `/admin/staff` (label: "Staff"), footer with logout button bound to `logout` server action from `src/app/actions/auth.ts`
- [x] T011 [US1] Create `src/app/admin/layout.tsx` — async Server Component: (1) `getUser()` → if no user `redirect('/login')`, (2) `getStaffProfile(user.id)` → if null `redirect('/login?error=account_inactive')`, (3) if `profile.role !== 'super_admin'` → `redirect('/staff/dashboard')`, (4) render `<AdminSidebar>` with profile data and `{children}`
- [x] T012 [P] [US1] Create `src/app/admin/dashboard/page.tsx` — placeholder admin overview page. Show heading "Admin Dashboard", a sub-line "Welcome, {firstName}", and a brief description "Manage staff accounts from the Staff menu." No data fetching required for V1.
- [x] T013 [US1] Update `src/app/page.tsx` — insert `getStaffProfile(user.id)` call between `getUser()` and `getCustomerProfile()`. Route: `super_admin` → `redirect('/admin/dashboard')`, `coach` or `staff` → `redirect('/staff/dashboard')`. Existing customer and no-profile fallback unchanged.
- [x] T014 [P] [US1] Add `account_inactive` error handling to `src/app/login/page.tsx` — when `searchParams.error === 'account_inactive'`, display the error message "Your account has been deactivated. Please contact Academy support." in the same error style as existing error messages on the login page

**Checkpoint**: Super Admin can log in and reach `/admin/dashboard`. Customers are blocked from admin routes. Unauthenticated visitors are redirected to `/login`.

---

## Phase 4: User Story 2 — Super Admin Creates and Manages Staff Accounts (Priority: P1)

**Goal**: Super Admin can invite staff members, view the staff list, change roles, and deactivate/reactivate accounts.

**Independent Test**: Log in as Super Admin → `/admin/staff/invite` → submit form with a real email and role "Coach". Check that email receives an invite. Confirm new row appears in `/admin/staff` list. Change the role and verify the badge updates.

- [x] T015 [US2] Create `src/app/actions/staff.ts` — `'use server'`; implement `inviteStaffMember(formData: FormData): Promise<void>`: (1) `getUser()` → `getStaffProfile()` → throw if not `super_admin`, (2) extract `first_name`, `last_name`, `email`, `role` from formData, (3) check `staff_profiles` for existing row with that email using service role client → if found `redirect('/admin/staff/invite?error=duplicate_email')`, (4) check `customer_profiles` for existing row with that email using service role client → if found `redirect('/admin/staff/invite?error=customer_email_conflict')`, (5) call `supabase.auth.admin.inviteUserByEmail(email)` using `createClient` with `SUPABASE_SERVICE_ROLE_KEY`, (6) call `createStaffProfile({ supabaseUserId: inviteData.user.id, email, firstName, lastName, role, invitedBy: callerProfile.id })`, (7) `redirect('/admin/staff')`
- [x] T016 [P] [US2] Add `changeStaffRole(staffProfileId: string, newRole: StaffRole): Promise<void>` to `src/app/actions/staff.ts` — `'use server'`; verify caller is `super_admin`; if current profile role is `super_admin` AND new role is not `super_admin`, count active super_admins via `listStaffProfiles()` — if count ≤ 1 throw/redirect with error `last_admin`; call `updateStaffProfile(staffProfileId, { role: newRole })`; revalidate or redirect to `/admin/staff`
- [x] T017 [P] [US2] Add `deactivateStaffMember(staffProfileId: string): Promise<void>` and `reactivateStaffMember(staffProfileId: string): Promise<void>` to `src/app/actions/staff.ts` — `'use server'`; each verifies caller is `super_admin`; `deactivateStaffMember` counts active super_admins before deactivating — if target is last active super_admin, redirect with error `last_admin`; calls `updateStaffProfile(staffProfileId, { isActive: false/true })`; revalidate or redirect to `/admin/staff`
- [x] T018 [US2] Create `src/components/StaffListTable.tsx` — Server Component accepting `{ profiles: StaffProfile[] }`. Renders a table with columns: Name (first + last), Email, Role (badge: "Super Admin" / "Coach" / "Staff Support"), Status (badge: "Active" / "Inactive"). Each active row has: a role-change `<form>` with `<select>` (options: super_admin, coach, staff) bound to `changeStaffRole` server action passing `staffProfileId`; a deactivate button bound to `deactivateStaffMember`. Each inactive row has a reactivate button bound to `reactivateStaffMember`. Show error inline if `?error=last_admin` is in the URL.
- [x] T019 [US2] Create `src/app/admin/staff/page.tsx` — calls `listStaffProfiles()`, renders page heading "Staff Accounts" with a link to `/admin/staff/invite` ("Invite Staff Member"), then renders `<StaffListTable profiles={profiles} />`
- [x] T020 [US2] Create `src/app/admin/staff/invite/page.tsx` — renders invite form with fields: First name (text), Last name (text), Email (email), Role (select: Coach / Staff Support / Super Admin mapping to `coach` / `staff` / `super_admin`). Form action is `inviteStaffMember`. Show error messages: `?error=duplicate_email` → "A staff account with this email already exists."; `?error=customer_email_conflict` → "This email is already registered as a customer account. Staff and customer accounts cannot share an email address." On success the server action redirects to `/admin/staff`.

**Checkpoint**: Super Admin can invite staff, see the full list, change roles, and deactivate/reactivate accounts. Duplicate email is rejected with an error.

---

## Phase 5: User Story 3 — Coach and Staff Login and Staff Dashboard (Priority: P2)

**Goal**: Coach and Staff Support accounts log in via magic link and land on `/staff/dashboard`. Their role label is visible. Both see identical features. Admin routes are blocked.

**Independent Test**: Use the Coach account from Phase 4. Log in → confirm redirect to `/staff/dashboard`. Confirm "Coach" label appears in the sidebar. Repeat with a Staff Support account → same dashboard, label shows "Staff Support". Visit `/admin/dashboard` → confirm redirect back to `/staff/dashboard`.

- [x] T021 [P] [US3] Create `src/components/StaffSidebar.tsx` — accepts props `{ firstName: string; lastName: string; email: string; role: 'coach' | 'staff' }`. Renders: Academy branding (match existing `Sidebar.tsx`), role label display: `coach → "Coach"`, `staff → "Staff Support"`, nav link to `/staff/dashboard` (label: "Dashboard"), footer with logout button bound to `logout` from `src/app/actions/auth.ts`
- [x] T022 [US3] Create `src/app/staff/layout.tsx` — async Server Component: (1) `getUser()` → if no user `redirect('/login')`, (2) `getStaffProfile(user.id)` → if null `redirect('/login?error=account_inactive')`, (3) if `profile.role === 'super_admin'` → `redirect('/admin/dashboard')`, (4) render `<StaffSidebar>` with profile data and `{children}`
- [x] T023 [P] [US3] Create `src/app/staff/dashboard/page.tsx` — placeholder staff workspace page. Show heading "Staff Dashboard", sub-line "Welcome, {firstName}", and role label "You are logged in as {role label}." No data fetching for V1.

**Checkpoint**: Coach and Staff Support accounts reach `/staff/dashboard` after login. Both see identical content. Admin routes redirect them back to `/staff/dashboard`.

---

## Phase 6: User Story 4 — Promote Staff Member to Super Admin (Priority: P3)

**Goal**: Super Admin can elevate any Coach or Staff account to Super Admin. Promoted user gains admin access on next login. The system prevents removing the last active Super Admin.

**Independent Test**: As Super Admin, promote a Coach via the staff list. Log out of the Coach account and log back in — confirm they land on `/admin/dashboard`. Attempt to demote or deactivate yourself (the only remaining super_admin) — confirm the system prevents it with a clear message.

- [x] T024 [P] [US4] Update `src/components/StaffListTable.tsx` — ensure the role `<select>` includes "Super Admin" (`super_admin`) as an option alongside Coach and Staff Support. Add a visual indicator (e.g., distinct color or warning text) next to the super_admin option to signal its elevated nature. Ensure the `?error=last_admin` inline error renders: "At least one Super Admin must remain active."
- [x] T025 [US4] Verify `changeStaffRole()` in `src/app/actions/staff.ts` fully covers the last-admin promotion guard: if the target staff member is themselves the last active `super_admin` AND the new role is NOT `super_admin`, the action must redirect to `/admin/staff?error=last_admin` rather than update. Add this guard if not already present from T016.

**Checkpoint**: Promote-to-Super-Admin flow works end-to-end. Last-admin demotion is blocked. Promoted user accesses `/admin/dashboard` on next login.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, explicit FR-014 enforcement, and final validation.

- [x] T026 [P] Audit `src/components/AdminSidebar.tsx` and `src/components/StaffSidebar.tsx` for visual consistency with `src/components/Sidebar.tsx` — verify font sizes, spacing, color classes (brand-muted, brand-text), and logout button style match
- [x] T027 [P] Update `src/app/customer/[id]/layout.tsx` — add a `getStaffProfile(user.id)` call after `getUser()` and before the existing ownership check; if a staff profile is found (role is coach, staff, or super_admin), `redirect('/staff/dashboard')` (super_admin → `/admin/dashboard`). This explicitly enforces FR-014 for the edge case where a staff member shares an email with a customer account and has a `customer_profiles` row.
- [ ] T028 Run all 13 quickstart validation scenarios from `specs/003-roles-admin-staff/quickstart.md` in order and verify each expected outcome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002 is manual
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **blocks all user stories**
- **User Stories (Phases 3–6)**: All depend on Phase 2 completion; US1 and US2 are both P1 and can be worked in parallel by separate developers; US3 depends on US2 (needs existing staff accounts to test); US4 depends on US2 (extends the staff list UI)
- **Polish (Phase 7)**: All user story phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on other stories
- **US2 (P1)**: Can start after Phase 2 — no dependency on other stories; can run in parallel with US1
- **US3 (P2)**: Can start after Phase 2; requires US2 complete for realistic end-to-end testing
- **US4 (P3)**: Can start after US2 complete (extends the same staff list UI)

### Within Each User Story

- Foundational library (`staff-profile.ts`) before layouts that import it
- Layouts before page files that live inside them
- Server actions before UI components that call them
- Components before page files that render them

### Parallel Opportunities

- T003–T007 within Phase 2: T003 first (creates the file + types); T004–T007 can be written in parallel by different developers (each adds one function to the same file — coordinate to avoid conflicts) or sequentially by one developer
- T010, T012, T014: all create new files with no cross-dependency — fully parallel
- T015–T017: T015 creates the file; T016 and T017 add functions to the same file — sequential or coordinated
- T021 and T023: new files, fully parallel with each other and with T022's creation
- T024 and T025: T024 is a file update; T025 is a logic check/update — can run in parallel

---

## Parallel Example: Phase 3 (US1)

```
# Once Phase 2 is complete, launch these concurrently:
T010: Create AdminSidebar.tsx                    ← new file, no deps
T012: Create admin/dashboard/page.tsx            ← new file, no deps
T014: Update login/page.tsx (error message)      ← isolated change

# Then sequentially:
T011: Create admin/layout.tsx                    ← imports AdminSidebar (needs T010)
T013: Update src/app/page.tsx                    ← imports getStaffProfile (needs Phase 2)
```

---

## Implementation Strategy

### MVP Scope (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (Super Admin login + admin dashboard)
4. **STOP and VALIDATE**: Super Admin bootstrap scenario (quickstart.md Scenario 1–3)
5. Confirm routing from `/` works for all user types (quickstart.md Scenario 12)

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Super Admin can log in ✓
3. Phase 4 → Staff can be invited and managed ✓
4. Phase 5 → Coach/Staff can log in ✓
5. Phase 6 → Promotion and last-admin guard ✓
6. Phase 7 → All 13 quickstart scenarios validated ✓

---

## Notes

- `[P]` tasks touch different files — no merge conflicts if worked in parallel
- T002 is a manual Supabase step — must complete before any server-side code can run against `staff_profiles`
- No test files — manual validation via `quickstart.md` 13 scenarios
- `INITIAL_SUPER_ADMIN_EMAIL` must be in `.env` (not `.env.example` alone) before running Scenario 1
- `supabase.auth.admin.inviteUserByEmail()` requires the service role key — use `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` directly in the server action (same pattern as `customer-profile.ts`)
- `getStaffProfile` returns `null` for inactive accounts — layouts treat null as unauthorized regardless of reason
