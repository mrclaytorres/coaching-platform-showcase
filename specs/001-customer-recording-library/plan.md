# Implementation Plan: Customer Recording Library

**Branch**: `001-customer-recording-library` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-customer-recording-library/spec.md`

## Summary

Add a `/customer/[id]/library` route to the Academy platform where customers can browse, filter, and replay all their past lesson recordings. Data comes exclusively from the existing `fetchSnapshot` call (already cached per request via React's `cache()`), so no new backend work is required. Playback position and reviewed state persist in browser `localStorage`. The feature slots into the existing Next.js App Router + Tailwind + TypeScript stack with no new runtime dependencies.

## Technical Context

**Language/Version**: TypeScript 5 / Node 20 (matches existing project)

**Primary Dependencies**: Next.js 14 App Router, React 18, Tailwind 3.4, Lucide React (already installed). No new packages required — native `<video>`, `<iframe>` (Vimeo embed URL), and external link (Zoom) cover all three URL types.

**Storage**: Browser `localStorage` for playback position and reviewed state (V1, device-local). PayloadCMS is available in the stack for a future cross-device persistence upgrade but is not needed here.

**Testing**: Manual validation against demo customers 10002 (light) and 10001 (heavy, 461 sessions). No automated tests per project norms for V1.

**Target Platform**: Web — desktop and mobile (375 px minimum), same as existing dashboard.

**Project Type**: Next.js web application (App Router, server + client components).

**Performance Goals**: Library page loads and renders within 2 seconds on a standard connection for customers with 100+ recordings (spec SC-007). All filtering happens client-side in memory — no round-trips after initial load.

**Constraints**:
- Zero new backend endpoints — reuse existing `fetchSnapshot` cache.
- No new npm dependencies without prior approval (per project norms).
- `server-only` guard on `core-api.ts` must never be imported from client components.
- Core's API is read-only; no writes to the snapshot are possible.

**Scale/Scope**: Up to ~500 sessions per customer (customer 10001 has 461). A subset with `recording_url` will be smaller in practice. Client-side filtering over this volume is fast and appropriate.

## Constitution Check

*No project constitution is in effect (template placeholder only). No gates to evaluate.*

## Project Structure

### Documentation (this feature)

```text
specs/001-customer-recording-library/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — entities and shapes
├── contracts/
│   ├── components.md    # Component prop contracts
│   └── storage.md       # localStorage key schema
├── quickstart.md        # Phase 1 — validation guide
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── customer/
│       └── [id]/
│           └── library/
│               └── page.tsx                  # Server component: fetches snapshot, renders RecordingLibrary
├── components/
│   └── library/
│       ├── RecordingLibrary.tsx              # 'use client' root: filter state, list rendering
│       ├── LibraryFilters.tsx                # 'use client': search + lesson-type + date-range controls
│       ├── RecordingCard.tsx                 # 'use client': single list entry + reviewed toggle
│       ├── RecordingPlayer.tsx               # 'use client': in-app player (mp4 / Vimeo / Zoom)
│       └── LibraryEmptyState.tsx             # Presentational: no-recordings / no-results states
└── lib/
    └── library/
        ├── recording-utils.ts                # Pure: URL type detection, snapshot → Recording transform
        └── use-library-storage.ts            # Hook: localStorage reads/writes for position + reviewed
```

**Structure Decision**: All new code lives under the existing `src/` tree. Server-side data fetching mirrors the established pattern in `customer/[id]/page.tsx` (server component calls `fetchSnapshot`, passes data as props to a client sub-tree). No new top-level directories.

## Complexity Tracking

No constitution violations to justify.
