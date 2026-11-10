import type { SlotStore } from './slot-store.ts';

// Atomic capacity claim: read the slot, then write with a compare-and-swap on the count we just
// read. If a concurrent booking changed the count between the read and the write, the write
// matches zero rows and we retry. Two students can never both take the last seat.
//
// The query builder can't express a same-row comparison (`confirmed_count < capacity`) as one
// filter, so the CAS on the read value gives the same guarantee.

const MAX_ATTEMPTS = 3;

export async function claimSlotCapacity(store: SlotStore, slotId: string): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const slot = await store.getSlot(slotId);
    if (!slot || slot.status !== 'open' || slot.confirmedCount >= slot.capacity) return false;

    if (await store.compareAndSetCount(slotId, slot.confirmedCount, slot.confirmedCount + 1)) {
      return true;
    }
    // Lost the race; re-read and try again.
  }
  return false;
}

// Gives a seat back. Used for cancellations and to undo a claim when a later step fails.
export async function releaseSlotCapacity(store: SlotStore, slotId: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const slot = await store.getSlot(slotId);
    if (!slot || slot.confirmedCount <= 0) return;

    if (await store.compareAndSetCount(slotId, slot.confirmedCount, slot.confirmedCount - 1)) {
      return;
    }
  }
}
