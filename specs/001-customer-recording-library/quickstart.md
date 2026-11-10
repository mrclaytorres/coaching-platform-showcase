# Quickstart Validation Guide: Customer Recording Library

**Phase**: 1 | **Date**: 2026-06-08 | **Plan**: [plan.md](./plan.md)

---

## Prerequisites

- Node 20 installed
- `.env` populated (copy from `.env.example`, fill secrets from 1Password)
- `npm install` run in the repo root

## Start the Dev Server

```bash
cd ~/academy-platform   # or wherever the repo lives
npm run dev
# App available at http://localhost:3040
```

---

## Test Customers

| Customer | ID | Profile |
|---|---|---|
| Student A | `10002` | Light: 1 credit, 0 sessions, 1 event |
| Student B | `10001` | Heavy: 4 wallets, 461 sessions, 526 events |

Library URLs:
- `http://localhost:3040/customer/10002/library`
- `http://localhost:3040/customer/10001/library`

---

## Validation Scenarios

### S1 — Sidebar nav entry

1. Navigate to `http://localhost:3040/customer/10001`
2. **Expect**: "Recording Library" appears in the left sidebar nav, below "Fast Feedback"
3. Click it — **Expect**: navigates to `/customer/10001/library`, nav item is highlighted

---

### S2 — Library list (customer with recordings)

1. Navigate to `http://localhost:3040/customer/10001/library`
2. **Expect**: A list of recordings is shown. Each card displays:
   - Event name
   - Lesson type (or blank/null if not set)
   - Session date (formatted in `snapshot.display_timezone`)
3. **Expect**: All entries are past sessions with a non-null `recording_url`
4. **Expect**: No sessions appear that lack a `recording_url`

---

### S3 — Empty state (customer with no recordings)

1. Navigate to `http://localhost:3040/customer/10002/library`
2. **Expect**: An empty-state message is shown (e.g. "No recordings yet") — no list, no error

---

### S4 — Text search

1. On `customer/10001/library`, type a partial event name into the search box
2. **Expect**: List filters in real time, showing only matching event names (case-insensitive)
3. Clear the search — **Expect**: full list restored

---

### S5 — Lesson-type filter

1. On `customer/10001/library`, select a lesson type from the dropdown
2. **Expect**: Only recordings of that type are shown
3. Select "All types" — **Expect**: full list restored

---

### S6 — Date range filter

1. On `customer/10001/library`, set a "From" date
2. **Expect**: Recordings before that date disappear
3. Add a "To" date — **Expect**: recordings outside the range also disappear
4. Clear both dates — **Expect**: full list restored

---

### S7 — Combined filters + no-results state

1. Apply a lesson-type filter AND a date range that returns no results
2. **Expect**: A "no results for current filters" message is shown with a "Clear filters" button
3. Click "Clear filters" — **Expect**: full list is restored and filters reset

---

### S8 — MP4 playback

1. Find a recording with a direct `.mp4` URL in the list
2. Click it — **Expect**: a video player appears in the page with native `<video>` controls
3. Play for 10+ seconds, navigate away, return to the same recording
4. **Expect**: player starts near the saved position (within a few seconds)

---

### S9 — Vimeo playback

1. Find a recording with a `vimeo.com` URL
2. Click it — **Expect**: a Vimeo embedded player appears and loads the video
3. No native video controls visible — Vimeo's own controls are present

---

### S10 — Zoom recording

1. Find a recording with a `zoom.us/rec` URL
2. Click it — **Expect**: an info panel is shown (not a blank frame) with an "Open in Zoom" link
3. Click the link — **Expect**: opens the Zoom recording in a new tab

---

### S11 — Broken recording URL

1. Temporarily patch a recording URL to an invalid value (or test against a URL you know is dead)
2. Click it — **Expect**: an error state is shown explaining the recording is unavailable
3. **Expect**: no blank screen, no unhandled error

---

### S12 — Reviewed state persistence

1. On `customer/10001/library`, find any unreviewed recording
2. Mark it as reviewed — **Expect**: the card visually changes (badge, muted style, or checkmark)
3. Hard-reload the page — **Expect**: card still shows the reviewed state
4. Mark it un-reviewed — **Expect**: card returns to its default appearance, persists on reload

---

### S13 — Mobile layout

1. Open browser devtools, set viewport to 375×812 (iPhone SE / small mobile)
2. Navigate to `/customer/10001/library`
3. **Expect**: sidebar is either collapsed/hidden or replaced with mobile nav; list is readable; filter controls are usable; player renders without overflow

---

## Known Limitations (V1)

- Playback position for Vimeo recordings is saved on page-unload only (best-effort). Exact resume is supported for mp4 only.
- Reviewed state and playback position are device-local (localStorage). Clearing browser data will lose them.
- Zoom recordings cannot be played in-app; the "Open in Zoom" link requires the customer to be authenticated in Zoom separately.
