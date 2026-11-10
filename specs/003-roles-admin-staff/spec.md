# Feature Specification: Role-Based Access Control — Super Admin, Coach, and Staff

**Feature Branch**: `003-roles-admin-staff`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Now we need to implement a Super Admin account. As a matter of fact, we need to implement roles like Super Admin, Coach and Staff. The Coach and Staff will have the same functions. Although they have the same functions, there are people who are coaches and there are people who are staff supports. Please create a plan and implement this."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Super Admin Can Log In and Access the Admin Dashboard (Priority: P1)

A Super Admin is the highest-authority account on the platform. After logging in with their email, they are recognized as a Super Admin and land on a dedicated admin dashboard — completely separate from the customer-facing portal. From there they can see a management overview of the platform.

**Why this priority**: Nothing else in this feature works without a functioning Super Admin who can access their workspace. This is the entry point for all role management.

**Independent Test**: A pre-seeded Super Admin email logs in via magic link, lands on `/admin/dashboard`, and can see the admin overview page. A regular customer logging in with a different email does NOT land on `/admin/dashboard`.

**Acceptance Scenarios**:

1. **Given** a user whose email is designated as Super Admin, **When** they log in via magic link, **Then** they are redirected to the admin dashboard, not the customer portal.
2. **Given** a logged-in Super Admin, **When** they visit any `/admin/` route, **Then** they are granted access.
3. **Given** a logged-in customer (non-admin), **When** they attempt to visit any `/admin/` route, **Then** they are denied access and redirected to their customer dashboard.
4. **Given** an unauthenticated visitor, **When** they attempt to visit any `/admin/` route, **Then** they are redirected to the login page.

---

### User Story 2 — Super Admin Can Create and Manage Staff Accounts (Priority: P1)

A Super Admin can invite new staff members — either as a **Coach** or as **Staff Support** — by entering their name and email. The system creates their account and sends them a login link. The Super Admin can also view all staff accounts, change their role, or deactivate them.

**Why this priority**: Without the ability to create staff accounts, the whole role system is empty. This is the core management capability.

**Independent Test**: Super Admin creates a new Coach account with name and email. The invited user receives a magic link, logs in, and lands on the staff dashboard (not the customer portal). Super Admin sees them listed in the staff management table.

**Acceptance Scenarios**:

1. **Given** a logged-in Super Admin, **When** they submit a new staff invite form with name, email, and role (Coach or Staff), **Then** the account is created and the invited person receives a login email.
2. **Given** a logged-in Super Admin, **When** they view the staff list, **Then** they see all staff accounts with their name, email, role, and status (active/inactive).
3. **Given** a logged-in Super Admin, **When** they change a Coach's role to Staff Support (or vice versa), **Then** the role is updated immediately.
4. **Given** a logged-in Super Admin, **When** they deactivate a staff account, **Then** that user can no longer log in.
5. **Given** a Super Admin attempting to invite an email that already has a customer account, **When** they submit the form, **Then** the system warns them that the email is already registered as a customer.

---

### User Story 3 — Coach and Staff Can Log In and Access the Staff Workspace (Priority: P2)

Coaches and Staff Support members use the same login page as customers. After clicking their magic link, they are recognized as staff and redirected to a staff workspace — separate from the customer-facing portal. Their role label ("Coach" or "Staff Support") is visible in their interface but does not restrict what they can do.

**Why this priority**: Once staff accounts exist, they need to be able to log in and reach their workspace. The functional parity between Coach and Staff roles is the key characteristic of this story.

**Independent Test**: A Coach account logs in and lands on `/staff/dashboard`. A Staff Support account logs in and also lands on `/staff/dashboard`. Both see the same navigation and features. The displayed label reflects their specific role type.

**Acceptance Scenarios**:

1. **Given** a user with a Coach role, **When** they log in via magic link, **Then** they land on the staff dashboard with "Coach" shown as their role label.
2. **Given** a user with a Staff Support role, **When** they log in via magic link, **Then** they land on the staff dashboard with "Staff Support" shown as their role label.
3. **Given** a logged-in Coach or Staff member, **When** they view their workspace, **Then** they have access to the same set of features regardless of whether they are a Coach or Staff Support.
4. **Given** a logged-in Coach or Staff member, **When** they attempt to visit any `/admin/` route, **Then** they are denied access and redirected to their staff dashboard.
5. **Given** a logged-in Coach or Staff member, **When** they attempt to visit a customer's private portal (`/customer/[id]`), **Then** they are denied access.

---

### User Story 4 — Super Admin Can Promote a Staff Member to Super Admin (Priority: P3)

