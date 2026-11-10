# Tasks: Customer Recording Library

**Input**: Design documents from `specs/001-customer-recording-library/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/components.md, contracts/storage.md

**Tests**: Not included — no TDD requirement in spec; V1 dashboard test norms per project.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies on in-progress tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- All file paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directory scaffold for all new files in this feature.

- [x] T001 Create directories `src/lib/library/`, `src/components/library/`, and `src/app/customer/[id]/library/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pure utilities and types that every user story depends on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: All subsequent phases depend on this foundation.

- [x] T00 Create `src/lib/library/recording-utils.ts` with types (`Recording`, `RecordingUrlType`, `LessonTypeOption`, `FilterState`) and implement `snapshotSessionsToRecordings()`, `detectUrlType()`, and `uniqueLessonTypes()` — see contracts/components.md for signatures and data-model.md for field mappings
- [x] T00 Add `vimeoEmbedUrl()` and `applyFilters()` to `src/lib/library/recording-utils.ts` — `applyFilters` applies search, lesson-type, and date-range filters simultaneously; see data-model.md Validation Rules for filter logic

**Checkpoint**: `recording-utils.ts` is complete — all downstream components can now import types and helpers.

---

## Phase 3: User Story 1 — Browse the Recording Library (Priority: P1) 🎯 MVP

**Goal**: A customer navigates to `/customer/[id]/library` from the sidebar and sees a scrollable list of their past sessions that have recordings, each showing event name, lesson type, and date. Empty state shown when no recordings exist.

**Independent Test**: Load `http://localhost:3040/customer/10001/library` — confirm a recording list appears with event name, lesson type, and date per card. Load `http://localhost:3040/customer/10002/library` (no recordings) — confirm empty-state message, no errors.

- [x] T00 [P] [US1] Create `src/components/library/LibraryEmptyState.tsx` — presentational component accepting `variant: 'no-recordings' | 'no-results'` and optional `onClearFilters` callback; render only the `no-recordings` variant for now
- [x] T00 [P] [US1] Create `src/components/library/RecordingCard.tsx` — client component displaying event name, lesson type (or em-dash if null), and session date formatted in `displayTimezone` matching the `fmtDateTime` pattern in `src/app/customer/[id]/page.tsx`; accepts `recording: Recording`, `displayTimezone: string`, and `onPlay: (recording: Recording) => void`; no reviewed state yet
- [x] T00 [P] [US1] Add "Recording Library" nav item (with `Library` icon from lucide-react, or `Film` if `Library` is unavailable) to the `items` array in `src/components/Sidebar.tsx` at position after "Fast Feedback", linking to `` `${base}/library` ``
- [x] T00 [US1] Create `src/components/library/RecordingLibrary.tsx` as a `'use client'` component accepting `customerId: string`, `recordings: Recording[]`, `lessonTypes: LessonTypeOption[]`, `displayTimezone: string`; render `<LibraryEmptyState variant="no-recordings">` when `recordings.length === 0`, otherwise render a list of `<RecordingCard>` with an `onPlay` stub (console.log for now); no filter controls yet
- [x] T00 [US1] Create `src/app/customer/[id]/library/page.tsx` as a server component; call `fetchSnapshot(params.id)` (deduped by React `cache()`), derive `recordings` via `snapshotSessionsToRecordings` and `lessonTypes` via `uniqueLessonTypes`, render `<RecordingLibrary>` with those props; follow the `try/catch → notFound()` pattern from `src/app/customer/[id]/page.tsx`

**Checkpoint**: US1 fully functional — sidebar link appears, library page loads, recording list renders, empty state works for customer 10002.

---

## Phase 4: User Story 2 — Filter and Search Recordings (Priority: P2)

**Goal**: Customer can narrow the recording list using a text search (event name), a lesson-type dropdown, and a date-range picker. Filters combine and update the list in real time. A "no results" empty state appears when filters match nothing, with a "Clear filters" action.

**Independent Test**: On `customer/10001/library`, type a partial event name — list filters instantly. Select a lesson type — list narrows. Set a date range — list narrows further. Apply filters that match nothing — no-results message appears with "Clear filters" button. Click it — full list restores.

- [x] T00 [P] [US2] Create `src/components/library/LibraryFilters.tsx` as a `'use client'` component accepting `filters: FilterState`, `lessonTypes: LessonTypeOption[]`, `onChange: (filters: FilterState) => void`, `onClear: () => void`, `hasActiveFilters: boolean`; render a text input (search), a `<select>` for lesson type, and two `<input type="date">` for from/to range; call `onChange` on every change
- [x] T01 [P] [US2] Update `src/components/library/LibraryEmptyState.tsx` to support the `no-results` variant — show a "no recordings match your filters" message and a "Clear filters" button that calls `onClearFilters`
- [x] T01 [US2] Update `src/components/library/RecordingLibrary.tsx` to add `FilterState` with `DEFAULT_FILTER_STATE`, call `applyFilters(recordings, filters, displayTimezone)` to derive the visible list, render `<LibraryFilters>` above the list, and show `<LibraryEmptyState variant="no-results">` when the filtered list is empty but `recordings.length > 0`

