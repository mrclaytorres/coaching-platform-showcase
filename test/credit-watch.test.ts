import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCreditWatchReport, type StudentSnapshot, type UpstreamApi } from '../src/resilient-aggregation/credit-watch.ts';

const now = new Date('2026-01-10T12:00:00Z');

const snapshots: Record<number, StudentSnapshot> = {
  1: {
    studentId: 1,
    displayName: 'Student A',
    wallets: [{ lessonTypeId: 10, lessonTypeName: '1-on-1', balance: -2 }],
    sessions: [],
  },
  2: {
    studentId: 2,
    displayName: 'Student B',
    wallets: [{ lessonTypeId: 10, lessonTypeName: '1-on-1', balance: 0 }],
    sessions: [
      { id: 's-in-window', startsAt: '2026-01-12T12:00:00Z', lessonTypeId: 10, lessonTypeName: '1-on-1' },
      { id: 's-too-late', startsAt: '2026-03-01T12:00:00Z', lessonTypeId: 10, lessonTypeName: '1-on-1' },
    ],
  },
};

function api(aggregateWorks: boolean): UpstreamApi {
  return {
    async fetchCreditWatch() {
      if (!aggregateWorks) throw new Error('404 endpoint not found');
      return { generatedAt: now.toISOString(), negativeBalances: [], atRiskSessions: [] };
    },
    async fetchSnapshot(id) {
      const snapshot = snapshots[id];
      if (!snapshot) throw new Error('snapshot failed');
      return snapshot;
    },
  };
}

test('uses the aggregate endpoint when it works', async () => {
  const report = await getCreditWatchReport(api(true), [1, 2], 14, now);
  assert.equal(report.source, 'aggregate');
  assert.equal(report.uncheckedCount, 0);
});

test('falls back to per-student snapshots with the same shape', async () => {
  const report = await getCreditWatchReport(api(false), [1, 2], 14, now);
  assert.equal(report.source, 'fallback');
  assert.deepEqual(report.negativeBalances.map((n) => n.studentId), [1]);
  assert.deepEqual(report.atRiskSessions.map((s) => s.sessionId), ['s-in-window']);
  assert.equal(report.atRiskSessions[0]?.balanceAfterSession, -1);
});

test('one failing student is counted, not fatal', async () => {
  const report = await getCreditWatchReport(api(false), [1, 2, 999], 14, now);
  assert.equal(report.uncheckedCount, 1);
  assert.equal(report.negativeBalances.length, 1);
});
