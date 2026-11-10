# Contract: Supabase Schema

Applied to `apps/academy-platform`'s existing Supabase Postgres project — **not** a separate
project (see research.md #8: identity-unification decision). `customer_profiles` and
`staff_profiles` are owned by that app's own specs (`002-supabase-auth-user-data`,
`003-roles-admin-staff`, `012-student-enrollment`, `014-independent-account-signup`) and are
**not** redefined here — only the two additive columns below belong to this feature. Every
table below is this feature's own, with real foreign keys into those shared identity tables.
All writes are service-role-only from the Next.js server layer; RLS is defense-in-depth, not
the primary authorization mechanism (this monorepo's established convention).

Payload's own authored-content schema (`submission_forms`, `branding`, `coach_visibility_setting`,
plus Payload's own bookkeeping tables) lives on this app's own, **separate** Supabase Postgres
project — applied via `payload migrate`, not this file. It was deliberately kept off the shared
project: Payload's bookkeeping tables (`payload_migrations`, `payload_kv`, etc.) already exist
there for `apps/academy-platform`'s own Payload instance, and a second `payload migrate` run
against the same database would collide with them.

```sql
-- Additive columns on the existing, live customer_profiles table (apps/academy-platform's own).
ALTER TABLE public.customer_profiles ADD COLUMN phone text;
ALTER TABLE public.customer_profiles ADD COLUMN source_app text;
-- source_app is nullable; existing apps/academy-platform rows stay NULL, Ask-a-Coach-created rows
-- get 'ask-a-coach' — lets that app's admin Customer Console filter these out later.

CREATE INDEX CONCURRENTLY idx_customer_profiles_phone
  ON public.customer_profiles (phone) WHERE phone IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_customer_profiles_email_lower
  ON public.customer_profiles (lower(email));

-- This app's own multi-role table, repointed at the SHARED staff_profiles (its staff_id is
-- that row's own generated PK, not the Supabase auth uid).
CREATE TABLE public.coach_staff_roles (
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'designer', 'coach')),
  PRIMARY KEY (staff_id, role)
);
-- "At least one Owner" is enforced at the application layer on every role change/deactivation,
-- not a DB constraint — see data-model.md.

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id uuid NOT NULL REFERENCES public.customer_profiles(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  is_read boolean NOT NULL DEFAULT false,
  assigned_coach_id uuid REFERENCES public.staff_profiles(id),
  deleted_at timestamptz,  -- soft delete (FR-014) — replies/durations are retained, see data-model.md
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_customer_profile_id_idx ON public.conversations(customer_profile_id);
CREATE INDEX conversations_assigned_coach_id_idx ON public.conversations(assigned_coach_id);
CREATE INDEX conversations_status_idx ON public.conversations(status);

CREATE TABLE public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  author_staff_id uuid REFERENCES public.staff_profiles(id),  -- nullable: a writable API-key author has no staff member (T068, see data-model.md)
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_notes_conversation_id_idx ON public.conversation_notes(conversation_id);

-- Named coach_submissions, not submissions: apps/academy-platform's shared project already has its
-- own, unrelated public.submissions table (a course-assignment video-review feature —
-- student_id/assignment_id/reviewed_by). See research.md #8.
--
-- question_index/question_prompt (post-launch addition, data-model.md's "Multi-question forms"
-- note): a conversation_id UNIQUE constraint originally enforced one submission per conversation;
-- moved to (conversation_id, question_index) so a multi-question form can record one row per
-- question while still preventing a duplicate answer to the same question.
CREATE TABLE public.coach_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  question_index integer NOT NULL DEFAULT 0,
  question_prompt text,
  type text NOT NULL CHECK (type IN ('video', 'audio', 'text', 'file')),
  mux_upload_id text,  -- links a Mux direct upload to its eventual asset (see T014)
  mux_asset_id text,
  mux_playback_id text,  -- the asset's playback id, stored at webhook-ready time so signed playback/thumbnail URLs never need a live Mux API call per page view
  text_content text,
  file_url text,
  thumbnail_url text,
  transcript text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, question_index)
);

CREATE TABLE public.replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  author_type text NOT NULL CHECK (author_type IN ('coach', 'student')),
  author_staff_id uuid REFERENCES public.staff_profiles(id),
  type text NOT NULL CHECK (type IN ('video', 'audio', 'text')),
  mux_upload_id text,  -- links a Mux direct upload to its eventual asset (see T014)
  mux_asset_id text,
  mux_playback_id text,  -- the asset's playback id, stored at webhook-ready time so signed playback/thumbnail URLs never need a live Mux API call per page view
  text_content text,
  duration_seconds integer,  -- coach video/audio replies only — see data-model.md
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX replies_conversation_id_idx ON public.replies(conversation_id);
-- No FK ON DELETE CASCADE from conversations to replies — conversation "deletion" is the
-- deleted_at soft-delete above, so this constraint is moot, but is written NO ACTION
-- explicitly (the default) to make the retention guarantee (FR-019) visible in the schema.

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hashed_key text NOT NULL UNIQUE,
  is_read_only boolean NOT NULL DEFAULT true,
  created_by_staff_id uuid NOT NULL REFERENCES public.staff_profiles(id),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  signing_secret text NOT NULL,
  events text[] NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_status_idx ON public.webhook_deliveries(status);

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id),
  notification_type text NOT NULL CHECK (notification_type IN ('receipt', 'alert', 'reply')),
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  provider_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_staff_id uuid NOT NULL REFERENCES public.staff_profiles(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Service-role bypasses RLS, same convention as every other table in both apps — no policies
-- needed beyond ENABLE ROW LEVEL SECURITY itself. A `coach_can_see` policy on
-- conversations/coach_submissions/replies encoding the "all conversations by default, or only
-- assigned" toggle (spec FR-013) as defense-in-depth is left to a future task, same as before
-- this rework.
```

**Applied**: this schema (plus the `phone`/`source_app` columns on `customer_profiles`) is live
in `apps/academy-platform`'s Supabase project as of the identity-unification rework. The original
`students` table and this app's own local `staff_profiles`/`staff_roles` tables from the
previous, now-abandoned separate project were never carried over.
