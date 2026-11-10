# Contract: Server Actions / Library Functions

## `src/lib/auth/customer-profile.ts` (MODIFIED)

```ts
// Conflict target changes from supabase_user_id to core_customer_id (research.md §2, data-model.md).
// Existing callers (login/page.tsx's linkAccount, dev seed-accounts.ts) are unaffected in their own
// inputs/outputs — only the underlying upsert behavior changes, so a pre-enrolled row (created by
// createPendingCustomerProfile below) is adopted in place instead of colliding on insert.
export async function upsertCustomerProfile(input: UpsertInput): Promise<UpsertResult>;

// NEW — inserts a real (non-dev, is_seeded: false) customer_profiles row with
// supabase_user_id: NULL, for a student who has never logged into the portal. Distinct from
// upsertCustomerProfile: no supabaseUserId input (there isn't one yet), and this always inserts
// (the caller — enrollment.ts — already checked getCustomerProfileByCoreId returned null first).
export async function createPendingCustomerProfile(input: {
  coreCustomerId: number;
  email: string;
  firstName: string;
}): Promise<{ id: string }>;
```

## `src/lib/progress/enrollment.ts` (MODIFIED)

```ts
export type EnrollResult =
  | { status: 'enrolled' }
  | { status: 'already_enrolled'; currentTierName?: string }
  | { status: 'would_downgrade'; currentTierName: string; requestedTierName: string }
  | { status: 'not_standalone'; tierName: string }
  | { status: 'customer_not_found' };

// MODIFIED — was (studentId: string, courseOwnerId?: string): Promise<void>.
// Now takes a Core customer id (not an already-known Supabase student id) and a starting Tier;
// resolves-or-creates the local customer_profiles row first (FR-009, data-model.md), then applies
// FR-004 (already_enrolled)/FR-005 (would_downgrade) before writing.
export async function enrollStudentInTierSequence(
  coreCustomerId: number,
  startingTierId: string, // Payload Tier id — its `order` becomes current_tier_rank on first enroll
  courseOwnerId?: string, // defaults to 'academy', unchanged
): Promise<EnrollResult>;

// MODIFIED — was (studentId: string, courseId: string): Promise<void>.
// Same Core-customer-id + resolve-or-create change as above; the existing courseCategory check
// becomes the not_standalone result instead of a thrown Error; the existing
// `.upsert(..., { ignoreDuplicates: true })` becomes an explicit already_enrolled check-then-insert.
export async function enrollStudentInCourse(
  coreCustomerId: number,
  courseId: string,
): Promise<EnrollResult>;

// NEW — read-only, backs Story 3 / FR-006's standalone-Course half of the status display.
export async function listCourseEnrollmentsForStudent(studentId: string): Promise<
  { courseId: string }[]
>;
```

Both `enrollStudentInTierSequence` and `enrollStudentInCourse` keep their existing `requireStaffRole(['super_admin', 'staff'])` gate (FR-008) — unchanged from today's implementation, just now the first line of a longer function.

## `src/app/staff/customers/[coreCustomerId]/page.tsx` (MODIFIED) — and `src/app/staff/credit-watch/[coreCustomerId]/page.tsx` (MODIFIED, same shape)

```ts
// New data fetched alongside the existing snapshot/adjustments/linkedProfile calls:
const [tiers, courses, tierProgress, courseEnrollments] = await Promise.all([
  listTiers(),                                              // existing, src/lib/courses/tier-actions.ts
  listCourses(),                                             // existing, src/lib/courses/course-queries.ts
  getStudentTierProgress(profileId, 'academy'),                 // existing — only if a local profile exists
  profileId ? listCourseEnrollmentsForStudent(profileId) : [], // new
]);

// New 'use server' actions, same file-local pattern as the existing submitAdjustmentAction:
async function submitTierEnrollAction(formData: FormData) {
  'use server';
  const tierId = String(formData.get('tierId'));
  const result = await enrollStudentInTierSequence(coreCustomerId, tierId);
  // result.status drives the redirect's ?success=/?error= message, same pattern as today
}

async function submitCourseEnrollAction(formData: FormData) {
  'use server';
  const courseId = String(formData.get('courseId'));
  const result = await enrollStudentInCourse(coreCustomerId, courseId);
}
```

`tierProgress`/`courseEnrollments` are only meaningful once a local `customer_profiles` row exists — for a customer with no row yet (`linkedProfile === null`, the page's existing `hasLinkedPortalAccount` check), both are empty/`null`, and `CustomerDetailPanel` renders the Enrollment section's status as "not enrolled" — enrolling for the first time is what creates that row (FR-009), not a prerequisite for reaching this page.

## `src/components/customers/CustomerDetailPanel.tsx` (MODIFIED)

```ts
interface CustomerDetailPanelProps {
  snapshot: Snapshot;
  adjustments: CreditAdjustment[];
  hasLinkedPortalAccount: boolean;
  submitAdjustmentAction: (formData: FormData) => Promise<void>;
  // NEW:
  tiers: TierSummary[];
  courses: CourseSummary[];
  tierProgress: { currentTierRank: number } | null;
  courseEnrollments: { courseId: string }[];
  submitTierEnrollAction: (formData: FormData) => Promise<void>;
  submitCourseEnrollAction: (formData: FormData) => Promise<void>;
}
```

New "Enrollment" section, placed after "Record a credit adjustment" (same visual pattern: a status sub-block, then two small forms, each a `<select>` + `SubmitButton`, mirroring the existing adjustment form's markup):
- Status: current Tier name (or "Not enrolled in a Tier sequence") + list of enrolled standalone Course titles (or "No standalone Course enrollments").
- Form 1: `<select name="tierId">` listing `tiers` by name (ordered), submits to `submitTierEnrollAction`.
- Form 2: `<select name="courseId">` listing only `courses.filter(c => c.courseCategory === 'standalone')`, submits to `submitCourseEnrollAction`.
