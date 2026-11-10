# Phase 1 Data Model: Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign

**Branch**: `021-staff-students-submissions-tiers-ui` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

**No new tables or columns.** Staff Dashboard reuses specs/018/020's shapes verbatim. Tiers reads
and writes shapes that already exist, unchanged. The two shapes below are the only new
computation in this feature.

## Students Stat Snapshot *(computed, not stored)*

| Field | Type | Source |
|---|---|---|
| `totalStudents` | number | `listCustomerProfiles().length` |
| `newThisMonth` | number | Count of `customer_profiles` with `createdAt` in the current calendar month (research.md #4) |
| `activeThisWeek` | number | The existing total active-student count — labeled per the mockup, not a true 7-day figure (research.md #4, spec.md Assumptions) |
| `avgCompletion` | `null` | Always "—" — no real aggregate exists (research.md #4) |

## Submission Row *(existing `SubmissionRecord`, new field)*

| Field | Type | Source |
|---|---|---|
| ...existing fields | — | `SubmissionRecord` (`src/lib/progress/submissions.ts`), unchanged |
| `isPriority` | boolean | Computed: `status === 'pending' && now - submittedAt > 24h` (research.md #5) |

## Everything else — unchanged shapes, new presentation only

- **Staff Profile** (Story 2): `StaffProfile` (`src/lib/auth/staff-profile.ts`) — no shape change.
- **Student Profile** (Story 3 list): `StudentProfile` (`src/lib/auth/customer-profile.ts`) — no shape change.
- **Tier** (Story 5): `Tier` (`src/lib/courses/tier-actions.ts`) — no shape change.
