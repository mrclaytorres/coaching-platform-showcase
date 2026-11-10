# Contract: Payload Collection/Global Changes

**Branch**: `015-expanded-payments` | **Date**: 2026-09-01

## `collections/Tiers.ts` — add `priceCents`, `isForSale`

Same shape and admin-description convention as `Courses.priceCents`/`Courses.isForSale` (006-course-sales-payments). No changes to existing fields (`name`, `description`, `order`, `courseOwnerId`).

## `collections/Lessons.ts` — add `priceCents`, `isForSale`

Same shape as above. `isForSale` admin description must call out that it's independent of the parent Course's own listing (data-model.md). No changes to existing fields.

## New Global: `globals/SubscriptionPlan.ts`

```ts
import type { GlobalConfig } from 'payload';

export const SubscriptionPlan: GlobalConfig = {
  slug: 'subscription-plan',
  access: {
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'priceCents', type: 'number', min: 0 },
    {
      name: 'billingInterval',
      type: 'select',
      defaultValue: 'month',
      options: [
        { label: 'Monthly', value: 'month' },
        { label: 'Yearly', value: 'year' },
      ],
    },
    { name: 'isForSale', type: 'checkbox', defaultValue: false },
  ],
};
```

Registered in `payload.config.ts`'s `globals` array (new — this is the first Payload Global in the codebase; `collections` array is unaffected).

## Access pattern (unchanged convention from 004/006)

Payload's own `access` functions stay permissive (`Boolean(req.user)`) — real staff-role authorization continues to be enforced in the Next.js server-action layer (`requireStaffRole`), not in Payload, per 004-course-lesson-management's established research decision.
