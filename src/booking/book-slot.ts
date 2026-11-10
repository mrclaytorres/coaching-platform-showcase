import { claimSlotCapacity, releaseSlotCapacity } from './capacity.ts';
import type { SlotStore } from './slot-store.ts';
import type { CreditsAdapter } from '../credits/credits-adapter.ts';

// Booking pipeline, ordered so cheap read-only checks run before the one contended write, and
// so every write after that has a compensating step:
//
//   1. eligibility check  (read only)
//   2. credit check       (read only, must run before any seat is claimed)
//   3. capacity claim     (the atomic guard)
//   4. booking insert     (on failure, release the seat)
//   5. credit debit       (on failure, cancel the booking and release the seat)
//   6. notification       (never throws; a failed email is logged, not surfaced)
//
// A booking is never left standing that was not paid for, and a seat is never held by a
// booking that doesn't exist.

export type BookResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: 'not-eligible' | 'no-credit' | 'credit-check-failed' | 'slot-full' | 'already-booked' };

export interface BookingRepo {
  // Throws AlreadyBookedError when the student already holds this slot (a unique constraint).
  insert(studentId: string, slotId: string): Promise<string>;
  cancel(bookingId: string): Promise<void>;
}

export class AlreadyBookedError extends Error {}

export interface BookingDeps {
  slots: SlotStore;
  bookings: BookingRepo;
  credits: CreditsAdapter;
  isEligible(studentId: string, slotId: string): Promise<boolean>;
  notify(bookingId: string): Promise<void>;
  log?(message: string, error: unknown): void;
}

export async function bookSlot(
  deps: BookingDeps,
  studentId: string,
  slotId: string,
  lessonTypeId: number | null,
): Promise<BookResult> {
  if (!(await deps.isEligible(studentId, slotId))) return { ok: false, reason: 'not-eligible' };

  if (lessonTypeId !== null) {
    let check: { available: boolean };
    try {
      check = await deps.credits.checkCredit(studentId, lessonTypeId);
    } catch {
      return { ok: false, reason: 'credit-check-failed' };
    }
    if (!check.available) return { ok: false, reason: 'no-credit' };
  }

  if (!(await claimSlotCapacity(deps.slots, slotId))) return { ok: false, reason: 'slot-full' };

  let bookingId: string;
  try {
    bookingId = await deps.bookings.insert(studentId, slotId);
  } catch (error) {
    await releaseSlotCapacity(deps.slots, slotId);
    if (error instanceof AlreadyBookedError) return { ok: false, reason: 'already-booked' };
    throw error;
  }

  if (lessonTypeId !== null) {
    try {
      await deps.credits.debitCredit(studentId, lessonTypeId, bookingId);
    } catch {
      // Soft-cancel rather than delete, so the audit trail keeps the attempt.
      await deps.bookings.cancel(bookingId);
      await releaseSlotCapacity(deps.slots, slotId);
      return { ok: false, reason: 'credit-check-failed' };
    }
  }

  try {
    await deps.notify(bookingId);
  } catch (error) {
    deps.log?.('booking confirmation email failed', error);
  }

  return { ok: true, bookingId };
}
