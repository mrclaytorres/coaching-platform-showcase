# Implementation Plan: Role-Based Access Control — Super Admin, Coach, and Staff

**Branch**: `003-roles-admin-staff` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-roles-admin-staff/spec.md`

---

## Summary

Add three staff roles (`super_admin`, `coach`, `staff`) to the Academy platform. A new `staff_profiles` Supabase table stores staff identity and role. The existing magic-link auth flow is extended: after session exchange, the callback checks `staff_profiles` first (before `customer_profiles`) and routes Super Admins to `/admin/*` and Coaches/Staff to `/staff/*`. The middleware matcher is extended to protect both new route prefixes. A Super Admin management UI at `/admin/staff` allows inviting new staff (via Supabase `inviteUserByEmail`), changing roles, and deactivating accounts. Coach and Staff share identical access to the `/staff/*` workspace — their role is a display label only.

---

## Technical Context

**Language/Version**: TypeScript 5.5 / Node 20

**Primary Dependencies**: Next.js 14.2 App Router, `@supabase/supabase-js` v2.108.1, `@supabase/ssr` v0.12.0 (all already installed — no new npm packages required)

**Storage**: Supabase Postgres — new `staff_profiles` table + `staff_role` enum type alongside existing `customer_profiles`

**Testing**: Manual validation across 13 quickstart scenarios (`quickstart.md`). No automated tests per project norms for V1.

**Target Platform**: Web — same as existing platform

**Project Type**: Next.js web application (App Router, server + client components)

**Performance Goals**: Role check in layout < 50ms (single indexed DB lookup); invite flow < 2 seconds end-to-end

**Constraints**:
- `import 'server-only'` required in `src/lib/auth/staff-profile.ts`
- `SUPABASE_SERVICE_ROLE_KEY` used for all `staff_profiles` writes — never exposed to client
- Middleware extends matcher but body logic unchanged — role check stays in layouts
- Must preserve existing `/customer/*` auth behavior exactly
- At least one `super_admin` with `is_active = true` must always exist — enforced at application layer
- `INITIAL_SUPER_ADMIN_EMAIL` env var is server-only — never `NEXT_PUBLIC_`

**Scale/Scope**: Small number of staff (< 50). Supabase free tier sufficient.

---

## Constitution Check

*No project constitution is in effect. No gates to evaluate.*

---

## Project Structure

### Documentation (this feature)

```text
specs/003-roles-admin-staff/
├── plan.md              # This file
├── research.md          # Phase 0 — 9 resolved decisions
├── data-model.md        # Phase 1 — staff_profiles table + role enum
├── contracts/
│   ├── supabase-schema.md   # SQL DDL, indexes, RLS, trigger
│   ├── auth-flow.md         # Route protection table + callback resolution order
│   └── server-actions.md    # TypeScript function signatures + component interfaces
├── quickstart.md            # 13 validation scenarios
└── tasks.md                 # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# New files
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx                  # Super Admin guard — role check + AdminSidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Admin overview (V1 placeholder)
│   │   └── staff/
│   │       ├── page.tsx                # Staff list — name, email, role, status, actions
│   │       └── invite/
│   │           └── page.tsx            # Invite form (name, last name, email, role)
│   └── staff/
│       ├── layout.tsx                  # Coach/Staff guard — role check + StaffSidebar
│       └── dashboard/
│           └── page.tsx                # Staff workspace (V1 placeholder)
├── lib/
│   └── auth/
│       └── staff-profile.ts            # getStaffProfile(), bootstrapSuperAdmin(),
│                                       #   createStaffProfile(), updateStaffProfile(),
│                                       #   listStaffProfiles()
├── app/
│   └── actions/
│       └── staff.ts                    # inviteStaffMember(), changeStaffRole(),
│                                       #   deactivateStaffMember(), reactivateStaffMember()
└── components/
    ├── AdminSidebar.tsx                # Admin nav + logout
    └── StaffSidebar.tsx                # Staff nav + role label + logout

# Modified files
src/middleware.ts                       # Add /admin/:path* and /staff/:path* to matcher
src/app/auth/callback/route.ts          # Add staff_profiles lookup + bootstrap logic
src/app/page.tsx                        # Add staff profile check before customer check
src/app/login/page.tsx                  # Add account_inactive error message handling
.env.example                            # Add INITIAL_SUPER_ADMIN_EMAIL
```

**Structure Decision**: New staff auth utilities live in `src/lib/auth/staff-profile.ts` alongside `customer-profile.ts`. Staff server actions in `src/app/actions/staff.ts` alongside `auth.ts`. Admin and staff route groups follow the same nested layout pattern as the existing `/customer/[id]` group. No new npm packages are needed.
