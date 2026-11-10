# Quickstart: Independent Account Signup

## Prerequisites

- `next dev` running locally (`npm run dev`, port 3040).
- The new `core_link_requests` table (data-model.md) applied. No `customer_profiles` migration is needed — `account_origin`/`native_customer_id_seq`/`next_native_customer_id()` are already live (research.md §0).
- `RESEND_API_KEY` and `BOOKING_EMAIL_FROM` set (already configured in `.env.local`) — link-verification emails are sent for real, not mocked.
- A real inbox you control, so you can receive and click the verification link in Scenario 2.
- At least one published Booking Event (`/dev/seed-booking` or `/booking/staff/new`) to exercise Scenario 3.
- A Core/CourseHost customer ID to link against — a seeded dev account (e.g. `10001`) works, since `fetchSnapshot` only needs a real Core record to exist, not a matching platform login.

## Scenario 1 — Sign up without any existing account (Story 1, FR-001, FR-003)

1. Visit `/login`, enter a brand-new email address never used on this platform before, submit.
2. Confirm the `message=check_email` state renders.
3. Click the magic link from that email.
4. Confirm you land on `/login?message=no_profile` and see **two** options: the existing "Link your account" (Core ID) form, and a new "Continue without linking" option.
5. Choose "Continue without linking," enter a first name, submit.
6. Confirm you land directly on `/customer/{negative id}` — your own real dashboard, not a placeholder area — with Courses/Tiers/credits/session history showing accurate empty states instead of errors. Confirm the `customer_profiles` row has `account_origin = 'native'` and a negative `core_customer_id`.
7. Sign out, sign back in with the same email (magic link again) — confirm you land back on the same `/customer/{negative id}` dashboard.

## Scenario 2 — Link to an existing Core customer record (Story 2, FR-004–FR-007, FR-010, FR-011)

1. From your native dashboard, go to `/account/link` and submit a real, existing Core customer ID (e.g. `10001`).
2. Confirm a "check your email" style confirmation, and that an email arrives at that Core customer's **on-file** address (per the seeded snapshot — not necessarily the address you signed up with).
3. Click the verification link.
4. Confirm you're redirected toward `/customer/10001` (or `/login?message=linked_sign_in` if the clicking browser has no session) — and that the account now behaves exactly like a normal Core-linked student. Confirm the row's `core_customer_id` changed from negative to `10001` and `account_origin` is now `'core-linked'` — same row `id` as before linking.
5. Repeat steps 1–4 for a **different** newly-signed-up native account, but this time first run `/dev/seed-booking` or the staff enrollment flow (spec 012) against the same Core ID *before* signing up independently, so a pending row already exists. After linking, confirm: (a) the Tier/Course enrollments that were on the pending row are still present, (b) no duplicate `customer_profiles` row remains for that Core id, (c) the student ends up on the *pending* row's `id`, not the native row's.

## Scenario 3 — Use Coaching before linking (Story 3, FR-012, FR-013)

1. Complete Scenario 1 but stop before linking.
2. From your native dashboard, go to Coaching (same nav item every account has). Confirm you can browse published Booking Events and complete a booking, the same as a Core-linked student — no code path difference, just verify it works.
3. Confirm the dashboard's Courses/credits/session-history sections show accurate "nothing yet" empty states, not errors or fabricated data.
4. Now link this same account (Scenario 2's steps). Confirm the booking made while native in step 2 is still visible under this now-linked account's session history / My Bookings.

## Scenario 4 — Rejections and edge cases (Edge Cases, FR-005, FR-006, FR-008, FR-009, FR-014)

1. Submit a Core customer ID that doesn't exist. Confirm a clear "not found" message, no email sent.
2. Have two different native accounts both attempt to link to the **same** Core customer ID. Confirm the second attempt is rejected as "already linked" and does not reveal anything about the first account.
3. Let a verification link's request expire (or manually set `expires_at` in the past for a test row) and click it. Confirm "invalid or expired" with a way to request a new one, and that the link cannot be reused even with the correct token.
4. Submit more than 5 link requests for the same account within an hour. Confirm the 6th is rejected with a generic rate-limit message, not a Core lookup or email send.
5. Confirm that a platform signup email coincidentally matching a Core record's on-file email does **not** auto-link — the account still shows `account_origin = 'native'` until the explicit link+verify flow completes.

## Scenario 5 — Existing behavior unaffected (regression check)

1. Run the existing real-login flow end to end (`/login` → magic link → `linkAccount` with a valid Core ID matching the login email) — confirm it still works exactly as before.
2. Visit any existing Core-linked `/customer/[id]/*` or `/booking/customer/[id]/*` page as a normal linked student — confirm no behavior change, and that `fetchSnapshot()` is still called for these (only native accounts skip it).