**Checkpoint**: US2 fully functional — all three filter controls work, combined filtering works, no-results state appears and clears correctly.

---

## Phase 5: User Story 3 — Play a Recording (Priority: P2)

**Goal**: Clicking a recording opens an in-app player. Direct mp4 URLs use a native video player. Vimeo URLs use an embedded iframe player. Zoom URLs show an info panel with an "Open in Zoom" link. Broken/unknown URLs show an error state, never a blank screen.

**Independent Test**: Click each URL type in turn — confirm correct player/panel renders. Test with a deliberately broken URL — confirm error state appears with no crash.

- [x] T01 [P] [US3] Create `src/components/library/RecordingPlayer.tsx` as a `'use client'` component accepting `recording: Recording`, `customerId: string`, `onClose: () => void`; implement the `mp4` branch using a native `<video controls src={recordingUrl}>` element inside a modal/overlay with a close button and the recording's event name as title
- [x] T01 [US3] Add the `vimeo` branch to `src/components/library/RecordingPlayer.tsx` — render `<iframe src={vimeoEmbedUrl(recording.recordingUrl)} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen>` with appropriate aspect-ratio wrapper; import `vimeoEmbedUrl` from `src/lib/library/recording-utils.ts`
- [x] T01 [US3] Add the `zoom` branch to `src/components/library/RecordingPlayer.tsx` — render an info panel explaining the recording is hosted in Zoom with a prominent `<a href={recordingUrl} target="_blank" rel="noopener noreferrer">Open Recording in Zoom</a>` link styled with Academy accent color
- [x] T01 [US3] Add the `unknown` URL type branch to `src/components/library/RecordingPlayer.tsx` — render an error state ("This recording format isn't supported") with a fallback direct link to the URL; also add an `onError` handler to the `<video>` element that switches to an error state when the mp4 src fails to load
- [x] T01 [US3] Update `src/components/library/RecordingLibrary.tsx` to add `activeRecording: Recording | null` state; pass a real `onPlay` handler to `<RecordingCard>` that sets `activeRecording`; render `<RecordingPlayer recording={activeRecording} customerId={customerId} onClose={() => setActiveRecording(null)}>` when `activeRecording` is non-null

**Checkpoint**: US3 fully functional — all four player branches render correctly; closing the player returns to the list.

---

## Phase 6: User Story 4 — Resume Where You Left Off (Priority: P3)

**Goal**: When a customer reopens a recording they previously started watching, playback resumes near their saved position. New recordings start from zero. Completed recordings (watched to within 10 s of the end) restart from zero.

**Independent Test**: Play an mp4 recording past the 5-second mark, navigate away, return and reopen — playback resumes near the saved position. Open a never-watched recording — starts at 0:00. Open a fully-watched recording — starts at 0:00.

- [x] T01 [US4] Create `src/lib/library/use-library-storage.ts` with `useLibraryStorage(customerId: string)` hook; implement `getPosition(sessionId)` and `setPosition(sessionId, positionSeconds)` using the key pattern `academy:pos:{customerId}:{sessionId}`; guard all `localStorage` access with `typeof window !== 'undefined'`; swallow `SecurityError` silently (private browsing)
- [x] T01 [US4] Update `src/components/library/RecordingPlayer.tsx` to call `useLibraryStorage(customerId)` and on mp4 video mount set `video.currentTime` to the stored position (applying the "completed" threshold: if `storedPosition >= duration - 10` start at 0); save position via `setPosition` on `timeupdate` (throttled to once per 5 seconds) and on `window.addEventListener('beforeunload', ...)`

**Checkpoint**: US4 fully functional — resume works for mp4 recordings; Vimeo and Zoom are unaffected (position not tracked for those types).

---

## Phase 7: User Story 5 — Mark a Recording as Reviewed (Priority: P3)

**Goal**: A customer can mark any recording as reviewed. The card looks visually different (badge or checkmark). The state persists across page reloads. The customer can toggle reviewed off.

**Independent Test**: Mark a recording reviewed — card shows reviewed indicator. Hard-reload — indicator persists. Click again — indicator disappears. Reload — indicator gone.

