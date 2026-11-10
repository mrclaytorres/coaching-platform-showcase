# Contract: Public REST API

Every action the built-in UI performs is one of these endpoints (FR-029) — the UI is just
another caller, using the same auth as an external integration would (a session cookie for the
coach app, or an API key for a true external caller). All endpoints are versioned under `/api/v1`.

**Auth**: `Authorization: Bearer <api_key>` for external/API-key callers; the coach app's own
browser session (Supabase Auth cookie) for its own UI. A request authenticated by API key is
additionally scoped by that key's `is_read_only` flag (FR-030) — a read-only key gets `403` on
any write below.

**Rate limiting**: per API key and per source IP on the public (unauthenticated) submission
endpoints (FR-033) — exact limits are an implementation detail for `/speckit-tasks`, not fixed
here.

## Student submission flow (public — no API key required; a signed host-app JWT or nothing)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/submissions` | Start (or continue) a submission — creates `conversations`+`coach_submissions` rows (status `processing`). Body: contact info (per form config) or a signed identity JWT (FR-032), `formSlug`, submission `type`. **Multi-question forms** (post-launch addition, `SubmissionForm.questions`): the first call omits `conversationId`/`questionIndex` (question 0, a new conversation); every question after that supplies the `conversationId` the first response returned plus its own `questionIndex` — contact/consent/spam-check only happen once, on that first call. Response adds `questionIndex`, `totalQuestions`, `isFinalQuestion`; the receipt/alert notifications and `submission.created` webhook fire once, when `isFinalQuestion` is true, not per question. |
| `POST` | `/api/v1/submissions/:id/upload-url` | Returns a short-lived Mux direct-upload URL (FR-007). |
| `GET` | `/api/v1/submissions/:id` | Poll status (`processing`/`ready`/`failed`) — backs the "your question was sent" confirmation screen. |

## Conversations & replies (coach session or API key)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/conversations` | List, filterable by `status`, `assignedCoachId`, `search` (name/email/phone) — FR-012. Scoped by the coach-visibility setting for a coach-session caller. |
| `GET` | `/api/v1/conversations/:id` | Full thread — `submissions[]` (one per question, ordered by `questionIndex`; a single-question conversation still has exactly one) + all replies, chronological (FR-015). |
| `PATCH` | `/api/v1/conversations/:id` | `{ status, assignedCoachId }` — close/reopen/assign (FR-013/FR-014). |
| `DELETE` | `/api/v1/conversations/:id` | Soft-delete (data-model.md). |
| `POST` | `/api/v1/conversations/:id/notes` | Add an internal note (FR-014, staff-only, never in student-facing responses). |
| `POST` | `/api/v1/conversations/:id/replies` | Coach or student reply — same shape as a submission's `type`/upload-url flow, plus `authorType`. |

## Coaches & reporting

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/coaches` | Id → display name list (FR: "coach list"). |
| `GET` | `/api/v1/reports/durations` | Reply durations, filterable by `coachId`, `dateFrom`, `dateTo`; `Accept: text/csv` or `.../vnd.openxmlformats-...sheet` for export (FR-021). |
| `GET` | `/api/v1/students/:externalUserIdOrEmail/conversations` | Conversations/submissions by student (FR: "by student, email or external_user_id"). |

## Admin (Owner/Admin session only — never API-key-callable)

| Method | Path | Purpose |
|---|---|---|
| `POST` / `DELETE` | `/api/v1/api-keys` | Create (name, scope) / revoke. |
| `POST` | `/api/v1/staff/invite` | Invite by email (FR-025). |
| `PATCH` | `/api/v1/staff/:id` | Update roles / `isActive` (FR-026/FR-027 — server enforces last-Owner guard). |
| `GET` | `/api/v1/audit-log` | FR-028. |

Every write above also appends an `audit_log` row when it changes a form, setting, role, or API
key (FR-028) — the exact set of audited actions is enumerated at implementation time, not here.
