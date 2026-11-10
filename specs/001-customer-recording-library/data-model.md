# Data Model: Customer Recording Library

**Phase**: 1 | **Date**: 2026-06-08 | **Plan**: [plan.md](./plan.md)

---

## Source Data

The library derives all its data from `SnapshotSession[]` (defined in `src/lib/types.ts`). No new backend entities are created. The relevant fields are:

| Field | Type | Used For |
|---|---|---|
| `id` | `number` | Unique key for localStorage, dedup |
| `scheduled_event_name` | `string` | Display name, text search |
| `lesson_type_id` | `number \| null` | Lesson-type filter |
| `lesson_type_name` | `string \| null` | Lesson-type filter display |
| `event_start_time` | `string` (ISO 8601) | Date display, date-range filter |
| `recording_url` | `string \| null` | Playback; `null` entries are excluded |
| `is_past` | `boolean` | Only `true` entries are included |

---

## Derived Entity: `Recording`

A `Recording` is a `SnapshotSession` that has `is_past === true` AND `recording_url !== null`, enriched with a detected URL type. Produced by `recording-utils.ts`.

```typescript
type RecordingUrlType = 'mp4' | 'vimeo' | 'zoom' | 'unknown';

interface Recording {
  sessionId: number;           // from SnapshotSession.id
  eventName: string;           // from SnapshotSession.scheduled_event_name
  lessonTypeId: number | null; // from SnapshotSession.lesson_type_id
  lessonTypeName: string | null; // from SnapshotSession.lesson_type_name
  startTime: string;           // from SnapshotSession.event_start_time (ISO 8601)
  recordingUrl: string;        // guaranteed non-null at this point
  urlType: RecordingUrlType;   // derived by detectUrlType(recordingUrl)
}
```

**Derivation**: produced by `snapshotSessionsToRecordings(sessions: SnapshotSession[]): Recording[]` in `src/lib/library/recording-utils.ts`.

---

## Client State Entity: `FilterState`

Held in React `useState` inside `RecordingLibrary`. Resets on unmount.

```typescript
interface FilterState {
  search: string;           // free-text, matched against eventName (case-insensitive)
  lessonTypeId: number | null; // null = all lesson types
  dateFrom: string | null;  // ISO date string 'YYYY-MM-DD', inclusive
  dateTo: string | null;    // ISO date string 'YYYY-MM-DD', inclusive
}

const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  lessonTypeId: null,
  dateFrom: null,
  dateTo: null,
};
```

---

## Persisted Entity: `PlaybackState`

Stored in `localStorage`. One entry per (customerId, sessionId) pair.

```typescript
interface PlaybackState {
  positionSeconds: number; // last known playback position
  updatedAt: string;       // ISO 8601 — for future TTL / staleness checks
}
```

**localStorage key**: `academy:pos:{customerId}:{sessionId}`

**Example**: `academy:pos:10001:998` → `{"positionSeconds": 142.5, "updatedAt": "2026-06-08T14:30:00.000Z"}`

---

## Persisted Entity: `ReviewedState`

Stored in `localStorage`. One entry per (customerId, sessionId) pair.

```typescript
interface ReviewedState {
  reviewed: boolean;
  updatedAt: string; // ISO 8601
}
```

**localStorage key**: `academy:reviewed:{customerId}:{sessionId}`

**Example**: `academy:reviewed:10001:998` → `{"reviewed": true, "updatedAt": "2026-06-08T14:31:00.000Z"}`

---

## Derived Entity: `LessonTypeOption`

Used to populate the lesson-type filter dropdown. Derived from the `recordings` array — no separate API call.

```typescript
interface LessonTypeOption {
  id: number;
  name: string;
}
```

**Derivation**: `uniqueLessonTypes(recordings: Recording[]): LessonTypeOption[]` — filters out entries where `lessonTypeId` is null, deduplicates by `lessonTypeId`, sorts alphabetically by `name`.

---

## State Transitions

### Recording → Reviewed State

```
unreviewed (default)
    │
    ▼  customer clicks "Mark as reviewed"
 reviewed ──────────────────────────────────────── localStorage updated
    │
    ▼  customer clicks again (toggle off)
unreviewed ──────────────────────────────────────── localStorage updated
```

### Recording → Player State

```
list view
    │
    ▼  customer clicks recording card
 player open (position restored from localStorage, or 0)
    │         │
    │         ▼  user scrubs / plays
    │      position saved to localStorage on timeupdate (throttled)
    │
    ▼  customer closes player (or navigates away)
list view (reviewed state unchanged; position persists)
```

---

## Validation Rules

| Rule | Details |
|---|---|
| Recording inclusion | `session.is_past === true` AND `session.recording_url !== null` |
| Date filter | `startTime` date (in `display_timezone`) falls between `dateFrom` and `dateTo` inclusive |
| Text search | `eventName.toLowerCase().includes(search.toLowerCase())` |
| Position save threshold | Only save if `positionSeconds > 5` (avoid saving on accidental clicks) |
| Position resume threshold | If saved position ≥ `(duration - 10)`, start from 0 (treat as completed) |
