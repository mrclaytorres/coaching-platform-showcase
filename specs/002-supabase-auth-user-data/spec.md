# Feature Specification: Supabase Auth, Customer Profile Sync, and Content Management Foundation

**Feature Branch**: `002-supabase-auth-user-data`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "Use Supabase for Auth and cross-device user data. And then PayloadCMS for future content management like courses, community, etc. Plan the Academy API mapping into Supabase — create a Supabase entry whenever a user is determined or created and is fetched from Academy API."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Secure Customer Login (Priority: P1)

A Academy customer visits the platform and must prove their identity before seeing any of their data. They log in via a magic link sent to the email address registered with Academy. Once logged in, they are taken directly to their personal dashboard. They cannot access any other customer's data. Logging out ends the session on that device.

**Why this priority**: Without authentication the platform exposes every customer's lesson history, recordings, and wallet to anyone who guesses a customer ID. This is a security boundary that must exist before the platform is shown to real users.

**Independent Test**: Visit `/customer/[id]` while not logged in — confirm redirect to login. Send a magic link to a registered customer email — confirm successful login and redirect to the correct customer dashboard. Attempt to access `/customer/[other-id]` while logged in as a different customer — confirm access is denied.

**Acceptance Scenarios**:

1. **Given** a visitor is not authenticated, **When** they navigate to any `/customer/[id]` route, **Then** they are redirected to the login page without seeing any customer data.
2. **Given** a customer submits their Academy-registered email on the login page, **When** the system processes the request, **Then** they receive a magic link email within 60 seconds.
3. **Given** a customer clicks their magic link, **When** the link is valid and unexpired, **Then** they are authenticated and redirected to their own dashboard.
4. **Given** a logged-in customer, **When** they attempt to access another customer's `/customer/[id]` URL, **Then** they see an "access denied" screen and their own data is never shown.
5. **Given** a logged-in customer, **When** they click "Log out", **Then** their session ends and they are redirected to the login page.

---

### User Story 2 — Automatic Customer Profile Sync from Academy API (Priority: P1)

The first time a verified customer accesses the platform after logging in, the system automatically creates their platform profile using the data returned by the Academy API (name, email, customer ID). On every subsequent login, the profile is refreshed with the latest Academy data. The customer does not need to fill out any registration form — their Academy identity is the source of truth.

**Why this priority**: The platform is a mirror of the Academy backend. Customer profiles must be kept in sync so features like the recording library, calendar, and future content all reflect accurate identity data. Manual registration would create a divergence problem.

**Independent Test**: Log in as a brand-new customer whose email exists in Academy — confirm a profile is created automatically with their correct name and email. Log in again after a Academy name change — confirm the profile reflects the updated name.

**Acceptance Scenarios**:

1. **Given** a customer authenticates for the first time, **When** the Academy API returns their snapshot, **Then** a platform profile is created with their Academy customer ID, email, and first name.
2. **Given** a customer's name or email has changed in the Academy system, **When** they next log in to the platform, **Then** their platform profile is updated to match the Academy data.
3. **Given** the Academy API is temporarily unavailable, **When** a customer attempts to log in, **Then** the system shows an informative error message and the customer is not left with a broken or inconsistent profile.
4. **Given** a customer ID from the Academy API that does not match the authenticated user's email, **When** the system attempts to sync, **Then** the sync is rejected and an error is logged.

---

### User Story 3 — Cross-device Recording Progress Sync (Priority: P2)

A customer marks a recording as "reviewed" on their desktop computer. When they open the platform on their phone or a different browser, the recording still shows as reviewed. Similarly, if they stop a video halfway through on one device, they can resume from the same point on another device.

**Why this priority**: The recording library's value increases significantly when progress isn't trapped on a single device. Customers often practice on one device and review recordings on another.

**Independent Test**: Mark a recording as reviewed on Device A. Open the platform on Device B (fresh session). Confirm the reviewed state is visible. Play an mp4 recording past the 10-second mark on Device A, then open the same recording on Device B — confirm playback resumes near the saved position.

**Acceptance Scenarios**:

1. **Given** a customer marks a recording as reviewed on Device A, **When** they open the recording library on Device B, **Then** the recording shows the reviewed indicator.
2. **Given** a customer watches an mp4 recording to the 2-minute mark on Device A, **When** they open the same recording on Device B, **Then** playback offers to resume from approximately the 2-minute mark.
3. **Given** a customer has no prior progress on a recording, **When** they open it on any device, **Then** playback starts from the beginning.
4. **Given** a customer fully watches a recording (within 10 seconds of the end), **When** they reopen it on any device, **Then** playback starts from the beginning (completion resets position).
5. **Given** the sync service is temporarily unavailable, **When** a customer interacts with recordings, **Then** progress is saved locally and synced when connectivity is restored — the app does not crash or lose data.

---

### User Story 4 — Content Management Foundation for Academy Staff (Priority: P3)

