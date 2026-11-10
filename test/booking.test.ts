import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimSlotCapacity } from '../src/booking/capacity.ts';
import { InMemorySlotStore } from '../src/booking/slot-store.ts';
import { AlreadyBookedError, bookSlot, type BookingDeps, type BookingRepo } from '../src/booking/book-slot.ts';
import { InMemoryLedger, LedgerCreditsAdapter } from '../src/credits/credits-adapter.ts';

test('concurrent claims never exceed capacity', async () => {
  const store = new InMemorySlotStore([{ id: 'slot', capacity: 3, confirmedCount: 0, status: 'open' }]);
  const results = await Promise.all(Array.from({ length: 10 }, () => claimSlotCapacity(store, 'slot')));
  assert.equal(results.filter(Boolean).length, 3);
  assert.equal((await store.getSlot('slot'))?.confirmedCount, 3);
});

test('a canceled slot cannot be claimed', async () => {
  const store = new InMemorySlotStore([{ id: 'slot', capacity: 3, confirmedCount: 0, status: 'canceled' }]);
  assert.equal(await claimSlotCapacity(store, 'slot'), false);
});

function setup(options: { balance: number; failDebit?: boolean; existing?: string[] }) {
  const slots = new InMemorySlotStore([{ id: 'slot', capacity: 1, confirmedCount: 0, status: 'open' }]);
  const ledger = new InMemoryLedger();
  const canceled: string[] = [];
  const booked = new Set(options.existing ?? []);
  let nextId = 1;

  const bookings: BookingRepo = {
    async insert(studentId, slotId) {
      const key = `${studentId}:${slotId}`;
      if (booked.has(key)) throw new AlreadyBookedError();
      booked.add(key);
      return `booking-${nextId++}`;
    },
    async cancel(bookingId) {
      canceled.push(bookingId);
    },
  };

  const credits = new LedgerCreditsAdapter({ getBalance: async () => options.balance }, ledger);
  if (options.failDebit) credits.debitCredit = async () => { throw new Error('ledger down'); };

  const deps: BookingDeps = {
    slots,
    bookings,
    credits,
    isEligible: async () => true,
    notify: async () => { throw new Error('email provider down'); },
  };
  return { deps, slots, ledger, canceled };
}

test('successful booking debits one credit even if the email fails', async () => {
  const { deps, ledger, slots } = setup({ balance: 1 });
  const result = await bookSlot(deps, 'student', 'slot', 10);
  assert.equal(result.ok, true);
  assert.equal(ledger.entries.length, 1);
  assert.equal((await slots.getSlot('slot'))?.confirmedCount, 1);
});

test('no credit means no seat is claimed', async () => {
  const { deps, slots } = setup({ balance: 0 });
  assert.deepEqual(await bookSlot(deps, 'student', 'slot', 10), { ok: false, reason: 'no-credit' });
  assert.equal((await slots.getSlot('slot'))?.confirmedCount, 0);
});

test('a failed debit cancels the booking and releases the seat', async () => {
  const { deps, slots, canceled } = setup({ balance: 1, failDebit: true });
  assert.deepEqual(await bookSlot(deps, 'student', 'slot', 10), { ok: false, reason: 'credit-check-failed' });
  assert.deepEqual(canceled, ['booking-1']);
  assert.equal((await slots.getSlot('slot'))?.confirmedCount, 0);
});

test('a duplicate booking releases the seat it claimed', async () => {
  const { deps, slots } = setup({ balance: 1, existing: ['student:slot'] });
  assert.deepEqual(await bookSlot(deps, 'student', 'slot', 10), { ok: false, reason: 'already-booked' });
  assert.equal((await slots.getSlot('slot'))?.confirmedCount, 0);
});

test('retried debits are idempotent', async () => {
  const ledger = new InMemoryLedger();
  const credits = new LedgerCreditsAdapter({ getBalance: async () => 2 }, ledger);
  await credits.debitCredit('student', 10, 'booking-1');
  await credits.debitCredit('student', 10, 'booking-1');
  assert.equal(ledger.entries.length, 1);
  assert.equal((await credits.checkCredit('student', 10)).balance, 1);
});
