# Contract: Payload Collection Schemas

Registered in `payload.config.ts` alongside existing `Courses`, `CommunityPosts`, `Media`.

## Tiers (new — research.md #12)

```ts
export const Tiers: CollectionConfig = {
  slug: 'tiers',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'order', 'courseOwnerId'] },
  access: { read: () => true, create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user), delete: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'name', type: 'text', required: true }, // e.g. "White — Diaphragmatic Support" (FR-027)
    { name: 'description', type: 'richText', editor: lexicalEditor({}) },
    { name: 'order', type: 'number', required: true }, // rank within this Tier's owner's sequence (FR-027)
    {
      name: 'courseOwnerId',
      type: 'text',
      required: true,
      defaultValue: 'academy',
      admin: { description: 'Placeholder for future multi-tenant whitelisting (FR-028) — not a real tenancy system yet, see research.md #12' },
    },
  ],
  // uniqueness of `order` within a given `courseOwnerId` enforced in tier-actions.ts, not here (research.md #12)
};
```

## Courses (modified)

```ts
// collections/Courses.ts — add fields, keep existing fields as-is
{
  name: 'courseCategory',
  type: 'select',
  required: true,
  options: [
    { label: 'Sequential-Locked Course', value: 'sequential-locked' }, // renamed from 'Belt Course'/'belt' — research.md #12
    { label: 'Standalone Course', value: 'standalone' },
  ],
},
{
  name: 'tier', // renamed from 'beltLevel' — research.md #12
  type: 'relationship',
  relationTo: 'tiers',
  admin: { condition: (_, data) => data?.courseCategory === 'sequential-locked' },
  // required + uniqueness enforced in course-actions.ts (createCourse/updateCourse), not here —
  // Payload field-level `required`/`unique` would apply platform-wide, but Standalone Courses
  // have no tier at all (research.md #8, #12)
},
{
  name: 'courseOwnerId',
  type: 'text',
  required: true,
  defaultValue: 'academy',
  admin: { description: 'Placeholder for future multi-tenant whitelisting (FR-028) — see research.md #12' },
}
```

`access`: unchanged shape (`Boolean(req.user)`) is retained as a defense-in-depth safety net, but real authorization for coach writes happens in the calling server action (see `server-actions.md`) — see research.md #3.

## CourseModules (new)

```ts
export const CourseModules: CollectionConfig = {
  slug: 'course-modules',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'course', 'order'] },
  access: { read: () => true, create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user), delete: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'order', type: 'number', required: true },
  ],
};
```

## Lessons (new)

```ts
export const Lessons: CollectionConfig = {
  slug: 'lessons',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'module', 'contentType', 'order', 'isPublished'] },
  access: { read: () => true, create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user), delete: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'module', type: 'relationship', relationTo: 'course-modules', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'order', type: 'number', required: true },
    {
      name: 'contentType', type: 'select', required: true,
      options: [{ label: 'Video', value: 'video' }, { label: 'Audio', value: 'audio' }, { label: 'Text/Image', value: 'text-image' }],
    },
    { name: 'videoUrl', type: 'text', admin: { condition: (_, data) => data?.contentType === 'video' } },
    { name: 'audioUrl', type: 'text', admin: { condition: (_, data) => data?.contentType === 'audio' } },
    { name: 'body', type: 'richText', editor: lexicalEditor({}), admin: { condition: (_, data) => data?.contentType === 'text-image' } },
    { name: 'isPublished', type: 'checkbox', defaultValue: false }, // FR-019
  ],
};
```

## Assignments (new)

```ts
export const Assignments: CollectionConfig = {
  slug: 'assignments',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'type', 'attachedToLesson', 'attachedToModule', 'course'] },
  access: { read: () => true, create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user), delete: ({ req }) => Boolean(req.user) },
  fields: [
    {
      name: 'type', type: 'select', required: true,
      options: [
        { label: 'Video Response', value: 'video-response' },
        { label: 'Quiz', value: 'quiz' },
        { label: 'Final Assessment', value: 'final-assessment' },
      ],
    },
    { name: 'attachedToLesson', type: 'relationship', relationTo: 'lessons' },
    { name: 'attachedToModule', type: 'relationship', relationTo: 'course-modules' },
    { name: 'course', type: 'relationship', relationTo: 'courses', admin: { condition: (_, data) => data?.type === 'final-assessment' } },
    { name: 'title', type: 'text', required: true },
    { name: 'instructions', type: 'richText', editor: lexicalEditor({}) },
  ],
  // Enforced in course-actions.ts, not here (Payload's declarative validation doesn't cover cross-field conditionals):
  // - at most one `final-assessment`-type Assignment per `course`, and only for `sequential-locked`-category Courses (research.md #6)
  // - exactly one of attachedToLesson/attachedToModule set for video-response/quiz types; course (only) set for final-assessment (research.md #11, finding U2)
};
```

## QuizQuestions (new)

```ts
export const QuizQuestions: CollectionConfig = {
  slug: 'quiz-questions',
  admin: { useAsTitle: 'prompt', defaultColumns: ['prompt', 'assignment', 'order', 'questionType'] },
  access: { read: () => true, create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user), delete: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'assignment', type: 'relationship', relationTo: 'assignments', required: true },
    { name: 'order', type: 'number', required: true },
    { name: 'questionType', type: 'select', required: true, options: [{ label: 'Multiple Choice', value: 'multiple-choice' }, { label: 'Open Ended', value: 'open-ended' }] },
    { name: 'prompt', type: 'text', required: true },
    { name: 'options', type: 'array', fields: [{ name: 'label', type: 'text' }], admin: { condition: (_, data) => data?.questionType === 'multiple-choice' } },
    { name: 'correctOptionIndex', type: 'number', admin: { condition: (_, data) => data?.questionType === 'multiple-choice' } },
    { name: 'required', type: 'checkbox', defaultValue: true },
  ],
};
```

## payload.config.ts changes

```ts
import { s3Storage } from '@payloadcms/storage-s3';
// ...
plugins: [
  s3Storage({
    collections: { media: true },
    bucket: process.env.MINIO_BUCKET!,
    config: {
      endpoint: process.env.MINIO_ENDPOINT!,
      region: process.env.MINIO_REGION ?? 'us-east-1',
      credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY!, secretAccessKey: process.env.MINIO_SECRET_KEY! },
      forcePathStyle: true, // required for MinIO
    },
  }),
],
collections: [Courses, Tiers, CourseModules, Lessons, Assignments, QuizQuestions, CommunityPosts, Media],
```
