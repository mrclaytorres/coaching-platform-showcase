# Storage Contract: Customer Recording Library

**Phase**: 1 | **Date**: 2026-06-08

---

## localStorage Key Schema

All keys are prefixed with `academy:` to namespace them from other potential consumers.

### Playback Position

**Key pattern**: `academy:pos:{customerId}:{sessionId}`

**Value shape**:
```json
{
  "positionSeconds": 142.5,
  "updatedAt": "2026-06-08T14:30:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `positionSeconds` | `number` | Last known playback position in seconds |
| `updatedAt` | `string` | ISO 8601 timestamp of last save |

**Example key**: `academy:pos:10001:998`

**Write conditions**:
- Only written for `mp4` URL type (Vimeo position is best-effort via `beforeunload`)
- Only written when `positionSeconds > 5` (avoids saving accidental single-frame plays)
- Written on `timeupdate` (throttled: max once per 5 seconds) and on `window.beforeunload`

**Read conditions**: On player open. If key absent → start from 0. If `positionSeconds >= (videoDuration - 10)` → treat as completed, start from 0.

---

### Reviewed State

**Key pattern**: `academy:reviewed:{customerId}:{sessionId}`

**Value shape**:
```json
{
  "reviewed": true,
  "updatedAt": "2026-06-08T14:31:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `reviewed` | `boolean` | Whether the customer has marked this recording reviewed |
| `updatedAt` | `string` | ISO 8601 timestamp of last toggle |

**Example key**: `academy:reviewed:10001:998`

**Write conditions**: On every toggle (mark reviewed / un-review).

**Read conditions**: On `RecordingCard` render and on `RecordingLibrary` mount.

---

## Degradation Contract

If `localStorage` is unavailable (SecurityError in private browsing, quota exceeded, or storage disabled):

- All `getPosition` calls return `0`
- All `isReviewed` calls return `false`
- All write calls (`setPosition`, `setReviewed`) are silently swallowed — no thrown error
- The feature remains fully functional; state simply does not persist between visits
- No error message is shown to the user for storage unavailability (silent degradation)
