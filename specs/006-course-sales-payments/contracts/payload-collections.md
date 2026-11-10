# Contract: Payload Collection Changes

**Branch**: `006-course-sales-payments` | **Date**: 2026-07-28

Extends the existing `Courses` collection (`004-course-lesson-management`). No new Payload collections.

## Courses — new fields

```ts
// collections/Courses.ts — fields array, additive only
{
  name: 'priceCents',
  type: 'number',
  min: 0,
  admin: {
    description: 'Price in US cents (e.g. 4900 = $49.00). Required before this Course can be marked for sale.',
  },
},
{
  name: 'isForSale',
  type: 'checkbox',
  defaultValue: false,
  admin: {
    description: 'Publishes this Course\'s /courses/[slug] sales page. Independent of Draft/Published status — both must be set for the sales page to be reachable.',
  },
},
```

**Validation** (application layer — `course-actions.ts`, not a Payload-level hook, matching the existing Tier-uniqueness precedent): `setCoursePricing`/`updateCourse` rejects `isForSale: true` when `priceCents` is null/unset.

**Access control**: unchanged — Payload's own `Courses.access` rules stay as-is (`004-course-lesson-management` research.md #3: real authorization happens in the Next.js server action before Payload is ever called, not in Payload's own access functions).
