// Resilient aggregation: prefer one aggregate call to an upstream API, and when that endpoint
// is missing or failing, rebuild the same response from a per-student endpoint that is known
// to work. The fallback returns the exact same shape plus a `source` marker, so callers render
// one code path and the UI can label the result as partial data.

export interface Wallet {
  lessonTypeId: number;
  lessonTypeName: string;
  balance: number;
}

export interface UpcomingSession {
  id: string;
  startsAt: string;
  lessonTypeId: number;
  lessonTypeName: string;
}

export interface StudentSnapshot {
  studentId: number;
  displayName: string;
  wallets: Wallet[];
  sessions: UpcomingSession[];
}

export interface NegativeBalance {
  studentId: number;
  displayName: string;
  lessonTypeName: string;
  balance: number;
}

export interface AtRiskSession {
  sessionId: string;
  studentId: number;
  displayName: string;
  startsAt: string;
  lessonTypeName: string;
  currentBalance: number;
  balanceAfterSession: number;
}

export interface CreditWatchReport {
  generatedAt: string;
  negativeBalances: NegativeBalance[];
  atRiskSessions: AtRiskSession[];
  source: 'aggregate' | 'fallback';
  // Students whose snapshot request failed during a fallback build. Always 0 for 'aggregate'.
  uncheckedCount: number;
}

export interface UpstreamApi {
  fetchCreditWatch(lookAheadDays: number): Promise<Omit<CreditWatchReport, 'source' | 'uncheckedCount'>>;
  fetchSnapshot(studentId: number): Promise<StudentSnapshot>;
}

// The upstream API does not report per-session cost, so the fallback assumes one credit and
// the UI marks every at-risk row it produces as an estimate.
const ASSUMED_CREDITS_PER_SESSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getCreditWatchReport(
  api: UpstreamApi,
  knownStudentIds: number[],
  lookAheadDays: number,
  now: Date = new Date(),
): Promise<CreditWatchReport> {
  try {
    const report = await api.fetchCreditWatch(lookAheadDays);
    return { ...report, source: 'aggregate', uncheckedCount: 0 };
  } catch {
    return buildFallbackReport(api, knownStudentIds, lookAheadDays, now);
  }
}

export async function buildFallbackReport(
  api: UpstreamApi,
  knownStudentIds: number[],
  lookAheadDays: number,
  now: Date,
): Promise<CreditWatchReport> {
  // allSettled, not all: one bad student record must not take down the whole page.
  const results = await Promise.allSettled(knownStudentIds.map((id) => api.fetchSnapshot(id)));
  const windowEnd = new Date(now.getTime() + lookAheadDays * DAY_MS);

  const negativeBalances: NegativeBalance[] = [];
  const atRiskSessions: AtRiskSession[] = [];
  let uncheckedCount = 0;

  for (const result of results) {
    if (result.status === 'rejected') {
      uncheckedCount += 1;
      continue;
    }
    negativeBalances.push(...findNegativeBalances(result.value));
    atRiskSessions.push(...findAtRiskSessions(result.value, now, windowEnd));
  }

  return {
    generatedAt: now.toISOString(),
    negativeBalances,
    atRiskSessions,
    source: 'fallback',
    uncheckedCount,
  };
}

function findNegativeBalances(snapshot: StudentSnapshot): NegativeBalance[] {
  return snapshot.wallets
    .filter((wallet) => wallet.balance < 0)
    .map((wallet) => ({
      studentId: snapshot.studentId,
      displayName: snapshot.displayName,
      lessonTypeName: wallet.lessonTypeName,
      balance: wallet.balance,
    }));
}

function findAtRiskSessions(snapshot: StudentSnapshot, now: Date, windowEnd: Date): AtRiskSession[] {
  const rows: AtRiskSession[] = [];

  for (const session of snapshot.sessions) {
    const startsAt = new Date(session.startsAt);
    if (startsAt < now || startsAt > windowEnd) continue;

    const wallet = snapshot.wallets.find((w) => w.lessonTypeId === session.lessonTypeId);
    const currentBalance = wallet?.balance ?? 0;
    const balanceAfterSession = currentBalance - ASSUMED_CREDITS_PER_SESSION;
    if (balanceAfterSession >= 0) continue;

    rows.push({
      sessionId: session.id,
      studentId: snapshot.studentId,
      displayName: snapshot.displayName,
      startsAt: session.startsAt,
      lessonTypeName: session.lessonTypeName,
      currentBalance,
      balanceAfterSession,
    });
  }

  return rows;
}
