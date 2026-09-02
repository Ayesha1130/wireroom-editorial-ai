-- Wireroom dispatch storage.
--
-- Security model:
--   * With Supabase Auth configured, every dispatch is owned by auth.users.id.
--   * The Next.js server verifies the Supabase access token before reading/writing dispatches.
--   * The service-role key is server-only and every query still filters by user_id.
--   * The session_id column remains as a local/demo fallback when Auth is not configured.
--   * RLS is enabled as defense in depth; this app does not expose the table directly to clients.

create table if not exists dispatches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  user_id uuid references auth.users(id),
  topic text not null,
  status text not null check (status in ('waiting_for_approval', 'published', 'failed')),
  final_title text,
  final_body text,
  seo_description text,
  seo_keywords text[],
  sources jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table dispatches add column if not exists user_id uuid references auth.users(id);
alter table dispatches alter column session_id drop not null;

create index if not exists dispatches_session_id_idx on dispatches (session_id);
create index if not exists dispatches_user_id_idx on dispatches (user_id);

alter table dispatches enable row level security;

-- Authenticated direct access is intentionally disabled: the Next.js server owns all dispatch reads/writes and enforces user_id.
-- No policy is created for the anon or authenticated role. With RLS
-- enabled and zero policies, PostgREST/Supabase's anon and authenticated
-- roles can read or write NOTHING in this table — only the service role
-- (used exclusively server-side) can touch it. This is intentional.

-- Direct client access is intentionally not enabled. The server owns the
-- service-role boundary and verifies the user's bearer token before every
-- dispatch read/write.