A Super Admin can elevate a Coach or Staff account to Super Admin level. This is a deliberate, high-stakes action. The promoted person immediately gains full admin access on their next login.

**Why this priority**: Needed for platform continuity (e.g., original Super Admin leaves), but lower priority than the core management workflows.

**Independent Test**: Super Admin promotes a Coach to Super Admin. The promoted user logs out and back in. They now land on the admin dashboard with full management access.

**Acceptance Scenarios**:

1. **Given** a logged-in Super Admin, **When** they promote a staff member to Super Admin, **Then** that user gains admin-level access on their next authenticated page load.
2. **Given** there is only one Super Admin account, **When** they attempt to demote or deactivate themselves, **Then** the system prevents it with a clear message ("At least one Super Admin must remain active").

---

### Edge Cases

- What happens if a Super Admin's own email is deactivated? The system must prevent a Super Admin from locking themselves out.
- What if an invited staff email never clicks their magic link? The account exists but is considered "pending" until first login.
- What if the same person is a customer AND a staff member (same email)? This is treated as a conflict — the staff role takes precedence and they access the staff workspace, not the customer portal.
- What if a deactivated staff member tries to use an old magic link? They must be denied and shown a message that their account is inactive.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define three distinct role types: `super_admin`, `coach`, and `staff`.
- **FR-002**: The system MUST maintain a staff account registry separate from the customer account registry.
- **FR-003**: A Super Admin MUST be able to create staff accounts by providing name, email, and role (Coach or Staff).
- **FR-004**: The system MUST send a login invitation to the newly created staff account's email.
- **FR-005**: A Super Admin MUST be able to view a list of all staff accounts, including name, email, role, and active/inactive status.
- **FR-006**: A Super Admin MUST be able to change a staff member's role between `coach` and `staff`.
- **FR-007**: A Super Admin MUST be able to promote a staff member to `super_admin`.
- **FR-008**: A Super Admin MUST be able to deactivate a staff account, immediately preventing that user from accessing the platform.
- **FR-009**: The system MUST prevent deactivation of the last remaining Super Admin account.
- **FR-010**: Coaches and Staff MUST have identical access to features within the staff workspace.
- **FR-011**: Each user type MUST be routed to their appropriate workspace upon login: Super Admin → admin dashboard, Coach/Staff → staff dashboard, Customer → customer portal.
- **FR-012**: The `/admin/` route prefix MUST be accessible only to Super Admins.
- **FR-013**: The `/staff/` route prefix MUST be accessible only to Coach and Staff accounts.
- **FR-014**: Customer portal routes (`/customer/[id]`) MUST remain inaccessible to staff and admin accounts.
- **FR-015**: The first Super Admin account MUST be bootstrappable via a secure, out-of-band process (not the public UI).
- **FR-016**: A staff member's role label ("Coach" or "Staff Support") MUST be visible in their staff workspace UI.

### Key Entities

- **StaffProfile**: Represents a staff member on the platform. Has a name, email, role (`super_admin | coach | staff`), and active/inactive status. Linked to their login identity.
- **Role**: An enumerated type (`super_admin`, `coach`, `staff`) that determines which workspace a user is routed to and what routes they may access. Coach and Staff share identical functional permissions.
- **StaffInvite**: A pending account created by a Super Admin before the invited person has logged in for the first time.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Super Admin can invite a new staff member and have them fully onboarded (account created, login email received, first login completed) in under 2 minutes.
- **SC-002**: A logged-in staff member is routed to their correct workspace within 1 second of clicking their magic link.
- **SC-003**: A non-admin user attempting to access an admin route is blocked 100% of the time with no edge-case bypass.
- **SC-004**: Role changes made by a Super Admin take effect on the affected user's next authenticated page load, with no manual cache-clearing required.
- **SC-005**: The platform always has at least one active Super Admin account — the system enforces this with zero manual intervention.

---

## Assumptions

- Staff accounts are created and managed entirely within the Academy platform by a Super Admin — there is no external HR or identity system to sync with.
- The first Super Admin is bootstrapped via a secure server-side seed (e.g., an environment variable listing the initial Super Admin email), not through the public UI.
- Customers and staff are considered distinct account types; the same email cannot serve dual roles. If a conflict exists, staff access takes precedence.
- The staff workspace (what Coaches and Staff actually do day-to-day — e.g., viewing customer records, managing sessions) will be defined in a future spec. This spec covers account creation, role assignment, and access control only.
- "Deactivation" means the user cannot log in; their historical data is retained and the account can be reactivated by a Super Admin.
- Magic link authentication (already implemented for customers) is reused for staff logins — no separate authentication mechanism is needed.
