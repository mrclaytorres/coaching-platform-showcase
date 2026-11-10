# Quickstart Validation Guide: Supabase Auth, Customer Profile Sync, and Content Management Foundation

**Branch**: `002-supabase-auth-user-data` | **Date**: 2026-06-10

---

## Prerequisites

Before running any validation scenario, ensure:

1. **Supabase project created** and the following env vars are populated in `.env`:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   DATABASE_URL
   PAYLOAD_SECRET
   ```

2. **Supabase schema applied** — run the SQL from `contracts/supabase-schema.md` in the Supabase SQL editor (tables, indexes, RLS policies, triggers)

3. **Dependencies installed**:
   ```bash
   npm install
   ```

4. **Dev server running**:
   ```bash
   npm run dev
   ```
   Server starts at `http://localhost:3040`.

5. **Test customer emails**: Use the email addresses for demo customers 10002 and 10001 (visible in the Academy API snapshots — check `snapshot.customer.email`).

---

## Scenario 1: Unauthenticated Access is Blocked

**Goal**: Confirm the security boundary is in place.

1. In an incognito browser, navigate to `http://localhost:3040/customer/10001`
2. **Expected**: Redirected to `/login` — no customer data rendered
3. Navigate to `http://localhost:3040/customer/10001/library`
4. **Expected**: Redirected to `/login` — library page does not load
5. Navigate directly to `/` (root)
6. **Expected**: Root page loads normally (no auth required)

---

## Scenario 2: Magic Link Login

**Goal**: Confirm end-to-end authentication flow.

1. Navigate to `http://localhost:3040/login`
2. Enter the email address for test customer 10001
3. **Expected**: "Check your email" message appears — no error
4. Open the email inbox and click the magic link
5. **Expected**: Browser redirects to `http://localhost:3040/customer/10001` and the dashboard loads with the customer's name and data

---

## Scenario 3: Customer Profile Auto-Created

**Goal**: Confirm the Academy API → Supabase sync runs on first login.

1. Complete Scenario 2 (first login for this customer)
2. In the Supabase dashboard → Table Editor → `customer_profiles`
3. **Expected**: A row exists with the correct `core_customer_id`, `email`, and `first_name` matching the Academy API snapshot

---

## Scenario 4: Profile Updated on Re-login

**Goal**: Confirm the upsert refreshes stale data.

1. In Supabase Table Editor, manually change `first_name` in the customer's profile row to "TestName"
2. Log out of the platform (click logout in the sidebar or clear cookies)
3. Log back in via magic link
4. **Expected**: In Supabase Table Editor, `first_name` is back to the correct value from the Academy API — "TestName" has been overwritten

---

## Scenario 5: Cross-Customer Access Denied

**Goal**: Confirm ownership enforcement.

1. Log in as customer 10001 (complete Scenario 2)
2. In the browser address bar, manually navigate to `http://localhost:3040/customer/10002`
3. **Expected**: Redirected to `/customer/10001` (the authenticated customer's own dashboard) — customer 10002's data is never shown

---

## Scenario 6: Cross-device Recording Progress Sync

**Goal**: Confirm reviewed state and position persist server-side.

1. Log in as customer 10001 on Browser A
2. Navigate to the Recording Library at `/customer/10001/library`
3. Mark one recording as "Reviewed" — confirm the green checkmark appears
4. Open Browser B (or incognito), log in as the same customer 10001
5. Navigate to the Recording Library
6. **Expected**: The same recording shows the "Reviewed" indicator on Browser B
7. In Supabase Table Editor → `recording_progress` — confirm a row exists for this customer and session with `is_reviewed = true`

---

## Scenario 7: Playback Position Sync

**Goal**: Confirm mp4 position persists to Supabase.

1. Log in as customer 10001, open an mp4 recording
2. Watch past the 10-second mark
3. Wait 5 seconds (throttled save fires) or close the player (unmount save fires)
4. In Supabase Table Editor → `recording_progress` — confirm a row with `position_seconds > 10`
5. Open the same recording on a second browser (logged in as same customer)
6. **Expected**: Playback resumes near the saved position (not from 0)

---

## Scenario 8: Offline / Supabase Unavailable Fallback

**Goal**: Confirm localStorage fallback when Supabase is unreachable.

1. Log in as customer 10001
2. In browser DevTools → Network tab → block requests to `*.supabase.co`
3. Open a recording in the library and mark it as reviewed
4. **Expected**: The reviewed indicator appears immediately (localStorage write succeeds) — no error crash or blank screen
5. Unblock Supabase requests
6. Reload the page
7. **Expected**: The reviewed state is either still present (if queue sync completed) or may briefly reset to false (acceptable V1 behavior) — no data corruption

---

## Scenario 9: Logout Clears Session

**Goal**: Confirm logout terminates the session.

1. Log in as customer 10001
2. Click "Log out"
3. **Expected**: Redirected to `/login`
4. Navigate to `http://localhost:3040/customer/10001`
5. **Expected**: Redirected to `/login` — session is gone

---

## Scenario 10: PayloadCMS Admin Panel Access (Staff)

**Goal**: Confirm admin panel is accessible to authorized staff.

1. Navigate to `http://localhost:3040/admin`
2. **Expected**: PayloadCMS admin login screen loads (not the customer login)
3. Log in with a Payload admin account (created via `npm run payload create-admin` or via the first-run setup)
4. **Expected**: Admin dashboard shows "Courses" and "Community Posts" in the sidebar
5. Create a new Course entry: title = "Test Course", status = "draft"
6. **Expected**: Entry saves without error; visible in the Courses list

---

## Scenario 11: Customer Cannot Access Admin Panel

**Goal**: Confirm admin panel is protected from customers.

1. Log in as customer 10001 via magic link
2. Navigate to `http://localhost:3040/admin`
3. **Expected**: PayloadCMS admin login page — the customer's Supabase session provides no access; they see a login form for Payload users only, not their customer dashboard

---

## Scenario 12: Invalid / Expired Magic Link

**Goal**: Confirm graceful error handling.

1. Navigate to `/login` and submit an email
2. Wait 1+ hour without clicking the link (or use the old link after clicking a newer one)
3. Click the expired link
4. **Expected**: Redirected to `/login?error=auth_failed` with a user-friendly error message — no crash, no blank screen

---

## Scenario 13: Empty State — No Recordings Customer

**Goal**: Confirm auth and profile sync work for customers with no recordings (regression from spec 001).

1. Log in as customer 10002 (no recordings)
2. Navigate to `/customer/10002/library`
3. **Expected**: Library loads with empty state message — authentication and profile sync did not break the existing empty-state behavior
