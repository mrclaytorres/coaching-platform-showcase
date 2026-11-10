# Contract: Payload Collections & Globals

Authored/admin-managed content only (research.md #2) — real authorization for who can edit
these still happens in the Next.js layer (Designer role check), not Payload's own access
functions, matching this monorepo's established convention.

## `SubmissionForm` (collection)

One document per configurable submission form (a single default form is enough for launch —
collection, not a global, so a future multi-form setup — e.g. a form per coach specialty —
doesn't require a schema change).

| Field | Type | Notes |
|---|---|---|
| `slug` | text, unique | Used in the hosted/embed URL (`/ask/[slug]`) |
| `title` | text | |
| `introCopy` | richText | Shown when `questions` is empty (a single-question form) |
| `introVideoUrl` | text, optional | Plays before everything else, including the contact screen |
| `questions` | array, optional | VideoAsk-style "layers" — zero or more `{ prompt: text (required), videoUrl: text (optional) }`, asked in sequence, one recorded answer per question (`coach_submissions.question_index`/`question_prompt`, added post-launch). Empty (the default) keeps the original single-question flow — `introCopy` is the only prompt, no per-question intro screen. |
| `nameFieldMode` | select: `required` / `optional` / `hidden` | |
| `emailFieldMode` | select: `required` / `optional` / `hidden` | |
| `phoneFieldMode` | select: `required` / `optional` / `hidden` | |
| `maxRecordingSeconds` | number | Default 300 (5 min, spec's resolved default) |
| `isActive` | checkbox | |

## `NotificationTemplate` (collection)

One document per notification type — `type` is the effective unique key (student receipt,
coach/owner alert, student reply notification).

| Field | Type | Notes |
|---|---|---|
| `type` | select: `receipt` / `alert` / `reply`, unique | |
| `enabled` | checkbox | Per-type on/off toggle (FR-023) |
| `subject` | text | Supports `{{studentName}}`/`{{coachName}}`/`{{link}}` variables |
| `bodyHtml` | richText | Same variables |

## `Branding` (global)

Singleton — applied to the recorder, coach app, and email templates (FR-034).

| Field | Type | Notes |
|---|---|---|
| `primaryColor` | text (hex) | |
| `accentColor` | text (hex) | |
| `logoUrl` | text | |
| `fontFamily` | text | |
| `faviconUrl` | text | |

## `CoachVisibilitySetting` (global)

Singleton — the "coaches see all conversations vs. only assigned" toggle (FR-013), an
Admin-only setting rather than a per-form or per-coach one.

| Field | Type | Notes |
|---|---|---|
| `mode` | select: `all` / `assigned_only` | Default `all` — spec's resolved default |
