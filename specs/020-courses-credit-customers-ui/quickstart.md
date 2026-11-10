# Quickstart: Courses, Credit Watch & Customers UI Redesign

**Branch**: `020-courses-credit-customers-ui` | **Spec**: [spec.md](./spec.md) | **Data shapes**: [data-model.md](./data-model.md)

Manual end-to-end validation — no automated test framework exists in this repo. Run as a Super
Admin against a dev/staging environment with at least one for-sale course, one not-for-sale
course, one student with a negative balance, one with a low (0-1) balance, one declined purchase,
and one linked customer account.

## Scenario 1 — Courses page (Story 1)

1. Load `/staff/courses`.
2. **Expected**: large "Courses" title, subtitle, "New Course" button, card-wrapped table; a
   for-sale course shows its real price, a not-for-sale one shows "Not for sale."
3. Click "Unpublish" on a published course, then "Publish" on it again.
4. **Expected**: the row's status and action label update correctly both times, matching
   `updateCourse`'s real result.
5. Reload as a Coach.
6. **Expected**: "New Course" button is hidden, matching today's existing restriction.

## Scenario 2 — New Course page (Story 2)

1. Load `/staff/courses/new`.
2. **Expected**: "Courses > New Course" breadcrumb, large title, the same four fields as today.
3. Create a course.
4. **Expected**: succeeds exactly as it does today, redirecting to the new course's edit page.

## Scenario 3 — Credit Watch page (Story 3)

1. Load `/staff/credit-watch`.
2. **Expected**: four stat cards (Negative Balance, Low Balance, Cards Expiring, Failed
   Payments); Cards Expiring always shows 0.
3. Click each filter tab.
4. **Expected**: the table narrows to that category only; "All Alerts" shows everything together.
5. Click "Add Credit" on a Negative or Low Balance row.
6. **Expected**: lands on that student's `/staff/credit-watch/{id}` page, with the real
   adjustment form.
7. Click "Retry Charge" on a Failed Payment row.
8. **Expected**: lands on `/staff/purchases` — no automatic retry happens.
9. Filter to a category with zero matches.
10. **Expected**: a clear empty state, not a blank table.
11. Scroll below the four alert categories.
12. **Expected**: the existing "Upcoming sessions at risk" table and its 7/14/30/60-day
    lookahead selector still render, unchanged (FR-015a).

## Scenario 4 — Customers page (Story 4)

1. Load `/staff/customers`.
2. **Expected**: title, existing subtitle, two side-by-side lookup cards, a "Recent Lookups"
   table of real linked accounts.
3. Use both lookup forms (CourseHost/Core ID, email/name search).
4. **Expected**: both work exactly as they do today.
5. Click "Open" on a Recent Lookups row.
6. **Expected**: opens that customer's real record page.
