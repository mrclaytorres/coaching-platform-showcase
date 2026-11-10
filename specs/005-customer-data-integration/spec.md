# Feature Specification: Dev/Demo Student Account Seeding & Normalized Account Display

**Feature Branch**: `005-customer-data-integration`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Now I want to work on the customer-facing frontend of the Academy Platform. At the moment, the current flow for students data if from Core's API. We fetch the data from the API and would want to display it on the Academy Platform. Using the API and API Key found in the .env, we will be able to fetch the customer data. We actually have a demo routes already wires and Core's API instructions found in the /docs/onboarding.md. 1. Now I want to create this for me. Create a seeder that will create a supa base account for the two demos that we have. Since we are using supabase, I want a mechanism to bypass the magic link login for these demo accounts. 2. Since I have access to coursehost, I will hava access to their unique coursehost ID, can we create a supabase seeder for these CourseHost accounts? I want to be able to login to these seeded accounts without the magic link, since we will have no access to their email. This is for development purposes only, so creating a seeded supabase account would be okay. 3. After the students data have been fetch, we would want to normalized and display the information of their accounts (e.g. credit, sessions, event)."

## Clarifications

### Session 2026-07-14

- Q: How does a CourseHost ID map to the customer record Core's API returns, and how does that record get linked to a Supabase account? → A: A CourseHost ID is the same numeric identifier as Core's `customer_id`. Today, a real student's Supabase account is linked to their `customer_id` by matching the Supabase auth user's email address against the email Core's snapshot returns for that `customer_id` (this is the existing production linking rule, enforced at account-link time).
- Q: Seeded/CourseHost-sourced accounts skip the magic-link step entirely, so there's no proven real email to check against Core's snapshot email — how should a seeded account satisfy that existing match rule? → A: The seeder assigns each seeded account a synthetic placeholder email (derived from its numeric identifier) and stores that same placeholder as the linked profile email, so the existing match check is satisfied by comparing the placeholder to itself. No real student email is ever required, stored, or used for seeded accounts, and the existing production linking logic needs no special-cased bypass.
- Q: FR-007 keeps the sign-in bypass UI inert in production, but should the seeder itself (the thing that creates accounts) also refuse to run against a production Supabase project? → A: Yes — the seeder must hard-refuse to run at all if it detects it is targeting the production Supabase project. This is a second, independent safeguard on top of FR-007, not a replacement for it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seed the Two Known Demo Accounts (Priority: P1)

The developer runs a seeding process that creates a Supabase account for each of the two already-known demo students (the "light" account and the "heavy" stress-test account referenced in onboarding). Each seeded account is linked to its real student record so that, once signed in, the developer sees that student's real credits, sessions, and activity — exactly as a real student would.

**Why this priority**: This is the smallest possible slice that proves the whole approach works, and it unblocks all local development/demoing without depending on real email delivery.

**Independent Test**: Run the seeder once, then use the sign-in bypass to open each demo account's dashboard and confirm the credit balances, session list, and activity feed match what the two demo routes already show today.

**Acceptance Scenarios**:

1. **Given** neither demo account has been seeded yet, **When** the developer runs the seeder, **Then** two Supabase accounts are created, each linked to its correct student record, with no manual email step required.
2. **Given** the seeder has already run once, **When** the developer runs it again, **Then** it does not create duplicate accounts or duplicate student records — the existing seeded accounts are reused/updated in place.
3. **Given** a seeded demo account exists, **When** the developer signs in as that account, **Then** they land on that account's dashboard without ever receiving or clicking an email link.

---

### User Story 2 - Seed Additional Accounts by Known ID (Priority: P2)

The developer knows the numeric identifier of a real student (sourced from the CourseHost admin panel, where an email address may not be readily available) and wants a local, working account for that student without needing that student's actual email inbox. The developer adds that identifier to the seed list and runs the seeder; a new dev account is created and becomes available through the same sign-in bypass as the two demo accounts.

