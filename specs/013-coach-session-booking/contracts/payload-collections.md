# Contract: Payload Collection Schema

Registered in `payload.config.ts` alongside existing `Courses`, `Tiers`, `Assignments`, `CourseModules`, `Lessons`, `QuizQuestions`, `CommunityPosts`.

## `booking-events` (new — data-model.md, research.md #2)

```ts
// collections/BookingEvents.ts
import type { CollectionConfig } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

export const BookingEvents: CollectionConfig = {
  slug: 'booking-events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'eventType', 'coachId', 'isPublished'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'richText', editor: lexicalEditor({}) },
    {
      name: 'durationMinutes',
      type: 'number',
      required: true,
      admin: { description: 'Used to compute each Time Slot\'s end time for overlap checks (FR-009).' },
    },
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        { label: '1-on-1', value: 'one-on-one' },
        { label: 'Group', value: 'group' },
      ],
    },
    {
      name: 'capacity',
      type: 'number',
      admin: {
        condition: (_, data) => data?.eventType === 'group',
        description: 'Max registrants per slot. Ignored/forced to 1 for one-on-one events — enforced in booking-events.ts, not here (FR-003).',
      },
    },
    {
      name: 'coachId',
      type: 'text',
      required: true,
      admin: {
        description: 'staff_profiles.id of the owning Staff/Coach — plain reference, not a Payload relationship, since Staff/Coach accounts live in Supabase, not a Payload Users collection (research.md #1/#9).',
      },
    },
    {
      name: 'restrictedTiers',
      type: 'relationship',
      relationTo: 'tiers',
      hasMany: true,
      admin: {
        description: 'Empty = open to all Students. Non-empty = only Students whose current Tier rank has reached at least one of these Tiers may book (FR-019–FR-021, research.md #4).',
      },
    },
    { name: 'isPublished', type: 'checkbox', defaultValue: false },
  ],
  // Cross-field invariants enforced in src/lib/booking/booking-events.ts, not here:
  // - capacity >= 1 when eventType = group (FR-003)
  // - only super_admin/staff/coach may create/update (FR-016) — requireStaffRole, same as createAssignment
};
```

## `payload.config.ts` (modified)

```ts
import { BookingEvents } from './collections/BookingEvents';
// ...
export default buildConfig({
  // ...
  collections: [
    Courses,
    CommunityPosts,
    Tiers,
    CourseModules,
    Lessons,
    Assignments,
    QuizQuestions,
    BookingEvents, // new
    Media,
  ],
  // ...
});
```

A migration (`npm run payload -- migrate:create add_booking_events`) is required after adding this collection, per the established `push: false` workflow (`docs/payload-setup.md`).
