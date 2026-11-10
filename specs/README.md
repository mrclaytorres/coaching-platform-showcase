# Feature Specs

These are the planning documents for every feature in the platform, produced through the
[spec-driven workflow](../docs/agentic-workflow.md) and kept with their original numbering.
Each folder holds some or all of: `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`, `tasks.md`, and `checklists/`.

**Sanitized.** Client, people and customer details have been replaced:

| In these docs | Stands for |
|---|---|
| **Academy** | The client (an online coaching academy) |
| **Core** | The legacy Django REST API that is the system of record for customers, credits and sessions |
| **CourseHost** | The third-party course platform the academy used before this one |
| `core.example.com`, `example.com` | Real hostnames and email domains |
| `10001`–`10004`, "Student A", "Coach One", ... | Real customer IDs and names |

File paths (`src/...`, `apps/...`) refer to the private production codebase, not this repo.
Numbers 007 and 010 were shipped without a separate spec folder.

| # | Feature |
|---|---|
| [001](001-customer-recording-library/) | Customer Recording Library |
| [002](002-supabase-auth-user-data/) | Supabase Auth, Customer Profile Sync, and Content Management Foundation |
| [003](003-roles-admin-staff/) | Role-Based Access Control: Super Admin, Coach, and Staff |
| [004](004-course-lesson-management/) | Course & Lesson Curriculum Management |
| [005](005-customer-data-integration/) | Dev/Demo Student Account Seeding & Normalized Account Display |
| [006](006-course-sales-payments/) | Course Sales Pages & Direct Payment Enrollment |
| [008](008-staff-credit-watch/) | Staff Credit Watch Dashboard |
| [009](009-admin-customer-console/) | Admin Customer Console |
| [011](011-credit-watch-fallback/) | Credit Watch Data Fallback (Interim) |
| [012](012-student-enrollment/) | Staff-Driven Student Enrollment |
| [013](013-coach-session-booking/) | Coach Session Booking |
| [014](014-independent-account-signup/) | Independent Account Signup |
| [015](015-expanded-payments/) | Multi-Product Payments: Tiers, Lessons & Subscriptions |
| [016](016-ask-a-coach/) | Ask a Coach (VideoAsk Replacement) |
| [017](017-live-coaching/) | Live Coaching (Calendly Replacement) |
| [018](018-admin-dashboard-redesign/) | Admin Dashboard Redesign |
| [019](019-booking-ui-redesign/) | Booking UI Redesign |
| [020](020-courses-credit-customers-ui/) | Courses, Credit Watch & Customers UI Redesign |
| [021](021-staff-students-submissions-tiers-ui/) | Staff Dashboard, Staff, Students, Submissions & Tiers UI Redesign |
