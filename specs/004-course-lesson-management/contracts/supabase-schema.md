# Contract: Supabase Schema (runtime, per-student state)

Mirrors the RLS pattern established by `customer_profiles`/`staff_profiles` (`002-supabase-auth-user-data`, `003-roles-admin-staff`).

```sql
-- lesson_completions
create table lesson_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references customer_profiles(id),
  lesson_id text not null, -- Payload Lesson id
  completed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

alter table lesson_completions enable row level security;

create policy "students read own completions"
  on lesson_completions for select
  using (student_id in (select id from customer_profiles where supabase_user_id = auth.uid()));

create policy "students insert own completions"
  on lesson_completions for insert
  with check (student_id in (select id from customer_profiles where supabase_user_id = auth.uid()));

-- submissions
create table submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references customer_profiles(id),
  assignment_id text not null, -- Payload Assignment id
  video_url text,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  outcome text check (outcome in ('pass', 'fail')),
  feedback_video_url text,
  feedback_comment text,
  reviewed_by uuid references staff_profiles(id),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table submissions enable row level security;

create policy "students read own submissions"
  on submissions for select
  using (student_id in (select id from customer_profiles where supabase_user_id = auth.uid()));

create policy "students insert own submissions"
  on submissions for insert
  with check (student_id in (select id from customer_profiles where supabase_user_id = auth.uid()));

-- Coach/Staff read+update handled via SUPABASE_SERVICE_ROLE_KEY server actions (bypasses RLS),
-- same pattern as listStaffProfiles() in src/lib/auth/staff-profile.ts — no direct client access for staff.

-- quiz_responses
create table quiz_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id text not null, -- Payload QuizQuestion id
  answer_text text not null,
  is_correct boolean
);

alter table quiz_responses enable row level security;

create policy "students read own quiz responses"
  on quiz_responses for select
  using (submission_id in (
    select id from submissions where student_id in (
      select id from customer_profiles where supabase_user_id = auth.uid()
    )
  ));

create policy "students insert own quiz responses"
  on quiz_responses for insert
  with check (submission_id in (
    select id from submissions where student_id in (
      select id from customer_profiles where supabase_user_id = auth.uid()
    )
  ));

-- module_feedback
create table module_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references customer_profiles(id),
  module_id text not null, -- Payload CourseModule id
  coach_id uuid not null references staff_profiles(id),
  comment text,
  video_url text,
  created_at timestamptz not null default now()
);

alter table module_feedback enable row level security;

create policy "students read own module feedback"
  on module_feedback for select
  using (student_id in (select id from customer_profiles where supabase_user_id = auth.uid()));

-- writes by coaches go through SUPABASE_SERVICE_ROLE_KEY server actions, same as staff-profile writes

-- student_tier_progress (renamed from student_belt_progress — research.md #12)
-- No row for a given (student_id, course_owner_id) = Student not enrolled in that owner's Tier sequence =
-- zero access to any Sequential-Locked Course under that owner, including the entry Tier.
-- Row is only ever inserted at that owner's lowest Tier `order` by enrollStudentInTierSequence (FR-024) — no "rank 0" default.
create table student_tier_progress (
  student_id uuid not null references customer_profiles(id),
  course_owner_id text not null, -- placeholder scoping field (research.md #12); fixed to 'academy' today
  current_tier_rank integer not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, course_owner_id)
);

alter table student_tier_progress enable row level security;

create policy "students read own tier progress"
  on student_tier_progress for select
  using (student_id in (select id from customer_profiles where supabase_user_id = auth.uid()));

-- Row creation (enrollment, rank = owner's lowest Tier order) and advancement (rank increments) only via SUPABASE_SERVICE_ROLE_KEY:
-- - creation triggered by a Coach/Staff manual enrollStudentInTierSequence action (FR-024, FR-026)
-- - advancement triggered by a Coach marking a Sequential-Locked Course's final-assessment submission outcome = 'pass' (FR-021)

-- course_enrollments (NEW — Standalone Courses only; Sequential-Locked Courses use student_tier_progress instead)
create table course_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references customer_profiles(id),
  course_id text not null, -- Payload Course id, must be courseCategory = 'standalone'
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

alter table course_enrollments enable row level security;

create policy "students read own course enrollments"
  on course_enrollments for select
  using (student_id in (select id from customer_profiles where supabase_user_id = auth.uid()));

-- writes only via SUPABASE_SERVICE_ROLE_KEY, through enrollStudentInCourse (staff-role gated, FR-025, FR-026) —
-- not self-service, since it represents a fulfilled purchase
```

**Notes**:
- All Coach/Staff-side writes (reviewing submissions, leaving module feedback, advancing Tier rank) go through server actions using `SUPABASE_SERVICE_ROLE_KEY`, exactly like `inviteStaffMember`/`changeStaffRole` in `003-roles-admin-staff` — never exposed to the client, per the existing `import 'server-only'` convention in `src/lib/auth/*`.
- No student-facing `update`/`delete` policies are defined — students can create completions/submissions but not edit or remove them after the fact, keeping an honest history for Coach review.
- `student_tier_progress.current_tier_rank` has no fixed range check (unlike the old `student_belt_progress.current_belt_rank between 1 and 8`) since Tier count is now Coach-authored data per Course Owner, not a fixed 8-item enum (research.md #12).
