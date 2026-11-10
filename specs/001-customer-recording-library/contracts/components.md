# Component Contracts: Customer Recording Library

**Phase**: 1 | **Date**: 2026-06-08

All types reference entities defined in [data-model.md](../data-model.md).

---

## `library/page.tsx` (Server Component)

**Responsibility**: Fetch snapshot, derive `recordings` and `lessonTypes`, render `<RecordingLibrary>`.

```typescript
// Props (Next.js page convention)
interface PageProps {
  params: { id: string }; // customer ID from route
}

// Renders:
<RecordingLibrary
  customerId={params.id}
  recordings={Recording[]}
  lessonTypes={LessonTypeOption[]}
  displayTimezone={string}
/>
```

**Error handling**: Delegates to the existing `customer/[id]/error.tsx` boundary. Throws `CoreApiError` on 404 → `notFound()`.

---

## `<RecordingLibrary>` (Client Component)

**File**: `src/components/library/RecordingLibrary.tsx`

**Responsibility**: Own filter state, derive filtered list, render `<LibraryFilters>`, recording list, and `<RecordingPlayer>` modal/panel.

```typescript
interface RecordingLibraryProps {
  customerId: string;
  recordings: Recording[];
  lessonTypes: LessonTypeOption[];
  displayTimezone: string;
}
```

**Internal state**:
- `filters: FilterState` — current filter values
- `activeRecording: Recording | null` — which recording is open in the player

**Renders**:
- `<LibraryFilters>` (always)
- Recording count + list (when filtered results exist)
- `<RecordingCard>` per filtered recording
- `<LibraryEmptyState variant="no-recordings">` when `recordings.length === 0`
- `<LibraryEmptyState variant="no-results" onClearFilters={...}>` when filtered list is empty but recordings exist
- `<RecordingPlayer>` when `activeRecording !== null`

---

## `<LibraryFilters>` (Client Component)

**File**: `src/components/library/LibraryFilters.tsx`

**Responsibility**: Render search input, lesson-type select, date-from/date-to inputs. Calls `onChange` on every change.

```typescript
interface LibraryFiltersProps {
  filters: FilterState;
  lessonTypes: LessonTypeOption[];
  onChange: (filters: FilterState) => void;
  onClear: () => void;
  hasActiveFilters: boolean; // controls visibility of "Clear filters" button
}
```

---

## `<RecordingCard>` (Client Component)

**File**: `src/components/library/RecordingCard.tsx`

**Responsibility**: Display one recording in the list. Show event name, lesson type, date. Show reviewed badge. Handle "mark reviewed" toggle. Call `onPlay` when clicked.

```typescript
interface RecordingCardProps {
  recording: Recording;
  customerId: string;
  displayTimezone: string;
  onPlay: (recording: Recording) => void;
}
```

**Internal state**: none — reads reviewed state from `useLibraryStorage(customerId)`, calls its `setReviewed` action.

---

## `<RecordingPlayer>` (Client Component)

**File**: `src/components/library/RecordingPlayer.tsx`

**Responsibility**: Render the correct player for the recording's `urlType`. Save/restore position. Show broken-URL error state. Provide a close/back action.

```typescript
interface RecordingPlayerProps {
  recording: Recording;
  customerId: string;
  onClose: () => void;
}
```

**URL type dispatch**:
| `urlType` | Rendered element |
|---|---|
| `'mp4'` | `<video controls src={recordingUrl}>` with `onTimeUpdate` + `onLoadedMetadata` |
| `'vimeo'` | `<iframe src={vimeoEmbedUrl(recordingUrl)} allow="autoplay; fullscreen">` |
| `'zoom'` | Info panel + `<a href={recordingUrl} target="_blank">Open in Zoom</a>` |
| `'unknown'` | Error state: "This recording format is not supported. Try opening directly." + link |

**Position save**: For `mp4` only — saves `positionSeconds` on `timeupdate` (throttled to once per 5 seconds) and on `beforeunload`.

---

## `<LibraryEmptyState>` (Presentational Component)

**File**: `src/components/library/LibraryEmptyState.tsx`

```typescript
interface LibraryEmptyStateProps {
  variant: 'no-recordings' | 'no-results';
  onClearFilters?: () => void; // required when variant === 'no-results'
}
```

---

## `useLibraryStorage` Hook

**File**: `src/lib/library/use-library-storage.ts`

**Responsibility**: Read and write playback position and reviewed state from `localStorage`. Returns stable action references (safe for use in `useEffect` dependency arrays).

```typescript
interface LibraryStorageActions {
  getPosition: (sessionId: number) => number; // returns 0 if not found
  setPosition: (sessionId: number, positionSeconds: number) => void;
  isReviewed: (sessionId: number) => boolean;
  setReviewed: (sessionId: number, reviewed: boolean) => void;
}

function useLibraryStorage(customerId: string): LibraryStorageActions
```

**SSR safety**: Guards every `localStorage` access with `typeof window !== 'undefined'` to prevent server-side render errors.

---

## `recording-utils.ts` (Pure Functions)

**File**: `src/lib/library/recording-utils.ts`

```typescript
// Transform + filter sessions to recordings
function snapshotSessionsToRecordings(sessions: SnapshotSession[]): Recording[]

// Detect URL type
function detectUrlType(url: string): RecordingUrlType

// Extract Vimeo embed URL from any Vimeo URL format
function vimeoEmbedUrl(url: string): string

// Derive unique lesson types for the filter dropdown
function uniqueLessonTypes(recordings: Recording[]): LessonTypeOption[]

// Apply all filters to a recording list
function applyFilters(recordings: Recording[], filters: FilterState, tz: string): Recording[]
```
