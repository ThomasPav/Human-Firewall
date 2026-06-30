-- Human Firewall — Live Compete (Mentimeter-style) realtime backend.
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- Anonymous by design: we store only an opaque player id + a random alias + score.
-- No names, emails, or PII.

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  status           text not null default 'lobby'
                     check (status in ('lobby','playing','revealed','ended')),
  current_incident int  not null default 0,
  deck             jsonb not null,                 -- ordered scenario ids for the round
  created_at       timestamptz not null default now()
);

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  alias      text not null,                        -- anonymous display name only
  score      int  not null default 0,
  total_ms   int  not null default 0,              -- cumulative response time (tie-break)
  joined_at  timestamptz not null default now()
);
create index if not exists players_session_idx on public.players(session_id);

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  incident    int  not null,
  player_id   uuid not null references public.players(id) on delete cascade,
  decision    text not null,
  answered_at timestamptz not null default now(),
  unique (session_id, incident, player_id)         -- one vote per player per incident
);
create index if not exists votes_session_incident_idx on public.votes(session_id, incident);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- The app uses the anon key with no per-user auth, so policies are permissive:
-- anyone with the join code can read the session and add players/votes. This is
-- appropriate for a trusted workshop/classroom. To harden (prevent a player from
-- editing the session or another player's score), switch to Supabase anonymous
-- auth with owner-scoped policies, or route host actions through an Edge Function.
alter table public.sessions enable row level security;
alter table public.players  enable row level security;
alter table public.votes    enable row level security;

create policy "sessions read"   on public.sessions for select using (true);
create policy "sessions insert" on public.sessions for insert with check (true);
create policy "sessions update" on public.sessions for update using (true) with check (true);

create policy "players read"   on public.players for select using (true);
create policy "players insert" on public.players for insert with check (true);
create policy "players update" on public.players for update using (true) with check (true);

create policy "votes read"   on public.votes for select using (true);
create policy "votes insert" on public.votes for insert with check (true);

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Let clients subscribe to row changes (lobby count, live tally, status changes).
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.votes;