**Why this priority**: Extends the same mechanism from User Story 1 to an arbitrary, developer-supplied list of real students, which is what makes the tool useful beyond the two hardcoded demos — but it depends on User Story 1's seeding mechanism already existing.

**Independent Test**: Add one additional known student identifier to the seed input, run the seeder, and confirm a new account appears in the sign-in bypass list showing that student's real data.

**Acceptance Scenarios**:

1. **Given** a developer-supplied list of student identifiers beyond the two demos, **When** the seeder runs, **Then** one dev account is created per identifier, each linked to that identifier's real student record.
2. **Given** an identifier that does not correspond to any real student in Core's system, **When** the seeder runs, **Then** that identifier is skipped with a clear message, and the run still completes for the remaining valid identifiers.
3. **Given** a seeded account created from a known identifier, **When** the developer signs in as that account, **Then** the dashboard shows that student's real credits, sessions, and activity, timezone-correct, exactly as the existing dashboard already renders for any other student.

---

### User Story 3 - Confirm Normalized Dashboard Covers Seeded Accounts (Priority: P3)

Having seeded and signed into demo and dev accounts, the developer verifies that the existing account dashboard — credit balances, upcoming/past sessions, and the activity log — renders correctly for these accounts, including accounts with little data (the "light" demo) and accounts with a large volume of data (the "heavy" demo).

**Why this priority**: This closes the loop — the whole point of seeding accounts is to be able to actually see their data rendered correctly. It is lower priority than the seeding mechanism itself because it depends on User Stories 1 and 2 already existing, and largely re-validates dashboard behavior that already exists.

**Independent Test**: Sign in as the "heavy" demo account and confirm the dashboard loads without error and reflects the same credit/session/activity totals as calling Core's API directly for that identifier; repeat for the "light" demo account and confirm empty-state handling still works correctly.

**Acceptance Scenarios**:

1. **Given** a seeded account with no credits, no sessions, and minimal activity, **When** the developer views its dashboard, **Then** appropriate empty states are shown for each section rather than errors or blank space.
2. **Given** a seeded account with a large number of sessions and activity entries, **When** the developer views its dashboard, **Then** the dashboard still loads successfully and long lists remain usable (not spec'd here beyond "loads and is usable" since the dashboard itself is out of scope for new work).
3. **Given** any seeded account, **When** its dashboard is viewed, **Then** every date/time shown reflects that account's display timezone, not the viewer's local timezone.

---

### Edge Cases

- What happens if the seeder is run against a numeric identifier that Core's API returns a permanent error for (not just "not found")? The run should report the failure for that identifier and continue with the rest rather than aborting the whole batch.
- What happens if a seeded account's underlying student record already exists (e.g., a real student with that identifier already signed up through the normal magic-link flow)? The seeder must not overwrite or take over a real, already-claimed account.
- What happens if someone tries to reach the developer-only sign-in bypass page in a production deployment? It must not be reachable or functional there under any circumstance.
- What happens if the seeder is accidentally run with credentials/configuration pointed at the production Supabase project? It must refuse to run and create nothing, rather than seeding fake dev accounts into the live database.
- What happens if the same numeric identifier is listed twice in one seeding run? It should be treated as a single account, not seeded/duplicated twice.
- What happens when a seeded account is signed into and then the developer also has an unrelated real Supabase session active in the same browser? Signing in as the seeded account should behave like any other account sign-in (replacing the active session), not silently merge or conflict with it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a way for a developer to seed a Supabase account for each of the two known demo students (identifiers `10002` and `10001`) in one run, without requiring any manual email interaction.
- **FR-002**: System MUST accept a developer-supplied list of additional numeric student identifiers to seed beyond the two demo accounts, and create one account per identifier.
- **FR-003**: Each seeded account MUST be linked to the real student record for its identifier so that the identifier's live data from Core's API becomes that account's data, consistent with the existing rule that a Supabase account is only linked to a `customer_id` when the account's email matches the email Core's snapshot returns for that `customer_id`.
- **FR-004**: Running the seeder again for an identifier that was already seeded MUST NOT create a duplicate account or duplicate student record; the existing seeded account must be reused.
- **FR-005**: System MUST refuse to seed over an identifier that is already linked to a real (non-seeded) account, to avoid a developer accidentally taking over a genuine student's account.
- **FR-006**: System MUST provide a mechanism for a developer to sign in directly as any seeded account, reaching that account's dashboard without requesting, receiving, or clicking a magic-link email.
- **FR-007**: The sign-in bypass mechanism MUST be completely inoperative and unreachable when the application is running in a production deployment.
- **FR-008**: System MUST visibly mark seeded accounts with a "Dev" badge distinguishing them from real student rows (not visible to or confusable with real student-facing account management), including in any place staff/admins can view account lists.
- **FR-009**: When seeding an identifier that Core's API reports as not found or otherwise fails to return, the system MUST report that specific failure and continue processing the remaining identifiers in the same run.
- **FR-010**: The existing account dashboard (credits, sessions, activity) MUST render correctly for every seeded account, respecting the same empty-state, timezone, and recording-link visibility rules it already applies to real student accounts.
- **FR-011**: Seeded accounts MUST NOT require, collect, or store the real student's email address. Each seeded account MUST instead be assigned a synthetic placeholder email derived from its numeric identifier, used consistently as both the account's sign-in email and its linked profile email, so the existing email-match linking rule (FR-003) is satisfied without ever needing the real student's email.
- **FR-012**: The seeding process itself MUST refuse to run at all if it detects it is targeting the production Supabase project, independent of and in addition to the sign-in bypass being inoperative in production (FR-007).

### Key Entities

- **Seeded Dev Account**: A Supabase authentication account created by the seeding process rather than through the normal sign-up/magic-link flow. Linked one-to-one to a real student record via a known numeric student identifier, using a synthetic placeholder email (derived from that identifier) in place of the real student's email. Flagged as seeded so it can be distinguished from genuine student accounts.
- **Seed List**: The set of numeric student identifiers a developer wants dev accounts for — the two fixed demo identifiers plus any additional identifiers the developer supplies (e.g., sourced from CourseHost's admin panel).
- **Student Record**: The existing profile record linking a student's account to their numeric identifier and the live data Core's API returns for that identifier (credits, sessions, activity) — unchanged by this feature except that it may now also be reached via a seeded account.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from a clean local environment to viewing either demo account's real dashboard in under 2 minutes, with zero email interactions.
- **SC-002**: A developer can add a new known student identifier and be viewing that account's dashboard in under 2 minutes, without ever needing that student's email address.
- **SC-003**: Running the seeding process repeatedly against the same identifiers never results in duplicate accounts or duplicate student records.
- **SC-004**: 100% of attempts to use the sign-in bypass mechanism in a production deployment fail to produce a signed-in session.
- **SC-005**: Both the "light" and "heavy" demo accounts' dashboards load successfully and show data consistent with what Core's API returns for those identifiers.
- **SC-006**: 100% of attempts to run the seeder against the production Supabase project are refused before any account is created.

## Assumptions

- "The two demos we have" refers to the two identifiers already documented in onboarding: `10002` (light) and `10001` (heavy).
- A CourseHost unique ID and Core's numeric `customer_id` are the same identifier space — there is no separate CourseHost-to-Academy-customer mapping step required. This matches how the two existing demo routes already work (both are addressed purely by numeric ID). (Confirmed — see Clarifications.)
- This capability is for local/development use only; it is explicitly out of scope to expose any seeding or bypass functionality to real students or through any production-reachable surface.
- The developer running the seeder has direct access to the project's Supabase service-role credentials and Core's API credentials already present in `.env`, consistent with how the rest of the codebase accesses them.
- "Normalize and display" (item 3 of the request) does not require new dashboard UI work — it requires confirming seeded accounts correctly flow through the dashboard that was already built and shipped for real students.
- No new production-facing functionality is introduced by this feature; its entire surface area (seeding + bypass sign-in) is development-only tooling.