- [x] T01 [US5] Add `isReviewed(sessionId)` and `setReviewed(sessionId, reviewed)` to `src/lib/library/use-library-storage.ts` using key pattern `academy:reviewed:{customerId}:{sessionId}`; same `typeof window` SSR guard and silent `SecurityError` handling as position methods
- [x] T02 [US5] Update `src/components/library/RecordingCard.tsx` to call `useLibraryStorage(customerId)`, read `isReviewed(recording.sessionId)`, render a visual reviewed indicator (e.g., a green checkmark badge or `opacity-50` + "Reviewed" label in the card's top-right corner), and add a toggle button that calls `setReviewed(recording.sessionId, !isReviewed)`; reviewed cards should be visually distinct but not hidden

**Checkpoint**: US5 fully functional — reviewed state toggles, persists on reload, and is visually clear in the list.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Ensure consistency, mobile usability, and end-to-end validation across all stories.

- [x] T02 [P] Audit date formatting in `src/components/library/RecordingCard.tsx` — confirm `event_start_time` is rendered in `displayTimezone` (not the browser's local timezone), using the same `Intl.DateTimeFormat` / `toLocaleString` options as `fmtDateTime` in `src/app/customer/[id]/page.tsx`
- [x] T02 [P] Mobile layout audit — open the library page at 375 px viewport width in browser devtools; verify the recording list, filter controls, player modal/overlay, and reviewed badges all render without horizontal overflow or broken layouts; adjust Tailwind classes as needed
- [x] T02 Run through all 13 validation scenarios in `specs/001-customer-recording-library/quickstart.md` against the running dev server (`npm run dev`) and confirm each passes; document any discrepancies

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — **T007 and T008 require T004 and T005 to exist first**
- **US2 (Phase 4)**: Depends on Phase 3 — filters are wired into `RecordingLibrary`
- **US3 (Phase 5)**: Depends on Phase 3 — `RecordingPlayer` is wired into `RecordingLibrary`
- **US4 (Phase 6)**: Depends on Phase 5 — position wired into `RecordingPlayer`
- **US5 (Phase 7)**: Depends on Phase 3 — reviewed state wired into `RecordingCard`; can start after Phase 3 in parallel with Phases 4–6
- **Polish (Phase 8)**: Depends on all desired user stories complete

### User Story Dependencies

| Story | Depends On | Can Start After |
|---|---|---|
| US1 (P1) | Phase 2 complete | T003 done |
| US2 (P2) | US1 complete | T008 done |
| US3 (P2) | US1 complete | T008 done — parallel with US2 |
| US4 (P3) | US3 complete | T016 done |
| US5 (P3) | US1 complete | T008 done — parallel with US2/US3 |

### Within Each Phase

- Tasks marked `[P]` reference different files and can be dispatched simultaneously
- Sequential tasks (no `[P]`) within a phase must complete in listed order
- Phase 3: run T004, T005, T006 in parallel → then T007 → then T008
- Phase 4: run T009, T010 in parallel → then T011
- Phase 5: T012 → T013 → T014 → T015 (sequential, same file) → T016

### Parallel Opportunities

```bash
# Phase 3 — launch together:
T004  src/components/library/LibraryEmptyState.tsx
T005  src/components/library/RecordingCard.tsx
T006  src/components/Sidebar.tsx

# Phase 4 — launch together:
T009  src/components/library/LibraryFilters.tsx
T010  src/components/library/LibraryEmptyState.tsx (no-results variant)

# Phase 5 — T012 parallel with Phase 4 completion:
T012  src/components/library/RecordingPlayer.tsx (mp4 base)

# Phase 7 — parallel with Phases 4 and 5:
T019  src/lib/library/use-library-storage.ts (reviewed methods)
T020  src/components/library/RecordingCard.tsx (reviewed UI)

# Phase 8 — launch together:
T021  RecordingCard.tsx timezone audit
T022  Mobile layout audit
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (`recording-utils.ts`) — **do not skip**
3. Complete Phase 3: US1 (list page, sidebar, empty state)
4. **STOP and VALIDATE**: Confirm recording list loads for customer 10001, empty state for 10002
5. Ship/demo — customers can browse their recordings

### Incremental Delivery

1. Setup + Foundational → `recording-utils.ts` ready
2. Add US1 → browse list works → **MVP shippable**
3. Add US2 → filters work → better UX for heavy users (461 sessions)
4. Add US3 → playback works → **core value unlocked**
5. Add US4 → resume position → polish
6. Add US5 → reviewed state → polish
7. Polish phase → mobile, timezone, full quickstart validation

### Parallel Team Strategy (if two developers)

After Phase 2:
- Developer A: US1 → US2 (list + filters)
- Developer B: US3 → US4 (player + position)
- US5 (reviewed state) can be picked up by either after Phase 3

---

## Notes

- `[P]` tasks operate on different files — no merge conflicts when run in parallel
- `src/lib/core-api.ts` is `server-only` — never import it from any `'use client'` component
- `fetchSnapshot` is already wrapped in React `cache()` — the layout and the library page both call it; only one network request fires per render pass
- All date display must use `displayTimezone` from the snapshot, not `new Date().toLocaleString()` without a timezone
- No new npm packages — use native `<video>`, `<iframe>`, and `<a>` elements
- `localStorage` writes must be wrapped in try/catch to handle `SecurityError` in private browsing
