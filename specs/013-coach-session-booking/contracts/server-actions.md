# Contract: Server Actions / Library Functions

Function signatures this feature adds. Follows the existing convention (`src/lib/courses/course-actions.ts`, `src/lib/progress/submissions.ts`): plain async functions, `requireStaffRole`/`requireCustomerProfile` for auth, thin `'use server'` page-level actions that call these and `redirect()`/`revalidatePath()`.

## `src/lib/booking/booking-events.ts` *(Payload — mirrors `course-actions.ts`)*

```ts
async function createBookingEvent(input: {
  title: string;
  description?: string;
  durationMinutes: number;
  eventType: 'one-on-one' | 'group';
  capacity?: number;          // required & >=1 when eventType='group'; ignored for one-on-one (FR-003)
  coachId: string;            // staff_profiles.id
  restrictedTierIds?: string[]; // FR-019
}): Promise<{ id: string }>;
// requireStaffRole(['super_admin','staff','coach']) — FR-001, FR-016

async function updateBookingEvent(
  eventId: string,
  updates: Partial<{ title: string; description: string; durationMinutes: number; capacity: number; restrictedTierIds: string[] }>,
): Promise<void>;
// requireStaffRole(['super_admin','staff','coach'])

async function setBookingEventPublished(eventId: string, isPublished: boolean): Promise<void>;
// requireStaffRole(['super_admin','staff','coach']) — FR-005

async function listOwnedBookingEvents(): Promise<BookingEventSummary[]>;
// requireStaffRole(['super_admin','staff','coach']) — FR-015; "owned" = all events, not filtered by
// coachId (research.md #9) — every staff/coach account sees every event, same as Courses/Assignments

async function listBookableEvents(studentId: string): Promise<BookingEventSummary[]>;
// requireCustomerProfile() — FR-006; filters to isPublished=true AND
// (restrictedTiers is empty OR student's current_tier_rank >= at least one restrictedTiers[].order)
// per research.md #4
```

## `src/lib/booking/time-slots.ts` *(Supabase)*

```ts
async function addTimeSlot(input: { bookingEventId: string; startTime: string; capacity: number }): Promise<{ id: string }>;
// requireStaffRole(['super_admin','staff','coach']) — FR-002; rejects startTime <= now() (FR-004)

async function cancelTimeSlot(slotId: string): Promise<void>;
// requireStaffRole(['super_admin','staff','coach']) — FR-014; sets status='canceled', cascades
// bookings.status='canceled' for every confirmed Booking on this slot, triggers a cancellation
// email per affected Booking (FR-023)

async function listSlotsForEvent(bookingEventId: string): Promise<TimeSlotWithRoster[]>;
// requireStaffRole(['super_admin','staff','coach']) — FR-013, FR-015; includes each slot's
// confirmed Bookings joined to customer_profiles for display name/email

async function listOpenSlotsForEvent(bookingEventId: string, studentId: string): Promise<TimeSlotAvailability[]>;
// requireCustomerProfile() — FR-006; excludes canceled slots and slots at confirmed_count=capacity;
// annotates whether this Student already holds a confirmed Booking on each slot
```

## `src/lib/booking/bookings.ts` *(Supabase — the concurrency-sensitive core, research.md #3/#5)*

```ts
type BookSlotResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: 'slot-full' | 'already-booked' | 'overlapping-booking' | 'not-eligible-tier' };

async function bookSlot(studentId: string, timeSlotId: string): Promise<BookSlotResult>;
// requireCustomerProfile() — FR-007. Order of checks:
//   1. Tier eligibility (research.md #4) — cheap, no write yet
//   2. Overlap check against Student's other confirmed Bookings (research.md #5)
//   3. Atomic capacity claim: UPDATE booking_time_slots SET confirmed_count = confirmed_count + 1
//      WHERE id = $1 AND confirmed_count < capacity AND status = 'open' RETURNING id (FR-008, FR-010)
//   4. INSERT bookings (...) — UNIQUE(time_slot_id, student_id) catches a duplicate booking attempt;
//      on that failure, compensate: decrement confirmed_count back down (research.md #3)
//   5. Fire-and-log confirmation email (FR-022) — never throws back to the caller (FR-025)

async function cancelBooking(studentId: string, bookingId: string): Promise<void>;
// requireCustomerProfile() — FR-012; ownership check (bookingId must belong to studentId);
// sets status='canceled', decrements the slot's confirmed_count, fires cancellation email (FR-023)

async function listStudentBookings(studentId: string): Promise<BookingWithEventInfo[]>;
// requireCustomerProfile() — FR-011; joins Time Slot start_time + Booking Event title/coachId
// (Payload lookup per distinct event, batched)
```

## `src/lib/booking/notifications.ts` *(Resend wrapper, research.md #6/#8)*

```ts
async function sendBookingConfirmation(booking: BookingWithEventInfo, student: StudentProfile): Promise<void>;
async function sendBookingCancellation(booking: BookingWithEventInfo, student: StudentProfile): Promise<void>;
async function sendBookingReminder(booking: BookingWithEventInfo, student: StudentProfile): Promise<void>;
// Each: try { await resend.emails.send({...}) } catch (err) { await logNotificationFailure(...) }
// — never throws to the caller (FR-025)

async function logNotificationFailure(
  bookingId: string,
  type: 'confirmation' | 'cancellation' | 'reminder',
  error: unknown,
): Promise<void>;
// Inserts into booking_notification_failures — best-effort, swallows its own errors too
```

## `src/app/api/booking/send-reminders/route.ts` *(Route Handler, research.md #7)*

```ts
// POST /api/booking/send-reminders
// Header: x-booking-cron-secret === process.env.BOOKING_REMINDER_CRON_SECRET, else 401
// Body: none
// Behavior: SELECT confirmed Bookings whose slot.start_time is within the next
//   BOOKING_REMINDER_WINDOW_HOURS (default 24) AND reminder_sent_at IS NULL, call
//   sendBookingReminder for each, stamp reminder_sent_at on success (FR-024)
// Response: { sent: number, failed: number }
```
