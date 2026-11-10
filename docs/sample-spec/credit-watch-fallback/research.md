# Research: Credit Watch Data Fallback (Interim)

Decisions made during planning, with the reasoning and the alternatives that were rejected.

## 1. Reviving a previously rejected approach

The original Credit Watch spec rejected building on a per-student loop for three reasons: it only
covers students known to the platform, it doesn't scale to every customer, and it has no renewal
data. This feature brings the loop back on purpose, as a **labeled, interim fallback**:

- **Coverage gap:** shown to staff in a banner (FR-004) instead of hidden.
- **Scale:** doesn't apply yet, because the known-student pool is small.
- **Renewal data:** the false claim is removed instead of worked around. Rows say "renewal info
  not available."

## 2. Where the known-student pool comes from

**Decision:** every row in the local customer profiles table (portal sign-ups and seeded
accounts).

**Rejected:**
- *Include students staff have looked up ad hoc.* Those lookups aren't stored, so including them
  would need a new tracking mechanism. That's too much for a temporary feature.
- *A staff-curated watchlist.* That's extra product surface for something meant to be deleted.

## 3. Fetch strategy

**Decision:** fan out one request per student with `Promise.allSettled`, so a single failure is
counted instead of failing the batch. No concurrency limiter.

**Rejected:** a concurrency cap. It's unnecessary at the current scale, and the need is noted in
the spec's Assumptions in case the pool grows.

## 4. Response shape

**Decision:** return exactly the aggregate endpoint's response shape, plus two fields:
`source: 'fallback'` and `uncheckedCount`. The page keeps one rendering path and only branches
on `source` for the banner, the estimate badges and the renewal wording.

**Rejected:** a separate fallback-only page. It would duplicate the tables and drift from the
main path over time.

## 5. Session cost

**Decision:** assume 1 credit per session, confirmed with the stakeholder during clarification.
A row is at risk when `balance - 1 < 0`, and every such row is labeled "Estimate."

**Why:** the per-student data has no cost field. One credit is the simplest conservative
default, and the label keeps staff from treating it as exact.

## 6. Switching back

**Decision:** no state to manage. The page always tries the aggregate call first, and the
fallback only runs in its `catch`. When the real endpoint starts responding, the page switches
back on its own (FR-006) with no extra code.
