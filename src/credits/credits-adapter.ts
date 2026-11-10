// Swappable credits adapter. The system of record for credit balances is an upstream API with
// no write endpoint yet. Until one ships, this adapter enforces credits against a local ledger
// laid on top of the upstream's last-known balance:
//
//   effective balance = upstream balance + sum(local ledger entries)
//
// When the upstream write endpoint ships, a new adapter implements the same interface and the
// booking flow does not change.

export interface CreditsAdapter {
  checkCredit(studentId: string, lessonTypeId: number): Promise<{ available: boolean; balance: number }>;
  debitCredit(studentId: string, lessonTypeId: number, bookingId: string): Promise<void>;
  refundCredit(studentId: string, lessonTypeId: number, bookingId: string): Promise<void>;
}

export interface LedgerEntry {
  bookingId: string;
  studentId: string;
  lessonTypeId: number;
  type: 'debit' | 'refund';
  amount: number;
}

export class DuplicateEntryError extends Error {
  constructor() {
    super('Ledger entry already exists for this booking and type');
    this.name = 'DuplicateEntryError';
  }
}

export interface Ledger {
  // Must reject a second entry with the same (bookingId, type) by throwing DuplicateEntryError.
  // In Postgres this is a UNIQUE constraint, and error code 23505 maps to it.
  insert(entry: LedgerEntry): Promise<void>;
  entriesFor(studentId: string, lessonTypeId: number): Promise<LedgerEntry[]>;
}

export interface UpstreamBalances {
  getBalance(studentId: string, lessonTypeId: number): Promise<number>;
}

export class LedgerCreditsAdapter implements CreditsAdapter {
  private readonly upstream: UpstreamBalances;
  private readonly ledger: Ledger;

  constructor(upstream: UpstreamBalances, ledger: Ledger) {
    this.upstream = upstream;
    this.ledger = ledger;
  }

  async checkCredit(studentId: string, lessonTypeId: number) {
    const upstreamBalance = await this.upstream.getBalance(studentId, lessonTypeId);
    const entries = await this.ledger.entriesFor(studentId, lessonTypeId);
    const adjustment = entries.reduce(
      (total, e) => total + (e.type === 'debit' ? -Math.abs(e.amount) : Math.abs(e.amount)),
      0,
    );
    const balance = upstreamBalance + adjustment;
    return { available: balance >= 1, balance };
  }

  async debitCredit(studentId: string, lessonTypeId: number, bookingId: string) {
    await this.insertIdempotent({ bookingId, studentId, lessonTypeId, type: 'debit', amount: -1 });
  }

  async refundCredit(studentId: string, lessonTypeId: number, bookingId: string) {
    await this.insertIdempotent({ bookingId, studentId, lessonTypeId, type: 'refund', amount: 1 });
  }

  // The unique constraint is the idempotency guard: a duplicate means a retried call already
  // succeeded once, so treat it as success instead of an error.
  private async insertIdempotent(entry: LedgerEntry) {
    try {
      await this.ledger.insert(entry);
    } catch (error) {
      if (!(error instanceof DuplicateEntryError)) throw error;
    }
  }
}

export class InMemoryLedger implements Ledger {
  readonly entries: LedgerEntry[] = [];

  async insert(entry: LedgerEntry) {
    if (this.entries.some((e) => e.bookingId === entry.bookingId && e.type === entry.type)) {
      throw new DuplicateEntryError();
    }
    this.entries.push(entry);
  }

  async entriesFor(studentId: string, lessonTypeId: number) {
    return this.entries.filter((e) => e.studentId === studentId && e.lessonTypeId === lessonTypeId);
  }
}
