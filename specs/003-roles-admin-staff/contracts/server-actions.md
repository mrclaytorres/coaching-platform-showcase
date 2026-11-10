# Contract: Server Functions and Component Interfaces

**Branch**: `003-roles-admin-staff` | **Date**: 2026-06-16

---

## `src/lib/auth/staff-profile.ts`

Server-only module (add `import 'server-only'`). Uses the service role client — same pattern as `customer-profile.ts`.

```typescript
import 'server-only';

export type StaffRole = 'super_admin' | 'coach' | 'staff';

export interface StaffProfile {
  id: string;
  supabaseUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  isActive: boolean;
}

// Returns null if not found OR if is_active = false
export async function getStaffProfile(
  supabaseUserId: string,
): Promise<StaffProfile | null>

// Creates the bootstrapped Super Admin profile (called only once, on first login)
export async function bootstrapSuperAdmin(input: {
  supabaseUserId: string;
  email: string;
}): Promise<StaffProfile>

// Creates a new staff profile (called after inviteUserByEmail returns the new user ID)
export async function createStaffProfile(input: {
  supabaseUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  invitedBy: string; // Super Admin's staff_profiles.id
}): Promise<StaffProfile>

// Updates role or active status — used by Super Admin management actions
export async function updateStaffProfile(
  staffProfileId: string,
  updates: { role?: StaffRole; isActive?: boolean },
): Promise<StaffProfile>

// Returns all staff profiles — used for the admin staff list page
// Service role bypasses RLS to fetch all rows
export async function listStaffProfiles(): Promise<StaffProfile[]>
```

---

## `src/app/actions/staff.ts`

Server Actions called from admin UI forms. All require the caller to be an authenticated Super Admin (checked inside the action).

```typescript
'use server';

// Invite a new staff member: calls inviteUserByEmail, then createStaffProfile
// Throws if caller is not super_admin, or if email already exists in staff_profiles
export async function inviteStaffMember(formData: FormData): Promise<void>
// FormData fields: first_name, last_name, email, role ('coach' | 'staff' | 'super_admin')
// On success: redirect('/admin/staff')

// Change a staff member's role
// Throws if caller is not super_admin
// Throws if changing the last active super_admin away from super_admin
export async function changeStaffRole(
  staffProfileId: string,
  newRole: StaffRole,
): Promise<void>

// Deactivate a staff member
// Throws if caller is not super_admin
// Throws if deactivating the last active super_admin
export async function deactivateStaffMember(staffProfileId: string): Promise<void>

// Reactivate a previously deactivated staff member
// Throws if caller is not super_admin
export async function reactivateStaffMember(staffProfileId: string): Promise<void>
```

---

## Component Interfaces

### `<AdminSidebar>`

```typescript
interface AdminSidebarProps {
  firstName: string;
  lastName: string;
  email: string;
}
// Renders: Academy branding, nav links (/admin/dashboard, /admin/staff), logout button
```

### `<StaffSidebar>`

```typescript
interface StaffSidebarProps {
  firstName: string;
  lastName: string;
  email: string;
  role: 'coach' | 'staff';  // determines displayed label: "Coach" | "Staff Support"
}
// Renders: Academy branding, staff nav links, role label, logout button
```

### `<StaffListTable>`

```typescript
interface StaffListTableProps {
  profiles: StaffProfile[];
}
// Server component — renders name, email, role badge, status badge, action buttons
// Action buttons trigger changeStaffRole / deactivateStaffMember server actions
```

---

## New Routes

| Route | File | Purpose |
|---|---|---|
| `GET /admin/dashboard` | `src/app/admin/dashboard/page.tsx` | Admin overview (placeholder for V1) |
| `GET /admin/staff` | `src/app/admin/staff/page.tsx` | Staff list with role/status management |
| `GET /admin/staff/invite` | `src/app/admin/staff/invite/page.tsx` | Invite form |
| `POST /admin/staff/invite` | server action in invite page | Triggers `inviteStaffMember` |
| `GET /staff/dashboard` | `src/app/staff/dashboard/page.tsx` | Staff workspace (placeholder for V1) |
