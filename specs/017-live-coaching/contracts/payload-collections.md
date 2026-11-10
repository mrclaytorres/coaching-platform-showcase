# Contract: Payload Collection Extensions

**Branch**: `017-live-coaching` | **Date**: 2026-09-22

Extends the existing `collections/BookingEvents.ts` (013). Field-level rationale is in data-model.md's "Booking Event" section — this file is the concrete Payload field config to add, requiring a new migration (`payload migrate:create`) same as every prior collection change in this repo.

**Shipped in two passes**: `creditLessonTypeId` below landed with User Story 2, ahead of everything else here (which lands with US3's workshop fields) — 013's existing events needed no migration-time data backfill since the field defaults to null (free).

```ts
// User Story 2 (shipped) — one additive, nullable field, no change to any existing field.
{
  name: 'creditLessonTypeId',
  type: 'number',
  admin: {
    description:
      "Core's lesson_type_id this event debits/refunds against (research.md #5). Null = free, no credit check.",
  },
},

// User Story 3 (planned) — added/changed fields on the existing booking-events collection
// (013's original fields — title, description, durationMinutes, isPublished, restrictedTiers —
// are unchanged).

{
  name: 'eventType',
  type: 'select',
  required: true,
  options: ['one-on-one', 'group', 'workshop'], // was: ['one-on-one', 'group']
},
{
  name: 'coachIds', // replaces 013's single `coachId` text field
  type: 'array',
  required: true,
  minRows: 1,
  fields: [{ name: 'coachId', type: 'text', required: true }],
},
{
  name: 'pricingModel',
  type: 'select',
  required: true,
  defaultValue: 'credit',
  options: ['free', 'credit', 'paid'],
  admin: { condition: (data) => data.eventType === 'workshop' },
},
// Workshops reuse creditLessonTypeId above when pricingModel = 'credit' — no separate field.
{
  name: 'waitlistEnabled',
  type: 'checkbox',
  defaultValue: true,
  admin: { condition: (data) => data.eventType === 'workshop' },
},
{
  name: 'bookingQuestions',
  type: 'array',
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'required', type: 'checkbox', defaultValue: false },
  ],
},
{ name: 'minNoticeMinutes', type: 'number', defaultValue: 0 },
{ name: 'bookingHorizonDays', type: 'number', defaultValue: 60 },
{ name: 'startTimeIncrementMinutes', type: 'number', defaultValue: 15 },
{ name: 'bufferBeforeMinutes', type: 'number', defaultValue: 0 },
{ name: 'bufferAfterMinutes', type: 'number', defaultValue: 0 },
{ name: 'dailyLimit', type: 'number' },
{ name: 'weeklyLimit', type: 'number' },
{ name: 'monthlyLimit', type: 'number' },
{ name: 'cancellationCutoffMinutes', type: 'number', defaultValue: 1440 },
{ name: 'isHidden', type: 'checkbox', defaultValue: false },
{
  name: 'sessionCategory',
  type: 'select',
  required: true,
  options: ['one-on-one', 'group', 'workshop'],
  // Admin-only field-level access (FR-039) — enforced in access.update, not just admin.readOnly,
  // so a direct API write from a non-admin role is also rejected, not merely hidden in the UI.
  access: {
    update: ({ req }) => hasBookingRole(req.user, ['owner', 'admin']),
  },
},
{ name: 'notificationWorkflowId', type: 'text' }, // references Supabase notification_workflows.id
```

`hasBookingRole` is a new helper in `src/lib/booking/roles.ts` (Payload's `access` functions run server-side and can call arbitrary code, same pattern 013 already uses for its own Tier-restriction access checks).
