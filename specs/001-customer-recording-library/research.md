# Research: Customer Recording Library

**Phase**: 0 | **Date**: 2026-06-08 | **Plan**: [plan.md](./plan.md)

---

## Decision 1: Persistence Strategy for Playback Position and Reviewed State

**Decision**: Browser `localStorage`, keyed by `customerId` and `sessionId`.

**Rationale**: The spec explicitly states V1 persistence is device-local. `localStorage` requires zero new infrastructure, no Payload schema, and no API changes. It directly satisfies FR-012 and FR-013. A future V2 can migrate this to a PayloadCMS collection (or a dedicated Core endpoint) without changing the component interfaces — the storage hook is isolated and swappable.

**Alternatives considered**:
- **PayloadCMS collection** (`recording_state`): Enables cross-device sync and admin visibility. Rejected for V1 because it introduces a backend dependency the spec explicitly excludes ("no new backend, zero Core dependency"), requires auth session linkage not yet built, and adds schema migration work.
- **URL search params**: Good for shareable filter state, not appropriate for per-user playback positions (they'd leak in browser history and shared links).
- **`sessionStorage`**: Clears on tab close, so resume-on-return (US-4) would not work.

---

## Decision 2: Video Player for Direct MP4 URLs

**Decision**: Native HTML `<video>` element with `controls`.

**Rationale**: All modern browsers support `<video>` natively. No package needed. Gives full control over the `currentTime` property for position save/restore. Handles both `http(s)://` direct file links.

**Alternatives considered**:
- **react-player**: Supports all three URL types in one component. Rejected because the project norm prohibits adding dependencies without prior approval, and the three-type split is manageable with the native approach.
- **video.js**: Overkill for this use case; adds significant bundle weight.

---

## Decision 3: Vimeo Playback

**Decision**: Native `<iframe>` using the Vimeo player embed URL (`https://player.vimeo.com/video/{ID}?autoplay=0`). Extract the numeric video ID from the `recording_url` with a simple regex.

**Rationale**: Vimeo's embed iframe is a well-documented, zero-dependency approach. Works within the same-origin iframe sandbox without any SDK. No new package required.

**Vimeo URL patterns to handle**:
- `https://vimeo.com/123456789` → ID: `123456789`
- `https://vimeo.com/123456789/abcdef` (unlisted) → ID: `123456789`
- `https://player.vimeo.com/video/123456789` (already an embed URL) → use as-is

**Alternatives considered**:
- **Vimeo Player SDK (`@vimeo/player`)**: Enables JS control over playback position. Rejected (new dependency). Position tracking for Vimeo iframes can be approximated via the `postMessage`-based Player API without the npm package if needed in a future iteration.
- **react-player**: See Decision 2 above.

**Limitation**: Playback position cannot be read back from an iframe without the Vimeo Player SDK or `postMessage` integration. For V1, position save for Vimeo recordings is best-effort (save on player close / page unload). This is acceptable and matches the spec's "remembered between visits" intent.

---

## Decision 4: Zoom Cloud Recording Playback

**Decision**: Show a prominent "Open Recording" link that opens the Zoom URL in a new tab. Do not attempt to embed.

**Rationale**: Zoom cloud recordings (`zoom.us/rec/...`) require authentication and do not support cross-origin iframe embedding (Zoom sets `X-Frame-Options: SAMEORIGIN`). Any embed attempt will fail silently or show an error frame. An explicit link is transparent and reliable.

**Alternatives considered**:
- **Iframe embed**: Blocked by Zoom's frame policy. Rejected.
- **Proxy / download**: Requires Core-side work to download and re-host recordings. Rejected for V1 (new backend dependency).

---

## Decision 5: URL Type Detection Logic

**Decision**: Pure function `detectUrlType(url: string): 'mp4' | 'vimeo' | 'zoom' | 'unknown'` using hostname and pathname checks.

```
vimeo   → hostname contains 'vimeo.com'
zoom    → hostname contains 'zoom.us' OR contains 'zoomgov.com'
mp4     → pathname ends with '.mp4' OR content-type is video/* (not checkable client-side without a HEAD request)
unknown → anything else (render error state)
```

**Rationale**: Core's API documentation and the onboarding brief confirm these are the three URL types in the wild. The `unknown` fallback ensures the broken-URL error state (FR-011) is triggered for anything unexpected.

---

## Decision 6: Filter State Location

**Decision**: React `useState` inside the `RecordingLibrary` client component. Filters are not persisted to the URL.

**Rationale**: The spec does not require shareable filter URLs. URL search params would add complexity (Next.js router push, `useSearchParams` in a client component, Suspense boundary requirements) for no user-visible benefit. In-memory React state is simple, instant, and resets cleanly on navigation away and back.

**Alternatives considered**:
- **URL search params**: Shareable + bookmarkable. Rejected for V1 scope; easy to add later.
- **`localStorage`**: Unnecessary statefulness for filter preferences.

---

## Decision 7: Server vs Client Component Split

**Decision**: `library/page.tsx` is a server component (mirrors `customer/[id]/page.tsx`). It calls `fetchSnapshot` (which is de-duplicated via React `cache()` with the layout's call), derives the `recordings` array, extracts unique lesson types, and passes both as props to `<RecordingLibrary>` (a `'use client'` component).

**Rationale**: This matches the established pattern. Server component handles data; client component handles interactivity. The `recordings` prop is a plain serializable array (no class instances), so it crosses the server/client boundary cleanly.

**Key implication**: `fetchSnapshot` will be called twice per request (layout + library page) but React's `cache()` deduplicates within a single render pass — zero extra network calls.

---

## Decision 8: Sidebar Nav Icon

**Decision**: Use the `Library` icon from `lucide-react` (already installed). Label: `"Recording Library"`.

**Rationale**: `lucide-react` is already in the project. `Library` (book shelves icon) is the most semantically appropriate match. If `Library` is not available in the installed version, fall back to `Film`.

---

## Resolved Unknowns

All items from the Technical Context are resolved. No NEEDS CLARIFICATION markers remain.