A Academy staff member logs into the platform's admin panel and can create, edit, and publish course content and community posts without touching code or doing a deployment. The admin panel is only accessible to authorized staff — customers cannot access it.

**Why this priority**: This is a foundation for future features (courses, community). The content types and admin access need to be scaffolded now so the team can begin authoring content before the customer-facing pages are built.

**Independent Test**: Log in to the admin panel as a Academy staff account — confirm access to Courses and Community content types. Attempt to access the admin panel URL as a regular customer — confirm access is denied. Create a draft course entry — confirm it is saved and editable.

**Acceptance Scenarios**:

1. **Given** an authorized Academy staff member, **When** they navigate to the admin panel URL, **Then** they can log in and see Courses and Community Post content types.
2. **Given** a staff member in the admin panel, **When** they create and save a Course entry, **Then** the entry is persisted and retrievable.
3. **Given** an authenticated customer, **When** they attempt to access the admin panel URL, **Then** they are redirected or shown an access-denied page.
4. **Given** an unauthenticated visitor, **When** they attempt to access the admin panel URL, **Then** they are redirected to the admin login page.

---

### Edge Cases

- What happens when a magic link is used more than once or after it expires?
- What if a customer's email in Supabase Auth differs from the email in the Academy snapshot (e.g., they changed their Academy email)?
- What if a Academy customer ID is valid but has never had a session — should a Supabase profile still be created?
- What if two Academy customers share the same email address (data quality issue in the Academy system)?
- What if a customer clears localStorage before cross-device sync has fully replaced it — is local-only progress lost?
- What if the Supabase write for recording progress fails mid-session — is partial progress retained locally?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Platform MUST require customer authentication before displaying any customer-specific data on any route.
- **FR-002**: Customers MUST be able to authenticate using only their registered Academy email address (magic link, no password required).
- **FR-003**: System MUST prevent an authenticated customer from viewing or accessing another customer's data.
- **FR-004**: System MUST automatically create a customer platform profile on the first successful authentication, using data returned by the Academy API.
- **FR-005**: System MUST update the customer platform profile with the latest Academy API data on each subsequent authenticated session.
- **FR-006**: System MUST reject profile creation or update if the email address in the Academy snapshot does not match the authenticated user's email.
- **FR-007**: System MUST persist recording playback positions server-side, keyed by customer and session, accessible from any device.
- **FR-008**: System MUST persist recording "reviewed" markers server-side, keyed by customer and session, accessible from any device.
- **FR-009**: When the server-side sync service is unavailable, the system MUST fall back to local storage and queue the sync for when connectivity is restored.
- **FR-010**: System MUST provide a content administration interface accessible only to authorized Academy staff accounts.
- **FR-011**: The content administration interface MUST include content types for Courses and Community Posts.
- **FR-012**: Customer accounts MUST have no access to the content administration interface.

### Key Entities

- **CustomerProfile**: The platform's record of a Academy customer — stores Academy customer ID, email, first name, and the link to the authenticated identity. Created and updated automatically from Academy API data on each login.
- **RecordingProgress**: Per-customer, per-session record of playback position (in seconds) and reviewed status (boolean). The server-side replacement for the localStorage entries introduced in spec 001.
- **Course**: Content type managed by Academy staff. Represents a vocal training course — title, description, and associated media. Customer-facing rendering is out of scope for this feature.
- **CommunityPost**: Content type managed by Academy staff. Represents a community announcement or discussion entry. Customer-facing rendering is out of scope for this feature.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An unauthenticated visitor cannot access any customer data — zero customer data rendered without a valid session.
- **SC-002**: A customer receives their magic link within 60 seconds of submitting their email.
- **SC-003**: Customer profile is created or updated within 2 seconds of a successful authentication.
- **SC-004**: Recording progress (position and reviewed state) is visible from a second device within 5 seconds of being saved on the first device.
- **SC-005**: A Academy staff member can create and publish a Course entry through the admin panel in under 5 minutes, with no code deployment required.
- **SC-006**: 100% of authenticated sessions enforce the customer-to-profile ownership check — no cross-customer data leaks are possible.
- **SC-007**: When the sync service is unavailable, the platform remains functional with local fallback — zero crashes or data loss for the customer.

---

## Assumptions

- Customer email addresses in the Academy API are unique per customer and match the email the customer would use to log in.
- Magic link (passwordless email) authentication is the intended login method — no password management needed.
- The Academy API `customer_id` is the stable, permanent identifier for linking Academy records to the platform profile (it will never change for a given customer).
- Cross-device sync in V1 covers recording progress and reviewed state only. Other preferences (filters, sort order) remain device-local for now.
- PayloadCMS is the chosen content management tool for staff — admin panel setup is in scope; customer-facing course/community pages are **out of scope** for this feature.
- The existing localStorage-based recording progress from spec 001 will be migrated: the server-side store becomes the authority, and localStorage becomes the offline fallback only.
- Academy staff admin accounts are provisioned manually (no self-service staff registration).
- The platform will be the only consumer of the Supabase database in V1 — no other services read or write to it.
