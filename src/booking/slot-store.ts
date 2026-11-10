// Storage interface for booking time slots. The production version sits on Postgres (via the
// Supabase client). The in-memory version below has the same compare-and-swap semantics, so
// the booking logic can be tested without a database.

export interface TimeSlot {
  id: string;
  capacity: number;
  confirmedCount: number;
  status: 'open' | 'canceled';
}

export interface SlotStore {
  getSlot(slotId: string): Promise<TimeSlot | null>;
  // Conditional update: sets confirmedCount to `next` only if it still equals `expected` and the
  // slot is still open. Returns false when another request changed the row first. In SQL:
  //   UPDATE time_slots SET confirmed_count = $next
  //   WHERE id = $id AND confirmed_count = $expected AND status = 'open'
  compareAndSetCount(slotId: string, expected: number, next: number): Promise<boolean>;
}

export class InMemorySlotStore implements SlotStore {
  private slots = new Map<string, TimeSlot>();

  constructor(slots: TimeSlot[] = []) {
    for (const slot of slots) this.slots.set(slot.id, { ...slot });
  }

  async getSlot(slotId: string): Promise<TimeSlot | null> {
    const slot = this.slots.get(slotId);
    return slot ? { ...slot } : null;
  }

  async compareAndSetCount(slotId: string, expected: number, next: number): Promise<boolean> {
    const slot = this.slots.get(slotId);
    if (!slot || slot.status !== 'open' || slot.confirmedCount !== expected) return false;
    slot.confirmedCount = next;
    return true;
  }
}
