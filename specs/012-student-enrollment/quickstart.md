# Quickstart: Staff-Driven Student Enrollment

## Prerequisites

- `next dev` running locally (`npm run dev`, port 3040).
- Logged in as a `staff` or `super_admin` account (not `coach` — FR-008).
- At least one Tier and one standalone Course already authored (`/staff/tiers`, `/staff/courses`) — this feature only enrolls into Tiers/Courses that already exist.
- The `customer_profiles.supabase_user_id` migration (data-model.md) applied locally.
- A Core/CourseHost customer ID to test with — both a known one (already has a `customer_profiles` row, e.g. one of the seeded dev accounts) and, ideally, one that doesn't yet, to exercise FR-009's resolve-or-create path.

## Scenario 1 — Enroll a brand-new (never-logged-in) student into a Tier (Story 1, FR-009)

1. Pick a real Core customer ID with no existing `customer_profiles` row (confirm via `getCustomerProfileByCoreId` returning `null`, or just pick one not in `/dev/seed-accounts`' "Seeded accounts" list and not one you've logged in as).
2. Visit `/staff/customers/<that id>` — confirm the page loads with the existing "No linked Academy portal account" notice, and the new Enrollment section shows "Not enrolled."
3. Choose the sequence's entry Tier and submit the Tier enrollment form.
4. Confirm: a success message appears, the Enrollment section now shows that Tier's name, and (query `customer_profiles` directly, or reload the page) a `customer_profiles` row now exists for this customer with `supabase_user_id IS NULL`.

## Scenario 2 — Choose a non-entry starting Tier (Story 1, FR-001)

1. Using a student from Scenario 1 (or any other with no Tier enrollment yet), submit the Tier enrollment form choosing the *second* Tier in the sequence instead of the first.
2. Confirm the Enrollment section shows the second Tier's name, and that Tier's Course (and the first Tier's Course) are both accessible to that student on the customer-facing side — check `/customer/<id>/courses` if you have a way to sign in as them (or verify via `isCourseUnlocked` behavior: `tier.order <= current_tier_rank`).

## Scenario 3 — Duplicate and downgrade guards (FR-004, FR-005)

1. With a student already enrolled at a Tier (from Scenario 1 or 2), submit the Tier enrollment form again choosing the *same* Tier. Confirm you see an "already enrolled" message, not a crash or a silent no-op.
2. Submit again choosing a *lower* Tier than their current one. Confirm you see a message explaining this would lower their access, and that their `current_tier_rank` is unchanged afterward.

## Scenario 4 — Standalone Course enrollment + category guard (Story 2, FR-002, FR-003, FR-004)

1. Pick a known student and a standalone Course they're not enrolled in. Submit the Course enrollment form. Confirm success and that the Enrollment section now lists that Course.
2. Submit the same form again for the same Course. Confirm you see an "already enrolled" message.
3. If a Sequential-Locked Course exists, confirm it does *not* appear as an option in the standalone-Course enrollment form's picker (FR-003's category guard should mean staff never even see it as a choice, not just get rejected after picking it).

## Scenario 5 — Real login after pre-enrollment doesn't break (research.md §2, cross-cutting fix)

1. After Scenario 1 (student has a `customer_profiles` row with `supabase_user_id IS NULL`), have that same Core customer ID actually log into the student portal for the first time via `/login` (magic link + entering their customer ID), using their real matching email.
2. Confirm login succeeds — no unique-constraint error — and that the same `customer_profiles` row (same `id`) is now updated with `supabase_user_id` set, not a second row created.
3. Confirm their Tier enrollment from Scenario 1 is still intact after logging in (same student, same row, so nothing should have moved).

## Scenario 6 — Enrollment status visibility (Story 3, FR-006)

1. Open a student with no enrollments at all. Confirm the Enrollment section clearly shows "not enrolled" for both Tier and standalone Courses, not a blank or broken section.
2. Open a student enrolled in both a Tier and a standalone Course. Confirm both are shown by name (not raw ids) without needing to attempt an enrollment first.

## Verification commands

```bash
npm run typecheck
npm run lint
```

No automated test suite exists in this repo (see plan.md Technical Context) — the scenarios above are the acceptance check.
